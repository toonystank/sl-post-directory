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
        return NextResponse.json(
            {
                adsEnabled: true,
                mailRoutingBetaAvailable: true,
                mailRoutingSelfOptIn: true,
            },
            { headers: { "Cache-Control": "no-store" } }
        );
    }

    try {
        const settings = await prisma.siteSettings.findUnique({
            where: { id: "default" },
            select: {
                adsEnabled: true,
                mailRoutingBetaAvailable: true,
                mailRoutingSelfOptIn: true,
            },
        });
        return NextResponse.json(
            {
                adsEnabled: settings?.adsEnabled ?? true,
                mailRoutingBetaAvailable: settings?.mailRoutingBetaAvailable ?? true,
                mailRoutingSelfOptIn: settings?.mailRoutingSelfOptIn ?? true,
            },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch {
        return NextResponse.json({ error: "Failed to load settings" }, { status: 500, headers: { "Cache-Control": "no-store" } });
    }
}

// PUT: Super admin only — update sitewide settings & beta feature flags
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
        const body = (await req.json()) as {
            adsEnabled?: unknown;
            mailRoutingBetaAvailable?: unknown;
            mailRoutingSelfOptIn?: unknown;
        };

        const updateData: {
            adsEnabled?: boolean;
            mailRoutingBetaAvailable?: boolean;
            mailRoutingSelfOptIn?: boolean;
        } = {};

        if (body.adsEnabled !== undefined) {
            if (typeof body.adsEnabled !== "boolean") {
                return NextResponse.json({ error: "adsEnabled must be a boolean" }, { status: 400, headers: { "Cache-Control": "no-store" } });
            }
            updateData.adsEnabled = body.adsEnabled;
        }
        if (body.mailRoutingBetaAvailable !== undefined) {
            if (typeof body.mailRoutingBetaAvailable !== "boolean") {
                return NextResponse.json({ error: "mailRoutingBetaAvailable must be a boolean" }, { status: 400, headers: { "Cache-Control": "no-store" } });
            }
            updateData.mailRoutingBetaAvailable = body.mailRoutingBetaAvailable;
        }
        if (body.mailRoutingSelfOptIn !== undefined) {
            if (typeof body.mailRoutingSelfOptIn !== "boolean") {
                return NextResponse.json({ error: "mailRoutingSelfOptIn must be a boolean" }, { status: 400, headers: { "Cache-Control": "no-store" } });
            }
            updateData.mailRoutingSelfOptIn = body.mailRoutingSelfOptIn;
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: "At least one boolean setting must be provided" }, { status: 400, headers: { "Cache-Control": "no-store" } });
        }

        const settings = await prisma.siteSettings.upsert({
            where: { id: "default" },
            update: updateData,
            create: {
                id: "default",
                adsEnabled: updateData.adsEnabled ?? true,
                mailRoutingBetaAvailable: updateData.mailRoutingBetaAvailable ?? true,
                mailRoutingSelfOptIn: updateData.mailRoutingSelfOptIn ?? true,
            },
            select: {
                adsEnabled: true,
                mailRoutingBetaAvailable: true,
                mailRoutingSelfOptIn: true,
            },
        });

        await prisma.actionLog.create({
            data: {
                userId: auth.user.id,
                action: "SITE_SETTINGS_UPDATED",
                details: JSON.stringify(updateData),
            },
        });

        invalidatePublicConfigCache();
        revalidatePath("/", "layout");

        return NextResponse.json(settings, { headers: { "Cache-Control": "no-store" } });
    } catch {
        return NextResponse.json({ error: "Failed to update settings" }, { status: 500, headers: { "Cache-Control": "no-store" } });
    }
}
