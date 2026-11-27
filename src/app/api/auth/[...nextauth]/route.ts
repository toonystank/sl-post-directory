import NextAuth from "next-auth";
import { authOptions } from "./options";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimiters, rateLimitHeaders } from "@/lib/rate-limiter";

const handler = NextAuth(authOptions);

// Custom POST handler to wrap NextAuth credentials login with rate limiting
export async function POST(req: NextRequest, ctx: unknown) {
    let normalizedPath = req.nextUrl.pathname.toLowerCase();
    try {
        normalizedPath = decodeURIComponent(req.nextUrl.pathname).toLowerCase();
    } catch {
        // Keep raw lowercased path on malformed percent-encoding
    }

    if (normalizedPath.includes("/callback/credentials")) {
        const rateLimit = await checkRateLimit(req, rateLimiters.login);

        if (rateLimit.isRateLimited) {
            const origin = process.env.NEXTAUTH_URL || req.nextUrl.origin;
            return NextResponse.json(
                { url: `${origin}/login?error=Too+many+login+attempts.+Try+again+in+15+minutes.` },
                { status: 429, headers: rateLimitHeaders(rateLimit) }
            );
        }
    }

    return handler(req, ctx);
}

export { handler as GET };
