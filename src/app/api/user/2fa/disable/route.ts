import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { checkRateLimit, rateLimiters } from "@/lib/rate-limiter";

export async function POST(req: Request) {
    try {
        // Rate limit: 10 attempts per 15 minutes for 2FA operations
        const rateLimit = await checkRateLimit(req, rateLimiters.twoFactor);
        if (rateLimit.isRateLimited) {
            return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
        }

        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { password } = await req.json();

        if (!password) {
            return NextResponse.json({ error: "Password required to disable 2FA" }, { status: 400 });
        }

        // We require the password to disable 2FA
        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
            return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
        }

        // Valid password, delete the 2FA data
        await prisma.user.update({
            where: { email: session.user.email },
            data: {
                twoFactorEnabled: false,
                twoFactorSecret: null,
                backupCodes: []
            }
        });

        return NextResponse.json({ success: true, message: "Two-Factor Authentication has been disabled" });
    } catch (error) {
        console.error("2FA Disable Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
