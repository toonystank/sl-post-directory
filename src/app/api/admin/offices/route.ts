import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { loadLocalOffices } from "@/lib/local-sqlite";
import { normalizePostalCode, postalCodeSearchVariants } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    const user = session?.user as { role?: string } | undefined;

    if (!session || !["SUPER_ADMIN", "ADMIN", "MODERATOR", "CONTRIBUTOR"].includes(user?.role || "")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const q = (searchParams.get("q") || "").trim().slice(0, 100);
    const filter = searchParams.get("filter") || "all";

    const rawPage = parseInt(searchParams.get("page") || "1", 10);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, 10_000) : 1;

    const rawLimit = parseInt(searchParams.get("limit") || "20", 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 20;
    const skip = (page - 1) * limit;

    if (!hasDatabaseUrl) {
        let rows = loadLocalOffices();
        if (filter === "missing_gps") {
            rows = rows.filter((o) => o.latitude == null || o.longitude == null);
        } else if (filter === "missing_hours") {
            rows = rows.filter((o) => !o.fields.some((f) => f.name === "Working Hours" && f.value.trim()));
        } else if (filter === "has_services") {
            rows = rows.filter((o) => o.services.length > 0);
        }
        if (q) {
            const qLower = q.toLowerCase();
            const codeVariants = new Set(postalCodeSearchVariants(q).map((v) => v.toLowerCase()));
            rows = rows.filter(
                (o) =>
                    o.name.toLowerCase().includes(qLower) ||
                    o.postalCode.toLowerCase().includes(qLower) ||
                    codeVariants.has(o.postalCode.toLowerCase()) ||
                    (o.rmsc?.toLowerCase().includes(qLower) ?? false)
            );
        }
        const total = rows.length;
        const slice = rows.slice(skip, skip + limit).map((o) => ({
            id: o.id,
            slug: o.slug,
            name: o.name,
            postalCode: normalizePostalCode(o.postalCode),
            operatingHours: o.fields.find((f) => f.name === "Working Hours")?.value || null,
            services: o.services,
            rmsc: o.rmsc,
            latitude: o.latitude,
            longitude: o.longitude,
            updatedAt: o.updatedAt,
            _count: { fields: o.fields.length },
        }));
        return NextResponse.json(
            {
                offices: slice,
                total,
                page,
                limit,
                totalPages: Math.max(1, Math.ceil(total / limit)),
            },
            { headers: { "Cache-Control": "no-store" } }
        );
    }

    try {
        const andConditions: Prisma.PostOfficeWhereInput[] = [];

        if (filter === "missing_gps") {
            andConditions.push({ OR: [{ latitude: null }, { longitude: null }] });
        } else if (filter === "missing_hours") {
            andConditions.push({ OR: [{ operatingHours: null }, { operatingHours: "" }] });
        } else if (filter === "has_services") {
            andConditions.push({ NOT: { services: { equals: [] } } });
        }

        if (q) {
            const variants = postalCodeSearchVariants(q);
            const orSearch: Prisma.PostOfficeWhereInput[] = [
                { name: { contains: q, mode: "insensitive" } },
                { postalCode: { contains: q, mode: "insensitive" } },
                { rmsc: { contains: q, mode: "insensitive" } },
            ];
            if (variants.length > 0) {
                orSearch.push({ postalCode: { in: variants } });
            }
            andConditions.push({ OR: orSearch });
        }

        const where: Prisma.PostOfficeWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

        const [total, rawOffices] = await Promise.all([
            prisma.postOffice.count({ where }),
            prisma.postOffice.findMany({
                where,
                select: {
                    id: true,
                    slug: true,
                    name: true,
                    postalCode: true,
                    operatingHours: true,
                    services: true,
                    rmsc: true,
                    latitude: true,
                    longitude: true,
                    updatedAt: true,
                    _count: { select: { fields: true } },
                },
                orderBy: [{ name: "asc" }],
                skip,
                take: limit,
            }),
        ]);

        const offices = rawOffices.map((office) => ({
            ...office,
            postalCode: normalizePostalCode(office.postalCode),
        }));

        return NextResponse.json(
            {
                offices,
                total,
                page,
                limit,
                totalPages: Math.max(1, Math.ceil(total / limit)),
            },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch (error) {
        console.error("Admin Offices API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
