import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const FIELD_SELECT = {
    where: {
        name: { in: ["Type", "Phone", "Division", "Delivery", "Is24Hour", "Working Hours"] },
    },
    select: { name: true, value: true },
};

const OFFICE_SELECT = {
    id: true,
    name: true,
    postalCode: true,
    services: true,
    fields: FIELD_SELECT,
};

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const query = searchParams.get("q") || "";
        const letter = searchParams.get("letter") || "";
        const mode = searchParams.get("mode") || "name"; // "name" | "division"
        const service = searchParams.get("service") || "";

        let cursor = parseInt(searchParams.get("cursor") || "0");
        if (isNaN(cursor)) cursor = 0;

        let limit = parseInt(searchParams.get("limit") || "12");
        if (isNaN(limit)) limit = 12;
        limit = Math.min(Math.max(limit, 1), 100); // Clamp between 1 and 100

        let offices = [];
        let total = 0;

        if (query && mode === "name") {
            // === SQL-level ranked search with pagination ===
            const cleanQuery = query
                .replace(/\b(post\s*office|main|branch|sub)\b/gi, "")
                .trim();
            const primaryTerm = cleanQuery || query.trim();

            // Build WHERE clause fragments for letter and service filters
            const whereClauses: string[] = [
                `(similarity(p.name, $1) > 0.15 OR p.name ILIKE $1 || '%' OR p.name ILIKE '%' || $1 || '%' OR p."postalCode" ILIKE '%' || $1 || '%')`,
            ];
            const countWhereClauses: string[] = [...whereClauses];
            // $1 = primaryTerm, $2 = limit, $3 = cursor
            // Additional params start from $4
            let paramIndex = 4;
            const extraParams: any[] = [];

            if (letter) {
                whereClauses.push(`p.name ILIKE $${paramIndex} || '%'`);
                countWhereClauses.push(`p.name ILIKE $${paramIndex} || '%'`);
                extraParams.push(letter);
                paramIndex++;
            }

            if (service) {
                whereClauses.push(`$${paramIndex} = ANY(p.services)`);
                countWhereClauses.push(`$${paramIndex} = ANY(p.services)`);
                extraParams.push(service);
                paramIndex++;
            }

            const whereSQL = whereClauses.join(" AND ");
            const countWhereSQL = countWhereClauses.join(" AND ");

            // Ranked query with pagination at the SQL level
            const rankedQuery = `
                SELECT p.id, similarity(p.name, $1) as sim,
                    CASE
                        WHEN LOWER(p.name) = LOWER($1) THEN 0
                        WHEN LOWER(p.name) LIKE LOWER($1) || '%' THEN 1
                        WHEN LOWER(p.name) LIKE '%' || LOWER($1) || '%' THEN 2
                        ELSE 3
                    END as rank
                FROM "PostOffice" p
                WHERE ${whereSQL}
                ORDER BY rank ASC, sim DESC, p.name ASC
                LIMIT $2 OFFSET $3
            `;

            const countQuery = `
                SELECT COUNT(*)::int as total
                FROM "PostOffice" p
                WHERE ${countWhereSQL}
            `;

            try {
                const allParams = [primaryTerm, limit, cursor, ...extraParams];

                const [rankedResults, countResult] = await Promise.all([
                    prisma.$queryRawUnsafe<{ id: string; sim: number; rank: number }[]>(
                        rankedQuery, ...allParams
                    ),
                    prisma.$queryRawUnsafe<{ total: number }[]>(
                        countQuery, primaryTerm, ...extraParams
                    ),
                ]);

                total = countResult[0]?.total || 0;

                if (rankedResults.length > 0) {
                    const orderedIds = rankedResults.map(r => r.id);

                    const fetchedOffices = await prisma.postOffice.findMany({
                        where: { id: { in: orderedIds } },
                        select: OFFICE_SELECT,
                    });

                    // Preserve the SQL ranking order
                    const officeMap = new Map(fetchedOffices.map(o => [o.id, o]));
                    offices = orderedIds.map(id => officeMap.get(id)).filter(Boolean);
                }
            } catch (e) {
                console.error("Ranked search error, falling back:", e);
                // Fallback to simple Prisma query
                const conditions: Prisma.PostOfficeWhereInput[] = [
                    { name: { contains: query, mode: "insensitive" as const } },
                ];
                if (letter) conditions.push({ name: { startsWith: letter, mode: "insensitive" as const } });
                if (service) conditions.push({ services: { has: service } });

                const where = { AND: conditions };
                const [fallbackOffices, fallbackCount] = await Promise.all([
                    prisma.postOffice.findMany({ where, skip: cursor, take: limit, orderBy: { name: "asc" }, select: OFFICE_SELECT }),
                    prisma.postOffice.count({ where }),
                ]);
                offices = fallbackOffices;
                total = fallbackCount;
            }
        } else if (query && mode === "division") {
            // Division mode: search in Division field with proper pagination
            const conditions: Prisma.PostOfficeWhereInput[] = [
                {
                    fields: {
                        some: {
                            name: "Division",
                            value: { contains: query, mode: "insensitive" as const },
                        },
                    },
                },
            ];
            if (letter) conditions.push({ name: { startsWith: letter, mode: "insensitive" as const } });
            if (service) conditions.push({ services: { has: service } });

            const where = { AND: conditions };
            const [fetchedOffices, count] = await Promise.all([
                prisma.postOffice.findMany({
                    where,
                    skip: cursor,
                    take: limit,
                    orderBy: { name: "asc" },
                    select: OFFICE_SELECT,
                }),
                prisma.postOffice.count({ where }),
            ]);
            offices = fetchedOffices;
            total = count;
        } else {
            // No search query — standard browsing with db-level pagination
            const conditions: Prisma.PostOfficeWhereInput[] = [];
            if (letter) conditions.push({ name: { startsWith: letter, mode: "insensitive" as const } });
            if (service) conditions.push({ services: { has: service } });

            const where = conditions.length > 0 ? { AND: conditions } : {};

            const [fetchedOffices, count] = await Promise.all([
                prisma.postOffice.findMany({
                    where,
                    skip: cursor,
                    take: limit,
                    orderBy: { name: "asc" },
                    select: OFFICE_SELECT,
                }),
                prisma.postOffice.count({ where }),
            ]);
            offices = fetchedOffices;
            total = count;
        }

        const nextCursor = cursor + limit < total ? cursor + limit : null;

        return NextResponse.json(
            { offices, total, nextCursor },
            {
                status: 200,
                headers: {
                    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
                },
            }
        );
    } catch (error) {
        console.error("Error in /api/offices:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
