import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { checkRateLimit, rateLimiters } from "@/lib/rate-limiter";

export async function PUT(req: Request) {
    try {
        // Rate limit: 5 password change attempts per 15 minutes
        const rateLimit = await checkRateLimit(req, rateLimiters.password);
        if (rateLimit.isRateLimited) {
            return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
        }

        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { currentPassword, newPassword } = await req.json();

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isValid) {
            return NextResponse.json({ error: "Incorrect current password" }, { status: 401 });
        }

        if (newPassword.length < 8) {
            return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { email: session.user.email },
            data: { passwordHash: hashedPassword }
        });

        return NextResponse.json({ success: true, message: "Password updated successfully" });
    } catch (error) {
        console.error("Password update error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
