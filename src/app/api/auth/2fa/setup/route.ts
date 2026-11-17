import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimiters, rateLimitHeaders } from "@/lib/rate-limiter";
import { generateSecret, generateURI } from "otplib";
import QRCode from "qrcode";

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

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user || !["ADMIN", "MODERATOR", "SUPER_ADMIN"].includes(user.role)) {
            return NextResponse.json({ error: "Unauthorized or insufficient permissions" }, { status: 403 });
        }

        if (user.twoFactorEnabled) {
            return NextResponse.json({ error: "2FA is already enabled on this account." }, { status: 400 });
        }

        const secret = generateSecret();
        const otpauthContent = generateURI({
            issuer: "SL Post Directory",
            label: user.email,
            secret,
        });
        const qrCodeDataUrl = await QRCode.toDataURL(otpauthContent);

        await prisma.user.update({
            where: { id: user.id },
            data: { twoFactorSecret: secret },
        });

        return NextResponse.json({ secret, qrCode: qrCodeDataUrl });
    } catch (error) {
        console.error("2FA Setup Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
