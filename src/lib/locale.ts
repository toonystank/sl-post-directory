export type AppLocale = "en" | "si" | "ta";

export const APP_LOCALES: readonly AppLocale[] = ["en", "si", "ta"] as const;
export const DEFAULT_LOCALE: AppLocale = "en";
export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";
export const LOCALE_STORAGE_KEY = "sl-post-locale";

export function isAppLocale(value: string | null | undefined): value is AppLocale {
    return value === "en" || value === "si" || value === "ta";
}

export function normalizeAppLocale(value: string | null | undefined): AppLocale {
    return isAppLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Strips any leading locale prefix (/en, /si, /ta) from a pathname so components
 * like Navbar and BottomTabBar always see canonical paths ("/", "/calculator", "/browse")
 * even during optimistic client-side locale switches.
 */
export function stripLocalePrefix(pathname: string): string {
    const cleaned = pathname.replace(/^\/(en|si|ta)(?=\/|$)/, "");
    return cleaned || "/";
}

/**
 * Extracts an explicit locale prefix from a URL pathname if present (/si/... -> "si").
 */
export function getLocaleFromPathname(pathname: string): AppLocale | null {
    const match = pathname.match(/^\/(en|si|ta)(?=\/|$)/);
    return match ? (match[1] as AppLocale) : null;
}

/**
 * Builds the canonical URL for a given pathname, target locale, search, and hash.
 * Matches `localePrefix: "as-needed"` with defaultLocale "en".
 */
export function buildLocalizedUrl(
    pathname: string,
    nextLocale: AppLocale,
    search: string = "",
    hash: string = ""
): string {
    const base = stripLocalePrefix(pathname);
    let localizedPath: string;
    if (nextLocale === DEFAULT_LOCALE) {
        localizedPath = base;
    } else {
        localizedPath = base === "/" ? `/${nextLocale}` : `/${nextLocale}${base}`;
    }
    return `${localizedPath}${search}${hash}`;
}

export interface MiddlewareLocaleRedirectInput {
    method: string;
    pathname: string;
    search: string;
    cookieLocale: string | null | undefined;
    isSwPrecache: boolean;
    isRscOrPrefetch: boolean;
}

/**
 * Determines whether an incoming unprefixed navigation should be redirected
 * to the user's explicitly saved non-English locale ("si" or "ta").
 *
 * Rules:
 * - Defaults to English ("en") when no cookie is present (never uses Accept-Language).
 * - Remembers explicit "si" or "ta" choice via NEXT_LOCALE cookie on unprefixed GET document loads.
 * - Never redirects SW precache requests, RSC payloads, or Next.js prefetches.
 */
export function resolveMiddlewareLocaleRedirect(
    input: MiddlewareLocaleRedirectInput
): string | null {
    if (input.method !== "GET") return null;
    if (input.isSwPrecache || input.isRscOrPrefetch) return null;

    // URL already has an explicit locale prefix (/en, /si, /ta)
    if (getLocaleFromPathname(input.pathname) !== null) return null;

    // Only redirect when user explicitly chose Sinhala or Tamil
    if (input.cookieLocale !== "si" && input.cookieLocale !== "ta") {
        return null;
    }

    return buildLocalizedUrl(input.pathname, input.cookieLocale, input.search);
}
