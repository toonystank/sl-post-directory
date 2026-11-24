import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { queryLocalOffices } from "@/lib/local-sqlite";
import { clampPagination } from "@/lib/security";
import { formatSriLankaPhone, normalizePostalCode } from "@/lib/site";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const FIELD_SELECT = {
    where: {
        name: { in: ["Type", "Phone", "Telephone", "Division", "Delivery", "Is24Hour", "Working Hours"] },
    },
    select: { name: true, value: true },
};

const OFFICE_SELECT = {
    id: true,
    slug: true,
    name: true,
    postalCode: true,
    services: true,
    rmsc: true,
    controllingOffice: { select: { id: true, slug: true, name: true } },
    controlledOffices: { select: { id: true, slug: true, name: true, postalCode: true } },
    fields: FIELD_SELECT,
};

const OFFICES_CACHE_CONTROL = "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400";

interface OfficePayload {
    postalCode: string;
    controlledOffices?: { id: string; slug: string; name: string; postalCode: string }[];
    fields?: { name: string; value: string }[];
    [key: string]: unknown;
}

function normalizeOfficePayload<T extends OfficePayload>(office: T): T {
    return {
        ...office,
        postalCode: normalizePostalCode(office.postalCode),
        controlledOffices: office.controlledOffices?.map((child) => ({
            ...child,
            postalCode: normalizePostalCode(child.postalCode),
        })),
        fields: office.fields?.map((f) =>
            f.name === "Phone" || f.name === "Telephone"
                ? { ...f, value: formatSriLankaPhone(f.value) }
                : f
        ),
    };
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const query = (searchParams.get("q") || "").slice(0, 100);
    const letter = (searchParams.get("letter") || "").slice(0, 4);
    const mode = searchParams.get("mode") === "division" ? "division" : "name";
    const service = (searchParams.get("service") || "").slice(0, 60);
    const division = (searchParams.get("division") || "").slice(0, 80);
    const officeType = (searchParams.get("type") || "").slice(0, 80);
    const is24Hour = searchParams.get("is24Hour") === "1" || searchParams.get("is24Hour") === "true";

    const { cursor, limit } = clampPagination(
        searchParams.get("cursor"),
        searchParams.get("limit"),
        12,
        100
    );

    if (!hasDatabaseUrl) {
        return NextResponse.json(
            queryLocalOffices({ q: query, letter, mode, service, division, officeType, is24Hour, cursor, limit }),
            {
                status: 200,
                headers: {
                    "Cache-Control": OFFICES_CACHE_CONTROL,
                },
            }
        );
    }

    try {
        let offices: OfficePayload[] = [];
        let total = 0;

        const buildPrismaFilterConditions = (): Prisma.PostOfficeWhereInput[] => {
            const conditions: Prisma.PostOfficeWhereInput[] = [];
            if (letter) conditions.push({ name: { startsWith: letter, mode: "insensitive" as const } });
            if (service) conditions.push({ services: { has: service } });
            if (division) {
                conditions.push({
                    fields: {
                        some: {
                            name: "Division",
                            value: { equals: division, mode: "insensitive" as const },
                        },
                    },
                });
            }
            if (officeType) {
                conditions.push({
                    fields: {
                        some: {
                            name: "Type",
                            value: { equals: officeType, mode: "insensitive" as const },
                        },
                    },
                });
            }
            if (is24Hour) {
                conditions.push({
                    fields: {
                        some: {
                            name: "Is24Hour",
                            value: "true",
                        },
                    },
                });
            }
            return conditions;
        };

        if (query && mode === "name") {
            const cleanQuery = query
                .replace(/\b(post\s*office|main|branch|sub)\b/gi, "")
                .trim();
            const primaryTerm = cleanQuery || query.trim();
            const strippedDigits = /^\d+$/.test(primaryTerm)
                ? primaryTerm.replace(/^0+/, "") || primaryTerm
                : primaryTerm;

            const whereClauses: string[] = [
                `(similarity(p.name, $1) > 0.15 OR p.name ILIKE $1 || '%' OR p.name ILIKE '%' || $1 || '%' OR p."postalCode" ILIKE '%' || $1 || '%' OR (p."postalCode" ~ '^[0-9]+$' AND LPAD(p."postalCode", 5, '0') ILIKE '%' || $1 || '%') OR p."postalCode" = $4)`,
            ];
            let paramIndex = 5;
            const extraParams: string[] = [strippedDigits];

            if (letter) {
                whereClauses.push(`p.name ILIKE $${paramIndex} || '%'`);
                extraParams.push(letter);
                paramIndex++;
            }

            if (service) {
                whereClauses.push(`$${paramIndex} = ANY(p.services)`);
                extraParams.push(service);
                paramIndex++;
            }

            if (division) {
                whereClauses.push(
                    `EXISTS (SELECT 1 FROM "PostOfficeField" f WHERE f."postOfficeId" = p.id AND f.name = 'Division' AND LOWER(f.value) = LOWER($${paramIndex}))`
                );
                extraParams.push(division);
                paramIndex++;
            }

            if (officeType) {
                whereClauses.push(
                    `EXISTS (SELECT 1 FROM "PostOfficeField" f WHERE f."postOfficeId" = p.id AND f.name = 'Type' AND LOWER(f.value) = LOWER($${paramIndex}))`
                );
                extraParams.push(officeType);
                paramIndex++;
            }

            if (is24Hour) {
                whereClauses.push(
                    `EXISTS (SELECT 1 FROM "PostOfficeField" f WHERE f."postOfficeId" = p.id AND f.name = 'Is24Hour' AND f.value = 'true')`
                );
            }

            const whereSQL = whereClauses.join(" AND ");

            const rankedQuery = `
                SELECT p.id, similarity(p.name, $1) as sim,
                    CASE
                        WHEN LOWER(p.name) = LOWER($1) OR (p."postalCode" ~ '^[0-9]+$' AND LPAD(p."postalCode", 5, '0') = LPAD($1, 5, '0')) OR p."postalCode" = $4 THEN 0
                        WHEN LOWER(p.name) LIKE LOWER($1) || '%' OR (p."postalCode" ~ '^[0-9]+$' AND LPAD(p."postalCode", 5, '0') LIKE $1 || '%') THEN 1
                        WHEN LOWER(p.name) LIKE '%' || LOWER($1) || '%' THEN 2
                        ELSE 3
                    END as rank
                FROM "PostOffice" p
                WHERE ${whereSQL}
                ORDER BY rank ASC, sim DESC, p.name ASC
                LIMIT $2 OFFSET $3
            `;

            try {
                // For countQuery, re-index $4+ parameters cleanly by passing dummy values at $2/$3 or rewriting
                const countWhereSQL = whereSQL.replace(/\$(\d+)/g, (_, numStr) => {
                    const n = parseInt(numStr, 10);
                    return n >= 4 ? `$${n - 2}` : `$${n}`;
                });
                const finalCountQuery = `SELECT COUNT(*)::int as total FROM "PostOffice" p WHERE ${countWhereSQL}`;

                const [rankedResults, countResult] = await Promise.all([
                    prisma.$queryRawUnsafe<{ id: string; sim: number; rank: number }[]>(
                        rankedQuery,
                        primaryTerm,
                        limit,
                        cursor,
                        ...extraParams
                    ),
                    prisma.$queryRawUnsafe<{ total: number }[]>(
                        finalCountQuery,
                        primaryTerm,
                        ...extraParams
                    ),
                ]);

                total = countResult[0]?.total || 0;

                if (rankedResults.length > 0) {
                    const orderedIds = rankedResults.map((r) => r.id);

                    const fetchedOffices = await prisma.postOffice.findMany({
                        where: { id: { in: orderedIds } },
                        select: OFFICE_SELECT,
                    });

                    const officeMap = new Map(fetchedOffices.map((o) => [o.id, o]));
                    offices = orderedIds
                        .map((id) => officeMap.get(id))
                        .filter((o): o is NonNullable<typeof o> => Boolean(o))
                        .map(normalizeOfficePayload);
                }
            } catch (e) {
                console.error("Ranked search error, falling back:", e);
                const normalizedCode = normalizePostalCode(primaryTerm);
                const conditions: Prisma.PostOfficeWhereInput[] = [
                    {
                        OR: [
                            { name: { contains: query, mode: "insensitive" as const } },
                            { postalCode: { contains: primaryTerm, mode: "insensitive" as const } },
                            ...(strippedDigits !== primaryTerm
                                ? [{ postalCode: { equals: strippedDigits } }]
                                : []),
                            ...(normalizedCode
                                ? [{ postalCode: { equals: normalizedCode } }]
                                : []),
                        ],
                    },
                    ...buildPrismaFilterConditions(),
                ];

                const where = { AND: conditions };
                const [fallbackOffices, fallbackCount] = await Promise.all([
                    prisma.postOffice.findMany({ where, skip: cursor, take: limit, orderBy: { name: "asc" }, select: OFFICE_SELECT }),
                    prisma.postOffice.count({ where }),
                ]);
                offices = fallbackOffices.map(normalizeOfficePayload);
                total = fallbackCount;
            }
        } else if (query && mode === "division") {
            const conditions: Prisma.PostOfficeWhereInput[] = [
                {
                    fields: {
                        some: {
                            name: "Division",
                            value: { contains: query, mode: "insensitive" as const },
                        },
                    },
                },
                ...buildPrismaFilterConditions(),
            ];

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
            offices = fetchedOffices.map(normalizeOfficePayload);
            total = count;
        } else {
            const conditions = buildPrismaFilterConditions();
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
            offices = fetchedOffices.map(normalizeOfficePayload);
            total = count;
        }

        const nextCursor = cursor + limit < total ? cursor + limit : null;

        return NextResponse.json(
            { offices, total, nextCursor },
            {
                status: 200,
                headers: {
                    "Cache-Control": OFFICES_CACHE_CONTROL,
                },
            }
        );
    } catch {
        return NextResponse.json(
            queryLocalOffices({ q: query, letter, mode, service, division, officeType, is24Hour, cursor, limit }),
            {
                status: 200,
                headers: {
                    "Cache-Control": OFFICES_CACHE_CONTROL,
                },
            }
        );
    }
}
