import {
    DEFAULT_RATE_CONFIG,
    calculateAllDomesticServices,
    calculateAllInternationalServices,
    calculateCodPostage,
    formatWeightLabel,
    type CodPostageResult,
    type RateConfig,
} from "./postage-rates";
import {
    getLocalizedCountryName,
    getLocalizedZoneName,
    getServiceTagline,
} from "./calculator-ui";
import {
    classifyBarcode,
    detectTrackingQuery,
    getBarcodePrefixLabel,
} from "./tracking/classifier";
import type { BarcodeClassification } from "./tracking/types";
import {
    computeMailRoute,
    parseRouteQueryPair,
    resolveOfficeForRoute,
    type ComputedMailRoute,
    type RoutingOfficeNode,
} from "./mail-routing";
import { parseSingleSidedRouteQuery } from "./staff-station";

export interface SmartQuoteItem {
    serviceId: string;
    name: string;
    shortName: string;
    transport?: "air" | "sea";
    totalLkr: number;
    isCheapest?: boolean;
    tierLabel: string;
}

export interface InternationalRateIntent {
    kind: "international";
    countryCode: string;
    countryName: string;
    zoneLabel: string;
    matchedQueryToken: string;
    isFuzzyMatch: boolean;
    weightGrams: number;
    hasExplicitWeight: boolean;
    transport: "air" | "sea";
    preferredServiceId?: string;
    quotes: SmartQuoteItem[];
    calculatorHref: {
        pathname: "/calculator";
        query: Record<string, string>;
    };
    seoRatesHref: string;
}

export interface CodRateIntent {
    kind: "cod";
    weightGrams: number;
    hasExplicitWeight: boolean;
    codAmountLkr: number;
    result: CodPostageResult;
    calculatorHref: {
        pathname: "/calculator";
        query: Record<string, string>;
    };
    seoRatesHref: string;
}

export interface DomesticRateIntent {
    kind: "domestic";
    weightGrams: number;
    hasExplicitWeight: boolean;
    preferredServiceId: string;
    registered: boolean;
    quotes: SmartQuoteItem[];
    calculatorHref: {
        pathname: "/calculator";
        query: Record<string, string>;
    };
    seoRatesHref: string;
}

export interface TrackingIntent {
    kind: "tracking";
    barcodes: string[];
    primaryBarcode: string;
    classification: BarcodeClassification;
    serviceHint: string;
    hasExplicitWeight: false;
    trackHref: string;
}

export interface RouteIntent {
    kind: "route";
    originQuery: string;
    destQuery: string;
    origin: RoutingOfficeNode;
    dest: RoutingOfficeNode;
    originFuzzy: boolean;
    destFuzzy: boolean;
    route: ComputedMailRoute;
    routingHref: string;
}

export type SmartSearchIntent =
    | TrackingIntent
    | InternationalRateIntent
    | CodRateIntent
    | DomesticRateIntent;

export const COUNTRY_ALIASES: Record<string, string> = {
    // Taiwan (including the user-tested "thaiwan" typo)
    taiwan: "TW",
    thaiwan: "TW",
    thiwan: "TW",
    taiwanese: "TW",
    taipei: "TW",
    formosa: "TW",
    // United Kingdom
    uk: "GB",
    u_k: "GB",
    britain: "GB",
    greatbritain: "GB",
    england: "GB",
    scotland: "GB",
    wales: "GB",
    london: "GB",
    unitedkingdom: "GB",
    // United States
    usa: "US",
    u_s_a: "US",
    america: "US",
    unitedstates: "US",
    newyork: "US",
    california: "US",
    // United Arab Emirates
    uae: "AE",
    dubai: "AE",
    abudhabi: "AE",
    sharjah: "AE",
    emirates: "AE",
    // Australia & New Zealand
    aus: "AU",
    aussie: "AU",
    astralia: "AU",
    austrailia: "AU",
    sydney: "AU",
    melbourne: "AU",
    nz: "NZ",
    newzealand: "NZ",
    auckland: "NZ",
    // East & Southeast Asia
    korea: "KR",
    southkorea: "KR",
    seoul: "KR",
    japan: "JP",
    jappan: "JP",
    tokyo: "JP",
    osaka: "JP",
    china: "CN",
    beijing: "CN",
    shanghai: "CN",
    hongkong: "HK",
    singapore: "SG",
    singapoor: "SG",
    singapor: "SG",
    malaysia: "MY",
    malasiya: "MY",
    malayasia: "MY",
    kualalumpur: "MY",
    thailand: "TH",
    tailand: "TH",
    bangkok: "TH",
    philippines: "PH",
    philipines: "PH",
    phillipines: "PH",
    manila: "PH",
    indonesia: "ID",
    jakarta: "ID",
    vietnam: "VN",
    // South Asia
    india: "IN",
    chennai: "IN",
    mumbai: "IN",
    delhi: "IN",
    maldives: "MV",
    male: "MV",
    bangladesh: "BD",
    dhaka: "BD",
    pakistan: "PK",
    karachi: "PK",
    nepal: "NP",
    kathmandu: "NP",
    // Middle East
    saudi: "SA",
    saudiarabia: "SA",
    riyadh: "SA",
    jeddah: "SA",
    ksa: "SA",
    qatar: "QA",
    quatar: "QA",
    doha: "QA",
    kuwait: "KW",
    oman: "OM",
    muscat: "OM",
    bahrain: "BH",
    jordan: "JO",
    lebanon: "LB",
    israel: "IL",
    egypt: "EG",
    cairo: "EG",
    // Europe & North America
    canada: "CA",
    caneda: "CA",
    toronto: "CA",
    vancouver: "CA",
    germany: "DE",
    deutschland: "DE",
    berlin: "DE",
    france: "FR",
    paris: "FR",
    italy: "IT",
    rome: "IT",
    milan: "IT",
    netherlands: "NL",
    holland: "NL",
    amsterdam: "NL",
    switzerland: "CH",
    swiss: "CH",
    zurich: "CH",
    sweden: "SE",
    stockholm: "SE",
    norway: "NO",
    oslo: "NO",
    denmark: "DK",
    finland: "FI",
    spain: "ES",
    madrid: "ES",
    portugal: "PT",
    poland: "PL",
    austria: "AT",
    vienna: "AT",
    belgium: "BE",
    brussels: "BE",
    ireland: "IE",
    dublin: "IE",
    greece: "GR",
    cyprus: "CY",
    turkey: "TR",
    turkiye: "TR",
    istanbul: "TR",
    russia: "RU",
    moscow: "RU",
    ukraine: "UA",
    brazil: "BR",
    southafrica: "ZA",
    kenya: "KE",
};

const STOP_WORDS = new Set([
    "to",
    "for",
    "in",
    "of",
    "post",
    "office",
    "postage",
    "rate",
    "rates",
    "price",
    "cost",
    "send",
    "shipping",
    "mail",
    "air",
    "sea",
    "ems",
    "parcel",
    "letter",
    "packet",
    "item",
    "weight",
    "kg",
    "kgs",
    "kilo",
    "kilos",
    "g",
    "gm",
    "gms",
    "gram",
    "grams",
    "cod",
    "rs",
    "lkr",
    "usd",
]);

function normalizePhonetic(word: string): string {
    return word
        .toLowerCase()
        .replace(/[^a-z]/g, "")
        .replace(/^thai/, "tai")
        .replace(/ph/g, "f")
        .replace(/(.)\1+/g, "$1");
}

/**
 * Bounded Damerau-Levenshtein edit distance (transpositions + insertions + deletions + substitutions).
 */
export function editDistance(a: string, b: string): number {
    if (a === b) return 0;
    const la = a.length;
    const lb = b.length;
    if (Math.abs(la - lb) > 3) return 99;

    const dp: number[][] = Array.from({ length: la + 1 }, () =>
        new Array<number>(lb + 1).fill(0)
    );
    for (let i = 0; i <= la; i++) dp[i][0] = i;
    for (let j = 0; j <= lb; j++) dp[0][j] = j;

    for (let i = 1; i <= la; i++) {
        for (let j = 1; j <= lb; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            );
            if (
                i > 1 &&
                j > 1 &&
                a[i - 1] === b[j - 2] &&
                a[i - 2] === b[j - 1]
            ) {
                dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
            }
        }
    }
    return dp[la][lb];
}

/**
 * Extracts a weight in grams from a free-text query (e.g. "thaiwan 5kg" -> 5000, "250g" -> 250, "1.5 kg" -> 1500).
 */
export function extractWeightFromQuery(rawQuery: string): {
    weightGrams: number | null;
    cleanedQuery: string;
} {
    const regex =
        /(?:^|\s)(\d+(?:\.\d+)?)\s*(kg|kgs|kilo|kilos|kilogram|kilograms|g|gm|gms|gram|grams|කි\.?ග්‍රෑ\.?|ග්‍රෑම්|கி\.?கி\.?|கிராம்)(?=\s|$)/i;
    const match = rawQuery.match(regex);
    if (!match) {
        return { weightGrams: null, cleanedQuery: rawQuery };
    }

    const num = parseFloat(match[1]);
    if (!Number.isFinite(num) || num <= 0) {
        return { weightGrams: null, cleanedQuery: rawQuery };
    }

    const unit = match[2].toLowerCase();
    const isKg =
        unit.startsWith("k") ||
        unit.includes("කි") ||
        unit.includes("கி");
    const grams = Math.round(isKg ? num * 1000 : num);
    const clamped = Math.min(Math.max(grams, 10), 40000);
    const cleanedQuery = rawQuery.replace(match[0], " ").replace(/\s+/g, " ").trim();

    return { weightGrams: clamped, cleanedQuery };
}

/**
 * Matches a country (including fuzzy typos like "thaiwan" or aliases like "uk", "dubai") from query text.
 */
export function matchSmartCountry(
    queryText: string,
    config: RateConfig = DEFAULT_RATE_CONFIG
): {
    countryCode: string;
    matchedToken: string;
    isFuzzyMatch: boolean;
} | null {
    const trimmed = queryText.trim();
    if (!trimmed || trimmed.length < 2) return null;

    const lowerFull = trimmed.toLowerCase();
    const collapsedFull = lowerFull.replace(/[^a-z0-9]/g, "");

    // 1. Direct multi-word or alias match on the full cleaned text
    if (COUNTRY_ALIASES[collapsedFull]) {
        const code = COUNTRY_ALIASES[collapsedFull];
        const country = config.emsCountries.find((c) => c.code === code);
        const exactName = country?.name.toLowerCase() === lowerFull;
        return {
            countryCode: code,
            matchedToken: trimmed,
            isFuzzyMatch: !exactName && collapsedFull.length >= 4 && !["uk", "usa", "uae", "aus", "nz", "ksa"].includes(collapsedFull),
        };
    }

    // 2. Check localized Sinhala & Tamil country names
    for (const c of config.emsCountries) {
        const siName = getLocalizedCountryName(c.code, c.name, "si");
        const taName = getLocalizedCountryName(c.code, c.name, "ta");
        if (
            (siName && trimmed.includes(siName)) ||
            (taName && trimmed.includes(taName))
        ) {
            return {
                countryCode: c.code,
                matchedToken: trimmed,
                isFuzzyMatch: false,
            };
        }
    }

    // 3. Check exact or prefix country name match in query
    for (const c of config.emsCountries) {
        const cLower = c.name.toLowerCase();
        if (lowerFull === cLower || lowerFull.includes(cLower)) {
            return {
                countryCode: c.code,
                matchedToken: c.name,
                isFuzzyMatch: false,
            };
        }
    }

    // 4. Token-by-token alias, prefix, phonetic, and fuzzy edit-distance match
    const tokens = trimmed.split(/\s+/).filter(Boolean);
    for (const rawToken of tokens) {
        const cleanToken = rawToken.toLowerCase().replace(/[^a-z]/g, "");
        if (!cleanToken || STOP_WORDS.has(cleanToken)) continue;

        if (COUNTRY_ALIASES[cleanToken]) {
            const code = COUNTRY_ALIASES[cleanToken];
            const country = config.emsCountries.find((c) => c.code === code);
            const isExact = country?.name.toLowerCase() === cleanToken;
            const isShortAlias = ["uk", "usa", "uae", "aus", "nz", "hk", "sg", "ksa"].includes(cleanToken);
            return {
                countryCode: code,
                matchedToken: rawToken,
                isFuzzyMatch: !isExact && !isShortAlias,
            };
        }

        // Prefix match for tokens >= 4 chars (e.g. "taiw", "austra", "singap")
        if (cleanToken.length >= 4) {
            const prefixHit = config.emsCountries.find((c) =>
                c.name.toLowerCase().startsWith(cleanToken)
            );
            if (prefixHit) {
                return {
                    countryCode: prefixHit.code,
                    matchedToken: rawToken,
                    isFuzzyMatch: false,
                };
            }
        }

        // Phonetic & Damerau-Levenshtein match for tokens >= 5 chars
        if (cleanToken.length >= 5) {
            const tokenPhonetic = normalizePhonetic(cleanToken);
            let bestCode: string | null = null;
            let bestDist = 99;

            for (const c of config.emsCountries) {
                const cWords = c.name.toLowerCase().split(/\s+/);
                for (const cw of cWords) {
                    const cwClean = cw.replace(/[^a-z]/g, "");
                    if (cwClean.length < 4) continue;
                    if (normalizePhonetic(cwClean) === tokenPhonetic) {
                        return {
                            countryCode: c.code,
                            matchedToken: rawToken,
                            isFuzzyMatch: cwClean !== cleanToken,
                        };
                    }
                    const dist = editDistance(cleanToken, cwClean);
                    const maxAllowed = cwClean.length >= 7 ? 2 : 1;
                    if (dist <= maxAllowed && dist < bestDist) {
                        bestDist = dist;
                        bestCode = c.code;
                    }
                }
            }

            if (bestCode) {
                return {
                    countryCode: bestCode,
                    matchedToken: rawToken,
                    isFuzzyMatch: true,
                };
            }
        }
    }

    return null;
}

/**
 * Parses a Home search bar query into a structured SmartSearchIntent (if it matches
 * an International destination, COD query, or Domestic rate/weight query).
 */
export function parseSmartSearchIntent(
    rawQuery: string,
    locale: string = "en",
    overrideWeightGrams?: number | null,
    config: RateConfig = DEFAULT_RATE_CONFIG
): SmartSearchIntent | null {
    const trimmed = rawQuery.trim();
    if (!trimmed) return null;

    // Pure 5-digit Sri Lankan postal codes (e.g. "20000", "00100", "22200") are post office lookups
    if (/^\d{5}$/.test(trimmed)) {
        return null;
    }

    // 0. Check Parcel / Mail Tracking barcode intent FIRST
    // (Must run before COD/country matching so e.g. "BD070817564LK" doesn't collide with BD/Bangladesh)
    const detectedBarcodes = detectTrackingQuery(trimmed);
    if (detectedBarcodes.length > 0) {
        const primaryBarcode = detectedBarcodes[0];
        const classification = classifyBarcode(primaryBarcode);
        const trackHref =
            detectedBarcodes.length === 1
                ? `/track/${encodeURIComponent(primaryBarcode)}`
                : `/track?q=${encodeURIComponent(detectedBarcodes.join(","))}`;
        return {
            kind: "tracking",
            barcodes: detectedBarcodes,
            primaryBarcode,
            classification,
            serviceHint: getBarcodePrefixLabel(primaryBarcode),
            hasExplicitWeight: false,
            trackHref,
        };
    }

    const { weightGrams: parsedWeight, cleanedQuery } = extractWeightFromQuery(trimmed);
    const hasExplicitWeight = parsedWeight !== null;
    const lower = trimmed.toLowerCase();

    // 1. Check COD intent first ("cod", "cod 5000", "cod 5000 1kg", "cash on delivery")
    const isCodQuery =
        /\bcod\b/i.test(lower) ||
        lower.includes("cash on delivery") ||
        lower.includes("භාණ්ඩ ලැබීමේදී") ||
        lower.includes("பெறும்போது பணம்");

    if (isCodQuery) {
        const weightGrams = overrideWeightGrams ?? parsedWeight ?? 250;
        // Extract COD collection amount from remaining numbers in cleanedQuery
        const amountMatches = cleanedQuery.match(/\b(\d{3,6})\b/g);
        let codAmountLkr = 2500;
        if (amountMatches && amountMatches.length > 0) {
            const candidate = parseInt(amountMatches[0], 10);
            if (Number.isFinite(candidate) && candidate > 0) {
                codAmountLkr = Math.min(Math.max(candidate, 100), 100000);
            }
        }

        const result = calculateCodPostage(config, weightGrams, codAmountLkr);
        return {
            kind: "cod",
            weightGrams,
            hasExplicitWeight,
            codAmountLkr,
            result,
            calculatorHref: {
                pathname: "/calculator",
                query: {
                    mode: "cod",
                    weight: String(weightGrams),
                    codAmount: String(codAmountLkr),
                },
            },
            seoRatesHref: "/rates/cod",
        };
    }

    // 2. Check International Country intent (e.g., "thaiwan", "taiwan 5kg", "uk 250g", "japan ems")
    const countryMatch = matchSmartCountry(cleanedQuery || trimmed, config);
    if (countryMatch) {
        const country =
            config.emsCountries.find((c) => c.code === countryMatch.countryCode) ??
            config.emsCountries[0];
        const zone = config.emsZones.find((z) => z.id === country?.zoneId);
        const localizedCountryName = getLocalizedCountryName(
            country.code,
            country.name,
            locale
        );
        const localizedZone = getLocalizedZoneName(
            zone?.id,
            zone?.name ?? "EMS Zone",
            locale
        );

        const weightGrams = overrideWeightGrams ?? parsedWeight ?? 250;
        const wantsSea = /\b(sea|surface|ship)\b/i.test(lower);
        const wantsEms = /\b(ems|express|speed)\b/i.test(lower);
        const allQuotes = calculateAllInternationalServices(
            config,
            country.code,
            weightGrams
        );

        const validQuotes = allQuotes.filter(
            (q) => q.available && !q.result.error && !q.result.exceedsMaxWeight
        );

        // Pick up to 3 most useful quotes to preview (e.g. Cheapest Air/Printed/Parcel, EMS Express, and Sea Mail)
        const cheapestOverall = validQuotes.reduce<number | null>(
            (min, q) =>
                min === null || q.result.totalCost < min ? q.result.totalCost : min,
            null
        );

        const airQuotes = validQuotes.filter((q) => q.service.transport === "air");
        const seaQuotes = validQuotes.filter((q) => q.service.transport === "sea");

        const selectedPreviewQuotes: SmartQuoteItem[] = [];
        const pushQuote = (q: (typeof validQuotes)[number] | undefined) => {
            if (!q) return;
            if (selectedPreviewQuotes.some((item) => item.serviceId === q.service.id)) return;
            const tag = getServiceTagline(q.service.id, locale);
            selectedPreviewQuotes.push({
                serviceId: q.service.id,
                name: tag.name || q.service.name,
                shortName: tag.shortName || q.service.shortName,
                transport: q.service.transport,
                totalLkr: q.result.totalCost,
                isCheapest:
                    cheapestOverall !== null &&
                    q.result.totalCost === cheapestOverall &&
                    validQuotes.length > 1,
                tierLabel: q.result.tierLabel,
            });
        };

        // 1st slot: Cheapest air option (Air Letter / Printed Matter / U-Packet / Air Parcel)
        const cheapestAir = [...airQuotes].sort(
            (a, b) => a.result.totalCost - b.result.totalCost
        )[0];
        pushQuote(cheapestAir);

        // 2nd slot: EMS Express (or next air service)
        const emsQuote = airQuotes.find((q) => q.service.id === "ems");
        pushQuote(emsQuote ?? airQuotes[1]);

        // 3rd slot: Best Sea Mail option (or remaining air option)
        const cheapestSea = [...seaQuotes].sort(
            (a, b) => a.result.totalCost - b.result.totalCost
        )[0];
        pushQuote(cheapestSea ?? airQuotes[2]);

        const preferredServiceId = wantsEms
            ? "ems"
            : wantsSea
                ? (cheapestSea?.service.id ?? "sea_parcel")
                : (cheapestAir?.service.id ?? "ems");

        const countrySlug = country.name
            .toLowerCase()
            .replace(/&/g, "and")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
        const weightSlug =
            weightGrams >= 1000
                ? `${Number.isInteger(weightGrams / 1000) ? weightGrams / 1000 : Number((weightGrams / 1000).toFixed(2))}kg`
                : `${Math.round(weightGrams)}g`;

        return {
            kind: "international",
            countryCode: country.code,
            countryName: localizedCountryName,
            zoneLabel: `${localizedZone.short} · Group ${country.group}`,
            matchedQueryToken: countryMatch.matchedToken,
            isFuzzyMatch: countryMatch.isFuzzyMatch,
            weightGrams,
            hasExplicitWeight,
            transport: wantsSea ? "sea" : "air",
            preferredServiceId,
            quotes: selectedPreviewQuotes,
            calculatorHref: {
                pathname: "/calculator",
                query: {
                    mode: "intl",
                    country: country.code,
                    weight: String(weightGrams),
                    ...(wantsSea ? { transport: "sea" } : {}),
                    ...(preferredServiceId ? { service: preferredServiceId } : {}),
                },
            },
            seoRatesHref: `/rates/${countrySlug}/${weightSlug}`,
        };
    }

    // 3. Check Domestic Service or Weight intent ("500g registered letter", "2kg parcel", "slp courier 1kg", "5kg")
    const hasDomesticKeyword =
        /\b(letter|parcel|courier|slp|speed\s*post|registered|open\s*article|printed|postcard|newspaper|local|domestic)\b/i.test(
            lower
        );

    if (hasExplicitWeight || hasDomesticKeyword) {
        const weightGrams =
            overrideWeightGrams ??
            parsedWeight ??
            (/\b(parcel|courier|slp)\b/i.test(lower) ? 1000 : 50);
        const registered = /\b(registered|reg)\b/i.test(lower);

        let preferredServiceId = "letter";
        if (/\b(courier|slp|speed)\b/i.test(lower)) preferredServiceId = "courier";
        else if (/\bparcel\b/i.test(lower) || weightGrams > 2000) preferredServiceId = "parcel";
        else if (/\b(open|printed)\b/i.test(lower)) preferredServiceId = "open_article";
        else if (/\bpostcard\b/i.test(lower)) preferredServiceId = "postcard";
        else if (/\bnewspaper\b/i.test(lower)) preferredServiceId = "newspaper";

        const allDom = calculateAllDomesticServices(config, weightGrams, {
            registered,
            arReceipt: false,
        });
        const validDom = allDom.filter(
            (q) => !q.result.error && !q.result.exceedsMaxWeight
        );
        const cheapestCost = validDom.reduce<number | null>(
            (min, q) =>
                min === null || q.result.totalCost < min ? q.result.totalCost : min,
            null
        );

        const quotes: SmartQuoteItem[] = validDom.slice(0, 4).map((q) => {
            const tag = getServiceTagline(q.service.id, locale);
            return {
                serviceId: q.service.id,
                name: tag.name || q.service.name,
                shortName: tag.shortName || q.service.shortName || q.service.name,
                totalLkr: q.result.totalCost,
                isCheapest:
                    cheapestCost !== null &&
                    q.result.totalCost === cheapestCost &&
                    validDom.length > 1,
                tierLabel: q.result.tierLabel,
            };
        });

        return {
            kind: "domestic",
            weightGrams,
            hasExplicitWeight,
            preferredServiceId,
            registered,
            quotes,
            calculatorHref: {
                pathname: "/calculator",
                query: {
                    mode: "local",
                    weight: String(weightGrams),
                    service: preferredServiceId,
                    ...(registered ? { registered: "1" } : {}),
                },
            },
            seoRatesHref: "/rates/local",
        };
    }

    return null;
}

export const SMART_WEIGHT_CHIPS = [100, 250, 500, 1000, 2000, 5000, 10000];

/**
 * Resolves a natural route query such as "kandy to jafna", "20000 to 40000", or
 * (when a staff Duty Station is set) single-sided queries like "to jafna" / "-> 40000"
 * against the loaded Sri Lanka Post routing graph, while guarding international
 * rate queries like "colombo to taiwan" or "to uk 1kg".
 */
export function resolveSmartRouteIntent(
    rawQuery: string,
    nodes: RoutingOfficeNode[],
    defaultOriginSlug?: string | null,
    config: RateConfig = DEFAULT_RATE_CONFIG
): RouteIntent | null {
    if (nodes.length === 0) return null;

    const pair = parseRouteQueryPair(rawQuery);
    if (pair) {
        // Do not hijack international rate queries like "colombo to taiwan" or "kandy to uk"
        if (matchSmartCountry(pair.destQuery, config)) {
            return null;
        }

        const originMatch = resolveOfficeForRoute(pair.originQuery, nodes);
        const destMatch = resolveOfficeForRoute(pair.destQuery, nodes);
        if (!originMatch || !destMatch) return null;

        const route = computeMailRoute(originMatch.office, destMatch.office, nodes);
        return {
            kind: "route",
            originQuery: pair.originQuery,
            destQuery: pair.destQuery,
            origin: originMatch.office,
            dest: destMatch.office,
            originFuzzy: originMatch.isFuzzyMatch,
            destFuzzy: destMatch.isFuzzyMatch,
            route,
            routingHref: `/routing?from=${encodeURIComponent(originMatch.office.slug)}&to=${encodeURIComponent(destMatch.office.slug)}`,
        };
    }

    if (!defaultOriginSlug) return null;
    const singleDest = parseSingleSidedRouteQuery(rawQuery);
    if (!singleDest) return null;

    // Never hijack weight or international queries such as "to uk 1kg" or "to taiwan"
    if (
        extractWeightFromQuery(singleDest).weightGrams !== null ||
        matchSmartCountry(singleDest, config)
    ) {
        return null;
    }

    const originNode = nodes.find((n) => n.slug === defaultOriginSlug);
    if (!originNode) return null;

    const destMatch = resolveOfficeForRoute(singleDest, nodes);
    if (!destMatch || destMatch.office.id === originNode.id) return null;

    const route = computeMailRoute(originNode, destMatch.office, nodes);
    return {
        kind: "route",
        originQuery: originNode.name,
        destQuery: singleDest,
        origin: originNode,
        dest: destMatch.office,
        originFuzzy: false,
        destFuzzy: destMatch.isFuzzyMatch,
        route,
        routingHref: `/routing?from=${encodeURIComponent(originNode.slug)}&to=${encodeURIComponent(destMatch.office.slug)}`,
    };
}

/**
 * Returns 12 localized cycling search bar placeholder examples showcasing
 * post offices, postcodes, areas, international country + weight rates,
 * COD calculations, and upcoming tracking.
 */
export function getSearchCyclingExamples(locale: string = "en"): string[] {
    if (locale === "si") {
        return [
            'විදේශ ගාස්තු: "Taiwan 5kg"',
            'මාර්ග සෙවුම: "Kandy to Jaffna"',
            'කාර්යාල: "Nuwara Eliya", "22200"',
            'COD ගාස්තු: "COD 5000 1kg"',
            'විදේශ පාර්සල්: "Australia 2kg"',
            'ප්‍රදේශය: "Nugegoda", "Galle"',
            'ගුවන්/මුහුදු: "Dubai 1.5kg"',
            'දේශීය ලිපි: "500g letter"',
            'තැපැල් කේත: "00100", "20000"',
            'කුරියර්: "SLP Courier 1kg"',
            'විදේශ EMS: "Japan 1kg", "UK 250g"',
            'උප කාර්යාල: "Peradeniya"',
            'පාර්සල් ලුහුබැඳීම: "BD070817564LK"',
        ];
    }
    if (locale === "ta") {
        return [
            'வெளிநாட்டு கட்டணம்: "Taiwan 5kg"',
            'வழி தேடல்: "Kandy to Jaffna"',
            'நிலையம்: "Nuwara Eliya", "22200"',
            'COD கட்டணம்: "COD 5000 1kg"',
            'வெளிநாட்டு பார்சல்: "Australia 2kg"',
            'பகுதி: "Nugegoda", "Galle"',
            'வான் & கடல்: "Dubai 1.5kg"',
            'உள்நாட்டு அஞ்சல்: "500g letter"',
            'குறியீடு: "00100", "20000"',
            'கூரியர்: "SLP Courier 1kg"',
            'வெளிநாட்டு EMS: "Japan 1kg"',
            'உப நிலையம்: "Peradeniya"',
            'பார்சல் கண்காணிப்பு: "BD070817564LK"',
        ];
    }
    return [
        'Try "Taiwan 5kg" · overseas rates',
        'Mail route: "Kandy to Jaffna"',
        'Office or code: "Nuwara Eliya", "22200"',
        'Calculate COD: "COD 5000 1kg"',
        'Send abroad: "Australia 2kg", "UK 250g"',
        'Search area: "Nugegoda", "Galle Fort"',
        'Air & Sea mail: "Dubai 1.5kg"',
        'Local post: "500g registered letter"',
        'Lookup postcodes: "00100", "20000"',
        'Domestic courier: "SLP Courier 1kg"',
        'Overseas EMS: "Japan 1kg", "USA 1kg"',
        'Sub offices: "Peradeniya", "Dehiwala"',
        'Track parcel: "BD070817564LK", "NA055922175LK"',
    ];
}

export { formatWeightLabel };
