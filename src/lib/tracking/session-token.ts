import crypto from "crypto";

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const VALID_PHPSESSID_REGEX = /^PHPSESSID=[a-zA-Z0-9,-]{10,128}$/;

// Random per-process fallback secret used ONLY in non-production environments
const devFallbackSecret = crypto.randomBytes(32).toString("hex");

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
 * with an expiration timestamp so clients cannot tamper with or forge upstream cookies.
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
    });
    const encoded = Buffer.from(payload, "utf8").toString("base64url");
    const sig = crypto
        .createHmac("sha256", secret)
        .update(encoded)
        .digest("base64url");

    return `${encoded}.${sig}`;
}

/**
 * Verify a signed session token and return the upstream PHPSESSID cookie pair,
 * or null if invalid/expired.
 */
export function verifyUpstreamSessionCookie(token: string): string | null {
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
        return parsed.c;
    } catch {
        return null;
    }
}
