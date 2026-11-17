import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/navigation";
import { PostOffice, SearchMode, SearchResponse } from "./types";

export function useDirectoryState() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [query, setQuery] = useState(searchParams.get("q") || "");
    const [searchMode, setSearchMode] = useState<SearchMode>((searchParams.get("mode") as SearchMode) || "name");
    const [activeLetter, setActiveLetter] = useState<string | null>(searchParams.get("letter") || null);
    const [activeService, setActiveService] = useState<string | null>(searchParams.get("service") || null);

    const [offices, setOffices] = useState<PostOffice[]>([]);
    const [total, setTotal] = useState(0);
    const [nextCursor, setNextCursor] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    const isRestoringRef = useRef(false);
    const activeAbortRef = useRef<AbortController | null>(null);
    const lastFetchedRef = useRef<{
        q: string;
        mode: SearchMode;
        letter: string | null;
        service: string | null;
    } | null>(null);

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

    const fetchOffices = useCallback(async (searchQuery: string, letter: string | null, mode: SearchMode, service: string | null, cursor: number, append: boolean) => {
        if (!append) {
            activeAbortRef.current?.abort();
        }
        const controller = new AbortController();
        activeAbortRef.current = controller;

        if (cursor === 0) {
            lastFetchedRef.current = { q: searchQuery, mode, letter, service };
            setInitialLoading(true);
        } else {
            setLoading(true);
        }

        try {
            const params = new URLSearchParams();
            if (searchQuery) params.set("q", searchQuery);
            if (letter) params.set("letter", letter);
            if (service) params.set("service", service);
            params.set("mode", mode);
            params.set("cursor", cursor.toString());
            params.set("limit", "24");

            const res = await fetch(`/api/offices?${params.toString()}`, {
                signal: controller.signal,
            });
            if (!res.ok) throw new Error(`API Error: ${res.status}`);
            
            const data: SearchResponse = await res.json();
            if (controller.signal.aborted) return;

            setOffices((prev) => {
                const incomingOffices = data?.offices || [];
                if (!append) return incomingOffices;
                const existingIds = new Set(prev.map(o => o.id));
                const newOffices = incomingOffices.filter(o => !existingIds.has(o.id));
                return [...prev, ...newOffices];
            });

            setTotal(data?.total || 0);
            setNextCursor(data?.nextCursor ?? null);
        } catch (err) {
            if ((err as { name?: string })?.name === "AbortError") return;
            setOffices([]);
            setTotal(0);
            setNextCursor(null);
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
                setInitialLoading(false);
            }
        }
    }, []);

    const urlQuery = searchParams.get("q") || "";
    const urlMode = (searchParams.get("mode") as SearchMode) || "name";
    const urlLetter = searchParams.get("letter") || null;
    const urlService = searchParams.get("service") || null;

    // Sync state with URL params (including resetting when navigating to "/" via desktop/mobile tabs)
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
                    return;
                }
            } catch { }
        }
        fetchOffices(urlQuery, urlLetter, urlMode, urlService, 0, false);
    }, [urlQuery, urlMode, urlLetter, urlService, fetchOffices]);

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
            sessionStorage.setItem("directory-cache-v3", JSON.stringify({
                q: query, mode: searchMode, letter: activeLetter, service: activeService, offices, total, nextCursor
            }));
        }
    }, [offices, total, nextCursor, query, searchMode, activeLetter, activeService, initialLoading]);

    return {
        query, setQuery,
        searchMode, setSearchMode,
        activeLetter, setActiveLetter,
        activeService, setActiveService,
        offices, total, nextCursor,
        loading, initialLoading,
        updateUrl, fetchOffices
    };
}
