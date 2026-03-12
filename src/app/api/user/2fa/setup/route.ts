import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { generateSecret, generateURI } from "otplib";
import qrcode from "qrcode";
import crypto from "node:crypto";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (user.twoFactorEnabled) {
            return NextResponse.json({ error: "2FA is already enabled on this account." }, { status: 400 });
        }

        // Generate TOTP Secret on the server
        const secret = generateSecret();
        const otpauth = generateURI({
            issuer: "SL Post Directory",
            label: session.user.email,
            secret
        });
        const qrCodeUrl = await qrcode.toDataURL(otpauth);

        // Generate Backup Codes (10 random strings)
        const backupCodes = Array.from({ length: 10 }, () =>
            crypto.randomBytes(4).toString("hex")
        );

        // Store the secret and backup codes server-side BEFORE returning
        // They are not "active" yet — twoFactorEnabled remains false until verified
        await prisma.user.update({
            where: { id: user.id },
            data: {
                twoFactorSecret: secret,
                backupCodes: backupCodes
            }
        });

        return NextResponse.json({
            qrCodeUrl,
            backupCodes
            // NOTE: secret is intentionally NOT returned to the client
        });

    } catch (error) {
        console.error("2FA Setup Error:", error);
        return NextResponse.json({ error: "Failed to generate 2FA setup" }, { status: 500 });
    }
}
