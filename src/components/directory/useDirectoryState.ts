import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

    const updateUrl = useCallback((q: string, mode: SearchMode, letter: string | null, service: string | null) => {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (mode !== "name") params.set("mode", mode);
        if (letter) params.set("letter", letter);
        if (service) params.set("service", service);
        const paramString = params.toString();
        const newUrl = paramString ? `/?${paramString}` : "/";
        router.replace(newUrl, { scroll: false });
    }, [router]);

    const fetchOffices = useCallback(async (searchQuery: string, letter: string | null, mode: SearchMode, service: string | null, cursor: number, append: boolean) => {
        if (cursor === 0) setInitialLoading(true);
        else setLoading(true);

        try {
            const params = new URLSearchParams();
            if (searchQuery) params.set("q", searchQuery);
            if (letter) params.set("letter", letter);
            if (service) params.set("service", service);
            params.set("mode", mode);
            params.set("cursor", cursor.toString());
            params.set("limit", "24");
            params.set("_t", Date.now().toString());

            const res = await fetch(`/api/offices?${params.toString()}`);
            if (!res.ok) throw new Error(`API Error: ${res.status}`);
            
            const data: SearchResponse = await res.json();

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
            console.error("Failed to fetch offices:", err);
        } finally {
            setLoading(false);
            setInitialLoading(false);
        }
    }, []);

    // Session cache & scrolling restoration
    useEffect(() => {
        const q = searchParams.get("q") || "";
        const mode = (searchParams.get("mode") as SearchMode) || "name";
        const letter = searchParams.get("letter") || null;
        const service = searchParams.get("service") || null;

        const cached = sessionStorage.getItem("directory-cache");
        if (cached) {
            try {
                const data = JSON.parse(cached);
                if (data.q === q && data.mode === mode && data.letter === letter && data.service === service) {
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
        fetchOffices(q, letter, mode, service, 0, false);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const saveScroll = () => {
            if (!isRestoringRef.current) sessionStorage.setItem("directory-scroll", window.scrollY.toString());
        };
        window.addEventListener("scroll", saveScroll, { passive: true });
        return () => window.removeEventListener("scroll", saveScroll);
    }, []);

    useEffect(() => {
        if (offices.length > 0 && !initialLoading) {
            sessionStorage.setItem("directory-cache", JSON.stringify({
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
