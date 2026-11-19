import type { BarcodeClassification } from "./types";

/** Maximum barcodes accepted in a single batch lookup (matches bepost.lk limit) */
export const MAX_BATCH_BARCODES = 20;

/**
 * Standard UPU S10 13-character barcode: 2 letters + 9 digits + 2-letter ISO country code.
 * Examples: BD070817564LK, NA055922175LK, BF009065544LK, RA083556964LK, BG123456789LK, EE123456789US
 */
export const UPU_BARCODE_REGEX = /^[A-Z]{2}\d{9}[A-Z]{2}$/;

/**
 * Relaxed domestic SL Post barcode check (8–20 alphanumeric chars containing at least 5 digits).
 */
export const VALID_BARCODE_REGEX = /^(?=.*\d{5,})[A-Z0-9]{8,20}$/;

/**
 * Known Sri Lanka Post service prefixes for friendly display labels.
 */
export const PREFIX_DESCRIPTIONS: Record<string, string> = {
    BD: "COD (Cash on Delivery)",
    NA: "SLP Courier",
    BF: "SLP Courier",
    RA: "Registered Post / COD",
    RR: "Registered Post",
    RB: "Registered Post",
    BG: "COD / Domestic Parcel",
    EE: "EMS Speed Post",
    CP: "Postal Parcel",
    VV: "Insured Mail",
    LP: "U-Packet / Tracked Packet",
    UF: "Untracked / Foreign Packet",
};

/**
 * Clean and split raw user input into unique normalized uppercase barcodes.
 * Supports comma, whitespace, semicolon, or newline delimiters.
 */
export function parseBarcodes(raw: string): string[] {
    if (!raw || typeof raw !== "string") return [];

    // Strip optional leading intent words like "track " or "tracking "
    const cleaned = raw
        .trim()
        .replace(/^(track|tracking|parcel|status|barcode|check)\s*[:#-]?\s*/i, "");

    const tokens = cleaned
        .split(/[\s,;|\n\r]+/)
        .map((t) => t.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""))
        .filter((t) => t.length >= 8 && t.length <= 20 && VALID_BARCODE_REGEX.test(t));

    const unique: string[] = [];
    const seen = new Set<string>();
    for (const token of tokens) {
        if (!seen.has(token)) {
            seen.add(token);
            unique.push(token);
            if (unique.length >= MAX_BATCH_BARCODES) break;
        }
    }
    return unique;
}

/**
 * Classify a single normalized barcode into its routing category.
 *
 * Policy ("COD first, then SLP Courier"):
 * - BD*       -> Exclusively COD (never prompts SLP CAPTCHA)
 * - NA*, BF*  -> SLP-likely (still checked against COD first, pre-loads CAPTCHA)
 * - *<non-LK> -> International / UPU Global Track & Trace
 * - Everything else (RA, BG, RR, EE, CP, etc.) -> COD first, then SLP fallback
 */
export function classifyBarcode(rawBarcode: string): BarcodeClassification {
    const b = rawBarcode.trim().toUpperCase();

    if (b.startsWith("BD")) {
        return "cod_only";
    }

    if (UPU_BARCODE_REGEX.test(b) && !b.endsWith("LK")) {
        return "international";
    }

    if (b.startsWith("NA") || b.startsWith("BF")) {
        return "slp_likely";
    }

    return "cod_then_slp";
}

/**
 * Extract the 2-letter destination/origin country suffix for UPU codes (e.g. "LK", "US", "GB").
 */
export function getBarcodeCountrySuffix(barcode: string): string | null {
    const b = barcode.trim().toUpperCase();
    if (!UPU_BARCODE_REGEX.test(b)) return null;
    return b.slice(-2);
}

/**
 * Human-readable service hint based on the barcode prefix.
 */
export function getBarcodePrefixLabel(barcode: string): string {
    const b = barcode.trim().toUpperCase();
    const prefix = b.slice(0, 2);
    if (UPU_BARCODE_REGEX.test(b) && !b.endsWith("LK")) {
        return `International (${b.slice(-2)})`;
    }
    return PREFIX_DESCRIPTIONS[prefix] ?? "Sri Lanka Post";
}

/**
 * Build the official UPU Global Track & Trace URL for international articles.
 */
export function getUpuTrackingUrl(barcode?: string): string {
    if (!barcode) return "https://globaltracktrace.ptc.post/gtt.web/";
    return `https://globaltracktrace.ptc.post/gtt.web/Search.aspx?id=${encodeURIComponent(barcode.trim().toUpperCase())}`;
}

/**
 * Fast detector for the homepage dynamic search bar.
 * Returns extracted barcodes if the user typed one or more tracking numbers
 * (optionally prefixed with "track "), avoiding false positives on 5-digit postal codes
 * or post office names.
 */
export function detectTrackingQuery(raw: string): string[] {
    if (!raw || typeof raw !== "string") return [];
    const trimmed = raw.trim();
    if (trimmed.length < 8) return [];

    // Strip optional leading "track" verb
    const stripped = trimmed.replace(/^(track|tracking|parcel|check)\s*[:#-]?\s*/i, "");
    const parts = stripped.split(/[\s,;|\n\r]+/).filter(Boolean);
    if (parts.length === 0) return [];

    // Every non-empty token must look like a valid tracking barcode
    const extracted: string[] = [];
    const seen = new Set<string>();
    for (const part of parts) {
        const clean = part.toUpperCase().replace(/[^A-Z0-9]/g, "");
        // Require either full UPU S10 (e.g. BD070817564LK, NA055922175LK)
        // OR 2 letters + 6+ digits (partial/domestic tracking codes)
        const isTrackingToken =
            UPU_BARCODE_REGEX.test(clean) || /^[A-Z]{2}\d{6,14}[A-Z]{0,2}$/.test(clean);
        if (!isTrackingToken) {
            return [];
        }
        if (!seen.has(clean)) {
            seen.add(clean);
            extracted.push(clean);
            if (extracted.length >= MAX_BATCH_BARCODES) break;
        }
    }

    return extracted;
}
