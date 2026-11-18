import type { PostOffice, SearchMode } from "@/components/directory/types";

export type SwCacheStrategy =
    | "ignore"
    | "cache-first-static"
    | "api-swr"
    | "network-only-api"
    | "rsc"
    | "navigate"
    | "page-swr";

export interface MinimalRequestInfo {
    url: string;
    origin: string;
    method: string;
    mode?: string;
    isRsc?: boolean;
}

const STATIC_EXT_RE = /\.(?:png|jpg|jpeg|webp|avif|svg|ico|woff2?|css|js|webmanifest)$/i;
const CACHEABLE_API_PREFIXES = [
    "/api/autocomplete",
    "/api/offices",
    "/api/exchange-rate",
    "/api/posts",
];

/**
 * Deterministic request classification for the Service Worker fetch handler.
 * Mirrors the routing logic in `public/sw.js` so it can be unit-tested cleanly.
 */
export function classifySwRequest(info: MinimalRequestInfo): SwCacheStrategy {
    if (info.method !== "GET") return "ignore";

    let parsed: URL;
    try {
        parsed = new URL(info.url, info.origin);
    } catch {
        return "ignore";
    }

    if (parsed.origin !== info.origin) return "ignore";

    const pathname = parsed.pathname;

    if (
        pathname.startsWith("/_next/webpack-hmr") ||
        pathname.includes("hot-update") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/admin")
    ) {
        return "ignore";
    }

    if (pathname.startsWith("/_next/static/") || STATIC_EXT_RE.test(pathname)) {
        return "cache-first-static";
    }

    if (CACHEABLE_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
        return "api-swr";
    }

    if (pathname.startsWith("/api/")) {
        return "network-only-api";
    }

    if (info.isRsc || parsed.searchParams.has("_rsc")) {
        return "rsc";
    }

    if (info.mode === "navigate") {
        return "navigate";
    }

    return "page-swr";
}

/**
 * Builds ordered cache lookup keys for offline page navigations.
 * Ensures deep-linked URLs like `/calculator?mode=intl&country=TW` fall back to
 * the cached `/calculator` shell, locale root (`/si` or `/ta`), `/`, and `/offline`.
 */
export function resolveOfflinePageLookupKeys(urlString: string, origin = "https://lankapost.app"): string[] {
    let parsed: URL;
    try {
        parsed = new URL(urlString, origin);
    } catch {
        return ["/", "/offline"];
    }

    const keys: string[] = [];
    const full = `${parsed.pathname}${parsed.search}`;
    const pathname = parsed.pathname || "/";

    const pushUnique = (val: string) => {
        if (val && !keys.includes(val)) keys.push(val);
    };

    pushUnique(full);
    pushUnique(pathname);

    // If locale-prefixed (e.g. /si/calculator), also consider locale root & unprefixed shell
    const localeMatch = pathname.match(/^\/(si|ta|en)(\/.*)?$/);
    if (localeMatch) {
        const locale = localeMatch[1];
        const rest = localeMatch[2] || "/";
        if (locale !== "en") {
            pushUnique(`/${locale}`);
        }
        pushUnique(rest);
        pushUnique(`/${locale}/offline`);
    }

    pushUnique("/");
    pushUnique("/offline");
    return keys;
}

export function isStandaloneDisplayMode(
    matchesQuery: (query: string) => boolean,
    navigatorStandalone?: boolean
): boolean {
    return Boolean(
        matchesQuery("(display-mode: standalone)") ||
        matchesQuery("(display-mode: fullscreen)") ||
        matchesQuery("(display-mode: minimal-ui)") ||
        navigatorStandalone === true
    );
}

// ---------------------------------------------------------------------------
// Offline Directory Cache (lightweight localStorage LRU for recently viewed / searched offices)
// ---------------------------------------------------------------------------

export const OFFLINE_OFFICES_STORAGE_KEY = "sl-post-offline-offices-v1";
const MAX_CACHED_OFFICES = 120;

export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

function getDefaultStorage(): StorageLike | null {
    if (typeof window === "undefined") return null;
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

export function getCachedOfficesList(storage: StorageLike | null = getDefaultStorage()): PostOffice[] {
    if (!storage) return [];
    try {
        const raw = storage.getItem(OFFLINE_OFFICES_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((item): item is PostOffice => Boolean(item && item.id && item.name));
    } catch {
        return [];
    }
}

export function saveOfficesToOfflineCache(
    incoming: PostOffice[],
    storage: StorageLike | null = getDefaultStorage()
): number {
    if (!storage || !Array.isArray(incoming) || incoming.length === 0) {
        return getCachedOfficesList(storage).length;
    }
    const existing = getCachedOfficesList(storage);
    const mergedMap = new Map<string, PostOffice>();

    // Keep incoming at the front (most recent)
    for (const office of incoming) {
        if (office?.id && office?.name) {
            mergedMap.set(office.id, office);
        }
    }
    for (const office of existing) {
        if (office?.id && !mergedMap.has(office.id)) {
            mergedMap.set(office.id, office);
        }
    }

    const bounded = Array.from(mergedMap.values()).slice(0, MAX_CACHED_OFFICES);
    try {
        storage.setItem(OFFLINE_OFFICES_STORAGE_KEY, JSON.stringify(bounded));
    } catch {
        // Ignore storage quota errors
    }
    return bounded.length;
}

export function searchOfflineOfficesCache(
    params: {
        q?: string;
        mode?: SearchMode;
        letter?: string | null;
        service?: string | null;
    },
    storage: StorageLike | null = getDefaultStorage()
): PostOffice[] {
    const all = getCachedOfficesList(storage);
    if (all.length === 0) return [];

    const q = (params.q || "").trim().toLowerCase();
    const mode = params.mode || "name";
    const letter = (params.letter || "").trim().toLowerCase();
    const service = (params.service || "").trim();

    return all.filter((office) => {
        if (letter && !office.name.toLowerCase().startsWith(letter)) {
            return false;
        }
        if (service && !(office.services || []).includes(service)) {
            return false;
        }
        if (!q) return true;

        const division =
            office.fields?.find((f) => f.name.toLowerCase() === "division")?.value?.toLowerCase() || "";

        if (mode === "division") {
            return division.includes(q);
        }

        return (
            office.name.toLowerCase().includes(q) ||
            (office.postalCode || "").toLowerCase().includes(q) ||
            division.includes(q)
        );
    });
}
