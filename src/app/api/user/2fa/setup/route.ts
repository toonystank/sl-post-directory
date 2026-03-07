import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
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

        // Generate TOTP Secret
        // Using authenticator (which defaults to base32) for better compatibility with Google Auth
        const secret = generateSecret();
        const otpauth = generateURI({
            issuer: "SL Post Directory",
            label: session.user.email,
            secret
        });
        const qrCodeUrl = await qrcode.toDataURL(otpauth);

        // Generate Backup Codes (10 random strings)
        const backupCodes = Array.from({ length: 10 }, () =>
            crypto.randomBytes(4).toString("hex") // Creates an 8-character hex string
        );

        // We DO NOT save these to the database yet. 
        // We only save them after the user successfully verifies the first token.
        return NextResponse.json({
            secret,
            qrCodeUrl,
            backupCodes
        });

    } catch (error) {
        console.error("2FA Setup Error:", error);
        return NextResponse.json({ error: "Failed to generate 2FA setup" }, { status: 500 });
    }
}
