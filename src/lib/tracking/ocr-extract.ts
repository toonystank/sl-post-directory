import { MAX_BATCH_BARCODES } from "./classifier";

/**
 * Known 2-letter Sri Lanka Post & UPU prefixes.
 * Prioritized during positional OCR error-correction of the first 2 characters.
 */
const KNOWN_SL_PREFIXES = new Set([
    "BD",
    "NA",
    "BF",
    "RA",
    "BG",
    "RR",
    "RB",
    "RC",
    "RD",
    "RE",
    "RF",
    "EE",
    "EA",
    "EB",
    "EC",
    "ED",
    "CP",
    "CA",
    "CB",
    "CC",
    "VV",
    "VA",
    "LP",
    "UF",
    "UM",
    "UX",
]);

/**
 * Common OCR & handwriting digit -> letter confusions in prefix/suffix positions (1-2 and 12-13).
 */
const DIGIT_TO_LETTER: Record<string, string> = {
    "0": "D", // e.g. B0 -> BD
    "1": "L", // e.g. 1K -> LK
    "2": "Z",
    "3": "E", // e.g. E3 -> EE
    "4": "A", // e.g. R4 -> RA, N4 -> NA
    "5": "S",
    "6": "G", // e.g. B6 -> BG
    "7": "T",
    "8": "B", // e.g. 8D -> BD, 8F -> BF
    "9": "P",
};

/**
 * Common OCR & handwriting letter/symbol -> digit confusions in the 9-digit serial position (3-11).
 */
const LETTER_TO_DIGIT: Record<string, string> = {
    O: "0",
    Q: "0",
    D: "0",
    U: "0",
    C: "0",
    I: "1",
    L: "1",
    "|": "1",
    "!": "1",
    "/": "1",
    "\\": "1",
    J: "1",
    Z: "2",
    E: "3",
    A: "4",
    H: "4",
    S: "5",
    $: "5",
    G: "6",
    T: "7",
    Y: "7",
    B: "8",
    R: "8",
    P: "9",
};

export interface ExtractedOcrCode {
    code: string;
    /** Raw substring from OCR before positional correction */
    rawMatch: string;
    /** True if positional OCR character corrections or LK suffix completion were applied */
    wasCorrected: boolean;
    /** Confidence score (0..100) for ranking multiple candidates */
    score: number;
}

/**
 * Normalize a 2-character prefix candidate into uppercase letters,
 * preferring known Sri Lanka Post prefixes (BD, NA, BF, RA, BG, RR, EE, CP, LP, VV).
 */
function normalizePrefix(raw2: string): { prefix: string; corrected: boolean } | null {
    const up = raw2.toUpperCase();
    if (KNOWN_SL_PREFIXES.has(up)) {
        return { prefix: up, corrected: false };
    }

    // Special case: "B0" or "80" or "8D" -> "BD"
    const c0 = /[A-Z]/.test(up[0]) ? up[0] : DIGIT_TO_LETTER[up[0]] || "";
    let c1 = /[A-Z]/.test(up[1]) ? up[1] : DIGIT_TO_LETTER[up[1]] || "";

    // Special disambiguation when first letter is B: 0 -> D (BD), 6 -> G (BG)
    if (c0 === "B" && (up[1] === "0" || up[1] === "O" || up[1] === "Q")) {
        c1 = "D";
    }
    // Special disambiguation when first letter is N or R: 4 -> A (NA, RA)
    if ((c0 === "N" || c0 === "R") && up[1] === "4") {
        c1 = "A";
    }

    if (!/^[A-Z]$/.test(c0) || !/^[A-Z]$/.test(c1)) {
        return null;
    }

    const candidate = `${c0}${c1}`;
    return {
        prefix: candidate,
        corrected: candidate !== up,
    };
}

/**
 * Normalize a 9-character serial body into 9 digits (`0-9`).
 * Returns null if more than 3 characters required non-digit coercion (to prevent false positives on random words).
 */
function normalizeSerial9(raw9: string): { serial: string; corrections: number } | null {
    if (raw9.length !== 9) return null;
    let out = "";
    let corrections = 0;

    for (let i = 0; i < 9; i++) {
        const ch = raw9[i].toUpperCase();
        if (/\d/.test(ch)) {
            out += ch;
        } else {
            const mapped = LETTER_TO_DIGIT[ch];
            if (!mapped) return null;
            out += mapped;
            corrections++;
        }
    }

    // Reject if more than 3 of the 9 digits were letters (likely an English word, not a serial number)
    if (corrections > 3) return null;

    return { serial: out, corrections };
}

/**
 * Normalize a 2-character country suffix (positions 12-13), strongly favoring "LK"
 * for common handwritten/OCR misreads like "1K", "lK", "|K", "IK", "LR", "LX", "L4".
 */
function normalizeSuffix(raw2: string): { suffix: string; corrected: boolean } | null {
    const up = raw2.toUpperCase();
    if (up === "LK") return { suffix: "LK", corrected: false };

    // Common OCR misreads of "LK"
    if (/^[1I|!L][KX4R]$/.test(up) || /^L[KX4R1I]$/.test(up)) {
        return { suffix: "LK", corrected: true };
    }

    const c0 = /[A-Z]/.test(up[0]) ? up[0] : up[0] === "0" ? "O" : DIGIT_TO_LETTER[up[0]] || "";
    const c1 = /[A-Z]/.test(up[1]) ? up[1] : up[1] === "0" ? "O" : DIGIT_TO_LETTER[up[1]] || "";

    if (!/^[A-Z]$/.test(c0) || !/^[A-Z]$/.test(c1)) {
        return null;
    }

    const candidate = `${c0}${c1}`;
    return {
        suffix: candidate,
        corrected: candidate !== up,
    };
}

/**
 * Try to parse a 13-character token (or 11-character token missing trailing "LK")
 * using positional S10 postal error-correction.
 */
export function tryParseOcrToken(rawToken: string): ExtractedOcrCode | null {
    const cleaned = rawToken.toUpperCase().replace(/[^A-Z0-9|!$]/g, "");

    // Case 1: Full 13-character S10 candidate (2 prefix + 9 digits + 2 suffix)
    if (cleaned.length === 13) {
        const p = normalizePrefix(cleaned.slice(0, 2));
        const s = normalizeSerial9(cleaned.slice(2, 11));
        const suf = normalizeSuffix(cleaned.slice(11, 13));

        if (!p || !s || !suf) return null;

        const code = `${p.prefix}${s.serial}${suf.suffix}`;
        const wasCorrected = p.corrected || s.corrections > 0 || suf.corrected;
        const isKnownPrefix = KNOWN_SL_PREFIXES.has(p.prefix);
        const isLk = suf.suffix === "LK";

        // Require known SL prefix if multiple character corrections were needed
        if (!isKnownPrefix && (p.corrected || s.corrections > 1 || suf.corrected)) {
            return null;
        }

        const score =
            (isKnownPrefix ? 50 : 25) +
            (isLk ? 30 : 15) -
            s.corrections * 7 -
            (p.corrected ? 8 : 0) -
            (suf.corrected ? 5 : 0);

        return {
            code,
            rawMatch: rawToken.trim(),
            wasCorrected,
            score: Math.max(10, Math.min(100, score)),
        };
    }

    // Case 2: 11-character candidate where trailing "LK" was cut off or smudged on a handwritten slip
    // Only auto-complete "LK" if the 2-letter prefix is a known SL Post prefix (BD, NA, BF, RA, BG, etc.)
    if (cleaned.length === 11) {
        const p = normalizePrefix(cleaned.slice(0, 2));
        if (!p || !KNOWN_SL_PREFIXES.has(p.prefix)) return null;

        const s = normalizeSerial9(cleaned.slice(2, 11));
        if (!s || s.corrections > 2) return null;

        return {
            code: `${p.prefix}${s.serial}LK`,
            rawMatch: rawToken.trim(),
            wasCorrected: true,
            score: 65 - s.corrections * 8 - (p.corrected ? 8 : 0),
        };
    }

    return null;
}

/**
 * Extract all plausible Sri Lanka Post / UPU tracking codes from noisy OCR text
 * (supporting printed receipts, spaced/hyphenated formats like "NA 055 922 175 LK",
 * and handwritten slips with character confusions like "8D07O8I7S641K").
 */
export function extractPostalCodesFromOcr(rawText: string): ExtractedOcrCode[] {
    if (!rawText || typeof rawText !== "string") return [];

    const candidates: ExtractedOcrCode[] = [];
    const seen = new Set<string>();

    const addCandidate = (c: ExtractedOcrCode | null) => {
        if (!c) return;
        if (seen.has(c.code)) {
            // Keep higher score if already seen
            const idx = candidates.findIndex((x) => x.code === c.code);
            if (idx >= 0 && c.score > candidates[idx].score) {
                candidates[idx] = c;
            }
            return;
        }
        seen.add(c.code);
        candidates.push(c);
    };

    const lines = rawText.split(/[\r\n]+/);

    // Pattern for spaced/hyphenated tracking codes at word boundaries, e.g.:
    // "NA 055 922 175 LK", "BD - 070817564 - LK", "8D 07O8I7S64 1K"
    const SPACED_CODE_REGEX =
        /\b([A-Z0-9]{2})[\s\-_.]+([0-9OQDIL|!SZB]{3}[\s\-_.]*[0-9OQDIL|!SZB]{3}[\s\-_.]*[0-9OQDIL|!SZB]{3})(?:[\s\-_.]+([A-Z0-9|!]{2}))?\b/gi;

    for (const line of lines) {
        // 1. Check contiguous whitespace/punctuation-delimited tokens (11 or 13 chars)
        const tokens = line.split(/[\s,;:()[\]]+/).map((t) => t.replace(/^[-_.]+|[-_.]+$/g, ""));
        for (const tok of tokens) {
            const compact = tok.replace(/[-_.]/g, "");
            if (compact.length === 13 || compact.length === 11) {
                addCandidate(tryParseOcrToken(compact));
            }
        }

        // 2. Check spaced or hyphenated multi-part codes at word boundaries
        let match: RegExpExecArray | null;
        SPACED_CODE_REGEX.lastIndex = 0;
        while ((match = SPACED_CODE_REGEX.exec(line)) !== null) {
            const prefixPart = match[1];
            const serialPart = match[2].replace(/[\s\-_.]/g, "");
            const suffixPart = match[3] || "";
            const combined = `${prefixPart}${serialPart}${suffixPart}`;
            if (combined.length === 13 || combined.length === 11) {
                addCandidate(tryParseOcrToken(combined));
            }
        }
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, MAX_BATCH_BARCODES);
}
