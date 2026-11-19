import type { EmsCountry } from "./rate-types";
import { getLocalizedCountryName } from "./calculator-ui";
import { COUNTRY_ALIASES } from "./smart-search";

export const POPULAR_COUNTRY_CODES = [
    "GB",
    "US",
    "AU",
    "AE",
    "CA",
    "JP",
    "IN",
    "SG",
    "DE",
    "TW",
] as const;

/** Precomputed map of ISO code -> list of lowercase compact aliases from COUNTRY_ALIASES. */
const ALIASES_BY_CODE: Record<string, string[]> = (() => {
    const map: Record<string, string[]> = {};
    for (const [alias, code] of Object.entries(COUNTRY_ALIASES)) {
        const key = code.toUpperCase();
        if (!map[key]) map[key] = [];
        map[key].push(alias.toLowerCase());
    }
    return map;
})();

function normalizeCompact(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    let prev = new Array<number>(b.length + 1);
    let curr = new Array<number>(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;

    for (let i = 1; i <= a.length; i++) {
        curr[0] = i;
        const ca = a.charCodeAt(i - 1);
        for (let j = 1; j <= b.length; j++) {
            const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
            curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
        }
        [prev, curr] = [curr, prev];
    }
    return prev[b.length];
}

function scoreCountryMatch(
    country: EmsCountry,
    rawQuery: string,
    compactQuery: string,
    locale: string
): number {
    const code = country.code.toUpperCase();
    const codeLower = code.toLowerCase();
    const engLower = country.name.toLowerCase();
    const locLower = getLocalizedCountryName(code, country.name, locale).toLowerCase();
    const siLower = getLocalizedCountryName(code, country.name, "si").toLowerCase();
    const taLower = getLocalizedCountryName(code, country.name, "ta").toLowerCase();

    // 1. Exact ISO code or exact name match
    if (rawQuery === codeLower || rawQuery === engLower || rawQuery === locLower) {
        return 100;
    }

    // 2. Exact alias match (e.g., "uk", "usa", "uae", "dubai", "thaiwan", "holland", "swiss")
    if (compactQuery && COUNTRY_ALIASES[compactQuery] === code) {
        return 95;
    }

    // 3. Prefix match on localized or English name
    if (locLower.startsWith(rawQuery) || engLower.startsWith(rawQuery)) {
        return 90;
    }

    // 4. Word-start match (e.g. "kingdom" -> United Kingdom, "korea" -> South Korea)
    const engWords = engLower.split(/[\s\-()]+/).filter(Boolean);
    const locWords = locLower.split(/[\s\-()]+/).filter(Boolean);
    if (
        engWords.some((w) => w.startsWith(rawQuery)) ||
        locWords.some((w) => w.startsWith(rawQuery))
    ) {
        return 82;
    }

    // 5. Prefix match on aliases (e.g. "dub" -> "dubai" -> AE, "brit" -> "britain" -> GB)
    const aliases = ALIASES_BY_CODE[code] ?? [];
    if (compactQuery.length >= 2 && aliases.some((a) => a.startsWith(compactQuery))) {
        return 75;
    }

    // 6. Substring match across English, active locale, Sinhala, and Tamil names
    if (
        engLower.includes(rawQuery) ||
        locLower.includes(rawQuery) ||
        siLower.includes(rawQuery) ||
        taLower.includes(rawQuery)
    ) {
        return 65;
    }

    // 7. Compact substring match (handles spaces/hyphens omitted, e.g. "newzealand", "saudiarabia")
    const engCompact = normalizeCompact(engLower);
    if (compactQuery.length >= 3 && engCompact.includes(compactQuery)) {
        return 60;
    }

    // 8. Fuzzy typo tolerance for 4+ character ASCII queries (e.g. "austrlia", "germny", "switerland")
    if (compactQuery.length >= 4) {
        const maxDist = compactQuery.length >= 6 ? 2 : 1;
        const candidates = [engCompact, ...engWords.map(normalizeCompact), ...aliases];
        let bestDist = Infinity;
        for (const cand of candidates) {
            if (!cand || Math.abs(cand.length - compactQuery.length) > maxDist) continue;
            const d = levenshtein(compactQuery, cand);
            if (d < bestDist) bestDist = d;
            if (bestDist === 1) break;
        }
        if (bestDist <= maxDist) {
            return bestDist === 1 ? 50 : 40;
        }
    }

    return 0;
}

/**
 * Filters and ranks countries by ISO code, English/Sinhala/Tamil name,
 * common aliases/cities, and lightweight typo tolerance.
 */
export function filterCountries(
    countries: EmsCountry[],
    query: string,
    locale: string = "en"
): EmsCountry[] {
    const rawQuery = query.trim().toLowerCase();
    if (!rawQuery) return countries;

    const compactQuery = normalizeCompact(rawQuery);
    const scored: { country: EmsCountry; score: number }[] = [];

    for (const country of countries) {
        const score = scoreCountryMatch(country, rawQuery, compactQuery, locale);
        if (score > 0) {
            scored.push({ country, score });
        }
    }

    scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.country.name.localeCompare(b.country.name);
    });

    return scored.map((entry) => entry.country);
}
