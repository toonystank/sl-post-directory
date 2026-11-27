import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { autocompleteLocalOffices } from "@/lib/local-sqlite";
import { escapeSqlLike } from "@/lib/security";
import { normalizePostalCode } from "@/lib/site";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const q = (searchParams.get("q")?.trim() || "").slice(0, 100);
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

    if (!hasDatabaseUrl) {
        return NextResponse.json(
            { suggestions: autocompleteLocalOffices(q, mode) },
            {
                status: 200,
                headers: {
                    "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
                },
            }
        );
    }

    try {
        let suggestions: string[] = [];

        if (mode === "name" || mode === "all") {
            const isNumeric = /^\d+$/.test(q);
            const strippedDigits = isNumeric ? q.replace(/^0+/, "") || q : q;
            const escapedPrefix = escapeSqlLike(q) + "%";
            // Find post offices using tiered matching (pg_trgm) + zero-padded postalCode prefix
            const offices = await prisma.$queryRaw<{ name: string; postalCode: string }[]>`
                SELECT name, "postalCode" FROM (
                    SELECT DISTINCT name, "postalCode", similarity(name, ${q}) as sim
                    FROM "PostOffice"
                    WHERE name ILIKE ${escapedPrefix} ESCAPE '\'
                       OR "postalCode" ILIKE ${escapedPrefix} ESCAPE '\'
                       OR ("postalCode" ~ '^[0-9]+$' AND LPAD("postalCode", 5, '0') ILIKE ${escapedPrefix} ESCAPE '\')
                       OR "postalCode" = ${strippedDigits}
                       OR similarity(name, ${q}) > 0.15
                ) as subquery
                ORDER BY
                  CASE
                    WHEN LOWER(name) = LOWER(${q}) OR ("postalCode" ~ '^[0-9]+$' AND LPAD("postalCode", 5, '0') = LPAD(${q}, 5, '0')) OR "postalCode" = ${strippedDigits} THEN 0
                    WHEN name ILIKE ${escapedPrefix} ESCAPE '\' OR ("postalCode" ~ '^[0-9]+$' AND LPAD("postalCode", 5, '0') ILIKE ${escapedPrefix} ESCAPE '\') THEN 1
                    ELSE 2
                  END,
                  sim DESC, name ASC
                LIMIT 5;
            `;
            suggestions = offices.map((o) => {
                const code = normalizePostalCode(o.postalCode);
                return isNumeric && code ? `${o.name} (${code})` : o.name;
            });

            if (mode === "all" && suggestions.length < 5) {
                const fields = await prisma.postOfficeField.findMany({
                    where: {
                        name: "Division",
                        value: {
                            startsWith: q,
                            mode: "insensitive",
                        },
                    },
                    distinct: ["value"],
                    take: 5 - suggestions.length,
                    select: {
                        value: true,
                    },
                    orderBy: {
                        value: "asc",
                    },
                });
                for (const f of fields) {
                    if (!suggestions.includes(f.value)) {
                        suggestions.push(f.value);
                    }
                }
            }
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
    } catch {
        return NextResponse.json(
            { suggestions: autocompleteLocalOffices(q, mode) },
            {
                status: 200,
                headers: {
                    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
                },
            }
        );
    }
}
