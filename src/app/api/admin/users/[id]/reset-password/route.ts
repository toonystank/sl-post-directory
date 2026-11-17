import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { passwordSchema } from "@/lib/validations";
import bcrypt from "bcrypt";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        const currentUser = session?.user as { role?: string } | undefined;

        if (!session || currentUser?.role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
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

        return NextResponse.json({ success: true, message: `Password reset successfully for ${updatedUser.email}` });
    } catch (error) {
        console.error("Admin Password Reset Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
