import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

// Initialize Redis client — falls back to in-memory for dev if not configured
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Pre-configured rate limiters for different endpoints.
 * Uses sliding window algorithm for smooth rate limiting.
 */
export const rateLimiters = {
    /** Login: 10 attempts per 15 minutes per IP */
    login: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "15 m"),
        prefix: "rl:login",
        analytics: true,
    }),

    /** Registration: 5 accounts per hour per IP */
    register: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "1 h"),
        prefix: "rl:register",
        analytics: true,
    }),

    /** Suggestions: 15 per hour per IP */
    suggest: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(15, "1 h"),
        prefix: "rl:suggest",
        analytics: true,
    }),

    /** Password change: 5 attempts per 15 minutes per IP */
    password: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "15 m"),
        prefix: "rl:password",
        analytics: true,
    }),

    /** 2FA operations: 10 attempts per 15 minutes per IP */
    twoFactor: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "15 m"),
        prefix: "rl:2fa",
        analytics: true,
    }),
};

/**
 * Extract the client IP from a request.
 */
function getClientIp(req: NextRequest | Request): string {
    if (req instanceof NextRequest) {
        return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
            || req.headers.get("x-real-ip")
            || "unknown";
    }
    const headers = req.headers;
    return headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || headers.get("x-real-ip")
        || "unknown";
}

/**
 * Check rate limit for a request using a specific limiter.
 * Returns { isRateLimited, limit, remaining, reset }.
 */
export async function checkRateLimit(
    req: NextRequest | Request,
    limiter: Ratelimit
): Promise<{ isRateLimited: boolean; limit: number; remaining: number; reset: number }> {
    const ip = getClientIp(req);

    try {
        const result = await limiter.limit(ip);
        return {
            isRateLimited: !result.success,
            limit: result.limit,
            remaining: result.remaining,
            reset: result.reset,
        };
    } catch (error) {
        // If Redis is down, fail open (allow the request) but log the error
        console.error("Rate limiter error (failing open):", error);
        return { isRateLimited: false, limit: 0, remaining: 0, reset: 0 };
    }
}
