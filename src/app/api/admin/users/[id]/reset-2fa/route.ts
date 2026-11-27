import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { verifySameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const csrf = verifySameOrigin(req);
        if (!csrf.ok) {
            return NextResponse.json({ error: csrf.error }, { status: 403 });
        }

        // Ensure only Super Admins can reset 2FA
        const auth = await requireRole(["SUPER_ADMIN"]);
        if (!auth.ok) {
            return auth.response;
        }

        const { id } = await params;
        const targetUserId = id;

        const updatedUser = await prisma.user.update({
            where: { id: targetUserId },
            data: {
                twoFactorEnabled: false,
                twoFactorSecret: null,
                backupCodes: []
            },
            select: { email: true },
        });

        await prisma.actionLog.create({
            data: {
                userId: auth.user.id,
                action: "ADMIN_RESET_2FA",
                details: JSON.stringify({ targetUserId }),
            },
        });

        return NextResponse.json(
            { success: true, message: `2FA disabled successfully for ${updatedUser.email}` },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch (error: unknown) {
        if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2025") {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        console.error("Admin 2FA Reset Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
