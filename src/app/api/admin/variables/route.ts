import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { invalidatePublicConfigCache } from "@/lib/server-caches";

export async function GET() {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as { role?: string } | undefined)?.role;

    if (!session || !userRole || !["SUPER_ADMIN", "ADMIN", "MODERATOR"].includes(userRole)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasDatabaseUrl) {
        return NextResponse.json([], { headers: { "Cache-Control": "no-store" } });
    }

    try {
        const variables = await prisma.siteVariable.findMany({
            orderBy: { key: "asc" },
        });
        return NextResponse.json(variables, { headers: { "Cache-Control": "no-store" } });
    } catch {
        return NextResponse.json([], { headers: { "Cache-Control": "no-store" } });
    }
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as { role?: string } | undefined)?.role;

    if (!session || !userRole || !["SUPER_ADMIN", "ADMIN"].includes(userRole)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = (await req.json()) as { key?: string; value?: string; description?: string };
        const key = body.key?.trim();
        const value = body.value;
        const description = body.description?.trim();

        if (!key || value === undefined || value === null || String(value).trim() === "") {
            return NextResponse.json({ error: "Key and Value are required" }, { status: 400 });
        }

        const variable = await prisma.siteVariable.upsert({
            where: { key },
            update: { value: String(value), description },
            create: { key, value: String(value), description },
        });

        invalidatePublicConfigCache();
        revalidatePath("/blog", "layout");
        revalidatePath("/calculator");
        revalidatePath("/rates", "layout");

        return NextResponse.json(variable);
    } catch (error) {
        console.error("Error saving variable:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as { role?: string } | undefined)?.role;

    if (!session || !userRole || !["SUPER_ADMIN", "ADMIN"].includes(userRole)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const key = searchParams.get("key")?.trim();

        if (!key) {
            return NextResponse.json({ error: "Key is required" }, { status: 400 });
        }

        await prisma.siteVariable.delete({ where: { key } });

        invalidatePublicConfigCache();
        revalidatePath("/blog", "layout");
        revalidatePath("/calculator");
        revalidatePath("/rates", "layout");

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting variable:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
