import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";

export interface RateLimitConfig {
    prefix: string;
    limit: number;
    windowMs: number;
    windowLabel: "1 m" | "15 m" | "1 h";
}

export interface RateLimitResult {
    isRateLimited: boolean;
    limit: number;
    remaining: number;
    reset: number;
}

/**
 * Bounded in-memory sliding window store used when Upstash Redis is not
 * configured (local dev) or unreachable. Uses opportunistic pruning so no
 * module-level setInterval timer is leaked across serverless invocations.
 */
export class InMemorySlidingWindow {
    private readonly buckets = new Map<string, number[]>();
    private readonly maxBuckets: number;

    constructor(maxBuckets = 2000) {
        this.maxBuckets = maxBuckets;
    }

    limit(key: string, maxRequests: number, windowMs: number, now = Date.now()): RateLimitResult {
        const windowStart = now - windowMs;
        const existing = this.buckets.get(key) ?? [];
        const active = existing.filter((ts) => ts > windowStart);

        if (active.length >= maxRequests) {
            // Refresh LRU position without adding a timestamp
            this.buckets.delete(key);
            this.buckets.set(key, active);
            const oldest = active[0] ?? now;
            return {
                isRateLimited: true,
                limit: maxRequests,
                remaining: 0,
                reset: oldest + windowMs,
            };
        }

        active.push(now);
        this.buckets.delete(key);
        this.buckets.set(key, active);

        // Opportunistic bounded eviction (oldest bucket first)
        if (this.buckets.size > this.maxBuckets) {
            const firstKey = this.buckets.keys().next().value;
            if (firstKey !== undefined) {
                this.buckets.delete(firstKey);
            }
        }

        return {
            isRateLimited: false,
            limit: maxRequests,
            remaining: Math.max(0, maxRequests - active.length),
            reset: (active[0] ?? now) + windowMs,
        };
    }

    clear(): void {
        this.buckets.clear();
    }

    get size(): number {
        return this.buckets.size;
    }
}

const memoryLimiter = new InMemorySlidingWindow(2000);

function getConfiguredRedis(): Redis | null {
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
    if (!url || !token || !url.startsWith("https://")) {
        return null;
    }
    return new Redis({ url, token });
}

const redisClient = getConfiguredRedis();

function createLimiter(cfg: RateLimitConfig) {
    const upstash = redisClient
        ? new Ratelimit({
              redis: redisClient,
              limiter: Ratelimit.slidingWindow(cfg.limit, cfg.windowLabel),
              prefix: cfg.prefix,
              analytics: true,
          })
        : null;

    return {
        config: cfg,
        upstash,
    };
}

export const rateLimiters = {
    /** Login: 10 attempts per 15 minutes per IP */
    login: createLimiter({ prefix: "rl:login", limit: 10, windowMs: 15 * 60_000, windowLabel: "15 m" }),
    /** Registration: 5 accounts per hour per IP */
    register: createLimiter({ prefix: "rl:register", limit: 5, windowMs: 60 * 60_000, windowLabel: "1 h" }),
    /** Suggestions: 15 per hour per IP */
    suggest: createLimiter({ prefix: "rl:suggest", limit: 15, windowMs: 60 * 60_000, windowLabel: "1 h" }),
    /** Password change: 5 attempts per 15 minutes per IP */
    password: createLimiter({ prefix: "rl:password", limit: 5, windowMs: 15 * 60_000, windowLabel: "15 m" }),
    /** 2FA operations: 10 attempts per 15 minutes per IP */
    twoFactor: createLimiter({ prefix: "rl:2fa", limit: 10, windowMs: 15 * 60_000, windowLabel: "15 m" }),
    /** Public reviews: 8 submissions per 15 minutes per IP */
    reviews: createLimiter({ prefix: "rl:reviews", limit: 8, windowMs: 15 * 60_000, windowLabel: "15 m" }),
    /** Community photos: 10 uploads per hour per IP */
    photos: createLimiter({ prefix: "rl:photos", limit: 10, windowMs: 60 * 60_000, windowLabel: "1 h" }),
    /** Parcel tracking proxy: 30 requests per minute per IP */
    tracking: createLimiter({ prefix: "rl:tracking", limit: 30, windowMs: 60_000, windowLabel: "1 m" }),
    /** AI OCR / address extraction: 20 requests per minute per IP */
    ocr: createLimiter({ prefix: "rl:ocr", limit: 20, windowMs: 60_000, windowLabel: "1 m" }),
};

export type AppRateLimiter = (typeof rateLimiters)[keyof typeof rateLimiters];

/**
 * Extract the client IP from Vercel / Cloudflare / Netlify / standard proxy headers.
 */
export function getClientIp(req: NextRequest | Request): string {
    const headers = req.headers;
    const vercelForwarded = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
    if (vercelForwarded) return vercelForwarded;

    const cfConnecting = headers.get("cf-connecting-ip")?.trim();
    if (cfConnecting) return cfConnecting;

    const netlifyIp = headers.get("x-nf-client-connection-ip")?.trim();
    if (netlifyIp) return netlifyIp;

    const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;

    const realIp = headers.get("x-real-ip")?.trim();
    if (realIp) return realIp;

    return "unknown";
}

/**
 * Build standard HTTP rate-limit response headers.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
    const retryAfterSec = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
    return {
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(Math.ceil(result.reset / 1000)),
        ...(result.isRateLimited ? { "Retry-After": String(retryAfterSec) } : {}),
    };
}

/**
 * Check rate limit for a request using Upstash Redis when configured,
 * falling back cleanly to a bounded in-memory sliding window limiter.
 */
export async function checkRateLimit(
    req: NextRequest | Request,
    limiter: AppRateLimiter
): Promise<RateLimitResult> {
    const ip = getClientIp(req);
    const { prefix, limit, windowMs } = limiter.config;

    if (limiter.upstash) {
        try {
            const result = await limiter.upstash.limit(ip);
            return {
                isRateLimited: !result.success,
                limit: result.limit,
                remaining: result.remaining,
                reset: result.reset,
            };
        } catch (error) {
            console.warn(`Upstash rate limiter error on ${prefix}, falling back to in-memory:`, error);
        }
    }

    return memoryLimiter.limit(`${prefix}:${ip}`, limit, windowMs);
}
