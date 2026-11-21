import { findAliasesInText } from "./place-aliases";

export interface PlaceRecord {
    name: string;
    slug?: string;
    postalCode?: string;
    division?: string;
}

export interface PlaceDictionary {
    findExact(normalizedName: string): PlaceRecord[];
    findFuzzy(
        normalizedName: string,
        maxDist: number
    ): Array<{ record: PlaceRecord; distance: number }>;
    findByPostalCode(code5: string): PlaceRecord[];
}

export type DestinationMatchReason =
    | "postal_code"
    | "name"
    | "name+postal_code"
    | "alias"
    | "fuzzy";

export interface DestinationCandidate {
    name: string;
    slug?: string;
    postalCode?: string;
    score: number;
    matchedText: string;
    reason: DestinationMatchReason;
}

const STOPWORDS = new Set([
    "mr",
    "mrs",
    "miss",
    "ms",
    "dr",
    "rev",
    "prof",
    "hon",
    "sri",
    "lanka",
    "the",
    "no",
    "to",
    "from",
    "attn",
    "c",
    "o",
]);

const STREET_WORDS = new Set([
    "road",
    "rd",
    "mawatha",
    "mw",
    "mv",
    "lane",
    "ln",
    "street",
    "st",
    "avenue",
    "ave",
    "place",
    "pl",
    "junction",
    "jn",
    "watta",
    "para",
    "veediya",
    "gardens",
    "garden",
    "drive",
    "dr",
    "cross",
]);

const SENDER_BOUNDARY_REGEX = /\b(from|sender|return\s+to)\b\s*:?/i;
const TO_PREFIX_REGEX = /^\s*to\s*:\s*/i;
const NOISE_LINE_REGEX =
    /\b(licen[cs]e|ref(?:erence)?|reg(?:istration)?\s*no|number|tel|phone|mobile|email)\b|@|www\./i;
const STAMP_KEYWORD_REGEX = /\b(branch|post\s*office|p\.?\s*o\.?)\b/i;
const STAMP_DATE_REGEX = /\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/;
const FIVE_DIGIT_CODE_REGEX = /\b\d{5}\b/g;

/**
 * Normalizes a post office or town name for dictionary indexing and matching.
 */
export function normalizePlaceName(raw: string): string {
    return raw
        .toLowerCase()
        .replace(
            /\b(sub\s+post\s+office|post\s+office|g\.?\s*p\.?\s*o\.?|p\.?\s*o\.?|branch|main|sub)\b/gi,
            " "
        )
        .replace(/[^a-z]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function fixOcrWordDigits(token: string): string | null {
    const raw = token.replace(/[^A-Za-z0-9]/g, "");
    if (!raw) return null;

    const letterCount = (raw.match(/[A-Za-z]/g) || []).length;
    const digitCount = (raw.match(/\d/g) || []).length;

    // Only repair OCR digits inside mostly-letter tokens (e.g. NUGEG0DA -> nugegoda)
    if (letterCount < 2 || letterCount <= digitCount) {
        return null;
    }

    const repaired = raw
        .replace(/0/g, "o")
        .replace(/1/g, "l")
        .replace(/5/g, "s")
        .replace(/8/g, "b")
        .toLowerCase()
        .replace(/[^a-z]/g, "");

    return repaired.length >= 2 ? repaired : null;
}

function cleanLineNoiseTokens(line: string): string {
    return line
        // Strip NIC numbers (9 digits + V/X or 12 digits)
        .replace(/\b\d{9}[vVxX]\b/g, " ")
        .replace(/\b\d{12}\b/g, " ")
        // Strip phone / long numeric IDs (9-12 digits)
        .replace(/\b\d{9,12}\b/g, " ")
        // Strip mixed alphanumeric codes with >= 4 digits and >= 1 letter (e.g. B4019219, DANNOOT000907)
        .replace(/\b(?=[A-Za-z0-9-]*\d(?:[A-Za-z0-9-]*\d){3})(?=[A-Za-z0-9-]*[A-Za-z])[A-Za-z0-9-]{5,}\b/g, " ")
        // Strip house/assessment numbers like 544/24 or 3/8
        .replace(/\b\d+[/-]\d+[A-Za-z]?\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function isStampLine(line: string): boolean {
    if (!STAMP_KEYWORD_REGEX.test(line)) return false;
    FIVE_DIGIT_CODE_REGEX.lastIndex = 0;
    return FIVE_DIGIT_CODE_REGEX.test(line) || STAMP_DATE_REGEX.test(line);
}

interface RawCandidateHit {
    record: PlaceRecord;
    baseScore: number;
    matchedText: string;
    reason: Exclude<DestinationMatchReason, "name+postal_code">;
    lineIndex: number;
    inLastSegment: boolean;
    followedByStreetWord: boolean;
}

function recordKey(rec: PlaceRecord): string {
    return rec.slug ? `slug:${rec.slug}` : `name:${normalizePlaceName(rec.name)}`;
}

/**
 * Extracts and ranks likely Sri Lanka destination post offices from OCR text.
 * Pure function (no DOM) so it runs both in the browser scanner and Node unit tests.
 */
export function extractDestinationFromOcr(
    text: string,
    dict: PlaceDictionary
): DestinationCandidate[] {
    if (!text || typeof text !== "string") return [];

    const rawLines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

    if (rawLines.length === 0) return [];

    // Respect explicit To: / From: boundaries
    const toIndex = rawLines.findIndex((l) => TO_PREFIX_REGEX.test(l));
    const startIdx = toIndex >= 0 ? toIndex : 0;

    const scopedLines: string[] = [];
    for (let i = startIdx; i < rawLines.length; i++) {
        let line = rawLines[i];
        if (i === toIndex) {
            line = line.replace(TO_PREFIX_REGEX, "").trim();
        }
        if (SENDER_BOUNDARY_REGEX.test(line)) {
            break;
        }
        if (line) {
            scopedLines.push(line);
        }
    }

    if (scopedLines.length === 0) return [];

    // Filter out noise and postmark stamp lines, then strip embedded noise tokens
    const activeLines: string[] = [];
    for (const line of scopedLines) {
        if (NOISE_LINE_REGEX.test(line)) continue;
        if (isStampLine(line)) continue;
        const cleaned = cleanLineNoiseTokens(line);
        if (cleaned) {
            activeLines.push(cleaned);
        }
    }

    if (activeLines.length === 0) return [];

    const hits: RawCandidateHit[] = [];

    for (let lineIdx = 0; lineIdx < activeLines.length; lineIdx++) {
        const line = activeLines[lineIdx];

        // 1. Standalone 5-digit postal codes
        FIVE_DIGIT_CODE_REGEX.lastIndex = 0;
        let codeMatch: RegExpExecArray | null;
        while ((codeMatch = FIVE_DIGIT_CODE_REGEX.exec(line)) !== null) {
            const code5 = codeMatch[0];
            const matches = dict.findByPostalCode(code5);
            for (const rec of matches) {
                hits.push({
                    record: rec,
                    baseScore: 60,
                    matchedText: code5,
                    reason: "postal_code",
                    lineIndex: lineIdx,
                    inLastSegment: false,
                    followedByStreetWord: false,
                });
            }
        }

        // 2. Sinhala/Tamil script aliases
        const aliasMatches = findAliasesInText(line);
        for (const am of aliasMatches) {
            const normTarget = normalizePlaceName(am.englishName);
            let recs = dict.findExact(normTarget);
            if (recs.length === 0) {
                recs = dict.findFuzzy(normTarget, 1).map((f) => f.record);
            }
            const afterAlias = line.slice(am.index + am.alias.length).trim();
            const isLastSeg = !afterAlias.replace(/[.,;:\s]+/g, "");
            for (const rec of recs) {
                hits.push({
                    record: rec,
                    baseScore: 55,
                    matchedText: am.alias,
                    reason: "alias",
                    lineIndex: lineIdx,
                    inLastSegment: isLastSeg,
                    followedByStreetWord: false,
                });
            }
        }

        // 3. Comma-separated English place phrases (1-3 words)
        const segments = line
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

        for (let segIdx = 0; segIdx < segments.length; segIdx++) {
            const segment = segments[segIdx];
            const inLastSegment = segIdx === segments.length - 1;
            const rawTokens = segment.split(/\s+/).filter(Boolean);

            const wordTokens: Array<{ raw: string; clean: string }> = [];
            for (const tok of rawTokens) {
                const clean = fixOcrWordDigits(tok);
                if (clean) {
                    wordTokens.push({ raw: tok, clean });
                }
            }

            if (wordTokens.length === 0) continue;

            const exactCoveredIndices = new Set<number>();

            for (let len = Math.min(3, wordTokens.length); len >= 1; len--) {
                for (let start = 0; start <= wordTokens.length - len; start++) {
                    const slice = wordTokens.slice(start, start + len);

                    // Skip phrases starting/ending with stopwords or pure street words
                    if (
                        slice.every((t) => STOPWORDS.has(t.clean) || STREET_WORDS.has(t.clean))
                    ) {
                        continue;
                    }
                    if (len === 1 && (STOPWORDS.has(slice[0].clean) || STREET_WORDS.has(slice[0].clean))) {
                        continue;
                    }

                    const phraseNorm = slice.map((t) => t.clean).join(" ");
                    const compactLen = phraseNorm.replace(/\s+/g, "").length;
                    if (compactLen < 3) continue;

                    const nextTok = wordTokens[start + len];
                    const followedByStreetWord = Boolean(
                        nextTok && STREET_WORDS.has(nextTok.clean)
                    );
                    const matchedRaw = slice.map((t) => t.raw).join(" ");

                    const exactRecs = dict.findExact(phraseNorm);
                    if (exactRecs.length > 0) {
                        for (let k = start; k < start + len; k++) {
                            exactCoveredIndices.add(k);
                        }
                        for (const rec of exactRecs) {
                            hits.push({
                                record: rec,
                                baseScore: 50,
                                matchedText: matchedRaw,
                                reason: "name",
                                lineIndex: lineIdx,
                                inLastSegment,
                                followedByStreetWord,
                            });
                        }
                        continue;
                    }

                    // Skip fuzzy sub-phrases already covered by a longer exact match
                    let covered = false;
                    for (let k = start; k < start + len; k++) {
                        if (exactCoveredIndices.has(k)) {
                            covered = true;
                            break;
                        }
                    }
                    if (covered) continue;

                    if (compactLen >= 5) {
                        const maxDist = compactLen >= 8 ? 2 : 1;
                        const fuzzyHits = dict.findFuzzy(phraseNorm, maxDist);
                        for (const fh of fuzzyHits) {
                            hits.push({
                                record: fh.record,
                                baseScore: 50 - 12 * fh.distance,
                                matchedText: matchedRaw,
                                reason: "fuzzy",
                                lineIndex: lineIdx,
                                inLastSegment,
                                followedByStreetWord,
                            });
                        }
                    }
                }
            }
        }
    }

    if (hits.length === 0) return [];

    // Find last place-bearing line (ignoring lines that are only digits / non-word tokens)
    const linesWithPlaceName = new Set<number>();
    for (const h of hits) {
        if (h.reason !== "postal_code") {
            linesWithPlaceName.add(h.lineIndex);
        }
    }

    let lastPlaceLineIdx = -1;
    for (let i = activeLines.length - 1; i >= 0; i--) {
        const hasLettersOrScript = /[A-Za-z\u0D80-\u0DFF\u0B80-\u0BFF]{2,}/.test(activeLines[i]);
        if (hasLettersOrScript && linesWithPlaceName.has(i)) {
            lastPlaceLineIdx = i;
            break;
        }
    }
    if (lastPlaceLineIdx === -1) {
        // Fallback when only postal codes matched
        for (const h of hits) {
            if (h.lineIndex > lastPlaceLineIdx) lastPlaceLineIdx = h.lineIndex;
        }
    }

    // Score each hit and group by office record to merge name + postal_code matches
    interface GroupedCandidate {
        record: PlaceRecord;
        bestNameScore: number | null;
        bestNameMatch: string | null;
        bestNameReason: Exclude<DestinationMatchReason, "postal_code" | "name+postal_code"> | null;
        bestPostalScore: number | null;
        bestPostalMatch: string | null;
    }

    const grouped = new Map<string, GroupedCandidate>();

    for (const h of hits) {
        let score = h.baseScore;
        if (h.lineIndex === lastPlaceLineIdx) score += 25;
        if (h.inLastSegment) score += 10;
        if (h.followedByStreetWord) score -= 40;
        if (h.lineIndex === 0 && activeLines.length > 1 && h.lineIndex !== lastPlaceLineIdx) {
            score -= 15;
        }

        const key = recordKey(h.record);
        let entry = grouped.get(key);
        if (!entry) {
            entry = {
                record: h.record,
                bestNameScore: null,
                bestNameMatch: null,
                bestNameReason: null,
                bestPostalScore: null,
                bestPostalMatch: null,
            };
            grouped.set(key, entry);
        }

        if (h.reason === "postal_code") {
            if (entry.bestPostalScore === null || score > entry.bestPostalScore) {
                entry.bestPostalScore = score;
                entry.bestPostalMatch = h.matchedText;
            }
        } else {
            if (entry.bestNameScore === null || score > entry.bestNameScore) {
                entry.bestNameScore = score;
                entry.bestNameMatch = h.matchedText;
                entry.bestNameReason = h.reason;
            }
        }
    }

    const ranked: DestinationCandidate[] = [];
    for (const entry of grouped.values()) {
        if (entry.bestNameScore !== null && entry.bestPostalScore !== null) {
            ranked.push({
                name: entry.record.name,
                slug: entry.record.slug,
                postalCode: entry.record.postalCode,
                score: Math.max(entry.bestNameScore, entry.bestPostalScore) + 40,
                matchedText: `${entry.bestNameMatch} (${entry.bestPostalMatch})`,
                reason: "name+postal_code",
            });
        } else if (entry.bestNameScore !== null && entry.bestNameReason) {
            ranked.push({
                name: entry.record.name,
                slug: entry.record.slug,
                postalCode: entry.record.postalCode,
                score: entry.bestNameScore,
                matchedText: entry.bestNameMatch || entry.record.name,
                reason: entry.bestNameReason,
            });
        } else if (entry.bestPostalScore !== null) {
            ranked.push({
                name: entry.record.name,
                slug: entry.record.slug,
                postalCode: entry.record.postalCode,
                score: entry.bestPostalScore,
                matchedText: entry.bestPostalMatch || entry.record.postalCode || entry.record.name,
                reason: "postal_code",
            });
        }
    }

    ranked.sort((a, b) => b.score - a.score);
    if (ranked.length === 0 || ranked[0].score < 35) {
        return [];
    }

    return ranked.slice(0, 3);
}
