import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth-guard";
import { canUserSelfToggleMailRouting } from "@/lib/beta-features";
import { verifySameOrigin } from "@/lib/csrf";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { userBetaFeaturesSchema } from "@/lib/validations";

const ALL_ROLES = ["CONTRIBUTOR", "MODERATOR", "ADMIN", "SUPER_ADMIN"] as const;

export async function PUT(req: Request) {
    try {
        const csrf = verifySameOrigin(req);
        if (!csrf.ok) {
            return NextResponse.json(
                { error: csrf.error },
                { status: 403, headers: { "Cache-Control": "no-store" } }
            );
        }

        const auth = await requireRole(ALL_ROLES);
        if (!auth.ok) {
            return auth.response;
        }

        if (!hasDatabaseUrl) {
            return NextResponse.json(
                { error: "Database is not configured for user profile updates." },
                { status: 503, headers: { "Cache-Control": "no-store" } }
            );
        }

        const body = await req.json();
        const parsed = userBetaFeaturesSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message || "Invalid payload" },
                { status: 400, headers: { "Cache-Control": "no-store" } }
            );
        }

        const { mailRoutingBetaEnabled } = parsed.data;
        const settings = await prisma.siteSettings.findUnique({
            where: { id: "default" },
            select: {
                mailRoutingBetaAvailable: true,
                mailRoutingSelfOptIn: true,
            },
        });

        const permission = canUserSelfToggleMailRouting({
            role: auth.user.role,
            betaAvailable: settings?.mailRoutingBetaAvailable ?? true,
            selfOptInAllowed: settings?.mailRoutingSelfOptIn ?? true,
            nextEnabled: mailRoutingBetaEnabled,
        });

        if (!permission.ok) {
            return NextResponse.json(
                { error: permission.reason },
                { status: 403, headers: { "Cache-Control": "no-store" } }
            );
        }

        const updated = await prisma.user.update({
            where: { id: auth.user.id },
            data: { mailRoutingBetaEnabled },
            select: { id: true, mailRoutingBetaEnabled: true },
        });

        await prisma.actionLog.create({
            data: {
                userId: auth.user.id,
                action: "MAIL_ROUTING_BETA_SELF_TOGGLED",
                details: JSON.stringify({ mailRoutingBetaEnabled: updated.mailRoutingBetaEnabled }),
            },
        });

        revalidatePath("/routing");

        return NextResponse.json(
            { success: true, mailRoutingBetaEnabled: updated.mailRoutingBetaEnabled },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch (error) {
        console.error("User Beta Features Update Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500, headers: { "Cache-Control": "no-store" } }
        );
    }
}
