import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";
    const letter = searchParams.get("letter") || "";
    const mode = searchParams.get("mode") || "name"; // "name" | "division"
    const cursor = parseInt(searchParams.get("cursor") || "0");
    const limit = parseInt(searchParams.get("limit") || "12");

    const conditions: Prisma.PostOfficeWhereInput[] = [];

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

            const terms = cleanQuery ? [cleanQuery] : [query.trim()];
            if (cleanQuery && cleanQuery !== query.trim()) {
                terms.push(query.trim());
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

    return NextResponse.json({ offices, total, nextCursor });
}
