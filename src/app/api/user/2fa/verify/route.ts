import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { verifySync } from "otplib";
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

        const { token } = await req.json();

        if (!token) {
            return NextResponse.json({ error: "Verification code is required" }, { status: 400 });
        }

        // Read the secret from the database — NEVER accept it from the client
        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (!user || !user.twoFactorSecret) {
            return NextResponse.json({ error: "2FA setup was not initiated. Please start setup first." }, { status: 400 });
        }

        if (user.twoFactorEnabled) {
            return NextResponse.json({ error: "2FA is already enabled on this account." }, { status: 400 });
        }

        // Verify the token against the server-stored secret
        const isValidObj = verifySync({ token, secret: user.twoFactorSecret });

        if (!isValidObj.valid) {
            return NextResponse.json({ error: "Invalid verification code. Please try again." }, { status: 400 });
        }

        // Token is valid — enable 2FA (secret and backup codes were already stored during setup)
        await prisma.user.update({
            where: { id: user.id },
            data: {
                twoFactorEnabled: true
            }
        });

        return NextResponse.json({ success: true, message: "Two-Factor Authentication enabled successfully" });
    } catch (error) {
        console.error("2FA Verification Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
