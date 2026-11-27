import crypto from "node:crypto";
import { Redis } from "@upstash/redis";

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const VALID_PHPSESSID_REGEX = /^PHPSESSID=[a-zA-Z0-9,-]{10,128}$/;

// Random per-process fallback secret used ONLY in non-production environments
const devFallbackSecret = crypto.randomBytes(32).toString("hex");
const consumedTokensMemory = new Map<string, number>();

function getConfiguredRedis(): Redis | null {
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
    if (!url || !token || !url.startsWith("https://")) {
        return null;
    }
    return new Redis({ url, token });
}

const redisClient = getConfiguredRedis();

function pruneExpiredConsumedTokens(now: number) {
    for (const [jti, expiresAt] of consumedTokensMemory.entries()) {
        if (expiresAt <= now) {
            consumedTokensMemory.delete(jti);
        }
    }
    while (consumedTokensMemory.size > 5000) {
        const oldest = consumedTokensMemory.keys().next().value;
        if (oldest === undefined) break;
        consumedTokensMemory.delete(oldest);
    }
}

function getSigningSecret(): string | null {
    const configured =
        process.env.TRACKING_SESSION_SECRET?.trim() ||
        process.env.NEXTAUTH_SECRET?.trim();
    if (configured) {
        return configured;
    }
    if (process.env.NODE_ENV === "production") {
        console.error("CRITICAL: Neither TRACKING_SESSION_SECRET nor NEXTAUTH_SECRET is configured in production.");
        return null;
    }
    return devFallbackSecret;
}

/**
 * Wrap an upstream PHPSESSID cookie string in an HMAC-signed opaque token
 * with an expiration timestamp and single-use `jti` so clients cannot tamper with or replay sessions.
 */
export function signUpstreamSessionCookie(rawSetCookie: string): string | null {
    const secret = getSigningSecret();
    if (!secret) return null;

    const pair = rawSetCookie.split(";")[0]?.trim() || "";
    if (!VALID_PHPSESSID_REGEX.test(pair)) {
        return null;
    }

    const payload = JSON.stringify({
        c: pair,
        exp: Date.now() + TOKEN_TTL_MS,
        jti: crypto.randomBytes(16).toString("hex"),
    });
    const encoded = Buffer.from(payload, "utf8").toString("base64url");
    const sig = crypto
        .createHmac("sha256", secret)
        .update(encoded)
        .digest("base64url");

    return `${encoded}.${sig}`;
}

function verifyTokenPayload(
    token: string
): { cookiePair: string; exp: number; jti?: string } | null {
    const secret = getSigningSecret();
    if (!secret) return null;

    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [encoded, sig] = parts;
    if (!encoded || !sig) return null;

    const expectedSig = crypto
        .createHmac("sha256", secret)
        .update(encoded)
        .digest("base64url");

    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        return null;
    }

    try {
        const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
            c?: unknown;
            exp?: unknown;
            jti?: unknown;
        };
        if (typeof parsed.c !== "string" || typeof parsed.exp !== "number") {
            return null;
        }
        if (Date.now() > parsed.exp) {
            return null;
        }
        if (!VALID_PHPSESSID_REGEX.test(parsed.c)) {
            return null;
        }
        return {
            cookiePair: parsed.c,
            exp: parsed.exp,
            jti: typeof parsed.jti === "string" ? parsed.jti : undefined,
        };
    } catch {
        return null;
    }
}

/**
 * Verify a signed session token and return the upstream PHPSESSID cookie pair,
 * or null if invalid/expired.
 */
export function verifyUpstreamSessionCookie(token: string): string | null {
    return verifyTokenPayload(token)?.cookiePair ?? null;
}

/**
 * Verifies a signed session token AND consumes its single-use `jti` atomically
 * so an upstream CAPTCHA session token cannot be replayed multiple times.
 */
export async function consumeUpstreamSessionCookie(token: string): Promise<string | null> {
    const verified = verifyTokenPayload(token);
    if (!verified) return null;

    const dedupeId =
        verified.jti ||
        crypto.createHash("sha256").update(token).digest("hex");

    if (redisClient) {
        try {
            const ttlSec = Math.max(60, Math.ceil((verified.exp - Date.now()) / 1000));
            const setOk = await redisClient.set(`slp:used:${dedupeId}`, "1", {
                nx: true,
                ex: ttlSec,
            });
            if (setOk !== "OK") {
                return null;
            }
            return verified.cookiePair;
        } catch {
            // Fall through to process-local single-use store on Redis outage
        }
    }

    const now = Date.now();
    pruneExpiredConsumedTokens(now);
    const existingExp = consumedTokensMemory.get(dedupeId);
    if (existingExp !== undefined && existingExp > now) {
        return null;
    }
    consumedTokensMemory.set(dedupeId, verified.exp);
    return verified.cookiePair;
}
