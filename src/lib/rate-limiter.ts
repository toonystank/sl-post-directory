import { NextRequest } from "next/server";

const rateLimitMap = new Map<string, { count: number; lastReset: number }>();

interface RateLimitConfig {
    limit: number;     // max requests per window
    windowMs: number;  // time window in milliseconds
}

export function checkRateLimit(req: NextRequest | Request, config: RateLimitConfig) {
    // Attempt to extract IP from common proxy headers, fallback to "unknown"
    let ip = "unknown";
    if (req instanceof NextRequest) {
        ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    }

    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (!record) {
        rateLimitMap.set(ip, { count: 1, lastReset: now });
        return { isRateLimited: false, current: 1 };
    }

    if (now - record.lastReset > config.windowMs) {
        // Window expired, reset
        rateLimitMap.set(ip, { count: 1, lastReset: now });
        return { isRateLimited: false, current: 1 };
    }

    if (record.count >= config.limit) {
        return { isRateLimited: true, current: record.count };
    }

    // Increment count
    record.count += 1;
    rateLimitMap.set(ip, record);
    return { isRateLimited: false, current: record.count };
}

// Memory cleanup utility to prevent memory leaks over time
setInterval(() => {
    const now = Date.now();
    const maxWindow = 60 * 60 * 1000; // Keep records for a max of 1 hour

    for (const [ip, record] of rateLimitMap.entries()) {
        if (now - record.lastReset > maxWindow) {
            rateLimitMap.delete(ip);
        }
    }
}, 15 * 60 * 1000); // Cleanup every 15 minutes
