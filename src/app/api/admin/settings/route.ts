import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth-guard";
import { verifySameOrigin } from "@/lib/csrf";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { invalidatePublicConfigCache } from "@/lib/server-caches";

// GET: Super admin only — public pages use `/api/public/config`
export async function GET() {
    const auth = await requireRole(["SUPER_ADMIN"]);
    if (!auth.ok) {
        return auth.response;
    }

    if (!hasDatabaseUrl) {
        return NextResponse.json({ adsEnabled: true }, { headers: { "Cache-Control": "no-store" } });
    }

    try {
        const settings = await prisma.siteSettings.findUnique({
            where: { id: "default" },
            select: { adsEnabled: true },
        });
        return NextResponse.json(
            { adsEnabled: settings?.adsEnabled ?? true },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch {
        return NextResponse.json({ error: "Failed to load settings" }, { status: 500, headers: { "Cache-Control": "no-store" } });
    }
}

// PUT: Super admin only — toggle ads
export async function PUT(req: Request) {
    const csrf = verifySameOrigin(req);
    if (!csrf.ok) {
        return NextResponse.json({ error: csrf.error }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }

    const auth = await requireRole(["SUPER_ADMIN"]);
    if (!auth.ok) {
        return auth.response;
    }

    try {
        const { adsEnabled } = (await req.json()) as { adsEnabled?: unknown };

        if (typeof adsEnabled !== "boolean") {
            return NextResponse.json({ error: "adsEnabled must be a boolean" }, { status: 400, headers: { "Cache-Control": "no-store" } });
        }

        const settings = await prisma.siteSettings.upsert({
            where: { id: "default" },
            update: { adsEnabled },
            create: { id: "default", adsEnabled },
        });

        await prisma.actionLog.create({
            data: {
                userId: auth.user.id,
                action: adsEnabled ? "ADS_ENABLED" : "ADS_DISABLED",
                details: JSON.stringify({ adsEnabled }),
            },
        });

        invalidatePublicConfigCache();
        revalidatePath("/", "layout");

        return NextResponse.json({ adsEnabled: settings.adsEnabled }, { headers: { "Cache-Control": "no-store" } });
    } catch {
        return NextResponse.json({ error: "Failed to update settings" }, { status: 500, headers: { "Cache-Control": "no-store" } });
    }
}
