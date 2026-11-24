import { DEFAULT_RATE_CONFIG } from "./postage-rates";
import { extractWeightFromQuery, matchSmartCountry } from "./smart-search";
import { MAX_BATCH_BARCODES, UPU_BARCODE_REGEX } from "./tracking/classifier";
import type { RichAutocompleteSuggestion } from "./office-index";

/**
 * Complete tracking code pattern:
 * - Standard 13-character UPU S10 (e.g. BD070817564LK, NA055922175LK, EE123456789US)
 * - Shorter domestic SL Post code with 2-letter prefix, 5–14 digits, and 2-letter suffix (e.g. BD00000LK)
 */
export const COMPLETE_TRACKING_CODE_REGEX = /^[A-Z]{2}\d{5,14}[A-Z]{2}$/;

/**
 * Partial tracking code where the user has typed the 2-letter prefix + 5+ digits
 * and is about to finish with the 2-letter country suffix ("LK").
 */
export const PARTIAL_TRACKING_CODE_REGEX = /^[A-Z]{2}\d{5,14}[A-Z]?$/;

const BULK_EXAMPLE_POOL = [
    "NA055922175LK",
    "BF009065544LK",
    "BD070817564LK",
    "RA083556964LK",
    "EE123456789LK",
];

const POPULAR_COUNTRIES = [
    "Taiwan",
    "United Kingdom",
    "United States",
    "Australia",
    "Singapore",
    "Dubai",
    "Japan",
    "Canada",
    "Germany",
    "Malaysia",
    "India",
    "Qatar",
    "Saudi Arabia",
    "New Zealand",
    "South Korea",
    "France",
    "Italy",
    "Netherlands",
    "Switzerland",
    "Thailand",
    "Maldives",
];

export interface PredictionChip {
    id: string;
    label: string;
    meta?: string;
    officeSlug?: string;
    applyKind: "replace_draft" | "append_word" | "commit_bulk_slot" | "add_code";
    value: string;
    /** Highlighted as primary quick-accept chip (mirrors the inline ghost prediction on touch screens) */
    primary?: boolean;
}

export interface SearchPrediction {
    /** Inline ghost suffix rendered right after draftText */
    ghostSuffix: string;
    /** Value written to draftText if user accepts ghost via Tab / ArrowRight / tap; null if informational/bulk-slot */
    ghostAcceptDraft: string | null;
    /** True when ghostSuffix is a bulk-tracking example next to a completed code or chip */
    isBulkHint: boolean;
    /** Example next tracking code (e.g. "NA055922175LK") when in bulk-ready state */
    bulkExampleCode: string | null;
    /** Helper note shown right next to bulkExampleCode (e.g. "· , or space for bulk") */
    bulkHintLabel: string | null;
    /** Contextual next-word or quick-complete tappable chips */
    chips: PredictionChip[];
    /** Total valid tracking parcels ready across committed chips + complete draft */
    trackingCount: number;
    /** True when the composer should switch to monospace uppercase tracking mode */
    isTrackingMode: boolean;
}

export function normalizeTrackingToken(raw: string): string {
    return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isCompleteTrackingCode(raw: string): boolean {
    const clean = normalizeTrackingToken(raw);
    return UPU_BARCODE_REGEX.test(clean) || COMPLETE_TRACKING_CODE_REGEX.test(clean);
}

export function isPartialTrackingCode(raw: string): boolean {
    const clean = normalizeTrackingToken(raw);
    if (isCompleteTrackingCode(clean)) return false;
    return PARTIAL_TRACKING_CODE_REGEX.test(clean);
}

/**
 * Picks an example next tracking code with a prefix distinct from the most recently entered code.
 */
export function getNextBulkExampleCode(existingCodes: string[]): string {
    const normalizedExisting = new Set(existingCodes.map(normalizeTrackingToken));
    const lastCode = existingCodes[existingCodes.length - 1];
    const lastPrefix = lastCode ? normalizeTrackingToken(lastCode).slice(0, 2) : "";

    const distinctPrefix = BULK_EXAMPLE_POOL.find(
        (ex) => !normalizedExisting.has(ex) && ex.slice(0, 2) !== lastPrefix
    );
    if (distinctPrefix) return distinctPrefix;

    const unused = BULK_EXAMPLE_POOL.find((ex) => !normalizedExisting.has(ex));
    return unused ?? "NA055922175LK";
}

/**
 * Inspects a draft value right as the user types a separator (comma, space, semicolon, newline)
 * or pastes multi-token text. Commits any complete tracking codes into unique uppercase chips
 * while leaving normal text queries (e.g. "Taiwan 5kg", "Nuwara Eliya") completely untouched.
 */
export function extractTrackingTokensOnDelimiter(
    rawInput: string,
    existingCodes: string[]
): {
    committed: string[];
    remainingDraft: string;
    didCommit: boolean;
} {
    const endsWithDelimiter = /[\s,;\n\r]$/.test(rawInput);
    const hasInternalDelimiter = /[,;\n\r]/.test(rawInput) || /\s/.test(rawInput.trim());

    if (!endsWithDelimiter && !hasInternalDelimiter) {
        return { committed: existingCodes, remainingDraft: rawInput, didCommit: false };
    }

    // Strip optional leading "track " only when the rest consists solely of tracking tokens
    const stripped = rawInput.replace(/^(track|tracking|parcel|check)\s*[:#-]?\s*/i, "");
    const segments = stripped.split(/[\s,;\n\r]+/);

    // If user ended with a delimiter, the final split segment is ""
    const trailingSegment = endsWithDelimiter ? "" : (segments.pop() ?? "");
    const candidateTokens = segments.filter(Boolean);

    if (candidateTokens.length === 0) {
        return { committed: existingCodes, remainingDraft: rawInput, didCommit: false };
    }

    // Only tokenize if every separated candidate token is a complete tracking code
    const allComplete = candidateTokens.every((t) => isCompleteTrackingCode(t));
    if (!allComplete) {
        return { committed: existingCodes, remainingDraft: rawInput, didCommit: false };
    }

    const nextCodes = [...existingCodes];
    const seen = new Set(nextCodes);
    for (const token of candidateTokens) {
        const clean = normalizeTrackingToken(token);
        if (!seen.has(clean) && nextCodes.length < MAX_BATCH_BARCODES) {
            seen.add(clean);
            nextCodes.push(clean);
        }
    }

    return {
        committed: nextCodes,
        remainingDraft: trailingSegment,
        didCommit: true,
    };
}

/**
 * Attempts to split pasted text into bulk tracking codes.
 * Returns null if the pasted text is a normal search query (e.g. "Taiwan 5kg" or "Colombo GPO").
 */
export function splitPastedTrackingText(
    pastedText: string,
    existingCodes: string[]
): {
    committed: string[];
    remainingDraft: string;
    addedCount: number;
} | null {
    const trimmed = pastedText.trim();
    if (!trimmed) return null;

    const stripped = trimmed.replace(/^(track|tracking|parcel|check)\s*[:#-]?\s*/i, "");
    const parts = stripped.split(/[\s,;|\n\r]+/).filter(Boolean);
    if (parts.length === 0) return null;

    const completeParts = parts.filter((p) => isCompleteTrackingCode(p));
    // Only treat as a tracking batch paste if EVERY part is a valid tracking code
    if (completeParts.length !== parts.length) {
        return null;
    }

    const nextCodes = [...existingCodes];
    const seen = new Set(nextCodes);
    let addedCount = 0;

    for (const part of completeParts) {
        const clean = normalizeTrackingToken(part);
        if (!seen.has(clean) && nextCodes.length < MAX_BATCH_BARCODES) {
            seen.add(clean);
            nextCodes.push(clean);
            addedCount++;
        }
    }

    return {
        committed: nextCodes,
        remainingDraft: "",
        addedCount,
    };
}

/**
 * Combines committed tracking chips and active draft text into a single query string
 * for downstream smart intent parsing and navigation.
 */
export function buildCombinedSearchQuery(committedCodes: string[], draftText: string): string {
    const trimmedDraft = draftText.trim();
    if (committedCodes.length === 0) return draftText;
    if (!trimmedDraft) return committedCodes.join(", ");
    return [...committedCodes, trimmedDraft].join(", ");
}

function getAllValidTrackingCodes(committedCodes: string[], draftText: string): string[] {
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const code of committedCodes) {
        const clean = normalizeTrackingToken(code);
        if (clean && !seen.has(clean)) {
            seen.add(clean);
            unique.push(clean);
        }
    }
    const trimmed = draftText.trim();
    if (trimmed && isCompleteTrackingCode(trimmed)) {
        const clean = normalizeTrackingToken(trimmed);
        if (!seen.has(clean) && unique.length < MAX_BATCH_BARCODES) {
            seen.add(clean);
            unique.push(clean);
        }
    }
    return unique;
}

function findCountryPrefixCompletion(rawSingleWord: string): string | null {
    const lower = rawSingleWord.toLowerCase();
    if (lower.length < 3) return null;

    // Prefer popular destinations first
    for (const name of POPULAR_COUNTRIES) {
        if (name.toLowerCase().startsWith(lower) && name.length > rawSingleWord.length) {
            return name;
        }
    }

    for (const c of DEFAULT_RATE_CONFIG.emsCountries) {
        if (c.name.toLowerCase().startsWith(lower) && c.name.length > rawSingleWord.length) {
            return c.name;
        }
    }

    return null;
}

/**
 * Pure client-side predictive next-word and bulk-tracking helper.
 * Runs synchronously in < 1ms on every keystroke.
 */
export function predictSearchCompletion({
    draftText,
    committedCodes,
    officeSuggestions = [],
}: {
    draftText: string;
    committedCodes: string[];
    officeSuggestions?: RichAutocompleteSuggestion[];
    locale?: string;
}): SearchPrediction {
    const trimmed = draftText.trim();
    const endsWithSpace = /\s$/.test(draftText);
    const allTrackingCodes = getAllValidTrackingCodes(committedCodes, draftText);
    const hasCommitted = committedCodes.length > 0;
    const draftIsCompleteCode = Boolean(trimmed) && isCompleteTrackingCode(trimmed);
    const draftIsPartialCode = Boolean(trimmed) && isPartialTrackingCode(trimmed);
    const looksLikeTrackingStart =
        hasCommitted ||
        draftIsCompleteCode ||
        draftIsPartialCode ||
        /^(BD|NA|BF|RA|RR|RB|BG|EE|CP|VV|LP|UF)\d{2,}$/i.test(trimmed);

    // ------------------------------------------------------------------
    // 1. Tracking & Bulk Tracking Mode
    // ------------------------------------------------------------------
    if (looksLikeTrackingStart) {
        const atLimit = allTrackingCodes.length >= MAX_BATCH_BARCODES;
        const nextExample = getNextBulkExampleCode(allTrackingCodes);

        // 1a. Complete tracking number entered in draft (e.g. "BD00000LK" or "BD070817564LK")
        if (draftIsCompleteCode) {
            const bulkHintLabel = atLimit
                ? `Max ${MAX_BATCH_BARCODES} parcels reached`
                : "· , or space for bulk";
            const chips: PredictionChip[] = [];
            if (!atLimit) {
                chips.push({
                    id: "bulk-add-slot",
                    label: "+ Add another",
                    meta: ", or space",
                    applyKind: "commit_bulk_slot",
                    value: "",
                    primary: true,
                });
                chips.push({
                    id: "bulk-sample-next",
                    label: `+ ${nextExample}`,
                    applyKind: "add_code",
                    value: nextExample,
                });
            }
            return {
                ghostSuffix: atLimit ? "" : `, ${nextExample}`,
                ghostAcceptDraft: null,
                isBulkHint: true,
                bulkExampleCode: atLimit ? null : nextExample,
                bulkHintLabel,
                chips,
                trackingCount: allTrackingCodes.length,
                isTrackingMode: true,
            };
        }

        // 1b. Committed chips exist and draft is empty -> prompt for next tracking code inline
        if (hasCommitted && !trimmed) {
            const bulkHintLabel = atLimit
                ? `Max ${MAX_BATCH_BARCODES} parcels reached`
                : "· , or space for bulk";
            const chips: PredictionChip[] = atLimit
                ? []
                : [
                    {
                        id: "bulk-sample-next",
                        label: `+ ${nextExample}`,
                        meta: "Example",
                        applyKind: "add_code",
                        value: nextExample,
                    },
                ];
            return {
                ghostSuffix: atLimit ? "" : nextExample,
                ghostAcceptDraft: null,
                isBulkHint: true,
                bulkExampleCode: atLimit ? null : nextExample,
                bulkHintLabel,
                chips,
                trackingCount: allTrackingCodes.length,
                isTrackingMode: true,
            };
        }

        // 1c. Partial tracking code (e.g. "BD070817564" or "BD00000L") -> predict "LK" suffix
        if (draftIsPartialCode) {
            const clean = normalizeTrackingToken(trimmed);
            const suffix = clean.endsWith("L") ? "K" : "LK";
            const completed = `${clean}${suffix}`;
            return {
                ghostSuffix: suffix,
                ghostAcceptDraft: completed,
                isBulkHint: false,
                bulkExampleCode: null,
                bulkHintLabel: null,
                chips: [
                    {
                        id: "finish-lk",
                        label: completed,
                        meta: "Complete code",
                        applyKind: "replace_draft",
                        value: completed,
                        primary: true,
                    },
                ],
                trackingCount: allTrackingCodes.length,
                isTrackingMode: true,
            };
        }

        // 1d. Early tracking prefix + digits (e.g. "BD070")
        return {
            ghostSuffix: "",
            ghostAcceptDraft: null,
            isBulkHint: false,
            bulkExampleCode: nextExample,
            bulkHintLabel: hasCommitted ? "· , or space for next code" : null,
            chips: [],
            trackingCount: allTrackingCodes.length,
            isTrackingMode: true,
        };
    }

    // ------------------------------------------------------------------
    // 2. Empty Type Mode (no hardcoded starter chips; history handled in UI)
    // ------------------------------------------------------------------
    if (!trimmed) {
        return {
            ghostSuffix: "",
            ghostAcceptDraft: null,
            isBulkHint: false,
            bulkExampleCode: null,
            bulkHintLabel: null,
            chips: [],
            trackingCount: 0,
            isTrackingMode: false,
        };
    }

    const lower = trimmed.toLowerCase();
    const { weightGrams, cleanedQuery } = extractWeightFromQuery(trimmed);

    // ------------------------------------------------------------------
    // 3. COD Postage Query Prediction ("cod", "cod ", "cod 5000", "cod 1kg")
    // ------------------------------------------------------------------
    if (/^cod\b/i.test(lower) || lower === "cash on" || lower === "cash on delivery") {
        const hasAmount = /\b\d{3,6}\b/.test(cleanedQuery);
        if (!hasAmount && weightGrams === null) {
            const suffix = endsWithSpace ? "5000 1kg" : " 5000 1kg";
            return {
                ghostSuffix: suffix,
                ghostAcceptDraft: `${trimmed} 5000 1kg`,
                isBulkHint: false,
                bulkExampleCode: null,
                bulkHintLabel: null,
                chips: [
                    { id: "cod-5000", label: "5000", meta: "LKR", applyKind: "append_word", value: "5000", primary: true },
                    { id: "cod-2500", label: "2500", meta: "LKR", applyKind: "append_word", value: "2500" },
                    { id: "cod-10000", label: "10000", meta: "LKR", applyKind: "append_word", value: "10000" },
                    { id: "cod-500g", label: "500g", applyKind: "append_word", value: "500g" },
                    { id: "cod-1kg", label: "1kg", applyKind: "append_word", value: "1kg" },
                ],
                trackingCount: 0,
                isTrackingMode: false,
            };
        }
        if (hasAmount && weightGrams === null) {
            const suffix = endsWithSpace ? "1kg" : " 1kg";
            return {
                ghostSuffix: suffix,
                ghostAcceptDraft: `${trimmed} 1kg`,
                isBulkHint: false,
                bulkExampleCode: null,
                bulkHintLabel: null,
                chips: [
                    { id: "cod-w-250g", label: "250g", applyKind: "append_word", value: "250g" },
                    { id: "cod-w-500g", label: "500g", applyKind: "append_word", value: "500g" },
                    { id: "cod-w-1kg", label: "1kg", applyKind: "append_word", value: "1kg", primary: true },
                    { id: "cod-w-2kg", label: "2kg", applyKind: "append_word", value: "2kg" },
                    { id: "cod-w-5kg", label: "5kg", applyKind: "append_word", value: "5kg" },
                ],
                trackingCount: 0,
                isTrackingMode: false,
            };
        }
        if (!hasAmount && weightGrams !== null) {
            const suffix = endsWithSpace ? "5000" : " 5000";
            return {
                ghostSuffix: suffix,
                ghostAcceptDraft: `${trimmed} 5000`,
                isBulkHint: false,
                bulkExampleCode: null,
                bulkHintLabel: null,
                chips: [
                    { id: "cod-a-1500", label: "1500", meta: "LKR", applyKind: "append_word", value: "1500" },
                    { id: "cod-a-2500", label: "2500", meta: "LKR", applyKind: "append_word", value: "2500" },
                    { id: "cod-a-5000", label: "5000", meta: "LKR", applyKind: "append_word", value: "5000", primary: true },
                    { id: "cod-a-10000", label: "10000", meta: "LKR", applyKind: "append_word", value: "10000" },
                ],
                trackingCount: 0,
                isTrackingMode: false,
            };
        }
    }

    // ------------------------------------------------------------------
    // 4. International Country + Next-Word Weight / Transport Prediction
    // ------------------------------------------------------------------
    // If user is still mid-word typing a country prefix (e.g. "Taiw" -> "Taiwan", "Austr" -> "Australia"),
    // finish the country name first before suggesting weights.
    if (!endsWithSpace && !trimmed.includes(" ") && weightGrams === null) {
        const partialCountry = findCountryPrefixCompletion(trimmed);
        const hasExactOfficePrefix = officeSuggestions.some(
            (s) =>
                s.queryValue.toLowerCase().startsWith(lower) &&
                s.queryValue.length > draftText.length
        );
        if (partialCountry && !hasExactOfficePrefix) {
            const ghostSuffix = partialCountry.slice(trimmed.length);
            return {
                ghostSuffix,
                ghostAcceptDraft: `${partialCountry} `,
                isBulkHint: false,
                bulkExampleCode: null,
                bulkHintLabel: null,
                chips: [
                    { id: "cp-1", label: `${partialCountry} 5kg`, applyKind: "replace_draft", value: `${partialCountry} 5kg`, primary: true },
                    { id: "cp-2", label: `${partialCountry} 1kg`, applyKind: "replace_draft", value: `${partialCountry} 1kg` },
                    { id: "cp-3", label: `${partialCountry} 250g`, applyKind: "replace_draft", value: `${partialCountry} 250g` },
                    { id: "cp-4", label: `${partialCountry} EMS`, applyKind: "replace_draft", value: `${partialCountry} EMS` },
                ],
                trackingCount: 0,
                isTrackingMode: false,
            };
        }
    }

    const countryMatch = matchSmartCountry(cleanedQuery || trimmed);
    if (countryMatch && !/^\d{5}$/.test(trimmed)) {
        const hasTransport = /\b(ems|sea|air|surface)\b/i.test(lower);
        if (weightGrams === null) {
            const suffix = endsWithSpace ? "5kg" : " 5kg";
            return {
                ghostSuffix: suffix,
                ghostAcceptDraft: `${trimmed} 5kg`,
                isBulkHint: false,
                bulkExampleCode: null,
                bulkHintLabel: null,
                chips: [
                    { id: "w-250g", label: "250g", applyKind: "append_word", value: "250g" },
                    { id: "w-500g", label: "500g", applyKind: "append_word", value: "500g" },
                    { id: "w-1kg", label: "1kg", applyKind: "append_word", value: "1kg" },
                    { id: "w-2kg", label: "2kg", applyKind: "append_word", value: "2kg" },
                    { id: "w-5kg", label: "5kg", applyKind: "append_word", value: "5kg", primary: true },
                    { id: "w-ems", label: "EMS", applyKind: "append_word", value: "EMS" },
                ],
                trackingCount: 0,
                isTrackingMode: false,
            };
        }
        if (!hasTransport) {
            const suffix = endsWithSpace ? "EMS" : " EMS";
            return {
                ghostSuffix: suffix,
                ghostAcceptDraft: `${trimmed} EMS`,
                isBulkHint: false,
                bulkExampleCode: null,
                bulkHintLabel: null,
                chips: [
                    { id: "t-ems", label: "EMS", applyKind: "append_word", value: "EMS", primary: true },
                    { id: "t-air", label: "Air Mail", applyKind: "append_word", value: "Air" },
                    { id: "t-sea", label: "Sea Mail", applyKind: "append_word", value: "Sea" },
                ],
                trackingCount: 0,
                isTrackingMode: false,
            };
        }
    }

    // ------------------------------------------------------------------
    // 5. Bare Number Weight Unit Prediction ("5", "250", "1.5") — skips 5-digit postcodes
    // ------------------------------------------------------------------
    if (/^\d{1,3}(\.\d)?$/.test(trimmed)) {
        const numeric = parseFloat(trimmed);
        if (Number.isFinite(numeric) && numeric > 0) {
            const preferKg = numeric <= 30;
            const unit = preferKg ? "kg" : "g";
            return {
                ghostSuffix: endsWithSpace ? unit : unit,
                ghostAcceptDraft: `${trimmed}${unit}`,
                isBulkHint: false,
                bulkExampleCode: null,
                bulkHintLabel: null,
                chips: preferKg
                    ? [
                        { id: "u-kg", label: `${trimmed}kg`, applyKind: "replace_draft", value: `${trimmed}kg`, primary: true },
                        { id: "u-g", label: `${trimmed}00g`, applyKind: "replace_draft", value: `${trimmed}00g` },
                        { id: "u-tw", label: `Taiwan ${trimmed}kg`, applyKind: "replace_draft", value: `Taiwan ${trimmed}kg` },
                        { id: "u-uk", label: `UK ${trimmed}kg`, applyKind: "replace_draft", value: `UK ${trimmed}kg` },
                    ]
                    : [
                        { id: "u-g", label: `${trimmed}g`, applyKind: "replace_draft", value: `${trimmed}g`, primary: true },
                        { id: "u-g-letter", label: `${trimmed}g letter`, applyKind: "replace_draft", value: `${trimmed}g letter` },
                        { id: "u-g-reg", label: `${trimmed}g registered`, applyKind: "replace_draft", value: `${trimmed}g registered` },
                    ],
                trackingCount: 0,
                isTrackingMode: false,
            };
        }
    }

    // ------------------------------------------------------------------
    // 6. Explicit Weight or Domestic Service Next-Word Prediction
    // ------------------------------------------------------------------
    const hasDomesticKeyword =
        /\b(letter|parcel|courier|slp|speed\s*post|registered|printed|postcard|local|domestic)\b/i.test(lower);

    if (weightGrams !== null && !hasDomesticKeyword) {
        const nextWord = weightGrams >= 1000 ? "parcel" : "registered letter";
        const suffix = endsWithSpace ? nextWord : ` ${nextWord}`;
        return {
            ghostSuffix: suffix,
            ghostAcceptDraft: `${trimmed} ${nextWord}`,
            isBulkHint: false,
            bulkExampleCode: null,
            bulkHintLabel: null,
            chips: [
                { id: "d-reg", label: "registered letter", applyKind: "append_word", value: "registered letter", primary: weightGrams < 1000 },
                { id: "d-parcel", label: "parcel", applyKind: "append_word", value: "parcel", primary: weightGrams >= 1000 },
                { id: "d-slp", label: "SLP Courier", applyKind: "append_word", value: "SLP Courier" },
                { id: "d-tw", label: "Taiwan", applyKind: "append_word", value: "Taiwan" },
                { id: "d-uk", label: "UK", applyKind: "append_word", value: "UK" },
            ],
            trackingCount: 0,
            isTrackingMode: false,
        };
    }

    if (hasDomesticKeyword && weightGrams === null) {
        const defaultW = /\b(parcel|courier|slp)\b/i.test(lower) ? "1kg" : "500g";
        const suffix = endsWithSpace ? defaultW : ` ${defaultW}`;
        return {
            ghostSuffix: suffix,
            ghostAcceptDraft: `${trimmed} ${defaultW}`,
            isBulkHint: false,
            bulkExampleCode: null,
            bulkHintLabel: null,
            chips: [
                { id: "dw-100g", label: "100g", applyKind: "append_word", value: "100g" },
                { id: "dw-250g", label: "250g", applyKind: "append_word", value: "250g" },
                { id: "dw-500g", label: "500g", applyKind: "append_word", value: "500g", primary: defaultW === "500g" },
                { id: "dw-1kg", label: "1kg", applyKind: "append_word", value: "1kg", primary: defaultW === "1kg" },
                { id: "dw-2kg", label: "2kg", applyKind: "append_word", value: "2kg" },
            ],
            trackingCount: 0,
            isTrackingMode: false,
        };
    }

    // ------------------------------------------------------------------
    // 7. Post Office Prefix & Country Prefix Inline Word Completion
    // ------------------------------------------------------------------
    const exactOfficePrefix = officeSuggestions.find(
        (s) =>
            s.queryValue.toLowerCase().startsWith(lower) &&
            s.queryValue.length > draftText.length
    );

    if (exactOfficePrefix) {
        const ghostSuffix = exactOfficePrefix.queryValue.slice(draftText.length);
        return {
            ghostSuffix,
            ghostAcceptDraft: exactOfficePrefix.queryValue,
            isBulkHint: false,
            bulkExampleCode: null,
            bulkHintLabel: null,
            chips: officeSuggestions.slice(0, 5).map((s, idx) => ({
                id: `off-${s.slug ?? idx}`,
                label: s.queryValue,
                meta: s.postalCode,
                officeSlug: s.slug,
                applyKind: "replace_draft",
                value: s.queryValue,
                primary: idx === 0,
            })),
            trackingCount: 0,
            isTrackingMode: false,
        };
    }

    if (!endsWithSpace && !trimmed.includes(" ")) {
        const countryCompletion = findCountryPrefixCompletion(trimmed);
        if (countryCompletion) {
            const ghostSuffix = countryCompletion.slice(trimmed.length);
            return {
                ghostSuffix,
                ghostAcceptDraft: `${countryCompletion} `,
                isBulkHint: false,
                bulkExampleCode: null,
                bulkHintLabel: null,
                chips: [
                    { id: "cp-1", label: `${countryCompletion} 5kg`, applyKind: "replace_draft", value: `${countryCompletion} 5kg`, primary: true },
                    { id: "cp-2", label: `${countryCompletion} 1kg`, applyKind: "replace_draft", value: `${countryCompletion} 1kg` },
                    { id: "cp-3", label: `${countryCompletion} 250g`, applyKind: "replace_draft", value: `${countryCompletion} 250g` },
                    { id: "cp-4", label: `${countryCompletion} EMS`, applyKind: "replace_draft", value: `${countryCompletion} EMS` },
                ],
                trackingCount: 0,
                isTrackingMode: false,
            };
        }
    }

    // Fallback: surface top office suggestions as quick chips if any exist
    if (officeSuggestions.length > 0) {
        return {
            ghostSuffix: "",
            ghostAcceptDraft: null,
            isBulkHint: false,
            bulkExampleCode: null,
            bulkHintLabel: null,
            chips: officeSuggestions.slice(0, 5).map((s, idx) => ({
                id: `off-fb-${s.slug ?? idx}`,
                label: s.queryValue,
                meta: s.postalCode,
                officeSlug: s.slug,
                applyKind: "replace_draft",
                value: s.queryValue,
            })),
            trackingCount: 0,
            isTrackingMode: false,
        };
    }

    return {
        ghostSuffix: "",
        ghostAcceptDraft: null,
        isBulkHint: false,
        bulkExampleCode: null,
        bulkHintLabel: null,
        chips: [],
        trackingCount: 0,
        isTrackingMode: false,
    };
}
