import { NextResponse } from "next/server";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";

// Cache for 24 hours just like the main directory
export const revalidate = 86400;

export async function GET() {
    if (!hasDatabaseUrl) {
        return NextResponse.json(
            { divisions: [] },
            {
                status: 200,
                headers: {
                    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
                },
            }
        );
    }

    try {
        const divisions = await prisma.postOfficeField.groupBy({
            by: ['value'],
            where: { name: 'Division' },
            orderBy: { value: 'asc' }
        });

        // Map and filter out any empty strings
        const divisionNames = divisions
            .map(d => d.value.trim())
            .filter(Boolean);

        return NextResponse.json(
            { divisions: divisionNames },
            {
                status: 200,
                headers: {
                    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
                },
            }
        );
    } catch {
        return NextResponse.json(
            { divisions: [] },
            {
                status: 200,
                headers: {
                    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
                },
            }
        );
    }
}
