import crypto from "node:crypto";

const DEFAULT_UPLOADCARE_PUB_KEY = "16423b7c9e1a87e5884e";
const DEFAULT_UPLOADCARE_CDN_BASE = "https://3q5fhu0dw8.ucarecd.net";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const TICKET_TTL_MS = 5 * 60_000;
const DEV_FALLBACK_TICKET_SECRET = crypto.randomBytes(32).toString("hex");

export function getUploadcarePublicKey(): string {
    return process.env.NEXT_PUBLIC_UPLOADCARE_PUB_KEY?.trim() || DEFAULT_UPLOADCARE_PUB_KEY;
}

export function getUploadcareCdnBase(): string {
    return (process.env.NEXT_PUBLIC_UPLOADCARE_CDN?.trim() || DEFAULT_UPLOADCARE_CDN_BASE).replace(/\/+$/, "");
}

function getTicketSecret(): string | null {
    const configured =
        process.env.UPLOADCARE_SECRET_KEY?.trim() ||
        process.env.NEXTAUTH_SECRET?.trim();
    if (configured) return configured;
    if (process.env.NODE_ENV === "production") {
        console.error("CRITICAL: Neither UPLOADCARE_SECRET_KEY nor NEXTAUTH_SECRET is configured in production.");
        return null;
    }
    return DEV_FALLBACK_TICKET_SECRET;
}

/**
 * Computes an Uploadcare Signed Upload signature (`HMAC-SHA256(secretKey, expire)`).
 */
export function createUploadcareSignature(
    secretKey: string,
    ttlSec = 120,
    nowSec = Math.floor(Date.now() / 1000)
): { signature: string; expire: number } {
    const expire = nowSec + ttlSec;
    const signature = crypto
        .createHmac("sha256", secretKey)
        .update(String(expire))
        .digest("hex");
    return { signature, expire };
}

/**
 * Signs a short-lived community photo upload ticket bound to the officeId and client IP
 * so CAPTCHA verification gates the upload step itself.
 */
export function signUploadTicket(
    params: { officeId: string; ip: string },
    overrideSecret?: string,
    nowMs = Date.now()
): string | null {
    const secret = overrideSecret?.trim() || getTicketSecret();
    if (!secret) return null;

    const payload = JSON.stringify({
        o: params.officeId,
        ip: params.ip,
        exp: nowMs + TICKET_TTL_MS,
        n: crypto.randomBytes(8).toString("hex"),
    });
    const encoded = Buffer.from(payload, "utf8").toString("base64url");
    const sig = crypto
        .createHmac("sha256", secret)
        .update(encoded)
        .digest("base64url");

    return `${encoded}.${sig}`;
}

/**
 * Verifies a signed upload ticket against the expected officeId, client IP, and TTL.
 */
export function verifyUploadTicket(
    ticket: string,
    expected: { officeId: string; ip: string },
    overrideSecret?: string,
    nowMs = Date.now()
): boolean {
    const secret = overrideSecret?.trim() || getTicketSecret();
    if (!secret || !ticket || typeof ticket !== "string") return false;

    const parts = ticket.split(".");
    if (parts.length !== 2) return false;

    const [encoded, sig] = parts;
    if (!encoded || !sig) return false;

    const expectedSig = crypto
        .createHmac("sha256", secret)
        .update(encoded)
        .digest("base64url");

    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        return false;
    }

    try {
        const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
            o?: unknown;
            ip?: unknown;
            exp?: unknown;
        };
        if (parsed.o !== expected.officeId || parsed.ip !== expected.ip) {
            return false;
        }
        if (typeof parsed.exp !== "number" || nowMs > parsed.exp) {
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

/**
 * Verifies an uploaded file via Uploadcare REST API (must be a real image <= 5MB)
 * and promotes it to permanent storage when `UPLOADCARE_SECRET_KEY` is configured.
 */
export async function verifyAndStoreUploadcareFile(
    fileUuid: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
    const secretKey = process.env.UPLOADCARE_SECRET_KEY?.trim();
    if (!secretKey) {
        return { ok: true };
    }

    const pubKey = getUploadcarePublicKey();
    const authHeader = `Uploadcare.Simple ${pubKey}:${secretKey}`;

    try {
        const infoRes = await fetch(`https://api.uploadcare.com/files/${fileUuid}/`, {
            method: "GET",
            headers: {
                Authorization: authHeader,
                Accept: "application/vnd.uploadcare-v0.7+json",
            },
            redirect: "error",
            signal: AbortSignal.timeout(10_000),
        });

        if (!infoRes.ok) {
            return { ok: false, status: 400, error: "Uploaded file could not be verified on Uploadcare" };
        }

        const meta = (await infoRes.json()) as {
            is_image?: boolean;
            size?: number;
            mime_type?: string;
        };

        if (!meta.is_image || (meta.mime_type && !/^image\/(jpeg|png|webp)$/i.test(meta.mime_type))) {
            return { ok: false, status: 400, error: "Uploaded file must be a valid JPEG, PNG, or WebP image" };
        }
        if (typeof meta.size === "number" && meta.size > MAX_UPLOAD_BYTES) {
            return { ok: false, status: 400, error: "Uploaded image exceeds 5MB limit" };
        }

        const storeRes = await fetch(`https://api.uploadcare.com/files/${fileUuid}/storage/`, {
            method: "PUT",
            headers: {
                Authorization: authHeader,
                Accept: "application/vnd.uploadcare-v0.7+json",
            },
            redirect: "error",
            signal: AbortSignal.timeout(10_000),
        });

        if (!storeRes.ok) {
            return { ok: false, status: 502, error: "Failed to store verified photo" };
        }

        return { ok: true };
    } catch (err) {
        console.error("Uploadcare verification error:", err);
        return { ok: false, status: 502, error: "Unable to verify uploaded photo right now" };
    }
}
