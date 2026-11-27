import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { verifySameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { passwordSchema } from "@/lib/validations";
import bcrypt from "bcrypt";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const csrf = verifySameOrigin(req);
        if (!csrf.ok) {
            return NextResponse.json({ error: csrf.error }, { status: 403 });
        }

        const auth = await requireRole(["SUPER_ADMIN"]);
        if (!auth.ok) {
            return auth.response;
        }

        const body = await req.json();
        const parsedPassword = passwordSchema.safeParse(body?.newPassword);
        if (!parsedPassword.success) {
            return NextResponse.json(
                { error: parsedPassword.error.issues[0]?.message || "Invalid password" },
                { status: 400 }
            );
        }

        const { id } = await params;
        const hashedPassword = await bcrypt.hash(parsedPassword.data, 10);

        const updatedUser = await prisma.user.update({
            where: { id },
            data: { passwordHash: hashedPassword },
            select: { email: true },
        });

        await prisma.actionLog.create({
            data: {
                userId: auth.user.id,
                action: "ADMIN_RESET_PASSWORD",
                details: JSON.stringify({ targetUserId: id }),
            },
        });

        return NextResponse.json(
            { success: true, message: `Password reset successfully for ${updatedUser.email}` },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch (error: unknown) {
        if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2025") {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        console.error("Admin Password Reset Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
