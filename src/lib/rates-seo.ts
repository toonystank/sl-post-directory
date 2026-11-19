import {
    DEFAULT_RATE_CONFIG,
    calculateAllInternationalServices,
    formatWeightLabel,
    type RateConfig,
} from "./postage-rates";
import type { EmsCountry } from "./rate-types";
import { matchSmartCountry } from "./smart-search";
import { getLocalizedCountryName, getLocalizedZoneName } from "./calculator-ui";
import { buildLocalizedUrl } from "./site";

/**
 * Top international destinations frequently searched from Sri Lanka.
 * Used for pre-building static weight-specific SEO pages and internal links.
 */
export const TOP_SEO_COUNTRY_CODES = [
    "TW", // Taiwan
    "GB", // United Kingdom
    "US", // United States
    "AU", // Australia
    "CA", // Canada
    "AE", // United Arab Emirates
    "JP", // Japan
    "KR", // South Korea
    "SG", // Singapore
    "MY", // Malaysia
    "IN", // India
    "DE", // Germany
    "FR", // France
    "IT", // Italy
    "NL", // Netherlands
    "CH", // Switzerland
    "NZ", // New Zealand
    "QA", // Qatar
    "SA", // Saudi Arabia
    "KW", // Kuwait
    "OM", // Oman
    "BH", // Bahrain
    "CN", // China
    "HK", // Hong Kong
    "TH", // Thailand
    "ID", // Indonesia
    "PH", // Philippines
    "VN", // Vietnam
    "MV", // Maldives
    "BD", // Bangladesh
    "PK", // Pakistan
    "SE", // Sweden
    "NO", // Norway
    "IE", // Ireland
    "ES", // Spain
    "CY", // Cyprus
] as const;

export const POPULAR_WEIGHT_GRAMS = [250, 500, 1000, 2000, 5000] as const;
export const TABLE_WEIGHT_GRAMS = [100, 250, 500, 1000, 2000, 5000, 10000] as const;

export function countryToSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export function formatWeightSlug(grams: number): string {
    if (grams >= 1000) {
        const kg = grams / 1000;
        const str = Number.isInteger(kg) ? String(kg) : String(Number(kg.toFixed(2)));
        return `${str}kg`;
    }
    return `${Math.round(grams)}g`;
}

export function parseWeightSlug(rawSlug: string): {
    grams: number;
    canonicalSlug: string;
} | null {
    const clean = decodeURIComponent(rawSlug).trim().toLowerCase().replace(/_/g, ".");
    const match = clean.match(/^(\d+(?:[.-]\d+)?)\s*(kg|kgs|kilo|kilos|g|gm|gms|gram|grams)$/);
    if (!match) return null;

    const numericStr = match[1].replace("-", ".");
    const num = parseFloat(numericStr);
    if (!Number.isFinite(num) || num <= 0) return null;

    const unit = match[2];
    const grams = Math.round(unit.startsWith("k") ? num * 1000 : num);
    if (grams < 10 || grams > 30000) return null;

    return {
        grams,
        canonicalSlug: formatWeightSlug(grams),
    };
}

export function resolveCountryFromSlug(
    rawSlug: string,
    config: RateConfig = DEFAULT_RATE_CONFIG
): { country: EmsCountry; canonicalSlug: string; isCanonical: boolean } | null {
    const decoded = decodeURIComponent(rawSlug).trim().toLowerCase();
    if (!decoded) return null;

    // 1. Exact canonical slug match
    for (const c of config.emsCountries) {
        const slug = countryToSlug(c.name);
        if (slug === decoded) {
            return { country: c, canonicalSlug: slug, isCanonical: true };
        }
    }

    // 2. Exact ISO 2-letter code match (e.g. /rates/tw, /rates/gb, /rates/us)
    const upper = decoded.toUpperCase();
    const byCode = config.emsCountries.find((c) => c.code === upper);
    if (byCode) {
        const slug = countryToSlug(byCode.name);
        return { country: byCode, canonicalSlug: slug, isCanonical: slug === decoded };
    }

    // 3. Alias or typo match via smart-search (e.g. /rates/thaiwan -> Taiwan, /rates/uk -> United Kingdom)
    const spaced = decoded.replace(/-/g, " ");
    const smart = matchSmartCountry(spaced, config);
    if (smart) {
        const matched = config.emsCountries.find((c) => c.code === smart.countryCode);
        if (matched) {
            const slug = countryToSlug(matched.name);
            return { country: matched, canonicalSlug: slug, isCanonical: slug === decoded };
        }
    }

    return null;
}

export function getRatesHrefForCountry(countryCode: string, weightGrams?: number): string {
    const country = DEFAULT_RATE_CONFIG.emsCountries.find((c) => c.code === countryCode);
    if (!country) return "/calculator";
    const slug = countryToSlug(country.name);
    if (weightGrams && weightGrams >= 10 && weightGrams <= 30000) {
        return `/rates/${slug}/${formatWeightSlug(weightGrams)}`;
    }
    return `/rates/${slug}`;
}

export interface RateTableRow {
    weightGrams: number;
    weightLabel: string;
    weightSlug: string;
    airLetterLkr: number | null;
    airParcelLkr: number | null;
    emsLkr: number | null;
    seaParcelLkr: number | null;
    cheapestLkr: number | null;
    cheapestService: string | null;
}

export function buildCountryTariffTable(
    countryCode: string,
    config: RateConfig = DEFAULT_RATE_CONFIG
): RateTableRow[] {
    return TABLE_WEIGHT_GRAMS.map((weightGrams) => {
        const quotes = calculateAllInternationalServices(config, countryCode, weightGrams);
        const getValidCost = (id: string): number | null => {
            const found = quotes.find(
                (q) => q.service.id === id && q.available && !q.result.error && !q.result.exceedsMaxWeight
            );
            return found ? found.result.totalCost : null;
        };

        const valid = quotes.filter((q) => q.available && !q.result.error && !q.result.exceedsMaxWeight);
        const cheapest = valid.sort((a, b) => a.result.totalCost - b.result.totalCost)[0];

        return {
            weightGrams,
            weightLabel: formatWeightLabel(weightGrams),
            weightSlug: formatWeightSlug(weightGrams),
            airLetterLkr: getValidCost("air_letter"),
            airParcelLkr: getValidCost("air_parcel"),
            emsLkr: getValidCost("ems"),
            seaParcelLkr: getValidCost("sea_parcel"),
            cheapestLkr: cheapest ? cheapest.result.totalCost : null,
            cheapestService: cheapest ? cheapest.service.shortName : null,
        };
    });
}

export function formatLkrPlain(amount: number): string {
    return `Rs. ${amount.toLocaleString("en-US")}`;
}

export function buildInternationalRateSeoData(
    country: EmsCountry,
    weightGrams: number,
    locale: string = "en",
    config: RateConfig = DEFAULT_RATE_CONFIG
) {
    const slug = countryToSlug(country.name);
    const weightSlug = formatWeightSlug(weightGrams);
    const weightLabel = formatWeightLabel(weightGrams);
    const localizedName = getLocalizedCountryName(country.code, country.name, locale);
    const zone = config.emsZones.find((z) => z.id === country.zoneId);
    const localizedZone = getLocalizedZoneName(zone?.id, zone?.name ?? "EMS Zone", locale);

    const quotes = calculateAllInternationalServices(config, country.code, weightGrams);
    const validQuotes = quotes.filter(
        (q) => q.available && !q.result.error && !q.result.exceedsMaxWeight
    );
    const sortedByPrice = [...validQuotes].sort((a, b) => a.result.totalCost - b.result.totalCost);
    const cheapest = sortedByPrice[0] ?? null;
    const ems = validQuotes.find((q) => q.service.id === "ems") ?? null;
    const airParcel = validQuotes.find((q) => q.service.id === "air_parcel") ?? null;
    const seaParcel = validQuotes.find((q) => q.service.id === "sea_parcel") ?? null;

    const summaryParts: string[] = [];
    if (airParcel) summaryParts.push(`Air Parcel ${formatLkrPlain(airParcel.result.totalCost)}`);
    if (ems) summaryParts.push(`EMS Express ${formatLkrPlain(ems.result.totalCost)}`);
    if (seaParcel) summaryParts.push(`Sea Parcel ${formatLkrPlain(seaParcel.result.totalCost)}`);
    if (summaryParts.length === 0 && cheapest) {
        summaryParts.push(`${cheapest.service.shortName} ${formatLkrPlain(cheapest.result.totalCost)}`);
    }

    const answerSentence =
        summaryParts.length > 0
            ? `Sri Lanka Post rate to ${country.name} for ${weightLabel} (2026 tariffs): ${summaryParts.join(" · ")}.`
            : `Check current Sri Lanka Post international air mail, EMS Express, and sea parcel rates to ${country.name}.`;

    const faqs = [
        {
            question: `How much does it cost to send a ${weightLabel} parcel from Sri Lanka to ${country.name}?`,
            answer:
                cheapest && ems
                    ? `Sending ${weightLabel} from Sri Lanka to ${country.name} starts at ${formatLkrPlain(cheapest.result.totalCost)} via ${cheapest.service.name}. EMS Express costs ${formatLkrPlain(ems.result.totalCost)}${airParcel ? ` and Air Parcel costs ${formatLkrPlain(airParcel.result.totalCost)}` : ""}${seaParcel ? `, while Sea Parcel is ${formatLkrPlain(seaParcel.result.totalCost)}` : ""}.`
                    : answerSentence,
        },
        {
            question: `What is the cheapest way to post ${weightLabel} to ${country.name} via Sri Lanka Post?`,
            answer: cheapest
                ? `The cheapest Sri Lanka Post option for ${weightLabel} to ${country.name} is ${cheapest.service.name} at ${formatLkrPlain(cheapest.result.totalCost)} (tier: ${cheapest.result.tierLabel}).`
                : `Use the calculator above to compare Air Mail, Air Parcel, EMS Express, and Sea Mail rates to ${country.name}.`,
        },
        {
            question: `What is the maximum weight limit for Sri Lanka Post EMS to ${country.name}?`,
            answer: `${country.name} is in ${zone?.name ?? "Sri Lanka Post EMS network"} (Country Group ${country.group}) with a maximum EMS parcel weight of ${Math.round((country.emsMaxWeight ?? 20000) / 1000)} kg.`,
        },
    ];

    const pagePath = `/rates/${slug}/${weightSlug}`;
    const pageUrl = buildLocalizedUrl(pagePath, locale);

    const faqJsonLd = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: faq.answer,
            },
        })),
    };

    const serviceJsonLd = {
        "@context": "https://schema.org",
        "@type": "Service",
        name: `Sri Lanka Post International Postage to ${country.name} (${weightLabel})`,
        serviceType: "International Postal & Parcel Delivery",
        areaServed: {
            "@type": "Country",
            name: country.name,
        },
        provider: {
            "@type": "Organization",
            name: "Sri Lanka Post (Rates via Lanka Post Directory)",
        },
        url: pageUrl,
        offers: sortedByPrice.map((q) => ({
            "@type": "Offer",
            name: `${q.service.name} (${weightLabel} to ${country.name})`,
            priceCurrency: "LKR",
            price: q.result.totalCost,
            availability: "https://schema.org/InStock",
            url: pageUrl,
        })),
    };

    const breadcrumbJsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: buildLocalizedUrl("/", locale) },
            { "@type": "ListItem", position: 2, name: "Postage Rates", item: buildLocalizedUrl("/rates", locale) },
            { "@type": "ListItem", position: 3, name: country.name, item: buildLocalizedUrl(`/rates/${slug}`, locale) },
            { "@type": "ListItem", position: 4, name: weightLabel, item: pageUrl },
        ],
    };

    return {
        slug,
        weightSlug,
        weightLabel,
        localizedName,
        zoneLabel: `${localizedZone.short} · Group ${country.group}`,
        quotes,
        validQuotes: sortedByPrice,
        cheapest,
        ems,
        airParcel,
        seaParcel,
        answerSentence,
        faqs,
        faqJsonLd,
        serviceJsonLd,
        breadcrumbJsonLd,
    };
}
