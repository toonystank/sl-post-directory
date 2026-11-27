import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { verifySameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { adminUpdateRoleSchema } from "@/lib/validations";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

        const body = await req.json();
        const parsed = adminUpdateRoleSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message || "Invalid role" },
                { status: 400 }
            );
        }
        const { role } = parsed.data;

        const targetUser = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
        if (!targetUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Prevent modifying the user's own role to avoid accidental lockouts
        if (targetUser.id === auth.user.id) {
            return NextResponse.json({ error: "Cannot modify your own active role." }, { status: 400 });
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: { role },
            select: { id: true, name: true, email: true, role: true }
        });

        await prisma.actionLog.create({
            data: {
                userId: auth.user.id,
                action: "UPDATED_USER_ROLE",
                details: JSON.stringify({ targetUserId: id, previousRole: targetUser.role, newRole: role }),
            },
        });

        return NextResponse.json({ success: true, user: updatedUser }, { headers: { "Cache-Control": "no-store" } });

    } catch (error: unknown) {
        console.error("Super Admin Edit User Role Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

        const targetUser = await prisma.user.findUnique({ where: { id }, select: { id: true } });
        if (!targetUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        if (targetUser.id === auth.user.id) {
            return NextResponse.json({ error: "Cannot delete your own account." }, { status: 400 });
        }

        // Atomic deletion: remove edit requests, action logs, and user in a single transaction
        await prisma.$transaction(async (tx) => {
            await tx.actionLog.deleteMany({ where: { userId: id } });
            await tx.editRequest.deleteMany({ where: { requestedById: id } });
            await tx.user.delete({ where: { id } });
            await tx.actionLog.create({
                data: {
                    userId: auth.user.id,
                    action: "DELETED_USER",
                    details: JSON.stringify({ targetUserId: id }),
                },
            });
        });

        return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });

    } catch (error: unknown) {
        console.error("Super Admin Delete User Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
