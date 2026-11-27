import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimiters, rateLimitHeaders } from "@/lib/rate-limiter";
import { verifySameOrigin } from "@/lib/csrf";
import { encryptTotpSecret, generateRecoveryCodes } from "@/lib/two-factor-crypto";
import { generateSecret, generateURI } from "otplib";
import QRCode from "qrcode";

export async function POST(req: Request) {
    try {
        const csrf = verifySameOrigin(req);
        if (!csrf.ok) {
            return NextResponse.json({ error: csrf.error }, { status: 403, headers: { "Cache-Control": "no-store" } });
        }

        const rateLimit = await checkRateLimit(req, rateLimiters.twoFactor);
        if (rateLimit.isRateLimited) {
            return NextResponse.json(
                { error: "Too many attempts. Please try again later." },
                { status: 429, headers: { ...rateLimitHeaders(rateLimit), "Cache-Control": "no-store" } }
            );
        }

        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user || !["ADMIN", "MODERATOR", "SUPER_ADMIN"].includes(user.role)) {
            return NextResponse.json({ error: "Unauthorized or insufficient permissions" }, { status: 403, headers: { "Cache-Control": "no-store" } });
        }

        if (user.twoFactorEnabled) {
            return NextResponse.json({ error: "2FA is already enabled on this account." }, { status: 400, headers: { "Cache-Control": "no-store" } });
        }

        const secret = generateSecret();
        const encryptedSecret = encryptTotpSecret(secret);
        const otpauthContent = generateURI({
            issuer: "SL Post Directory",
            label: user.email,
            secret,
        });
        const qrCodeDataUrl = await QRCode.toDataURL(otpauthContent);
        const { plaintextCodes, hashedCodes } = generateRecoveryCodes(10);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                twoFactorSecret: encryptedSecret,
                backupCodes: hashedCodes,
            },
        });

        return NextResponse.json(
            { qrCode: qrCodeDataUrl, backupCodes: plaintextCodes },
            { headers: { ...rateLimitHeaders(rateLimit), "Cache-Control": "no-store" } }
        );
    } catch (error) {
        console.error("2FA Setup Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500, headers: { "Cache-Control": "no-store" } });
    }
}
