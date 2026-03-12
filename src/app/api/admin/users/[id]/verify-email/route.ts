import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        const user = session?.user as { role?: string, email?: string } | undefined;

        // Ensure only SUPER_ADMIN or ADMIN can access
        if (!session || (user?.role !== "SUPER_ADMIN" && user?.role !== "ADMIN")) {
            return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 401 });
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
            data: { emailVerified: new Date() },
            select: { id: true, name: true, email: true, emailVerified: true }
        });

        return NextResponse.json({ success: true, user: updatedUser });

    } catch (error: any) {
        console.error("Force Verify Email Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
