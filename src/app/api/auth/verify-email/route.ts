import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimiters, rateLimitHeaders } from "@/lib/rate-limiter";
import { getSiteUrl } from "@/lib/site";

export async function GET(req: Request) {
    try {
        // Enforce dedicated rate limit for email verification
        const rateLimit = await checkRateLimit(req, rateLimiters.verifyEmail);

        if (rateLimit.isRateLimited) {
            return NextResponse.json(
                { error: "Too many verification attempts. Please try again later." },
                { status: 429, headers: { ...rateLimitHeaders(rateLimit), "Cache-Control": "no-store" } }
            );
        }

        const { searchParams } = new URL(req.url);
        const token = searchParams.get("token")?.trim();

        if (!token) {
            return NextResponse.json(
                { error: "Missing verification token." },
                { status: 400, headers: { "Cache-Control": "no-store" } }
            );
        }

        const user = await prisma.user.findUnique({
            where: { verificationToken: token },
        });

        if (!user) {
            return NextResponse.json(
                { error: "Invalid or expired verification token." },
                { status: 400, headers: { "Cache-Control": "no-store" } }
            );
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                emailVerified: new Date(),
                verificationToken: null,
            },
        });

        // Redirect using canonical site origin rather than untrusted request host header
        const baseUrl = (process.env.NEXTAUTH_URL?.trim() || getSiteUrl()).replace(/\/+$/, "");
        return NextResponse.redirect(new URL("/login?verified=true", baseUrl));

    } catch (error: unknown) {
        console.error("Verification Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
