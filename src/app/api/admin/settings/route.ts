import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { invalidatePublicConfigCache } from "@/lib/server-caches";

const SETTINGS_CACHE_CONTROL = "public, max-age=60, s-maxage=1800, stale-while-revalidate=86400";

// GET: Public — anyone needs to know if ads are enabled
export async function GET() {
    if (!hasDatabaseUrl) {
        return NextResponse.json({ adsEnabled: true }, { headers: { "Cache-Control": SETTINGS_CACHE_CONTROL } });
    }

    try {
        const settings = await prisma.siteSettings.upsert({
            where: { id: "default" },
            update: {},
            create: { id: "default", adsEnabled: true },
        });
        return NextResponse.json({ adsEnabled: settings.adsEnabled }, { headers: { "Cache-Control": SETTINGS_CACHE_CONTROL } });
    } catch {
        return NextResponse.json({ adsEnabled: true }, { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } });
    }
}

// PUT: Super admin only — toggle ads
export async function PUT(req: Request) {
    const session = await getServerSession(authOptions);
    const user = session?.user as { id?: string; role?: string } | undefined;

    if (!session || user?.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { adsEnabled } = (await req.json()) as { adsEnabled?: unknown };

        if (typeof adsEnabled !== "boolean") {
            return NextResponse.json({ error: "adsEnabled must be a boolean" }, { status: 400 });
        }

        const settings = await prisma.siteSettings.upsert({
            where: { id: "default" },
            update: { adsEnabled },
            create: { id: "default", adsEnabled },
        });

        await prisma.actionLog.create({
            data: {
                userId: user.id!,
                action: adsEnabled ? "ADS_ENABLED" : "ADS_DISABLED",
                details: JSON.stringify({ adsEnabled }),
            },
        });

        invalidatePublicConfigCache();
        revalidatePath("/", "layout");

        return NextResponse.json({ adsEnabled: settings.adsEnabled });
    } catch {
        return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
    }
}
