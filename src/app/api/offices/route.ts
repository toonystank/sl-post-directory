import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

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

        const conditions: Prisma.PostOfficeWhereInput[] = [];

        // Service filter
        if (service) {
            conditions.push({ services: { has: service } });
        }

        // Letter filter: offices starting with a specific letter
        if (letter) {
            conditions.push({ name: { startsWith: letter, mode: "insensitive" as const } });
        }

        // Search query
        if (query) {
            const orConditions: Prisma.PostOfficeWhereInput[] = [];

            if (mode === "division") {
                // Division mode: search only in Division field
                orConditions.push({
                    fields: {
                        some: {
                            name: "Division",
                            value: { contains: query, mode: "insensitive" as const },
                        },
                    },
                });
            } else {
                // Name mode (default): search name, postal code, short code
                const cleanQuery = query
                    .replace(/\b(post\s*office|main|branch|sub)\b/gi, "")
                    .trim();

                const primaryTerm = cleanQuery || query.trim();
                const terms = [primaryTerm];
                if (cleanQuery && cleanQuery !== query.trim()) {
                    terms.push(query.trim());
                }

                // 1) Find fuzzy matched IDs using pg_trgm similarity
                try {
                    const matchedOffices = await prisma.$queryRaw<{ id: string }[]>`
                        SELECT id FROM "PostOffice"
                        WHERE similarity(name, ${primaryTerm}) > 0.15
                           OR name ILIKE ${primaryTerm + '%'}
                    `;
                    const matchedIds = matchedOffices.map(o => o.id);
                    
                    if (matchedIds.length > 0) {
                        orConditions.push({ id: { in: matchedIds } });
                    }
                } catch (e) {
                    console.error("Fuzzy search error:", e);
                }

                for (const term of terms) {
                    orConditions.push({ name: { startsWith: term, mode: "insensitive" as const } });
                    orConditions.push({ name: { contains: term, mode: "insensitive" as const } });
                    orConditions.push({ postalCode: { contains: term, mode: "insensitive" as const } });
                    // Short code / Code field
                    orConditions.push({
                        fields: {
                            some: {
                                name: "Code",
                                value: { contains: term, mode: "insensitive" as const },
                            },
                        },
                    });
                }
            }

            conditions.push({ OR: orConditions });
        }

        const where = conditions.length > 0 ? { AND: conditions } : {};

        const [offices, total] = await Promise.all([
            prisma.postOffice.findMany({
                where,
                skip: cursor,
                take: limit,
                orderBy: { name: "asc" },
                select: {
                    id: true,
                    name: true,
                    postalCode: true,
                    services: true,
                    fields: {
                        where: {
                            name: { in: ["Type", "Phone", "Division", "Delivery"] },
                        },
                        select: { name: true, value: true },
                    },
                },
            }),
            prisma.postOffice.count({ where }),
        ]);

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
