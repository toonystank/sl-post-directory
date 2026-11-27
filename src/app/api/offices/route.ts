import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { queryLocalOffices } from "@/lib/local-sqlite";
import { clampPagination, escapeSqlLike } from "@/lib/security";
import { formatSriLankaPhone, normalizePostalCode } from "@/lib/site";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const FIELD_SELECT = {
    where: {
        name: {
            in: [
                "Type",
                "Phone",
                "Telephone",
                "Division",
                "Delivery",
                "Is24Hour",
                "Working Hours",
                "Short Code",
                "Grade",
            ],
        },
    },
    select: { name: true, value: true },
};

const OFFICE_SELECT = {
    id: true,
    slug: true,
    name: true,
    postalCode: true,
    operatingHours: true,
    services: true,
    rmsc: true,
    controllingOffice: {
        select: {
            id: true,
            slug: true,
            name: true,
            postalCode: true,
            fields: { where: { name: "Short Code" }, select: { value: true } },
        },
    },
    controlledOffices: { select: { id: true, slug: true, name: true, postalCode: true } },
    fields: FIELD_SELECT,
};

const OFFICES_CACHE_CONTROL = "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400";

interface OfficePayload {
    postalCode: string;
    controllingOffice?: {
        id: string;
        slug: string;
        name: string;
        postalCode?: string;
        shortCode?: string;
        fields?: { value: string }[];
    } | null;
    controlledOffices?: { id: string; slug: string; name: string; postalCode: string }[];
    fields?: { name: string; value: string }[];
    [key: string]: unknown;
}

function normalizeOfficePayload<T extends OfficePayload>(office: T): T {
    return {
        ...office,
        postalCode: normalizePostalCode(office.postalCode),
        controllingOffice: office.controllingOffice
            ? {
                  id: office.controllingOffice.id,
                  slug: office.controllingOffice.slug,
                  name: office.controllingOffice.name,
                  postalCode: normalizePostalCode(office.controllingOffice.postalCode),
                  shortCode:
                      office.controllingOffice.shortCode ||
                      office.controllingOffice.fields?.[0]?.value ||
                      undefined,
              }
            : null,
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
    const rawDelivery = searchParams.get("delivery");
    const delivery: "yes" | "no" | null =
        rawDelivery === "yes" || rawDelivery === "no" ? rawDelivery : null;
    const rmsc = (searchParams.get("rmsc") || "").slice(0, 80);

    const { cursor, limit } = clampPagination(
        searchParams.get("cursor"),
        searchParams.get("limit"),
        12,
        100
    );

    if (!hasDatabaseUrl) {
        return NextResponse.json(
            queryLocalOffices({
                q: query,
                letter,
                mode,
                service,
                division,
                officeType,
                is24Hour,
                delivery,
                rmsc,
                cursor,
                limit,
            }),
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
                if (officeType.toLowerCase() === "supra post office") {
                    conditions.push({
                        fields: {
                            some: {
                                name: "Grade",
                                value: { contains: "Supra", mode: "insensitive" as const },
                            },
                        },
                    });
                } else {
                    conditions.push({
                        fields: {
                            some: {
                                name: "Type",
                                value: { equals: officeType, mode: "insensitive" as const },
                            },
                        },
                    });
                }
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
            if (delivery) {
                conditions.push({
                    fields: {
                        some: {
                            name: "Delivery",
                            value: { equals: delivery === "yes" ? "Yes" : "No", mode: "insensitive" as const },
                        },
                    },
                });
            }
            if (rmsc) {
                conditions.push({
                    rmsc: { contains: rmsc, mode: "insensitive" as const },
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

            const escapedTerm = escapeSqlLike(primaryTerm);
            const whereClauses: Prisma.Sql[] = [
                Prisma.sql`(similarity(p.name, ${primaryTerm}) > 0.15 OR p.name ILIKE ${escapedTerm + "%"} ESCAPE '\\' OR p.name ILIKE ${"%" + escapedTerm + "%"} ESCAPE '\\' OR p."postalCode" ILIKE ${"%" + escapedTerm + "%"} ESCAPE '\\' OR (p."postalCode" ~ '^[0-9]+$' AND LPAD(p."postalCode", 5, '0') ILIKE ${"%" + escapedTerm + "%"} ESCAPE '\\') OR p."postalCode" = ${strippedDigits} OR EXISTS (SELECT 1 FROM "PostOfficeField" sc WHERE sc."postOfficeId" = p.id AND sc.name = 'Short Code' AND sc.value ILIKE ${escapedTerm + "%"} ESCAPE '\\'))`,
            ];

            if (letter) {
                const escapedLetter = escapeSqlLike(letter);
                whereClauses.push(Prisma.sql`p.name ILIKE ${escapedLetter + "%"} ESCAPE '\\'`);
            }

            if (service) {
                whereClauses.push(Prisma.sql`${service} = ANY(p.services)`);
            }

            if (division) {
                whereClauses.push(
                    Prisma.sql`EXISTS (SELECT 1 FROM "PostOfficeField" f WHERE f."postOfficeId" = p.id AND f.name = 'Division' AND LOWER(f.value) = LOWER(${division}))`
                );
            }

            if (officeType) {
                if (officeType.toLowerCase() === "supra post office") {
                    whereClauses.push(
                        Prisma.sql`EXISTS (SELECT 1 FROM "PostOfficeField" f WHERE f."postOfficeId" = p.id AND f.name = 'Grade' AND LOWER(f.value) LIKE '%supra%')`
                    );
                } else {
                    whereClauses.push(
                        Prisma.sql`EXISTS (SELECT 1 FROM "PostOfficeField" f WHERE f."postOfficeId" = p.id AND f.name = 'Type' AND LOWER(f.value) = LOWER(${officeType}))`
                    );
                }
            }

            if (is24Hour) {
                whereClauses.push(
                    Prisma.sql`EXISTS (SELECT 1 FROM "PostOfficeField" f WHERE f."postOfficeId" = p.id AND f.name = 'Is24Hour' AND f.value = 'true')`
                );
            }

            if (delivery) {
                const deliveryVal = delivery === "yes" ? "yes" : "no";
                whereClauses.push(
                    Prisma.sql`EXISTS (SELECT 1 FROM "PostOfficeField" f WHERE f."postOfficeId" = p.id AND f.name = 'Delivery' AND LOWER(f.value) = ${deliveryVal})`
                );
            }

            if (rmsc) {
                const escapedRmsc = escapeSqlLike(rmsc);
                whereClauses.push(Prisma.sql`p.rmsc ILIKE ${"%" + escapedRmsc + "%"} ESCAPE '\\'`);
            }

            const whereSql = Prisma.join(whereClauses, " AND ");

            try {
                const [rankedResults, countResult] = await Promise.all([
                    prisma.$queryRaw<{ id: string; sim: number; rank: number }[]>`
                        SELECT p.id, similarity(p.name, ${primaryTerm}) as sim,
                            CASE
                                WHEN LOWER(p.name) = LOWER(${primaryTerm}) OR (p."postalCode" ~ '^[0-9]+$' AND LPAD(p."postalCode", 5, '0') = LPAD(${primaryTerm}, 5, '0')) OR p."postalCode" = ${strippedDigits} OR EXISTS (SELECT 1 FROM "PostOfficeField" sc WHERE sc."postOfficeId" = p.id AND sc.name = 'Short Code' AND LOWER(sc.value) = LOWER(${primaryTerm})) THEN 0
                                WHEN LOWER(p.name) LIKE LOWER(${escapedTerm}) || '%' ESCAPE '\' OR (p."postalCode" ~ '^[0-9]+$' AND LPAD(p."postalCode", 5, '0') LIKE ${escapedTerm} || '%' ESCAPE '\') OR EXISTS (SELECT 1 FROM "PostOfficeField" sc WHERE sc."postOfficeId" = p.id AND sc.name = 'Short Code' AND sc.value ILIKE ${escapedTerm} || '%' ESCAPE '\') THEN 1
                                WHEN LOWER(p.name) LIKE '%' || LOWER(${escapedTerm}) || '%' ESCAPE '\' THEN 2
                                ELSE 3
                            END as rank
                        FROM "PostOffice" p
                        WHERE ${whereSql}
                        ORDER BY rank ASC, sim DESC, p.name ASC
                        LIMIT ${limit} OFFSET ${cursor}
                    `,
                    prisma.$queryRaw<{ total: number }[]>`
                        SELECT COUNT(*)::int as total FROM "PostOffice" p WHERE ${whereSql}
                    `,
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
                            {
                                fields: {
                                    some: {
                                        name: "Short Code",
                                        value: { startsWith: primaryTerm, mode: "insensitive" as const },
                                    },
                                },
                            },
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
            queryLocalOffices({
                q: query,
                letter,
                mode,
                service,
                division,
                officeType,
                is24Hour,
                delivery,
                rmsc,
                cursor,
                limit,
            }),
            {
                status: 200,
                headers: {
                    "Cache-Control": OFFICES_CACHE_CONTROL,
                },
            }
        );
    }
}
