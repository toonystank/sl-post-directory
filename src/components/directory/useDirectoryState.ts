import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/navigation";
import { saveOfficesToOfflineCache, searchOfflineOfficesCache } from "@/lib/pwa";
import {
    ensureLocalOfficeIndex,
    getLoadedOfficeIndexSync,
} from "@/lib/office-index-client";
import { PostOffice, SearchMode, SearchResponse } from "./types";

const PAGE_LIMIT = 24;

export function useDirectoryState() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const urlQuery = searchParams.get("q") || "";
    const urlMode = (searchParams.get("mode") as SearchMode) || "name";
    const urlLetter = searchParams.get("letter") || null;
    const urlService = searchParams.get("service") || null;

    // If the compact 4,158-office index is already in memory, compute initial results synchronously in 0ms!
    const syncInitialResult = (() => {
        const engine = getLoadedOfficeIndexSync();
        if (!engine) return null;
        return engine.query({
            q: urlQuery,
            mode: urlMode,
            letter: urlLetter,
            service: urlService,
            cursor: 0,
            limit: PAGE_LIMIT,
        });
    })();

    const [query, setQuery] = useState(urlQuery);
    const [searchMode, setSearchMode] = useState<SearchMode>(urlMode);
    const [activeLetter, setActiveLetter] = useState<string | null>(urlLetter);
    const [activeService, setActiveService] = useState<string | null>(urlService);

    const [offices, setOffices] = useState<PostOffice[]>(() => syncInitialResult?.offices ?? []);
    const [total, setTotal] = useState<number>(() => syncInitialResult?.total ?? 0);
    const [nextCursor, setNextCursor] = useState<number | null>(() => syncInitialResult?.nextCursor ?? null);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState<boolean>(() => syncInitialResult === null);
    const [isOfflineFallback, setIsOfflineFallback] = useState(false);

    const isRestoringRef = useRef(false);
    const activeAbortRef = useRef<AbortController | null>(null);
    const lastFetchedRef = useRef<{
        q: string;
        mode: SearchMode;
        letter: string | null;
        service: string | null;
    } | null>(
        syncInitialResult
            ? { q: urlQuery, mode: urlMode, letter: urlLetter, service: urlService }
            : null
    );

    const updateUrl = useCallback((q: string, mode: SearchMode, letter: string | null, service: string | null) => {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (mode !== "name") params.set("mode", mode);
        if (letter) params.set("letter", letter);
        if (service) params.set("service", service);
        const paramString = params.toString();
        const newUrl = paramString ? `/browse?${paramString}` : "/browse";
        router.replace(newUrl, { scroll: false });
    }, [router]);

    const applySearchResponse = useCallback((data: SearchResponse, append: boolean, offlineNotice: boolean) => {
        const incomingOffices = data?.offices || [];
        setIsOfflineFallback(offlineNotice);
        setOffices((prev) => {
            if (!append) return incomingOffices;
            const existingIds = new Set(prev.map((o) => o.id));
            const newOffices = incomingOffices.filter((o) => !existingIds.has(o.id));
            return [...prev, ...newOffices];
        });
        setTotal(data?.total || 0);
        setNextCursor(data?.nextCursor ?? null);
        setLoading(false);
        setInitialLoading(false);
    }, []);

    const fetchOffices = useCallback(async (searchQuery: string, letter: string | null, mode: SearchMode, service: string | null, cursor: number, append: boolean) => {
        if (!append) {
            activeAbortRef.current?.abort();
        }

        if (cursor === 0) {
            lastFetchedRef.current = { q: searchQuery, mode, letter, service };
        }

        // Fast Path 1: Local 4,158-office index already in memory (< 5ms, zero network wait!)
        const syncEngine = getLoadedOfficeIndexSync();
        if (syncEngine) {
            const localRes = syncEngine.query({
                q: searchQuery,
                mode,
                letter,
                service,
                cursor,
                limit: PAGE_LIMIT,
            });
            applySearchResponse(localRes, append, false);
            return;
        }

        // Fast Path 2: Hydrate local 4,158-office index from IndexedDB / single compact fetch
        const controller = new AbortController();
        activeAbortRef.current = controller;

        if (cursor === 0) {
            setInitialLoading(true);
        } else {
            setLoading(true);
        }

        try {
            const engine = await ensureLocalOfficeIndex();
            if (controller.signal.aborted) return;

            if (engine) {
                const localRes = engine.query({
                    q: searchQuery,
                    mode,
                    letter,
                    service,
                    cursor,
                    limit: PAGE_LIMIT,
                });
                applySearchResponse(localRes, append, false);
                return;
            }

            // Fallback Path: Live server search API (e.g., if IndexedDB + index endpoint failed)
            const params = new URLSearchParams();
            if (searchQuery) params.set("q", searchQuery);
            if (letter) params.set("letter", letter);
            if (service) params.set("service", service);
            params.set("mode", mode);
            params.set("cursor", cursor.toString());
            params.set("limit", String(PAGE_LIMIT));

            const res = await fetch(`/api/offices?${params.toString()}`, {
                signal: controller.signal,
            });
            if (!res.ok) throw new Error(`API Error: ${res.status}`);

            const data: SearchResponse = await res.json();
            if (controller.signal.aborted) return;

            const incomingOffices = data?.offices || [];
            if (incomingOffices.length > 0) {
                saveOfficesToOfflineCache(incomingOffices);
                if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("slpost-offline-cache-updated"));
                }
            }

            applySearchResponse(data, append, false);
        } catch (err) {
            if ((err as { name?: string })?.name === "AbortError") return;
            const offlineMatches = searchOfflineOfficesCache({
                q: searchQuery,
                mode,
                letter,
                service,
            });
            if (offlineMatches.length > 0) {
                applySearchResponse(
                    { offices: offlineMatches, total: offlineMatches.length, nextCursor: null },
                    false,
                    true
                );
            } else {
                applySearchResponse(
                    { offices: [], total: 0, nextCursor: null },
                    false,
                    typeof navigator !== "undefined" && !navigator.onLine
                );
            }
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
                setInitialLoading(false);
            }
        }
    }, [applySearchResponse]);

    // Sync state with URL params (including resetting when navigating via desktop/mobile tabs)
    useEffect(() => {
        setQuery(urlQuery);
        setSearchMode(urlMode);
        setActiveLetter(urlLetter);
        setActiveService(urlService);

        const last = lastFetchedRef.current;
        if (
            last &&
            last.q === urlQuery &&
            last.mode === urlMode &&
            last.letter === urlLetter &&
            last.service === urlService
        ) {
            return;
        }

        // If local index is already hydrated, run immediately without waiting on sessionStorage
        const syncEngine = getLoadedOfficeIndexSync();
        if (syncEngine) {
            lastFetchedRef.current = { q: urlQuery, mode: urlMode, letter: urlLetter, service: urlService };
            const localRes = syncEngine.query({
                q: urlQuery,
                mode: urlMode,
                letter: urlLetter,
                service: urlService,
                cursor: 0,
                limit: PAGE_LIMIT,
            });
            applySearchResponse(localRes, false, false);
            return;
        }

        const cached = sessionStorage.getItem("directory-cache-v3");
        if (cached && !last) {
            try {
                const data = JSON.parse(cached);
                if (data.q === urlQuery && data.mode === urlMode && data.letter === urlLetter && data.service === urlService) {
                    lastFetchedRef.current = { q: urlQuery, mode: urlMode, letter: urlLetter, service: urlService };
                    setOffices(data.offices);
                    setTotal(data.total);
                    setNextCursor(data.nextCursor);
                    setInitialLoading(false);
                    isRestoringRef.current = true;

                    requestAnimationFrame(() => {
                        const scrollY = sessionStorage.getItem("directory-scroll");
                        if (scrollY) window.scrollTo(0, parseInt(scrollY));
                        isRestoringRef.current = false;
                    });
                    // Still warm the local index silently in background for instant next interaction
                    void ensureLocalOfficeIndex();
                    return;
                }
            } catch { }
        }
        void fetchOffices(urlQuery, urlLetter, urlMode, urlService, 0, false);
    }, [urlQuery, urlMode, urlLetter, urlService, fetchOffices, applySearchResponse]);

    useEffect(() => {
        let timeoutId: NodeJS.Timeout | null = null;
        const saveScroll = () => {
            if (!isRestoringRef.current) {
                if (timeoutId) clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    sessionStorage.setItem("directory-scroll", window.scrollY.toString());
                }, 150);
            }
        };
        window.addEventListener("scroll", saveScroll, { passive: true });
        return () => {
            window.removeEventListener("scroll", saveScroll);
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, []);

    useEffect(() => {
        if (offices.length > 0 && !initialLoading) {
            try {
                sessionStorage.setItem("directory-cache-v3", JSON.stringify({
                    q: query, mode: searchMode, letter: activeLetter, service: activeService, offices: offices.slice(0, PAGE_LIMIT), total, nextCursor
                }));
            } catch {
                // Ignore sessionStorage quota errors
            }
        }
    }, [offices, total, nextCursor, query, searchMode, activeLetter, activeService, initialLoading]);

    return {
        query, setQuery,
        searchMode, setSearchMode,
        activeLetter, setActiveLetter,
        activeService, setActiveService,
        offices, total, nextCursor,
        loading, initialLoading,
        isOfflineFallback,
        updateUrl, fetchOffices
    };
}
