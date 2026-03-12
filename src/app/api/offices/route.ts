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

        // Map to store similarity scores for tie-breaking ranked results
        let simMap = new Map<string, number>();

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
                    const matchedOffices = await prisma.$queryRaw<{ id: string, sim: number }[]>`
                        SELECT id, similarity(name, ${primaryTerm}) as sim FROM "PostOffice"
                        WHERE similarity(name, ${primaryTerm}) > 0.15
                           OR name ILIKE ${primaryTerm + '%'}
                    `;
                    const matchedIds = matchedOffices.map(o => {
                        simMap.set(o.id, o.sim);
                        return o.id;
                    });
                    
                    if (matchedIds.length > 0) {
                        orConditions.push({ id: { in: matchedIds } });
                    }
                } catch (e) {
                    console.error("Fuzzy search error:", e);
                }

                // Add to where clause...

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

        let offices = [];
        let total = 0;

        // If performing a text query, we fetch all matches to rank them properly in memory
        if (query) {
            const allOffices = await prisma.postOffice.findMany({
                where,
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
            });

            const qLower = query.toLowerCase();
            const cleanQuery = query.replace(/\b(post\s*office|main|branch|sub)\b/gi, "").trim().toLowerCase();
            const primaryTerm = cleanQuery || qLower;

            allOffices.sort((a, b) => {
                const aName = a.name.toLowerCase();
                const bName = b.name.toLowerCase();

                const getRank = (name: string) => {
                    if (name === primaryTerm) return 0; // Exact match 
                    if (name.startsWith(primaryTerm)) return 1; // Prefix match
                    if (name.includes(primaryTerm)) return 2; // Contains match
                    return 3; // Fuzzy or field match
                };

                const rankA = getRank(aName);
                const rankB = getRank(bName);

                if (rankA !== rankB) {
                    return rankA - rankB;
                }

                // If tied (especially rank 3), use similarity score if available
                if (mode === "name") {
                    const simA = simMap?.get(a.id) || 0;
                    const simB = simMap?.get(b.id) || 0;
                    if (simA !== simB) {
                        return simB - simA; // High similarity first
                    }
                }

                return a.name.localeCompare(b.name);
            });

            total = allOffices.length;
            offices = allOffices.slice(cursor, cursor + limit);
        } else {
            // Standard db-level pagination for no-query (browsing)
            const [fetchedOffices, count] = await Promise.all([
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
