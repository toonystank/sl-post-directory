import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

const TOTP_ENC_PREFIX = "enc:v1:";
const SCRYPT_CODE_PREFIX = "scrypt:v1:";
const DEV_FALLBACK_MASTER = crypto.randomBytes(32).toString("hex");

function getMasterSecret(overrideSecret?: string): string {
    const configured =
        overrideSecret?.trim() ||
        process.env.TWO_FACTOR_ENCRYPTION_KEY?.trim() ||
        process.env.NEXTAUTH_SECRET?.trim();
    if (configured) {
        return configured;
    }
    if (process.env.NODE_ENV === "production") {
        throw new Error(
            "CRITICAL: Neither TWO_FACTOR_ENCRYPTION_KEY nor NEXTAUTH_SECRET is configured in production."
        );
    }
    return DEV_FALLBACK_MASTER;
}

function deriveTotpAesKey(overrideSecret?: string): Buffer {
    const master = getMasterSecret(overrideSecret);
    return Buffer.from(
        crypto.hkdfSync("sha256", master, "lankapost-2fa-totp-v1", "aes-256-gcm", 32)
    );
}

/**
 * Returns true if the stored TOTP secret is encrypted with AES-256-GCM (`enc:v1:...`).
 */
export function isEncryptedTotpSecret(stored: string): boolean {
    return typeof stored === "string" && stored.startsWith(TOTP_ENC_PREFIX);
}

/**
 * Encrypts a plaintext Base32 TOTP secret using AES-256-GCM.
 */
export function encryptTotpSecret(plaintext: string, overrideSecret?: string): string {
    const key = deriveTotpAesKey(overrideSecret);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `${TOTP_ENC_PREFIX}${iv.toString("base64url")}:${authTag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

/**
 * Decrypts an AES-256-GCM encrypted TOTP secret, or returns legacy plaintext Base32 secrets
 * unchanged so existing enrolled accounts continue working seamlessly.
 */
export function decryptTotpSecret(stored: string, overrideSecret?: string): string {
    if (!isEncryptedTotpSecret(stored)) {
        return stored;
    }

    const payload = stored.slice(TOTP_ENC_PREFIX.length);
    const parts = payload.split(":");
    if (parts.length !== 3) {
        throw new Error("Malformed encrypted TOTP secret");
    }

    const [ivB64, tagB64, cipherB64] = parts;
    const iv = Buffer.from(ivB64, "base64url");
    const authTag = Buffer.from(tagB64, "base64url");
    const ciphertext = Buffer.from(cipherB64, "base64url");

    if (iv.length !== 12 || authTag.length !== 16 || ciphertext.length === 0) {
        throw new Error("Invalid encrypted TOTP secret parameters");
    }

    const key = deriveTotpAesKey(overrideSecret);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
}

function normalizeRecoveryCodeInput(raw: string): string {
    return raw.trim().toLowerCase().replace(/[\s-]+/g, "");
}

function formatRecoveryCodeDisplay(rawHex16: string): string {
    return `${rawHex16.slice(0, 4)}-${rawHex16.slice(4, 8)}-${rawHex16.slice(8, 12)}-${rawHex16.slice(12, 16)}`;
}

function hashRecoveryCode(normalizedCode: string): string {
    const salt = crypto.randomBytes(16);
    const derived = crypto.scryptSync(normalizedCode, salt, 32);
    return `${SCRYPT_CODE_PREFIX}${salt.toString("hex")}:${derived.toString("hex")}`;
}

/**
 * Generates high-entropy (64-bit) single-use recovery codes and their salted scrypt hashes.
 * Only `hashedCodes` should be persisted to the database; `plaintextCodes` are displayed once.
 */
export function generateRecoveryCodes(count = 10): {
    plaintextCodes: string[];
    hashedCodes: string[];
} {
    const plaintextCodes: string[] = [];
    const hashedCodes: string[] = [];

    for (let i = 0; i < count; i++) {
        const rawHex = crypto.randomBytes(8).toString("hex");
        plaintextCodes.push(formatRecoveryCodeDisplay(rawHex));
        hashedCodes.push(hashRecoveryCode(rawHex));
    }

    return { plaintextCodes, hashedCodes };
}

function constantTimeEqualsString(aStr: string, bStr: string): boolean {
    const a = Buffer.from(aStr, "utf8");
    const b = Buffer.from(bStr, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

/**
 * Matches a user-supplied recovery code against stored entries (supporting both salted scrypt
 * hashes and legacy plaintext backup codes) without short-circuiting early.
 * Returns the exact stored string to pass to `consumeBackupCodeAtomically`.
 */
export function matchRecoveryCode(storedCodes: string[], candidate: string): string | undefined {
    if (!Array.isArray(storedCodes) || storedCodes.length === 0) return undefined;
    const rawTrimmed = candidate.trim();
    const normalizedCandidate = normalizeRecoveryCodeInput(candidate);
    if (!normalizedCandidate) return undefined;

    let matchedEntry: string | undefined;

    for (const entry of storedCodes) {
        if (typeof entry !== "string" || !entry) continue;

        if (entry.startsWith(SCRYPT_CODE_PREFIX)) {
            const parts = entry.slice(SCRYPT_CODE_PREFIX.length).split(":");
            if (parts.length !== 2) continue;
            const [saltHex, expectedHashHex] = parts;
            if (!/^[0-9a-f]{32}$/i.test(saltHex) || !/^[0-9a-f]{64}$/i.test(expectedHashHex)) {
                continue;
            }
            const salt = Buffer.from(saltHex, "hex");
            const expectedHash = Buffer.from(expectedHashHex, "hex");
            const actualHash = crypto.scryptSync(normalizedCandidate, salt, 32);
            if (actualHash.length === expectedHash.length && crypto.timingSafeEqual(actualHash, expectedHash)) {
                matchedEntry = entry;
            }
        } else {
            const normalizedEntry = normalizeRecoveryCodeInput(entry);
            if (
                constantTimeEqualsString(entry, rawTrimmed) ||
                constantTimeEqualsString(normalizedEntry, normalizedCandidate)
            ) {
                matchedEntry = entry;
            }
        }
    }

    return matchedEntry;
}

/**
 * Atomically consumes a matched backup code in PostgreSQL using `array_remove` guarded by
 * `entry = ANY("backupCodes")`, preventing concurrent double-spend races.
 */
export async function consumeBackupCodeAtomically(
    userId: string,
    matchedStoredEntry: string,
    executeRawFn?: (userId: string, entry: string) => Promise<number>
): Promise<boolean> {
    if (!userId || !matchedStoredEntry) return false;

    const affectedRows = executeRawFn
        ? await executeRawFn(userId, matchedStoredEntry)
        : await prisma.$executeRaw`
              UPDATE "User"
              SET "backupCodes" = array_remove("backupCodes", ${matchedStoredEntry})
              WHERE id = ${userId}
                AND "twoFactorEnabled" = true
                AND ${matchedStoredEntry} = ANY("backupCodes")
          `;

    return affectedRows === 1;
}

/**
 * Computes a non-reversible short version fingerprint of a user's password hash
 * so active JWT sessions are immediately revoked when an admin resets or changes a password.
 */
export function computePasswordVersion(passwordHash: string): string {
    return crypto.createHash("sha256").update(passwordHash).digest("base64url").slice(0, 16);
}
