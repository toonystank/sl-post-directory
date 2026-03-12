import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const q = searchParams.get("q")?.trim();
        const mode = searchParams.get("mode") || "name"; // "name" | "division"

        // If no query string, simply return empty to avoid full table scans
        if (!q || q.length === 0) {
            return NextResponse.json(
                { suggestions: [] },
                {
                    status: 200,
                    headers: {
                        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
                    },
                }
            );
        }

        let suggestions: string[] = [];

        if (mode === "name") {
            // Find post offices using tiered matching (pg_trgm)
            const offices = await prisma.$queryRaw<{ name: string }[]>`
                SELECT name FROM (
                    SELECT DISTINCT name, similarity(name, ${q}) as sim
                    FROM "PostOffice"
                    WHERE name ILIKE ${q + '%'} OR similarity(name, ${q}) > 0.15
                ) as subquery
                ORDER BY
                  CASE
                    WHEN LOWER(name) = LOWER(${q}) THEN 0
                    WHEN name ILIKE ${q + '%'} THEN 1
                    ELSE 2
                  END,
                  sim DESC, name ASC
                LIMIT 5;
            `;
            suggestions = offices.map((o) => o.name);
        } else if (mode === "division") {
            // Find distinct area names (Division fields) starting with 'q'
            const fields = await prisma.postOfficeField.findMany({
                where: {
                    name: "Division",
                    value: {
                        startsWith: q,
                        mode: "insensitive",
                    },
                },
                distinct: ["value"],
                take: 5,
                select: {
                    value: true,
                },
                orderBy: {
                    value: "asc",
                },
            });
            suggestions = fields.map((f) => f.value);
        }

        return NextResponse.json(
            { suggestions },
            {
                status: 200,
                headers: {
                    // Cache generously for 24 hours at the Edge (CDN) level
                    // so repeated keystrokes from any user resolve instantly and save DB hits.
                    "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
                },
            }
        );
    } catch (error) {
        console.error("Error in /api/autocomplete:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
