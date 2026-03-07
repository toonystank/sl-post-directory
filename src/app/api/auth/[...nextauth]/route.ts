import NextAuth from "next-auth";
import { authOptions } from "./options"; // Extract authOptions to a separate file
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limiter";

const handler = NextAuth(authOptions);

// Custom POST handler to wrap NextAuth with Rate Limiting
export async function POST(req: NextRequest, ctx: any) {
    // We only want to rate limit the actual login attempts, not session checks
    if (req.nextUrl.pathname.includes("/callback/credentials")) {
        // Enforce Rate Limit: Max 10 login attempts per 15 minutes per IP
        const rateLimitConfig = { limit: 10, windowMs: 15 * 60 * 1000 };
        const rateLimit = checkRateLimit(req, rateLimitConfig);
        
        if (rateLimit.isRateLimited) {
            // NextAuth expects a specific JSON format for errors returned from callbacks
            return NextResponse.json(
                { url: `${process.env.NEXTAUTH_URL}/login?error=Too many login attempts. Try again in 15 minutes.` }, 
                { status: 429 }
            );
        }
    }

    // Forward the request to NextAuth
    return handler(req, ctx);
}

export { handler as GET };
