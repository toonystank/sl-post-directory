"use client";

import React, { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
    Search,
    MapPin,
    Building2,
    Loader2,
    X,
    CornerDownLeft,
    Plane,
    Banknote,
    Mail,
    ArrowRight,
    Scale,
    Camera,
} from "lucide-react";
import { m, AnimatePresence } from "motion/react";
import { Link, useRouter } from "@/navigation";
import { cn } from "@/lib/utils";
import CountryFlag from "@/components/brand/CountryFlag";
import HomeSmartSearchComposer from "./HomeSmartSearchComposer";
import HomeTrackingDrawerCard from "@/components/tracking/HomeTrackingDrawerCard";
import { useCurrency } from "@/context/CurrencyContext";
import { formatCurrencyAmount } from "@/lib/currency";
import {
    SMART_WEIGHT_CHIPS,
    formatWeightLabel,
    getSearchCyclingExamples,
    parseSmartSearchIntent,
    type SmartSearchIntent,
} from "@/lib/smart-search";
import { searchOfflineOfficesCache } from "@/lib/pwa";
import {
    ensureLocalOfficeIndex,
    getLoadedOfficeIndexSync,
} from "@/lib/office-index-client";
import type { RichAutocompleteSuggestion } from "@/lib/office-index";
import { triggerHaptic } from "@/lib/haptics";
import {
    loadSearchHistory,
    addSearchHistory,
    removeSearchHistoryItem,
} from "@/lib/search-history";
import { SearchMode } from "./types";

interface SearchBarProps {
    id: string;
    /** Compact variant used when docked under the mobile app bar / in the sidebar */
    isSticky?: boolean;
    /** Enables Nuwara Eliya illustration backdrop, stroked cycling examples, smart rate preview, and in-flow push-down drawer */
    enableSmartHomeSearch?: boolean;
    query: string;
    onQueryChange: (val: string, id: string) => void;
    searchMode: SearchMode;
    onSubmit: () => void;
    onClear: () => void;
    loading: boolean;
    onSuggestionClick: (suggestion: string) => void;
    onScanAddress?: () => void;
    containerRef?: React.RefObject<HTMLDivElement | null>;
    sidebarRef?: React.RefObject<HTMLDivElement | null>;
    inputRef?: React.Ref<HTMLInputElement>;
}

export default function SearchBar({
    id,
    isSticky = false,
    enableSmartHomeSearch = false,
    query,
    onQueryChange,
    searchMode,
    onSubmit,
    onClear,
    loading,
    onSuggestionClick,
    onScanAddress,
    containerRef,
    sidebarRef,
    inputRef,
}: SearchBarProps) {
    const t = useTranslations("Search");
    const tc = useTranslations("Calculator");
    const tHome = useTranslations("Home");
    const locale = useLocale();
    const router = useRouter();
    const { currency, lkrPerUsd } = useCurrency();

    const [suggestions, setSuggestions] = useState<RichAutocompleteSuggestion[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [highlight, setHighlight] = useState(-1);
    const [exampleIndex, setExampleIndex] = useState(0);
    const [weightOverrideGrams, setWeightOverrideGrams] = useState<number | null>(null);
    const [searchHistory, setSearchHistory] = useState<string[]>([]);

    const suggestionCache = useRef<Record<string, RichAutocompleteSuggestion[]>>({});
    const suggestDebounce = useRef<NodeJS.Timeout | null>(null);
    const suggestAbort = useRef<AbortController | null>(null);
    const localContainerRef = useRef<HTMLDivElement>(null);
    const searchFormRef = useRef<HTMLFormElement>(null);
    const drawerBoxRef = useRef<HTMLDivElement>(null);
    const actualContainerRef = containerRef || localContainerRef;
    const listId = `suggestions-${id}`;

    const cyclingExamples = useMemo(
        () => getSearchCyclingExamples(locale),
        [locale]
    );

    // Cycle example placeholder texts smoothly when on Home search and input is empty
    useEffect(() => {
        if (!enableSmartHomeSearch || query.trim().length > 0) return;
        const timer = setInterval(() => {
            setExampleIndex((prev) => (prev + 1) % cyclingExamples.length);
        }, 2800);
        return () => clearInterval(timer);
    }, [enableSmartHomeSearch, query, cyclingExamples.length]);

    // Reset manual weight chip override whenever the user edits the query text
    useEffect(() => {
        setWeightOverrideGrams(null);
    }, [query]);

    // Hydrate client search history on mount for Home smart search
    useEffect(() => {
        if (!enableSmartHomeSearch) return;
        setSearchHistory(loadSearchHistory());
    }, [enableSmartHomeSearch]);

    const recordHistory = useCallback(
        (term: string) => {
            if (!enableSmartHomeSearch) return;
            const trimmed = term.trim();
            if (!trimmed) return;
            setSearchHistory(addSearchHistory(trimmed));
        },
        [enableSmartHomeSearch]
    );

    const smartIntent: SmartSearchIntent | null = useMemo(() => {
        if (!enableSmartHomeSearch || !query.trim()) return null;
        return parseSmartSearchIntent(query, locale, weightOverrideGrams);
    }, [enableSmartHomeSearch, query, locale, weightOverrideGrams]);

    const effectiveAutocompleteMode: "name" | "division" | "all" = enableSmartHomeSearch ? "all" : searchMode;

    const fetchSuggestions = useCallback(
        async (val: string, mode: "name" | "division" | "all") => {
            const trimmed = val.trim();
            if (!trimmed) {
                suggestAbort.current?.abort();
                setSuggestions([]);
                return;
            }

            // Fast Path 1: Synchronous local index (< 3ms, zero network)
            const syncEngine = getLoadedOfficeIndexSync();
            if (syncEngine) {
                suggestAbort.current?.abort();
                setSuggestionsLoading(false);
                setSuggestions(syncEngine.autocompleteRich(trimmed, mode, 5));
                return;
            }

            const cacheKey = `${mode}-${trimmed.toLowerCase()}`;
            if (suggestionCache.current[cacheKey]) {
                setSuggestions(suggestionCache.current[cacheKey]);
                return;
            }

            suggestAbort.current?.abort();
            const controller = new AbortController();
            suggestAbort.current = controller;
            setSuggestionsLoading(true);

            try {
                // Hydrate local index once (typically from IndexedDB in < 20ms)
                const engine = await ensureLocalOfficeIndex();
                if (!controller.signal.aborted && engine) {
                    const localList = engine.autocompleteRich(trimmed, mode, 5);
                    suggestionCache.current[cacheKey] = localList;
                    setSuggestions(localList);
                    return;
                }

                const res = await fetch(
                    `/api/autocomplete?q=${encodeURIComponent(val)}&mode=${mode}`,
                    { signal: controller.signal }
                );
                if (res.ok && !controller.signal.aborted) {
                    const data = await res.json();
                    const list: RichAutocompleteSuggestion[] = (data.suggestions || []).map((label: string) => ({
                        label,
                        queryValue: label,
                        kind: mode === "division" ? "division" : "office",
                    }));
                    suggestionCache.current[cacheKey] = list;
                    setSuggestions(list);
                } else if (!controller.signal.aborted) {
                    const offlineMatches: RichAutocompleteSuggestion[] = searchOfflineOfficesCache({
                        q: val,
                        mode: mode === "division" ? "division" : "name",
                    })
                        .slice(0, 5)
                        .map((o) => ({
                            label: o.name,
                            queryValue: o.name,
                            slug: o.slug,
                            postalCode: o.postalCode || undefined,
                            division: o.fields.find((f) => f.name === "Division")?.value,
                            kind: "office",
                        }));
                    setSuggestions(offlineMatches);
                }
            } catch (err) {
                if ((err as { name?: string })?.name !== "AbortError") {
                    const offlineMatches: RichAutocompleteSuggestion[] = searchOfflineOfficesCache({
                        q: val,
                        mode: mode === "division" ? "division" : "name",
                    })
                        .slice(0, 5)
                        .map((o) => ({
                            label: o.name,
                            queryValue: o.name,
                            slug: o.slug,
                            postalCode: o.postalCode || undefined,
                            division: o.fields.find((f) => f.name === "Division")?.value,
                            kind: "office",
                        }));
                    setSuggestions(offlineMatches);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setSuggestionsLoading(false);
                }
            }
        },
        []
    );

    const processValueChange = useCallback(
        (val: string, sourceId: string) => {
            onQueryChange(val, sourceId);
            setHighlight(-1);
            if (!val.trim()) {
                if (suggestDebounce.current) clearTimeout(suggestDebounce.current);
                setSuggestions([]);
                setShowDropdown(false);
                return;
            }
            setIsActive(true);
            setShowDropdown(true);
            if (suggestDebounce.current) clearTimeout(suggestDebounce.current);

            // If the local index is already hydrated, run immediately with 0ms debounce!
            const syncEngine = getLoadedOfficeIndexSync();
            if (syncEngine) {
                setSuggestionsLoading(false);
                setSuggestions(syncEngine.autocompleteRich(val, effectiveAutocompleteMode, 5));
                return;
            }

            suggestDebounce.current = setTimeout(
                () => void fetchSuggestions(val, effectiveAutocompleteMode),
                80
            );
        },
        [effectiveAutocompleteMode, fetchSuggestions, onQueryChange]
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        processValueChange(e.target.value, id);
    };

    const navigateToSmartCalculator = (intent: SmartSearchIntent) => {
        setShowDropdown(false);
        setIsActive(false);
        triggerHaptic("light");
        if (intent.kind === "tracking") {
            router.push(intent.trackHref);
            return;
        }
        if (intent.kind === "international" && intent.seoRatesHref) {
            router.push(intent.seoRatesHref);
            return;
        }
        const params = new URLSearchParams(intent.calculatorHref.query);
        router.push(`/calculator?${params.toString()}`);
    };

    const visibleSuggestions = React.useMemo(() => {
        if (!enableSmartHomeSearch || !smartIntent) {
            return suggestions;
        }
        // When a user types a tracking barcode, explicit weight, or COD query,
        // suppress unrelated trigram post-office matches so the smart card is crisp and focused.
        if (smartIntent.kind === "tracking" || smartIntent.hasExplicitWeight || smartIntent.kind === "cod") {
            return [];
        }
        const qLower = query.trim().toLowerCase();
        return suggestions.filter((s) => s.label.toLowerCase().includes(qLower)).slice(0, 2);
    }, [enableSmartHomeSearch, smartIntent, suggestions, query]);

    const handleSubmit = () => {
        if (suggestDebounce.current) clearTimeout(suggestDebounce.current);
        recordHistory(query);
        setShowDropdown(false);
        setIsActive(false);
        // If on Home Page and user typed a clear rate query (like "thaiwan 5kg") with no matching post offices, jump straight to the SEO rate page / calculator
        if (enableSmartHomeSearch && smartIntent && visibleSuggestions.length === 0) {
            navigateToSmartCalculator(smartIntent);
            return;
        }
        onSubmit();
    };

    const handleSuggestClick = (s: RichAutocompleteSuggestion) => {
        recordHistory(s.queryValue);
        setShowDropdown(false);
        setIsActive(false);
        if (suggestDebounce.current) clearTimeout(suggestDebounce.current);
        triggerHaptic("light");
        if (enableSmartHomeSearch && s.kind === "office" && s.slug) {
            router.push(`/office/${s.slug}`);
            return;
        }
        onSuggestionClick(s.queryValue);
    };

    const handleCloseDropdownOnly = () => {
        if (suggestDebounce.current) clearTimeout(suggestDebounce.current);
        setShowDropdown(false);
        setIsActive(false);
    };

    const handleClearAndClose = () => {
        if (suggestDebounce.current) clearTimeout(suggestDebounce.current);
        setSuggestions([]);
        setShowDropdown(false);
        setIsActive(false);
        onClear();
    };

    const hasDropdownContent =
        Boolean(query.trim()) &&
        (Boolean(smartIntent) || visibleSuggestions.length > 0);
    const open = showDropdown && isActive && hasDropdownContent;

    // Automatically scroll down so the dropdown fits on screen, while clamping so the search bar itself never goes off the top of the screen
    useEffect(() => {
        if (!enableSmartHomeSearch || !open) return;
        const timer = window.setTimeout(() => {
            const formEl = searchFormRef.current;
            const drawerEl = drawerBoxRef.current;
            if (!formEl || !drawerEl) return;

            const formRect = formEl.getBoundingClientRect();
            const drawerRect = drawerEl.getBoundingClientRect();
            const stickyTopOffset = 62;
            const bottomBarOffset = window.innerWidth < 768 ? 64 : 16;
            const viewportBottom = window.innerHeight - bottomBarOffset;

            const overflowBottom = drawerRect.bottom - viewportBottom;
            const maxAllowedScrollDelta = Math.max(0, formRect.top - stickyTopOffset);

            if (overflowBottom > 0 && maxAllowedScrollDelta > 4) {
                const scrollDelta = Math.min(overflowBottom + 10, maxAllowedScrollDelta);
                window.scrollBy({ top: scrollDelta, behavior: "smooth" });
            }
        }, 180);

        return () => window.clearTimeout(timer);
    }, [enableSmartHomeSearch, open, query, smartIntent, visibleSuggestions.length]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (open && e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, visibleSuggestions.length - 1));
        } else if (open && e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, -1));
        } else if (e.key === "Escape") {
            e.preventDefault();
            handleCloseDropdownOnly();
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (open && highlight >= 0 && visibleSuggestions[highlight]) {
                handleSuggestClick(visibleSuggestions[highlight]);
            } else {
                handleSubmit();
            }
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const inThis = actualContainerRef.current?.contains(target);
            const inSidebar = sidebarRef?.current?.contains(target);
            if (!inThis && !inSidebar && isActive) {
                setShowDropdown(false);
                setIsActive(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [actualContainerRef, sidebarRef, isActive]);

    useEffect(() => {
        if (!enableSmartHomeSearch) {
            setSuggestions([]);
            setShowDropdown(false);
        }
    }, [searchMode, enableSmartHomeSearch]);

    const handleEnterTypeMode = useCallback(() => {
        setIsActive(true);
        void ensureLocalOfficeIndex();
        if (query.trim()) setShowDropdown(true);
    }, [query]);

    const handleComposerSubmit = () => {
        if (open && highlight >= 0 && visibleSuggestions[highlight]) {
            handleSuggestClick(visibleSuggestions[highlight]);
        } else {
            handleSubmit();
        }
    };

    return (
        <div className="relative w-full" id={`search-container-${id}`} ref={actualContainerRef}>
            {enableSmartHomeSearch ? (
                <HomeSmartSearchComposer
                    id={id}
                    query={query}
                    onQueryChange={processValueChange}
                    loading={loading}
                    suggestionsLoading={suggestionsLoading}
                    officeSuggestions={suggestions}
                    cyclingExamples={cyclingExamples}
                    exampleIndex={exampleIndex}
                    locale={locale}
                    isActive={isActive}
                    open={open}
                    listId={listId}
                    highlight={highlight}
                    submitLabel={t("submit")}
                    clearLabel={t("clear")}
                    searchFormRef={searchFormRef}
                    searchHistory={searchHistory}
                    onSelectHistoryItem={(term) => {
                        processValueChange(term, id);
                    }}
                    onRemoveHistoryItem={(term) => {
                        setSearchHistory(removeSearchHistoryItem(term));
                    }}
                    onEnterTypeMode={handleEnterTypeMode}
                    onCollapseTypeMode={handleCloseDropdownOnly}
                    onClearAll={() => {
                        if (suggestDebounce.current) clearTimeout(suggestDebounce.current);
                        setSuggestions([]);
                        setShowDropdown(false);
                        onClear();
                    }}
                    onSubmit={handleComposerSubmit}
                    onArrowNavigate={(dir) => {
                        if (dir === "down") {
                            setHighlight((h) => Math.min(h + 1, visibleSuggestions.length - 1));
                        } else {
                            setHighlight((h) => Math.max(h - 1, -1));
                        }
                    }}
                    onEscape={handleCloseDropdownOnly}
                />
            ) : (
                <form
                    ref={searchFormRef}
                    role="search"
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSubmit();
                    }}
                    className={cn(
                        "relative flex items-stretch overflow-hidden rounded-md border-2 border-foreground bg-card transition-shadow",
                        "focus-within:shadow-[3px_3px_0_0_hsl(var(--foreground))]",
                        isSticky ? "h-11" : "h-14"
                    )}
                >
                    <label
                        htmlFor={`search-${id}`}
                        className="relative z-10 flex flex-1 items-center gap-2 pl-2.5 md:pl-3.5 min-w-0 cursor-text"
                    >
                        <span className="sr-only">{t("submit")}</span>
                        <span
                            className="flex items-center justify-center shrink-0 text-muted-foreground"
                            aria-hidden="true"
                        >
                            {searchMode === "name" ? (
                                <Building2 className="h-[1.1rem] w-[1.1rem]" />
                            ) : (
                                <MapPin className="h-[1.1rem] w-[1.1rem]" />
                            )}
                        </span>

                        <div className="relative flex-1 h-full flex items-center min-w-0">
                            <input
                                id={`search-${id}`}
                                ref={inputRef}
                                type="search"
                                inputMode="search"
                                enterKeyHint="search"
                                autoComplete="off"
                                value={query}
                                onChange={handleChange}
                                onKeyDown={handleKeyDown}
                                onFocus={() => {
                                    setIsActive(true);
                                    void ensureLocalOfficeIndex();
                                    if (query.trim()) setShowDropdown(true);
                                }}
                                placeholder={
                                    searchMode === "name"
                                        ? t("placeholderName")
                                        : t("placeholderArea")
                                }
                                aria-label={
                                    searchMode === "name"
                                        ? t("placeholderName")
                                        : t("placeholderArea")
                                }
                                role="combobox"
                                aria-expanded={open}
                                aria-controls={listId}
                                aria-autocomplete="list"
                                aria-activedescendant={
                                    open && highlight >= 0 ? `${listId}-${highlight}` : undefined
                                }
                                className={cn(
                                    "relative z-10 h-full w-full min-w-0 bg-transparent outline-none [&::-webkit-search-cancel-button]:hidden",
                                    isSticky
                                        ? "text-base"
                                        : "text-[1.05rem] md:text-[1.12rem] placeholder:text-muted-foreground/80"
                                )}
                            />
                        </div>
                    </label>

                    <div className="relative z-10 flex items-center gap-1 pr-1.5">
                        {(loading || suggestionsLoading) && (
                            <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-card/90">
                                <Loader2
                                    className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin text-foreground"
                                    aria-hidden="true"
                                />
                            </span>
                        )}
                        {query && (
                            <button
                                type="button"
                                onClick={handleClearAndClose}
                                data-testid="search-clear-button"
                                className="tap flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
                                aria-label={t("clear")}
                            >
                                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.5} />
                            </button>
                        )}
                        {onScanAddress && (
                            <button
                                type="button"
                                onPointerDown={() =>
                                    void import("@/lib/tracking/ocr-worker").then((m) =>
                                        m.prewarmOcr(
                                            locale === "si"
                                                ? "eng+sin"
                                                : locale === "ta"
                                                  ? "eng+tam"
                                                  : "eng"
                                        )
                                    )
                                }
                                onClick={onScanAddress}
                                data-testid="browse-scan-address-btn"
                                title="Scan destination address from letter"
                                aria-label="Scan address"
                                className="tap inline-flex h-7 sm:h-8 items-center gap-1 rounded border-[1.5px] border-foreground bg-secondary px-2 text-xs font-extrabold text-secondary-foreground hover:opacity-95 transition-opacity"
                            >
                                <Camera className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
                                {!isSticky && <span className="hidden sm:inline">Scan</span>}
                            </button>
                        )}
                    </div>

                    <button
                        type="submit"
                        className={cn(
                            "tap relative z-10 flex shrink-0 items-center justify-center gap-2 border-l-2 border-foreground bg-primary font-semibold text-primary-foreground hover:bg-primary/90",
                            isSticky ? "w-11" : "w-12 sm:w-14 md:w-auto md:px-6"
                        )}
                        aria-label={t("submit")}
                    >
                        <Search className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.4} />
                        {!isSticky && <span className="hidden md:inline">{t("submit")}</span>}
                    </button>
                </form>
            )}

            {/* Home Page: In-Flow Push-Down Smart Search Drawer (shifts UI elements below downward when open, jumps back up when closed) */}
            {enableSmartHomeSearch ? (
                <AnimatePresence initial={false}>
                    {open && (
                        <m.div
                            key="home-inflow-smart-drawer"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                            className="overflow-hidden"
                        >
                            <div
                                ref={drawerBoxRef}
                                id={listId}
                                role="region"
                                aria-label="Smart search results"
                                data-testid="smart-search-inflow-drawer"
                                className="mt-2 overflow-hidden rounded-xl border-2 border-foreground bg-card shadow-[3px_3px_0_0_hsl(var(--foreground))]"
                            >
                                {/* Top Drawer Bar with Explicit [X] Close Button */}
                                <div className="flex items-center justify-between gap-2 border-b-[1.5px] border-foreground bg-muted/60 px-2.5 py-1.5 sm:px-3.5 sm:py-2">
                                    <span className="font-mono text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-foreground truncate">
                                        {smartIntent
                                            ? smartIntent.kind === "tracking"
                                                ? "Parcel & Mail Tracking"
                                                : smartIntent.kind === "international"
                                                    ? t("smartPreviewIntl")
                                                    : smartIntent.kind === "cod"
                                                        ? t("smartPreviewCod")
                                                        : t("smartPreviewLocal")
                                            : t("resultsFor", { query })}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleCloseDropdownOnly}
                                        data-testid="smart-drawer-close-button"
                                        aria-label="Close search results"
                                        className="tap inline-flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-md border-[1.5px] border-foreground bg-card text-foreground hover:bg-secondary transition-colors"
                                    >
                                        <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.5} />
                                    </button>
                                </div>

                                {/* 1. Smart Preview Section (Tracking / International / COD / Domestic) */}
                                {smartIntent && (
                                    <div className="p-2 sm:p-3.5 border-b border-border space-y-2">
                                        {smartIntent.kind === "tracking" && (
                                            <HomeTrackingDrawerCard
                                                intent={smartIntent}
                                                onCloseDrawer={() => {
                                                    recordHistory(query);
                                                    handleCloseDropdownOnly();
                                                }}
                                            />
                                        )}

                                        {smartIntent.kind === "international" && (
                                            <div
                                                data-testid="smart-rate-preview-intl"
                                                className="rounded-lg border-2 border-foreground par-avion-stripe p-[3px] sm:p-1"
                                            >
                                                <div className="rounded-md bg-card p-2 sm:p-3 space-y-2">
                                                    <div className="flex items-center justify-between gap-1.5">
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            <CountryFlag
                                                                code={smartIntent.countryCode}
                                                                title={smartIntent.countryName}
                                                                className="h-3.5 w-5 sm:h-4 sm:w-6 shrink-0"
                                                            />
                                                            <div className="min-w-0">
                                                                <div className="flex flex-wrap items-center gap-1">
                                                                    <span className="font-heading text-sm sm:text-base font-extrabold text-foreground leading-tight">
                                                                        {smartIntent.countryName}
                                                                    </span>
                                                                    {smartIntent.isFuzzyMatch && (
                                                                        <span className="rounded bg-secondary/45 px-1 py-px font-mono text-[9px] sm:text-[10px] font-bold text-foreground">
                                                                            {t("smartMatched", { token: smartIntent.matchedQueryToken })}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="font-mono text-[10px] sm:text-[11px] text-muted-foreground leading-tight truncate">
                                                                    {smartIntent.zoneLabel} ·{" "}
                                                                    <strong className="text-foreground">
                                                                        {formatWeightLabel(smartIntent.weightGrams)}
                                                                    </strong>{" "}
                                                                    ({smartIntent.weightGrams.toLocaleString()}g)
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#1D4E9E] px-2 py-0.5 font-mono text-[9px] sm:text-[10px] font-bold uppercase text-white">
                                                            <Plane className="h-2.5 w-2.5 sm:h-3 sm:w-3" aria-hidden="true" />
                                                            <span>{tc("modeIntl")}</span>
                                                        </span>
                                                    </div>

                                                    {/* Compact Mobile-First Quotes Grid (2 or 3 columns side-by-side even on mobile) */}
                                                    <div
                                                        className={cn(
                                                            "grid gap-1.5 sm:gap-2",
                                                            smartIntent.quotes.length >= 3
                                                                ? "grid-cols-3"
                                                                : "grid-cols-2"
                                                        )}
                                                    >
                                                        {smartIntent.quotes.map((q) => (
                                                            <Link
                                                                key={q.serviceId}
                                                                href={{
                                                                    pathname: "/calculator",
                                                                    query: {
                                                                        mode: "intl",
                                                                        country: smartIntent.countryCode,
                                                                        weight: String(smartIntent.weightGrams),
                                                                        transport: q.transport ?? "air",
                                                                        service: q.serviceId,
                                                                    },
                                                                }}
                                                                onClick={() => {
                                                                    recordHistory(query);
                                                                    handleCloseDropdownOnly();
                                                                }}
                                                                className="tap flex flex-col justify-between rounded-md border-[1.5px] border-foreground bg-background px-1.5 py-1.5 sm:px-2.5 sm:py-2 hover:bg-secondary/20 transition-colors min-w-0"
                                                            >
                                                                <div className="flex items-center justify-between gap-0.5 min-w-0">
                                                                    <span className="font-bold text-[10px] sm:text-xs text-foreground truncate">
                                                                        {q.shortName}
                                                                    </span>
                                                                    {q.isCheapest ? (
                                                                        <span className="rounded bg-green-100 px-1 py-px font-mono text-[7.5px] sm:text-[8.5px] font-bold uppercase text-green-800 dark:bg-green-900/50 dark:text-green-300 shrink-0">
                                                                            {tHome("cheapest")}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="font-mono text-[8px] sm:text-[9.5px] text-muted-foreground shrink-0">
                                                                            {q.transport === "sea" ? tc("sea") : tc("air")}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="mt-0.5">
                                                                    <span className="block font-mono text-[11.5px] sm:text-base font-extrabold text-[#1D4E9E] dark:text-blue-300 tabular-nums whitespace-nowrap">
                                                                        {formatCurrencyAmount(
                                                                            q.totalLkr,
                                                                            currency,
                                                                            lkrPerUsd
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            </Link>
                                                        ))}
                                                    </div>

                                                    {/* Interactive Weight Chips + Full-Width Deep-Link Button */}
                                                    <div className="flex flex-col gap-2 pt-0.5">
                                                        <div className="flex flex-wrap items-center gap-1">
                                                            <span className="inline-flex shrink-0 items-center gap-0.5 font-mono text-[10px] font-bold text-muted-foreground mr-0.5">
                                                                <Scale className="h-2.5 w-2.5" aria-hidden="true" />
                                                                <span>{tc("step1Title")}:</span>
                                                            </span>
                                                            {SMART_WEIGHT_CHIPS.map((w) => {
                                                                const active = smartIntent.weightGrams === w;
                                                                return (
                                                                    <button
                                                                        key={w}
                                                                        type="button"
                                                                        onMouseDown={(e) => e.preventDefault()}
                                                                        onClick={() => setWeightOverrideGrams(w)}
                                                                        className={cn(
                                                                            "tap shrink-0 rounded-full border px-1.5 py-0.5 font-mono text-[10px] font-bold transition-colors",
                                                                            active
                                                                                ? "border-foreground bg-foreground text-background"
                                                                                : "border-foreground/40 bg-background text-foreground hover:border-foreground"
                                                                        )}
                                                                    >
                                                                        {formatWeightLabel(w)}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>

                                                        <Link
                                                            href={smartIntent.calculatorHref}
                                                            data-testid="smart-rate-open-calculator"
                                                            onClick={() => {
                                                                recordHistory(query);
                                                                handleCloseDropdownOnly();
                                                            }}
                                                            className="tap inline-flex w-full items-center justify-center gap-1.5 rounded-md border-2 border-foreground bg-[#1D4E9E] px-3 py-1.5 text-xs font-bold text-white shadow-[0_2px_0_0_hsl(var(--foreground))] hover:opacity-95"
                                                        >
                                                            <span>
                                                                {t("smartOpenCalc", {
                                                                    country: smartIntent.countryName,
                                                                    weight: formatWeightLabel(smartIntent.weightGrams),
                                                                })}
                                                            </span>
                                                            <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {smartIntent.kind === "cod" && (
                                            <div
                                                data-testid="smart-rate-preview-cod"
                                                className="rounded-lg border-2 border-foreground bg-[#15803D]/10 dark:bg-emerald-500/15 p-3 space-y-2.5"
                                            >
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div>
                                                        <span className="inline-flex items-center gap-1.5 font-heading text-base font-extrabold text-foreground">
                                                            <Banknote className="h-4 w-4 text-[#15803D] dark:text-emerald-400" />
                                                            <span>{tc("codTitle")}</span>
                                                        </span>
                                                        <p className="font-mono text-xs text-muted-foreground">
                                                            <strong className="text-foreground">
                                                                {formatWeightLabel(smartIntent.weightGrams)}
                                                            </strong>{" "}
                                                            ·{" "}
                                                            <strong className="text-foreground">
                                                                Rs. {smartIntent.codAmountLkr.toLocaleString()}
                                                            </strong>
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="block font-mono text-[10px] uppercase text-muted-foreground">
                                                            {tc("total")}
                                                        </span>
                                                        <span className="font-mono text-xl font-extrabold text-[#15803D] dark:text-emerald-400 tabular-nums">
                                                            {formatCurrencyAmount(
                                                                smartIntent.result.totalCost,
                                                                currency,
                                                                lkrPerUsd
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-foreground/20">
                                                    <span className="font-mono text-xs text-foreground">
                                                        {tc("netRemittance", {
                                                            amount: formatCurrencyAmount(
                                                                smartIntent.result.netRemittance,
                                                                currency,
                                                                lkrPerUsd
                                                            ),
                                                        })}
                                                    </span>
                                                    <Link
                                                        href={smartIntent.calculatorHref}
                                                        data-testid="smart-rate-open-calculator"
                                                        onClick={() => {
                                                            recordHistory(query);
                                                            handleCloseDropdownOnly();
                                                        }}
                                                        className="tap inline-flex items-center gap-1.5 rounded-md border-2 border-foreground bg-[#15803D] px-3.5 py-1.5 text-xs font-bold text-white shadow-[0_2px_0_0_hsl(var(--foreground))]"
                                                    >
                                                        <span>
                                                            {t("smartOpenCodCalc", {
                                                                weight: formatWeightLabel(smartIntent.weightGrams),
                                                                amount: smartIntent.codAmountLkr.toLocaleString(),
                                                            })}
                                                        </span>
                                                        <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                                                    </Link>
                                                </div>
                                            </div>
                                        )}

                                        {smartIntent.kind === "domestic" && (
                                            <div
                                                data-testid="smart-rate-preview-domestic"
                                                className="rounded-lg border-2 border-foreground bg-primary/5 dark:bg-primary/15 p-3 space-y-2.5"
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="inline-flex items-center gap-1.5 font-heading text-base font-extrabold text-foreground">
                                                        <Mail className="h-4 w-4 text-primary" />
                                                        <span>
                                                            {tHome("toolLocal")} ·{" "}
                                                            {formatWeightLabel(smartIntent.weightGrams)}
                                                        </span>
                                                    </span>
                                                    <Link
                                                        href={smartIntent.calculatorHref}
                                                        data-testid="smart-rate-open-calculator"
                                                        onClick={() => {
                                                            recordHistory(query);
                                                            handleCloseDropdownOnly();
                                                        }}
                                                        className="tap inline-flex items-center gap-1.5 rounded-md border-2 border-foreground bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-[0_2px_0_0_hsl(var(--foreground))]"
                                                    >
                                                        <span>{t("smartOpenLocalCalc")}</span>
                                                        <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                                                    </Link>
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                                    {smartIntent.quotes.map((q) => (
                                                        <Link
                                                            key={q.serviceId}
                                                            href={{
                                                                pathname: "/calculator",
                                                                query: {
                                                                    mode: "local",
                                                                    weight: String(smartIntent.weightGrams),
                                                                    service: q.serviceId,
                                                                },
                                                            }}
                                                            onClick={() => {
                                                                recordHistory(query);
                                                                handleCloseDropdownOnly();
                                                            }}
                                                            className="tap rounded-md border border-foreground/50 bg-card px-2.5 py-1.5 hover:border-foreground"
                                                        >
                                                            <span className="block text-[11px] font-bold text-foreground truncate">
                                                                {q.shortName}
                                                            </span>
                                                            <span className="block font-mono text-sm font-extrabold text-primary tabular-nums">
                                                                {formatCurrencyAmount(
                                                                    q.totalLkr,
                                                                    currency,
                                                                    lkrPerUsd
                                                                )}
                                                            </span>
                                                        </Link>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 2. Matching Post Offices List */}
                                {visibleSuggestions.length > 0 && (
                                    <ul role="listbox" className="divide-y divide-border">
                                        {visibleSuggestions.map((s, i) => (
                                            <li
                                                key={`${s.label}-${s.postalCode ?? i}`}
                                                id={`${listId}-${i}`}
                                                role="option"
                                                aria-selected={highlight === i}
                                            >
                                                <button
                                                    type="button"
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => handleSuggestClick(s)}
                                                    className={cn(
                                                        "flex w-full items-center gap-3 px-4 py-2.5 text-left text-[0.95rem] transition-colors",
                                                        highlight === i
                                                            ? "bg-secondary/30"
                                                            : "hover:bg-muted"
                                                    )}
                                                >
                                                    <Building2 className="h-4 w-4 shrink-0 text-primary" />
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block font-semibold truncate">{s.queryValue}</span>
                                                        {s.division && (
                                                            <span className="block text-xs text-muted-foreground truncate">
                                                                {s.division}
                                                            </span>
                                                        )}
                                                    </span>
                                                    {s.postalCode && (
                                                        <span className="shrink-0 rounded border border-foreground/30 bg-muted/60 px-1.5 py-0.5 font-mono text-xs font-bold text-foreground">
                                                            {s.postalCode}
                                                        </span>
                                                    )}
                                                    <CornerDownLeft
                                                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60"
                                                        aria-hidden="true"
                                                    />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {/* Footer Directory Search Action (hidden for tracking barcodes) */}
                                {smartIntent?.kind !== "tracking" && (
                                    <div className="bg-muted/40 px-3.5 py-2 border-t border-border flex items-center justify-between">
                                        <button
                                            type="button"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => {
                                                recordHistory(query);
                                                onSubmit();
                                            }}
                                            className="tap inline-flex items-center gap-1.5 text-xs font-bold text-foreground hover:text-primary transition-colors"
                                        >
                                            <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                                            <span>
                                                {t("smartSearchDirectoryFor", { query: query.trim() })}
                                            </span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </m.div>
                    )}
                </AnimatePresence>
            ) : (
                /* Standard Overlay Autocomplete Dropdown for /browse Page */
                <AnimatePresence>
                    {open && suggestions.length > 0 && (
                        <m.ul
                            id={listId}
                            role="listbox"
                            initial={{ opacity: 0, y: -4, scale: 0.99 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.99 }}
                            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                            className="absolute left-0 right-0 top-full z-[60] mt-1.5 overflow-hidden rounded-md border-2 border-foreground bg-card py-1 shadow-[4px_4px_0_0_hsl(var(--foreground))]"
                        >
                            {suggestions.map((s, i) => (
                                <li
                                    key={`${s.label}-${s.postalCode ?? i}`}
                                    id={`${listId}-${i}`}
                                    role="option"
                                    aria-selected={highlight === i}
                                >
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => handleSuggestClick(s)}
                                        className={cn(
                                            "flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left text-[0.95rem] last:border-0",
                                            highlight === i ? "bg-secondary/30" : "hover:bg-muted"
                                        )}
                                    >
                                        {searchMode === "name" ? (
                                            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        ) : (
                                            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        )}
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate font-medium">{s.queryValue}</span>
                                            {s.division && searchMode === "name" && (
                                                <span className="block text-xs text-muted-foreground truncate">
                                                    {s.division}
                                                </span>
                                            )}
                                        </span>
                                        {s.postalCode && (
                                            <span className="shrink-0 rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-xs font-bold">
                                                {s.postalCode}
                                            </span>
                                        )}
                                        <CornerDownLeft
                                            className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60"
                                            aria-hidden="true"
                                        />
                                    </button>
                                </li>
                            ))}
                        </m.ul>
                    )}
                </AnimatePresence>
            )}
        </div>
    );
}
