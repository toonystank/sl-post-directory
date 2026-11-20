import type { Metadata } from "next";

export const DEFAULT_SITE_URL = "https://lankapost.vercel.app";
export const SUPPORTED_LOCALES = ["en", "si", "ta"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Centralized canonical site origin.
 * Set `NEXT_PUBLIC_SITE_URL` (e.g. `https://yourdomain.lk`) when moving to a custom domain
 * so all canonicals, hreflang alternates, sitemaps, robots.txt, OG tags, and JSON-LD update automatically.
 */
export function getSiteUrl(): string {
    const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (!raw) return DEFAULT_SITE_URL;
    return raw.replace(/\/+$/, "");
}

/**
 * Builds a fully-qualified localized URL respecting `localePrefix: "as-needed"`.
 */
export function buildLocalizedUrl(pathname: string, locale: string = "en"): string {
    const base = getSiteUrl();
    const cleanPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
    const normalizedPath = cleanPath === "/" ? "" : cleanPath.replace(/\/+$/, "");
    if (locale === "si" || locale === "ta") {
        return `${base}/${locale}${normalizedPath}`;
    }
    return normalizedPath ? `${base}${normalizedPath}` : `${base}/`;
}

/**
 * Generates Next.js `metadata.alternates` with self-referencing canonical and hreflang tags.
 */
export function buildLocalizedAlternates(
    pathname: string,
    locale: string = "en"
): NonNullable<Metadata["alternates"]> {
    const enUrl = buildLocalizedUrl(pathname, "en");
    const siUrl = buildLocalizedUrl(pathname, "si");
    const taUrl = buildLocalizedUrl(pathname, "ta");

    return {
        canonical: buildLocalizedUrl(pathname, locale),
        languages: {
            en: enUrl,
            si: siUrl,
            ta: taUrl,
            "x-default": enUrl,
        },
    };
}

/**
 * Normalizes Sri Lankan 5-digit postal codes so stripped leading zeros
 * (e.g., "100" -> "00100", "1200" -> "01200") are always restored.
 */
export function normalizePostalCode(raw: string | null | undefined): string {
    const trimmed = (raw ?? "").trim();
    if (
        !trimmed ||
        trimmed === "-" ||
        trimmed === "—" ||
        /^(n\/?a|none|null|unknown)$/i.test(trimmed)
    ) {
        return "";
    }
    if (/^\d{1,5}$/.test(trimmed)) {
        const numeric = parseInt(trimmed, 10);
        if (numeric === 0) return "";
        return trimmed.padStart(5, "0");
    }
    return trimmed;
}

/**
 * Converts a Sri Lanka postal division name into its canonical `/district/[slug]` segment.
 */
export function slugifyDivision(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export function getOgLocale(locale: string = "en"): string {
    if (locale === "si") return "si_LK";
    if (locale === "ta") return "ta_LK";
    return "en_US";
}

export function getDefaultOpenGraphImages(
    alt: string = "Lanka Post Directory — Sri Lanka Post Offices, Postal Codes & 2026 Rates"
) {
    const siteUrl = getSiteUrl();
    return [
        {
            url: `${siteUrl}/opengraph-image`,
            width: 1200,
            height: 630,
            alt,
        },
    ];
}

/**
 * Returns query variants for postal code search so searching "00100" matches
 * both normalized "00100" and legacy unpadded "100" DB rows, and vice versa.
 */
export function postalCodeSearchVariants(rawQuery: string): string[] {
    const trimmed = rawQuery.trim();
    if (!/^\d{1,5}$/.test(trimmed)) return [];
    const variants = new Set<string>([trimmed]);
    const stripped = trimmed.replace(/^0+/, "");
    if (stripped) variants.add(stripped);
    if (trimmed.length === 5 || (stripped && stripped.length <= 5)) {
        variants.add(trimmed.padStart(5, "0"));
    }
    return Array.from(variants);
}

/**
 * Formats Sri Lankan telephone numbers consistently (e.g. "672250448" -> "067 225-0448",
 * "0112328301" -> "011 232-8301"), preserving multi-number strings cleanly.
 */
export function formatSriLankaPhone(raw: string | null | undefined): string {
    const trimmed = (raw ?? "").trim();
    if (!trimmed) return "";

    // Leave multi-number or annotated strings intact except trimming
    if (trimmed.includes(",") || trimmed.includes("/") || /[a-zA-Z]/.test(trimmed)) {
        return trimmed;
    }

    // Preserve already-formatted 10-digit numbers starting with 0 (e.g. "011-2328301", "067 227-7220")
    if (/^0\d{2}[\s-]\d/.test(trimmed)) {
        return trimmed;
    }

    const digits = trimmed.replace(/\D/g, "");
    let normalized = digits;
    if (digits.length === 9 && !digits.startsWith("0")) {
        normalized = `0${digits}`;
    } else if (digits.length === 11 && digits.startsWith("94")) {
        normalized = `0${digits.slice(2)}`;
    }

    if (normalized.length === 10 && normalized.startsWith("0")) {
        return `${normalized.slice(0, 3)} ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
    }
    return trimmed;
}
