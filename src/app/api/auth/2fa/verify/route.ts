import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimiters, rateLimitHeaders } from "@/lib/rate-limiter";
import { totpTokenSchema } from "@/lib/validations";
import { verifySync } from "otplib";

export async function POST(req: Request) {
    try {
        const rateLimit = await checkRateLimit(req, rateLimiters.twoFactor);
        if (rateLimit.isRateLimited) {
            return NextResponse.json(
                { error: "Too many attempts. Please try again later." },
                { status: 429, headers: rateLimitHeaders(rateLimit) }
            );
        }

        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const parsedToken = totpTokenSchema.safeParse(body?.token);
        if (!parsedToken.success) {
            return NextResponse.json(
                { error: parsedToken.error.issues[0]?.message || "Verification code must be 6 digits" },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user || !user.twoFactorSecret) {
            return NextResponse.json({ error: "2FA setup was not initiated properly." }, { status: 400 });
        }

        const isValidObj = verifySync({
            token: parsedToken.data,
            secret: user.twoFactorSecret,
        });

        if (!isValidObj.valid) {
            return NextResponse.json({ error: "Invalid verification code. Please try again." }, { status: 400 });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { twoFactorEnabled: true },
        });

        return NextResponse.json({ success: true, message: "2FA has been verified and enabled." });
    } catch (error) {
        console.error("2FA Verify Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
