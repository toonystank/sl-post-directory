import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth-guard";
import { verifySameOrigin } from "@/lib/csrf";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { invalidatePublicConfigCache } from "@/lib/server-caches";
import { siteVariableSchema } from "@/lib/validations";

export async function GET() {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);
    if (!auth.ok) {
        return auth.response;
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
    const csrf = verifySameOrigin(req);
    if (!csrf.ok) {
        return NextResponse.json({ error: csrf.error }, { status: 403 });
    }

    const auth = await requireRole(["SUPER_ADMIN", "ADMIN"]);
    if (!auth.ok) {
        return auth.response;
    }

    try {
        const body = await req.json();
        const parsed = siteVariableSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message || "Key and Value are required" },
                { status: 400 }
            );
        }

        const { key, value, description } = parsed.data;

        const variable = await prisma.siteVariable.upsert({
            where: { key },
            update: { value, description: description || null },
            create: { key, value, description: description || null },
        });

        invalidatePublicConfigCache();
        revalidatePath("/blog", "layout");
        revalidatePath("/calculator");
        revalidatePath("/rates", "layout");

        return NextResponse.json(variable, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("Error saving variable:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const csrf = verifySameOrigin(req);
    if (!csrf.ok) {
        return NextResponse.json({ error: csrf.error }, { status: 403 });
    }

    const auth = await requireRole(["SUPER_ADMIN", "ADMIN"]);
    if (!auth.ok) {
        return auth.response;
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

        return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
    } catch (error: unknown) {
        if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2025") {
            return NextResponse.json({ error: "Variable not found" }, { status: 404 });
        }
        console.error("Error deleting variable:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
