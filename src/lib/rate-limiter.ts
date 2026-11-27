import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";
import net from "node:net";

export interface RateLimitConfig {
    prefix: string;
    limit: number;
    windowMs: number;
    windowLabel: "1 m" | "15 m" | "1 h";
    serverlessCap?: number;
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

if (!redisClient && process.env.NODE_ENV === "production") {
    console.warn(
        "SECURITY WARNING: Upstash Redis is not configured in production; rate limiting is using per-instance in-memory fallback."
    );
}

function getOcrHourlyCap(): number {
    const raw = parseInt(process.env.GEMINI_OCR_HOURLY_CAP || "500", 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 500;
}

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
    /** Login per account: 10 attempts per 15 minutes per email */
    loginAccount: createLimiter({ prefix: "rl:login:acct", limit: 10, windowMs: 15 * 60_000, windowLabel: "15 m" }),
    /** Registration: 5 accounts per hour per IP */
    register: createLimiter({ prefix: "rl:register", limit: 5, windowMs: 60 * 60_000, windowLabel: "1 h" }),
    /** Email verification: 15 attempts per hour per IP (decoupled from registration) */
    verifyEmail: createLimiter({ prefix: "rl:verify-email", limit: 15, windowMs: 60 * 60_000, windowLabel: "1 h" }),
    /** Suggestions: 15 per hour per IP */
    suggest: createLimiter({ prefix: "rl:suggest", limit: 15, windowMs: 60 * 60_000, windowLabel: "1 h" }),
    /** Password change: 5 attempts per 15 minutes per IP */
    password: createLimiter({ prefix: "rl:password", limit: 5, windowMs: 15 * 60_000, windowLabel: "15 m" }),
    /** 2FA operations: 10 attempts per 15 minutes per IP */
    twoFactor: createLimiter({ prefix: "rl:2fa", limit: 10, windowMs: 15 * 60_000, windowLabel: "15 m" }),
    /** 2FA per account: 8 attempts per 15 minutes per userId */
    twoFactorAccount: createLimiter({ prefix: "rl:2fa:acct", limit: 8, windowMs: 15 * 60_000, windowLabel: "15 m" }),
    /** Public reviews: 8 submissions per 15 minutes per IP */
    reviews: createLimiter({ prefix: "rl:reviews", limit: 8, windowMs: 15 * 60_000, windowLabel: "15 m" }),
    /** Community photos: 10 uploads per hour per IP */
    photos: createLimiter({ prefix: "rl:photos", limit: 10, windowMs: 60 * 60_000, windowLabel: "1 h" }),
    /** Uploadcare signing tickets: 15 per hour per IP */
    uploadSign: createLimiter({ prefix: "rl:upload-sign", limit: 15, windowMs: 60 * 60_000, windowLabel: "1 h" }),
    /** Parcel tracking proxy: 20 requests per minute per IP */
    tracking: createLimiter({ prefix: "rl:tracking", limit: 20, windowMs: 60_000, windowLabel: "1 m" }),
    /** Parcel tracking multi-barcode COD batch: 8 requests per minute per IP */
    trackingBatch: createLimiter({ prefix: "rl:tracking:batch", limit: 8, windowMs: 60_000, windowLabel: "1 m" }),
    /** AI OCR / address extraction: 6 requests per minute per IP (capped at 4 in serverless fallback) */
    ocr: createLimiter({ prefix: "rl:ocr", limit: 6, windowMs: 60_000, windowLabel: "1 m", serverlessCap: 4 }),
    /** AI OCR hourly per IP: 30 requests per hour per IP */
    ocrHourly: createLimiter({ prefix: "rl:ocr:hr", limit: 30, windowMs: 60 * 60_000, windowLabel: "1 h", serverlessCap: 15 }),
    /** AI OCR global hourly budget circuit breaker */
    ocrGlobalHourly: createLimiter({
        prefix: "rl:ocr:global",
        limit: getOcrHourlyCap(),
        windowMs: 60 * 60_000,
        windowLabel: "1 h",
        serverlessCap: 120,
    }),
};

export type AppRateLimiter = (typeof rateLimiters)[keyof typeof rateLimiters];

function normalizeIpCandidate(raw: string | null | undefined): string | null {
    if (!raw) return null;
    let candidate = raw.trim();
    if (!candidate || candidate.length > 64) return null;

    if (candidate.startsWith("[") && candidate.includes("]")) {
        const end = candidate.indexOf("]");
        candidate = candidate.slice(1, end);
    }

    // Strip IPv4-mapped IPv6 prefix
    if (candidate.toLowerCase().startsWith("::ffff:")) {
        const mapped = candidate.slice(7);
        if (net.isIPv4(mapped)) {
            candidate = mapped;
        }
    }

    // Strip optional IPv4 :port
    if (!candidate.includes("::") && candidate.includes(":") && net.isIPv4(candidate.split(":")[0])) {
        candidate = candidate.split(":")[0];
    }

    return net.isIP(candidate) !== 0 ? candidate : null;
}

function firstValidIpFromList(headerValue: string | null): string | null {
    if (!headerValue) return null;
    for (const part of headerValue.split(",")) {
        const normalized = normalizeIpCandidate(part);
        if (normalized) return normalized;
    }
    return null;
}

function rightmostValidIpFromList(headerValue: string | null): string | null {
    if (!headerValue) return null;
    const parts = headerValue.split(",");
    for (let i = parts.length - 1; i >= 0; i--) {
        const normalized = normalizeIpCandidate(parts[i]);
        if (normalized) return normalized;
    }
    return null;
}

/**
 * Extract the client IP using strict platform-aware header selection so attackers
 * cannot spoof `X-Vercel-Forwarded-For`, `CF-Connecting-IP`, or `X-Forwarded-For`
 * when the app runs on a different hosting provider.
 */
export function getClientIp(
    req: NextRequest | Request,
    env: Record<string, string | undefined> = process.env
): string {
    const headers = req.headers;

    if (env.VERCEL === "1") {
        const vercelReal = normalizeIpCandidate(headers.get("x-real-ip"));
        if (vercelReal) return vercelReal;
        const vercelForwarded =
            rightmostValidIpFromList(headers.get("x-vercel-forwarded-for")) ||
            firstValidIpFromList(headers.get("x-vercel-forwarded-for"));
        if (vercelForwarded) return vercelForwarded;
        return "unknown";
    }

    if (env.NETLIFY === "true" || Boolean(env.NETLIFY_LOCAL)) {
        const netlifyIp = normalizeIpCandidate(headers.get("x-nf-client-connection-ip"));
        if (netlifyIp) return netlifyIp;
        return "unknown";
    }

    if (env.TRUST_CLOUDFLARE_HEADERS === "true") {
        const cfConnecting = normalizeIpCandidate(headers.get("cf-connecting-ip"));
        if (cfConnecting) return cfConnecting;
    }

    const realIp = normalizeIpCandidate(headers.get("x-real-ip"));
    if (realIp) return realIp;

    const forwarded = rightmostValidIpFromList(headers.get("x-forwarded-for"));
    if (forwarded) return forwarded;

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
 * Check rate limit for an explicit identifier key (e.g. normalized email, userId, or global cap).
 */
export async function checkRateLimitByKey(
    key: string,
    limiter: AppRateLimiter
): Promise<RateLimitResult> {
    const { prefix, limit, windowMs, serverlessCap } = limiter.config;

    if (limiter.upstash) {
        try {
            const result = await limiter.upstash.limit(key);
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

    const effectiveLimit = serverlessCap ? Math.min(limit, serverlessCap) : limit;
    return memoryLimiter.limit(`${prefix}:${key}`, effectiveLimit, windowMs);
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
    return checkRateLimitByKey(ip, limiter);
}
