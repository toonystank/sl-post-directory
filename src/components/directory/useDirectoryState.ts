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

export interface DirectoryExtraFilters {
    division?: string | null;
    officeType?: string | null;
    is24Hour?: boolean;
    delivery?: "yes" | "no" | null;
}

export interface InitialDirectoryData {
    offices: PostOffice[];
    total: number;
    nextCursor: number | null;
    divisions: string[];
}

export function useDirectoryState(initialData?: InitialDirectoryData) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const urlQuery = searchParams.get("q") || "";
    const urlMode = (searchParams.get("mode") as SearchMode) || "name";
    const urlLetter = searchParams.get("letter") || null;
    const urlService = searchParams.get("service") || null;
    const urlDivision = searchParams.get("division") || null;
    const urlOfficeType = searchParams.get("type") || null;
    const urlIs24Hour = searchParams.get("is24Hour") === "1" || searchParams.get("is24Hour") === "true";
    const rawUrlDelivery = searchParams.get("delivery");
    const urlDelivery: "yes" | "no" | null =
        rawUrlDelivery === "yes" || rawUrlDelivery === "no" ? rawUrlDelivery : null;

    const hasUrlFilters = Boolean(
        urlQuery || urlLetter || urlService || urlDivision || urlOfficeType || urlIs24Hour || urlDelivery
    );

    const syncEngineAtInit = getLoadedOfficeIndexSync();
    const syncInitialResult = syncEngineAtInit
        ? syncEngineAtInit.query({
              q: urlQuery,
              mode: urlMode,
              letter: urlLetter,
              service: urlService,
              division: urlDivision,
              officeType: urlOfficeType,
              is24Hour: urlIs24Hour,
              delivery: urlDelivery,
              cursor: 0,
              limit: PAGE_LIMIT,
          })
        : !hasUrlFilters && initialData && initialData.offices.length > 0
          ? initialData
          : null;

    const [query, setQuery] = useState(urlQuery);
    const [searchMode, setSearchMode] = useState<SearchMode>(urlMode);
    const [activeLetter, setActiveLetter] = useState<string | null>(urlLetter);
    const [activeService, setActiveService] = useState<string | null>(urlService);
    const [activeDivision, setActiveDivision] = useState<string | null>(urlDivision);
    const [activeOfficeType, setActiveOfficeType] = useState<string | null>(urlOfficeType);
    const [only24Hour, setOnly24Hour] = useState<boolean>(urlIs24Hour);
    const [activeDelivery, setActiveDelivery] = useState<"yes" | "no" | null>(urlDelivery);

    const [availableDivisions, setAvailableDivisions] = useState<string[]>(
        () => syncEngineAtInit?.divisions ?? initialData?.divisions ?? []
    );
    const [availableTypes, setAvailableTypes] = useState<string[]>(
        () => syncEngineAtInit?.types ?? ["Post Office", "Sub Post Office"]
    );

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
        division: string | null;
        officeType: string | null;
        is24Hour: boolean;
        delivery: "yes" | "no" | null;
    } | null>(
        syncInitialResult
            ? {
                  q: urlQuery,
                  mode: urlMode,
                  letter: urlLetter,
                  service: urlService,
                  division: urlDivision,
                  officeType: urlOfficeType,
                  is24Hour: urlIs24Hour,
                  delivery: urlDelivery,
              }
            : null
    );

    const updateUrl = useCallback(
        (
            q: string,
            mode: SearchMode,
            letter: string | null,
            service: string | null,
            extra: DirectoryExtraFilters = {}
        ) => {
            const params = new URLSearchParams();
            if (q) params.set("q", q);
            if (mode !== "name") params.set("mode", mode);
            if (letter) params.set("letter", letter);
            if (service) params.set("service", service);
            if (extra.division) params.set("division", extra.division);
            if (extra.officeType) params.set("type", extra.officeType);
            if (extra.is24Hour) params.set("is24Hour", "1");
            if (extra.delivery) params.set("delivery", extra.delivery);
            const paramString = params.toString();
            const newUrl = paramString ? `/browse?${paramString}` : "/browse";
            router.replace(newUrl, { scroll: false });
        },
        [router]
    );

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

    const fetchOffices = useCallback(
        async (
            searchQuery: string,
            letter: string | null,
            mode: SearchMode,
            service: string | null,
            cursor: number,
            append: boolean,
            extra: DirectoryExtraFilters = {}
        ) => {
            const division = extra.division ?? null;
            const officeType = extra.officeType ?? null;
            const is24Hour = Boolean(extra.is24Hour);
            const delivery = extra.delivery ?? null;

            if (!append) {
                activeAbortRef.current?.abort();
            }

            if (cursor === 0) {
                lastFetchedRef.current = {
                    q: searchQuery,
                    mode,
                    letter,
                    service,
                    division,
                    officeType,
                    is24Hour,
                    delivery,
                };
            }

            // Fast Path 1: Local office index already in memory (< 5ms, zero network wait!)
            const syncEngine = getLoadedOfficeIndexSync();
            if (syncEngine) {
                if (availableDivisions.length === 0 && syncEngine.divisions.length > 0) {
                    setAvailableDivisions(syncEngine.divisions);
                    setAvailableTypes(syncEngine.types);
                }
                const localRes = syncEngine.query({
                    q: searchQuery,
                    mode,
                    letter,
                    service,
                    division,
                    officeType,
                    is24Hour,
                    delivery,
                    cursor,
                    limit: PAGE_LIMIT,
                });
                applySearchResponse(localRes, append, false);
                return;
            }

            // Fast Path 2: Hydrate local office index from IndexedDB / single compact fetch
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
                    setAvailableDivisions(engine.divisions);
                    setAvailableTypes(engine.types);
                    const localRes = engine.query({
                        q: searchQuery,
                        mode,
                        letter,
                        service,
                        division,
                        officeType,
                        is24Hour,
                        delivery,
                        cursor,
                        limit: PAGE_LIMIT,
                    });
                    applySearchResponse(localRes, append, false);
                    return;
                }

                // Fallback Path: Live server search API
                const params = new URLSearchParams();
                if (searchQuery) params.set("q", searchQuery);
                if (letter) params.set("letter", letter);
                if (service) params.set("service", service);
                if (division) params.set("division", division);
                if (officeType) params.set("type", officeType);
                if (is24Hour) params.set("is24Hour", "1");
                if (delivery) params.set("delivery", delivery);
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
        },
        [applySearchResponse, availableDivisions.length]
    );

    // Sync state with URL params
    useEffect(() => {
        setQuery(urlQuery);
        setSearchMode(urlMode);
        setActiveLetter(urlLetter);
        setActiveService(urlService);
        setActiveDivision(urlDivision);
        setActiveOfficeType(urlOfficeType);
        setOnly24Hour(urlIs24Hour);
        setActiveDelivery(urlDelivery);

        const last = lastFetchedRef.current;
        if (
            last &&
            last.q === urlQuery &&
            last.mode === urlMode &&
            last.letter === urlLetter &&
            last.service === urlService &&
            last.division === urlDivision &&
            last.officeType === urlOfficeType &&
            last.is24Hour === urlIs24Hour &&
            last.delivery === urlDelivery
        ) {
            return;
        }

        const syncEngine = getLoadedOfficeIndexSync();
        if (syncEngine) {
            setAvailableDivisions(syncEngine.divisions);
            setAvailableTypes(syncEngine.types);
            lastFetchedRef.current = {
                q: urlQuery,
                mode: urlMode,
                letter: urlLetter,
                service: urlService,
                division: urlDivision,
                officeType: urlOfficeType,
                is24Hour: urlIs24Hour,
                delivery: urlDelivery,
            };
            const localRes = syncEngine.query({
                q: urlQuery,
                mode: urlMode,
                letter: urlLetter,
                service: urlService,
                division: urlDivision,
                officeType: urlOfficeType,
                is24Hour: urlIs24Hour,
                delivery: urlDelivery,
                cursor: 0,
                limit: PAGE_LIMIT,
            });
            applySearchResponse(localRes, false, false);
            return;
        }

        void fetchOffices(urlQuery, urlLetter, urlMode, urlService, 0, false, {
            division: urlDivision,
            officeType: urlOfficeType,
            is24Hour: urlIs24Hour,
            delivery: urlDelivery,
        });
    }, [
        urlQuery,
        urlMode,
        urlLetter,
        urlService,
        urlDivision,
        urlOfficeType,
        urlIs24Hour,
        urlDelivery,
        fetchOffices,
        applySearchResponse,
    ]);

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

    return {
        query,
        setQuery,
        searchMode,
        setSearchMode,
        activeLetter,
        setActiveLetter,
        activeService,
        setActiveService,
        activeDivision,
        setActiveDivision,
        activeOfficeType,
        setActiveOfficeType,
        only24Hour,
        setOnly24Hour,
        activeDelivery,
        setActiveDelivery,
        availableDivisions,
        availableTypes,
        offices,
        total,
        nextCursor,
        loading,
        initialLoading,
        isOfflineFallback,
        updateUrl,
        fetchOffices,
    };
}
