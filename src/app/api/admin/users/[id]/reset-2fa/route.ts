import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        const currentUser = session?.user as { role?: string };

        // Ensure only Super Admins can reset 2FA
        if (!session || currentUser?.role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
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
        });

        return NextResponse.json({ success: true, message: `2FA disabled successfully for ${updatedUser.email}` });
    } catch (error: any) {
        console.error("Admin 2FA Reset Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
