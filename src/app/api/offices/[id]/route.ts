import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { getLocalOfficeById } from "@/lib/local-sqlite";
import { NextRequest, NextResponse } from "next/server";

const OFFICE_CACHE_CONTROL = "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const params = await context.params;
    const id = params.id?.trim();

    if (!id || id.length > 64) {
        return NextResponse.json({ error: "Invalid office ID" }, { status: 400 });
    }

    if (!hasDatabaseUrl) {
        const office = getLocalOfficeById(id);
        if (!office) {
            return NextResponse.json({ error: "Post office not found" }, { status: 404 });
        }
        return NextResponse.json(
            { office },
            {
                status: 200,
                headers: { "Cache-Control": OFFICE_CACHE_CONTROL },
            }
        );
    }

    try {
        const office =
            (await prisma.postOffice.findUnique({
                where: { id },
                include: {
                    fields: true,
                },
            })) ?? getLocalOfficeById(id);

        if (!office) {
            return NextResponse.json({ error: "Post office not found" }, { status: 404 });
        }

        return NextResponse.json(
            { office },
            {
                status: 200,
                headers: { "Cache-Control": OFFICE_CACHE_CONTROL },
            }
        );
    } catch {
        const fallbackOffice = getLocalOfficeById(id);
        if (!fallbackOffice) {
            return NextResponse.json({ error: "Post office not found" }, { status: 404 });
        }
        return NextResponse.json(
            { office: fallbackOffice },
            {
                status: 200,
                headers: { "Cache-Control": OFFICE_CACHE_CONTROL },
            }
        );
    }
}
