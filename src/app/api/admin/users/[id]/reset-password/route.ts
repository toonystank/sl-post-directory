import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        const currentUser = session?.user as { role?: string };

        if (!session || currentUser?.role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
        }

        const body = await req.json();
        const { newPassword } = body;

        if (!newPassword || newPassword.length < 8) {
            return NextResponse.json({ error: "Password must be at least 8 characters long." }, { status: 400 });
        }

        const { id } = await params;
        const targetUserId = id;

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const updatedUser = await prisma.user.update({
            where: { id: targetUserId },
            data: { passwordHash: hashedPassword },
        });

        return NextResponse.json({ success: true, message: `Password reset successfully for ${updatedUser.email}` });
    } catch (error: any) {
        console.error("Admin Password Reset Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
