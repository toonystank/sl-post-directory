import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { verifySync } from "otplib";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { token, secret, backupCodes } = await req.json();

        if (!token || !secret || !backupCodes || !Array.isArray(backupCodes)) {
            return NextResponse.json({ error: "Invalid data provided" }, { status: 400 });
        }

        // Verify the token using verifySync
        const isValidObj = verifySync({ token, secret });

        if (!isValidObj.valid) {
            return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
        }

        // Token is valid. Turn on 2FA for this user!
        await prisma.user.update({
            where: { email: session.user.email },
            data: {
                twoFactorEnabled: true,
                twoFactorSecret: secret,
                backupCodes: backupCodes
            }
        });

        return NextResponse.json({ success: true, message: "Two-Factor Authentication setup successfully" });
    } catch (error) {
        console.error("2FA Verification Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
