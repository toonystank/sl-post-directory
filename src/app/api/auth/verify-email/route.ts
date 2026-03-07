import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limiter";

export async function GET(req: Request) {
    try {
        // Enforce Rate Limit: Max 10 attempts per 15 minutes per IP
        const rateLimitConfig = { limit: 10, windowMs: 15 * 60 * 1000 };
        const rateLimit = checkRateLimit(req, rateLimitConfig);

        if (rateLimit.isRateLimited) {
            return NextResponse.json({ error: "Too many verification attempts. Please try again later." }, { status: 429 });
        }

        const { searchParams } = new URL(req.url);
        const token = searchParams.get("token");

        if (!token) {
            return NextResponse.json({ error: "Missing verification token." }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { verificationToken: token },
        });

        if (!user) {
            return NextResponse.json({ error: "Invalid or expired verification token." }, { status: 400 });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                emailVerified: new Date(),
                verificationToken: null,
            },
        });

        // Redirect to a success page or back to the login page with a success parameter
        return NextResponse.redirect(new URL("/login?verified=true", req.url));

    } catch (error: any) {
        console.error("Verification Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
