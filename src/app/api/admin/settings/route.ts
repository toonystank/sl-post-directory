import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";

// GET: Public — anyone needs to know if ads are enabled
export async function GET() {
    try {
        const settings = await prisma.siteSettings.upsert({
            where: { id: "default" },
            update: {},
            create: { id: "default", adsEnabled: true },
        });
        return NextResponse.json({ adsEnabled: settings.adsEnabled });
    } catch {
        return NextResponse.json({ adsEnabled: true }); // Default to true on error
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
        const { adsEnabled } = await req.json();

        if (typeof adsEnabled !== "boolean") {
            return NextResponse.json({ error: "adsEnabled must be a boolean" }, { status: 400 });
        }

        const settings = await prisma.siteSettings.upsert({
            where: { id: "default" },
            update: { adsEnabled },
            create: { id: "default", adsEnabled },
        });

        // Log the action
        await prisma.actionLog.create({
            data: {
                userId: user.id!,
                action: adsEnabled ? "ADS_ENABLED" : "ADS_DISABLED",
                details: JSON.stringify({ adsEnabled }),
            },
        });

        return NextResponse.json({ adsEnabled: settings.adsEnabled });
    } catch {
        return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
    }
}
