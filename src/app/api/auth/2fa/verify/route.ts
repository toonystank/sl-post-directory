import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { verifySync } from "otplib";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { token } = body;

        if (!token) {
            return NextResponse.json({ error: "Verification code is required" }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (!user || !user.twoFactorSecret) {
            return NextResponse.json({ error: "2FA setup was not initiated properly." }, { status: 400 });
        }

        const isValidObj = verifySync({
            token,
            secret: user.twoFactorSecret
        });

        if (!isValidObj.valid) {
            return NextResponse.json({ error: "Invalid verification code. Please try again." }, { status: 400 });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { twoFactorEnabled: true }
        });

        return NextResponse.json({ success: true, message: "2FA has been verified and enabled." });
    } catch (error: any) {
        console.error("2FA Verify Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
