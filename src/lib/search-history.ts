const SEARCH_HISTORY_KEY = "slpost_home_search_history_v1";
export const MAX_SEARCH_HISTORY = 6;

function normalizeWhitespace(raw: string): string {
    return raw.trim().replace(/\s+/g, " ");
}

function saveSearchHistory(items: string[]): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(items));
    } catch {
        // Ignore storage quota or private-mode access errors
    }
}

/**
 * Loads recent search queries from localStorage in an SSR-safe manner.
 */
export function loadSearchHistory(): string[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(SEARCH_HISTORY_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const seen = new Set<string>();
        const cleaned: string[] = [];
        for (const item of parsed) {
            if (typeof item !== "string") continue;
            const normalized = normalizeWhitespace(item);
            if (normalized.length < 2) continue;
            const key = normalized.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            cleaned.push(normalized);
            if (cleaned.length >= MAX_SEARCH_HISTORY) break;
        }
        return cleaned;
    } catch {
        return [];
    }
}

/**
 * Persists a search query to the top of the recent history list.
 */
export function addSearchHistory(rawQuery: string): string[] {
    const normalized = normalizeWhitespace(rawQuery);
    const current = loadSearchHistory();
    if (normalized.length < 2) {
        return current;
    }

    const key = normalized.toLowerCase();
    const next = [
        normalized,
        ...current.filter((item) => item.toLowerCase() !== key),
    ].slice(0, MAX_SEARCH_HISTORY);

    saveSearchHistory(next);
    return next;
}

/**
 * Removes a single query from the persisted search history list.
 */
export function removeSearchHistoryItem(target: string): string[] {
    const key = normalizeWhitespace(target).toLowerCase();
    const current = loadSearchHistory();
    const next = current.filter((item) => item.toLowerCase() !== key);
    saveSearchHistory(next);
    return next;
}

/**
 * Clears all persisted search history entries.
 */
export function clearSearchHistory(): string[] {
    if (typeof window !== "undefined") {
        try {
            window.localStorage.removeItem(SEARCH_HISTORY_KEY);
        } catch {
            // Ignore storage access errors
        }
    }
    return [];
}
