import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        const user = session?.user as { role?: string, email?: string } | undefined;

        if (!session || user?.role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Unauthorized. Super Admin access required." }, { status: 401 });
        }

        const body = await req.json();
        const { role } = body;

        // Prevent modifying the user's own role to avoid accidental lockouts
        const targetUser = await prisma.user.findUnique({ where: { id } });
        if (targetUser?.email === user.email) {
            return NextResponse.json({ error: "Cannot modify your own active role." }, { status: 400 });
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: { role },
            select: { id: true, name: true, email: true, role: true }
        });

        return NextResponse.json({ success: true, user: updatedUser });

    } catch (error: any) {
        console.error("Super Admin Edit User Role Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        const user = session?.user as { role?: string, email?: string } | undefined;

        if (!session || user?.role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Unauthorized. Super Admin access required." }, { status: 401 });
        }

        const targetUser = await prisma.user.findUnique({ where: { id } });
        if (targetUser?.email === user.email) {
            return NextResponse.json({ error: "Cannot delete your own account." }, { status: 400 });
        }

        // Before deleting the user, decide what happens to their edit requests.
        // Usually, we'd either cascade delete or re-assign. We'll cascade here.
        await prisma.editRequest.deleteMany({
            where: { requestedById: id }
        });

        await prisma.user.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Super Admin Delete User Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
