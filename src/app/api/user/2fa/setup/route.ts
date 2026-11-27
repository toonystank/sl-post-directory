import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { generateSecret, generateURI } from "otplib";
import qrcode from "qrcode";
import { checkRateLimit, rateLimiters, rateLimitHeaders } from "@/lib/rate-limiter";
import { verifySameOrigin } from "@/lib/csrf";
import { encryptTotpSecret, generateRecoveryCodes } from "@/lib/two-factor-crypto";

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

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
        }

        if (user.twoFactorEnabled) {
            return NextResponse.json({ error: "2FA is already enabled on this account." }, { status: 400, headers: { "Cache-Control": "no-store" } });
        }

        // Generate TOTP Secret on the server and encrypt at rest before persisting
        const secret = generateSecret();
        const encryptedSecret = encryptTotpSecret(secret);
        const otpauth = generateURI({
            issuer: "SL Post Directory",
            label: session.user.email,
            secret,
        });
        const qrCodeUrl = await qrcode.toDataURL(otpauth);

        // Generate high-entropy recovery codes and store only salted scrypt hashes
        const { plaintextCodes, hashedCodes } = generateRecoveryCodes(10);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                twoFactorSecret: encryptedSecret,
                backupCodes: hashedCodes,
            },
        });

        return NextResponse.json(
            {
                qrCodeUrl,
                backupCodes: plaintextCodes,
                // NOTE: secret is intentionally NOT returned to the client
            },
            { headers: { ...rateLimitHeaders(rateLimit), "Cache-Control": "no-store" } }
        );
    } catch (error) {
        console.error("2FA Setup Error:", error);
        return NextResponse.json({ error: "Failed to generate 2FA setup" }, { status: 500, headers: { "Cache-Control": "no-store" } });
    }
}
