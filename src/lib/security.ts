/**
 * Shared pure security utilities for input sanitization, URL validation,
 * JSON-LD script-safe serialization, and pagination bounds clamping.
 */

const BLOCKED_HOSTS = new Set([
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "169.254.169.254",
    "metadata.google.internal",
]);

const ALLOWED_UPLOADCARE_HOSTS = new Set([
    "ucarecdn.com",
    "3q5fhu0dw8.ucarecd.net",
]);

const UPLOADCARE_UUID_PATH_RE = /^\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;

function getConfiguredUploadcareHost(): string | null {
    const raw = process.env.NEXT_PUBLIC_UPLOADCARE_CDN?.trim();
    if (!raw) return null;
    try {
        return new URL(raw).hostname.toLowerCase();
    } catch {
        return null;
    }
}

function isPrivateIpv4(hostname: string): boolean {
    const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!match) return false;
    const [, a, b] = match.map(Number);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
}

/**
 * Validates that an external photo/asset URL uses HTTPS and points to a public host.
 * Prevents `javascript:`, `data:`, `file:`, and internal SSRF targets.
 */
export function isSafePublicImageUrl(raw: string): boolean {
    if (typeof raw !== "string") return false;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length > 2048) return false;

    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== "https:") return false;
        const host = parsed.hostname.toLowerCase();
        if (!host || BLOCKED_HOSTS.has(host) || isPrivateIpv4(host)) return false;
        if (host.endsWith(".local") || host.endsWith(".internal")) return false;
        return true;
    } catch {
        return false;
    }
}

/**
 * Validates that a community photo URL points strictly to an allowed Uploadcare CDN host
 * and carries a canonical UUID path so `next/image` never crashes on unconfigured hosts.
 */
export function isUploadcareImageUrl(raw: string): boolean {
    if (!isSafePublicImageUrl(raw)) return false;
    try {
        const parsed = new URL(raw.trim());
        const host = parsed.hostname.toLowerCase();
        const customHost = getConfiguredUploadcareHost();
        const isAllowedHost = ALLOWED_UPLOADCARE_HOSTS.has(host) || (customHost !== null && host === customHost);
        if (!isAllowedHost) return false;
        if (parsed.search || parsed.hash) return false;
        return UPLOADCARE_UUID_PATH_RE.test(parsed.pathname);
    } catch {
        return false;
    }
}

/**
 * Normalizes a validated Uploadcare image URL so it always ends with `/`
 * (required before appending `-/preview/...` image transformation directives).
 */
export function normalizeUploadcareImageUrl(raw: string): string {
    const parsed = new URL(raw.trim());
    const match = UPLOADCARE_UUID_PATH_RE.exec(parsed.pathname);
    if (!match) {
        return raw.trim().endsWith("/") ? raw.trim() : `${raw.trim()}/`;
    }
    return `https://${parsed.hostname.toLowerCase()}/${match[1].toLowerCase()}/`;
}

/**
 * HTML-encodes user-supplied values before interpolating into HTML email templates or markup.
 */
export function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Serializes structured data for `<script type="application/ld+json">` while escaping
 * `<`, `>`, and `&` so user-supplied strings containing `</script>` cannot break out.
 */
export function safeJsonLd(data: unknown): string {
    return JSON.stringify(data)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026");
}

/**
 * Clamps numeric cursor/limit query parameters to safe non-negative bounds.
 */
export function clampPagination(
    cursorRaw: string | number | null | undefined,
    limitRaw: string | number | null | undefined,
    defaultLimit = 12,
    maxLimit = 100
): { cursor: number; limit: number } {
    const parsedCursor = typeof cursorRaw === "number" ? cursorRaw : parseInt(String(cursorRaw ?? "0"), 10);
    const cursor = Number.isFinite(parsedCursor) && parsedCursor > 0 ? Math.min(parsedCursor, 100_000) : 0;

    const parsedLimit = typeof limitRaw === "number" ? limitRaw : parseInt(String(limitRaw ?? defaultLimit), 10);
    const safeLimit = Number.isFinite(parsedLimit) ? parsedLimit : defaultLimit;
    const limit = Math.min(Math.max(safeLimit, 1), maxLimit);

    return { cursor, limit };
}
