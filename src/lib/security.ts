/**
 * Shared pure security utilities for input sanitization, URL validation,
 * JSON-LD script-safe serialization, and pagination bounds clamping.
 */

const BLOCKED_HOSTS = new Set([
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "::",
    "169.254.169.254",
    "metadata.google.internal",
    "metadata.goog",
    "instance-data",
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

function unbracketIpv6(hostname: string): string {
    if (hostname.startsWith("[") && hostname.endsWith("]")) {
        return hostname.slice(1, -1);
    }
    return hostname;
}

function isPrivateIpv4Octets(a: number, b: number, c: number, d: number): boolean {
    if ([a, b, c, d].some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
    if (a === 0) return true; // 0.0.0.0/8 ("this network")
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
    if (a === 127) return true; // 127.0.0.0/8 (loopback)
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local / cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 (benchmarking)
    if (a >= 224) return true; // 224.0.0.0/4 multicast & 240.0.0.0/4 reserved
    return false;
}

function isPrivateIpv4(hostname: string): boolean {
    const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!match) return false;
    const [, a, b, c, d] = match.map(Number);
    return isPrivateIpv4Octets(a, b, c, d);
}

function isPrivateIpv6(rawHost: string): boolean {
    const host = unbracketIpv6(rawHost).toLowerCase().split("%")[0];
    if (!host.includes(":")) return false;

    if (host === "::" || host === "::1" || host === "0:0:0:0:0:0:0:1" || host === "0:0:0:0:0:0:0:0") {
        return true;
    }

    // Link-local fe80::/10 (fe80 - febf), Unique local fc00::/7 (fc00 - fdff), Multicast ff00::/8
    if (/^(fe[89ab][0-9a-f]|f[cd][0-9a-f]{2}|ff[0-9a-f]{2}):/i.test(host)) {
        return true;
    }

    // IPv4-mapped / compatible IPv6 in dotted form (e.g. ::ffff:127.0.0.1)
    const mappedDotted = host.match(/^(?:::ffff:|::)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/i);
    if (mappedDotted) {
        const [, a, b, c, d] = mappedDotted.map(Number);
        return isPrivateIpv4Octets(a, b, c, d);
    }

    // IPv4-mapped IPv6 normalized by WHATWG URL to hex (e.g. ::ffff:7f00:1 or ::ffff:a9fe:a9fe)
    const mappedHex = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (mappedHex) {
        const hi = parseInt(mappedHex[1], 16);
        const lo = parseInt(mappedHex[2], 16);
        const a = (hi >> 8) & 0xff;
        const b = hi & 0xff;
        const c = (lo >> 8) & 0xff;
        const d = lo & 0xff;
        return isPrivateIpv4Octets(a, b, c, d);
    }

    // IPv4-compatible / NAT64 / unspecified prefixes with 0:0:0:0:0:...
    if (host.startsWith("0:") || host.startsWith("::") || host.startsWith("64:ff9b:")) {
        return true;
    }

    return false;
}

function isSafePublicHttpsUrlInternal(raw: string): boolean {
    if (typeof raw !== "string") return false;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length > 2048) return false;
    if (/[\u0000-\u001f\u007f]/.test(trimmed)) return false;

    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== "https:") return false;
        if (parsed.username || parsed.password) return false;
        if (parsed.port && parsed.port !== "443") return false;

        const cleanHost = unbracketIpv6(parsed.hostname.toLowerCase()).replace(/\.+$/, "");
        if (!cleanHost) return false;
        if (
            BLOCKED_HOSTS.has(cleanHost) ||
            cleanHost.endsWith(".localhost") ||
            cleanHost.endsWith(".local") ||
            cleanHost.endsWith(".internal")
        ) {
            return false;
        }
        if (isPrivateIpv4(cleanHost) || isPrivateIpv6(parsed.hostname)) {
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

/**
 * Validates that an external photo/asset URL uses HTTPS and points to a public host.
 * Prevents `javascript:`, `data:`, `file:`, credentials-in-URL, and IPv4/IPv6 SSRF targets.
 */
export function isSafePublicImageUrl(raw: string): boolean {
    return isSafePublicHttpsUrlInternal(raw);
}

/**
 * Validates that an external reference URL (e.g. official news source link) uses HTTPS
 * and resolves to a safe public host without embedded credentials or internal/metadata IPs.
 */
export function isSafeExternalHttpUrl(raw: string): boolean {
    return isSafePublicHttpsUrlInternal(raw);
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
 * Extracts and validates the canonical lowercase Uploadcare UUID from a URL,
 * returning null if the URL is not a strict Uploadcare CDN UUID asset URL.
 */
export function extractUploadcareUuid(raw: string): string | null {
    if (!isUploadcareImageUrl(raw)) return null;
    try {
        const parsed = new URL(raw.trim());
        const match = UPLOADCARE_UUID_PATH_RE.exec(parsed.pathname);
        return match ? match[1].toLowerCase() : null;
    } catch {
        return null;
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
 * Escapes PostgreSQL LIKE/ILIKE wildcard characters (`\`, `%`, `_`) so user search input
 * is matched literally when paired with `ESCAPE '\'`.
 */
export function escapeSqlLike(input: string): string {
    return input.replace(/[\\%_]/g, "\\$&");
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
 * `<`, `>`, `&`, and Unicode line/paragraph separators so user-supplied strings cannot break out.
 */
export function safeJsonLd(data: unknown): string {
    return JSON.stringify(data)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
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
