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

        const { id } = await params;
        const auth = await requireRole(["SUPER_ADMIN"]);
        if (!auth.ok) {
            return auth.response;
        }

        const targetUser = await prisma.user.findUnique({ where: { id } });
        
        if (!targetUser) {
            return NextResponse.json({ error: "User not found." }, { status: 404 });
        }

        if (targetUser.emailVerified) {
            return NextResponse.json({ error: "Email is already verified." }, { status: 400 });
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: { emailVerified: new Date(), verificationToken: null },
            select: { id: true, name: true, email: true, emailVerified: true }
        });

        await prisma.actionLog.create({
            data: {
                userId: auth.user.id,
                action: "ADMIN_VERIFY_EMAIL",
                details: JSON.stringify({ targetUserId: id }),
            },
        });

        return NextResponse.json({ success: true, user: updatedUser }, { headers: { "Cache-Control": "no-store" } });

    } catch (error: unknown) {
        console.error("Force Verify Email Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
