import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { getLocalOfficeById } from "@/lib/local-sqlite";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const params = await context.params;
    const { id } = params;

    if (!id) {
        return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    if (!hasDatabaseUrl) {
        const office = getLocalOfficeById(id);
        if (!office) {
            return NextResponse.json({ error: "Post office not found" }, { status: 404 });
        }
        return NextResponse.json({ office }, {
            status: 200,
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
            },
        });
    }

    try {
        const office =
            (await prisma.postOffice.findUnique({
                where: { id },
                include: {
                    fields: true,
                }
            })) ?? getLocalOfficeById(id);

        if (!office) {
            return NextResponse.json({ error: "Post office not found" }, { status: 404 });
        }

        return NextResponse.json({ office }, {
            status: 200,
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
            },
        });

    } catch {
        const fallbackOffice = getLocalOfficeById(id);
        if (!fallbackOffice) {
            return NextResponse.json({ error: "Post office not found" }, { status: 404 });
        }
        return NextResponse.json({ office: fallbackOffice }, {
            status: 200,
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
            },
        });
    }
}
