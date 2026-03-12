import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const params = await context.params;
        const { id } = params;

        if (!id) {
            return NextResponse.json({ error: "ID is required" }, { status: 400 });
        }

        const office = await prisma.postOffice.findUnique({
            where: { id },
            include: {
                fields: true,
            }
        });

        if (!office) {
            return NextResponse.json({ error: "Post office not found" }, { status: 404 });
        }

        return NextResponse.json({ office }, {
            status: 200,
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
            },
        });

    } catch (error) {
        console.error("Error in /api/offices/[id]:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
