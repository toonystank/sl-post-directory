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
    Route,
    AlertTriangle,
} from "lucide-react";
import { m, AnimatePresence } from "motion/react";
import { Link, useRouter } from "@/navigation";
import { cn } from "@/lib/utils";
import CountryFlag from "@/components/brand/CountryFlag";
import HomeSmartSearchComposer from "./HomeSmartSearchComposer";
import HomeTrackingDrawerCard from "@/components/tracking/HomeTrackingDrawerCard";
import { useCurrency } from "@/context/CurrencyContext";
import { useStaffStation } from "@/context/StaffStationContext";
import { formatCurrencyAmount } from "@/lib/currency";
import {
    SMART_WEIGHT_CHIPS,
    formatWeightLabel,
    getSearchCyclingExamples,
    parseSmartSearchIntent,
    resolveSmartRouteIntent,
    type SmartSearchIntent,
} from "@/lib/smart-search";
import { parseRouteQueryPair } from "@/lib/mail-routing";
import { parseSingleSidedRouteQuery, toStaffStation } from "@/lib/staff-station";
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
    const { station, setStation, mailRoutingEnabled } = useStaffStation();

    const [suggestions, setSuggestions] = useState<RichAutocompleteSuggestion[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [highlight, setHighlight] = useState(-1);
    const [exampleIndex, setExampleIndex] = useState(0);
    const [weightOverrideGrams, setWeightOverrideGrams] = useState<number | null>(null);
    const [searchHistory, setSearchHistory] = useState<string[]>([]);
    const [indexVersion, setIndexVersion] = useState(0);

    const suggestionCache = useRef<Record<string, RichAutocompleteSuggestion[]>>({});
    const suggestDebounce = useRef<NodeJS.Timeout | null>(null);
    const suggestAbort = useRef<AbortController | null>(null);
    const localContainerRef = useRef<HTMLDivElement>(null);
    const searchFormRef = useRef<HTMLFormElement>(null);
    const savedScrollYRef = useRef<number | null>(null);
    const skipScrollRestoreRef = useRef(false);
    const scrollRafRef = useRef<number | null>(null);
    const restoreTimerRef = useRef<number | null>(null);
    const enterIndexTimerRef = useRef<number | null>(null);
    const isActiveRef = useRef(isActive);
    isActiveRef.current = isActive;
    const actualContainerRef = containerRef || localContainerRef;
    const listId = `suggestions-${id}`;

    useEffect(() => {
        return () => {
            if (scrollRafRef.current !== null && typeof window !== "undefined") {
                window.cancelAnimationFrame(scrollRafRef.current);
            }
            if (restoreTimerRef.current !== null && typeof window !== "undefined") {
                window.clearTimeout(restoreTimerRef.current);
            }
            if (enterIndexTimerRef.current !== null && typeof window !== "undefined") {
                window.clearTimeout(enterIndexTimerRef.current);
            }
        };
    }, []);

    // Preload offline office index during browser idle time so opening search never stalls on IDB
    useEffect(() => {
        if (!enableSmartHomeSearch || typeof window === "undefined") return;
        const win = window as Window & {
            requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
            cancelIdleCallback?: (id: number) => void;
        };
        if (typeof win.requestIdleCallback === "function") {
            const idleId = win.requestIdleCallback(() => {
                void ensureLocalOfficeIndex();
            }, { timeout: 2500 });
            return () => win.cancelIdleCallback?.(idleId);
        }
        const timer = window.setTimeout(() => {
            void ensureLocalOfficeIndex();
        }, 1500);
        return () => window.clearTimeout(timer);
    }, [enableSmartHomeSearch]);

    const cyclingExamples = useMemo(
        () => getSearchCyclingExamples(locale, mailRoutingEnabled),
        [locale, mailRoutingEnabled]
    );

    // Cycle example placeholder texts cleanly while resting; pause immediately when active or typing
    useEffect(() => {
        if (!enableSmartHomeSearch || isActive || query.trim().length > 0) return;
        const timer = setInterval(() => {
            setExampleIndex((prev) => (prev + 1) % cyclingExamples.length);
        }, 2800);
        return () => clearInterval(timer);
    }, [enableSmartHomeSearch, isActive, query, cyclingExamples.length]);

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

    // Hydrate the compact index immediately when the user types a route query like "kandy to jafna" or "to jafna"
    useEffect(() => {
        if (!mailRoutingEnabled) return;
        const isPair = Boolean(parseRouteQueryPair(query));
        const isSingleStaffRoute = Boolean(station && parseSingleSidedRouteQuery(query));
        if (!isPair && !isSingleStaffRoute) return;
        if (getLoadedOfficeIndexSync()) return;
        let cancelled = false;
        void ensureLocalOfficeIndex().then((engine) => {
            if (!cancelled && engine) {
                setIndexVersion((v) => v + 1);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [mailRoutingEnabled, query, station]);

    const routeIntent = useMemo(() => {
        if (!mailRoutingEnabled || !query.trim()) return null;
        const engine = getLoadedOfficeIndexSync();
        if (!engine) return null;
        void indexVersion;
        return resolveSmartRouteIntent(query, engine.getRoutingNodes(), station?.slug);
    }, [mailRoutingEnabled, query, indexVersion, station?.slug]);

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

    const scrollSearchBarToTop = useCallback(() => {
        if (!enableSmartHomeSearch || typeof window === "undefined") return;
        // Only auto-scroll on mobile viewports (< md) where the soft keyboard overlays results
        if (window.innerWidth >= 768) return;
        const formEl = searchFormRef.current;
        if (!formEl) return;

        if (restoreTimerRef.current !== null) {
            window.clearTimeout(restoreTimerRef.current);
            restoreTimerRef.current = null;
        }

        // Preserve exact pre-search scroll offset only on initial transition into search mode
        if (savedScrollYRef.current === null) {
            savedScrollYRef.current = window.scrollY;
        }
        skipScrollRestoreRef.current = false;

        if (scrollRafRef.current !== null) {
            window.cancelAnimationFrame(scrollRafRef.current);
        }
        scrollRafRef.current = window.requestAnimationFrame(() => {
            scrollRafRef.current = null;
            const currentFormEl = searchFormRef.current;
            if (!currentFormEl) return;

            const headerEl = document.querySelector<HTMLElement>("header.sticky");
            const stickyHeight = headerEl?.offsetHeight || 52;
            const targetTop = stickyHeight + 10;

            const formRect = currentFormEl.getBoundingClientRect();
            const delta = formRect.top - targetTop;
            if (Math.abs(delta) > 8) {
                const prefersReducedMotion =
                    typeof window.matchMedia === "function" &&
                    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                const nextScrollY = Math.max(0, window.scrollY + delta);
                window.scrollTo({
                    top: nextScrollY,
                    behavior: prefersReducedMotion ? "auto" : "smooth",
                });
            }
        });
    }, [enableSmartHomeSearch]);

    const restorePreviousScroll = useCallback(() => {
        if (!enableSmartHomeSearch || typeof window === "undefined") return;
        if (scrollRafRef.current !== null) {
            window.cancelAnimationFrame(scrollRafRef.current);
            scrollRafRef.current = null;
        }
        if (restoreTimerRef.current !== null) {
            window.clearTimeout(restoreTimerRef.current);
            restoreTimerRef.current = null;
        }
        if (skipScrollRestoreRef.current) {
            skipScrollRestoreRef.current = false;
            savedScrollYRef.current = null;
            return;
        }
        if (savedScrollYRef.current !== null) {
            const targetY = savedScrollYRef.current;
            savedScrollYRef.current = null;
            if (Math.abs(window.scrollY - targetY) > 2) {
                const prefersReducedMotion =
                    typeof window.matchMedia === "function" &&
                    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                restoreTimerRef.current = window.setTimeout(() => {
                    restoreTimerRef.current = null;
                    window.scrollTo({
                        top: targetY,
                        behavior: prefersReducedMotion ? "auto" : "smooth",
                    });
                }, 60);
            }
        }
    }, [enableSmartHomeSearch]);

    const closeForNavigation = useCallback(() => {
        if (suggestDebounce.current) clearTimeout(suggestDebounce.current);
        skipScrollRestoreRef.current = true;
        savedScrollYRef.current = null;
        isActiveRef.current = false;
        setShowDropdown(false);
        setIsActive(false);
    }, []);

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
            if (!isActiveRef.current) {
                isActiveRef.current = true;
                scrollSearchBarToTop();
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
        [effectiveAutocompleteMode, fetchSuggestions, onQueryChange, scrollSearchBarToTop]
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        processValueChange(e.target.value, id);
    };

    const navigateToSmartCalculator = (intent: SmartSearchIntent) => {
        closeForNavigation();
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
        if (routeIntent) {
            return [];
        }
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
    }, [enableSmartHomeSearch, routeIntent, smartIntent, suggestions, query]);

    const handleSubmit = () => {
        recordHistory(query);
        closeForNavigation();
        if (mailRoutingEnabled && routeIntent) {
            setStation(toStaffStation(routeIntent.origin));
            triggerHaptic("light");
            router.push(routeIntent.routingHref);
            return;
        }
        if (
            mailRoutingEnabled &&
            (parseRouteQueryPair(query) || (station && parseSingleSidedRouteQuery(query)))
        ) {
            void ensureLocalOfficeIndex().then((engine) => {
                if (!engine) {
                    onSubmit();
                    return;
                }
                const resolved = resolveSmartRouteIntent(
                    query,
                    engine.getRoutingNodes(),
                    station?.slug
                );
                if (resolved) {
                    setStation(toStaffStation(resolved.origin));
                    triggerHaptic("light");
                    router.push(resolved.routingHref);
                } else {
                    onSubmit();
                }
            });
            return;
        }
        // If on Home Page and user typed a clear rate query (like "thaiwan 5kg") with no matching post offices, jump straight to the SEO rate page / calculator
        if (enableSmartHomeSearch && smartIntent && visibleSuggestions.length === 0) {
            navigateToSmartCalculator(smartIntent);
            return;
        }
        onSubmit();
    };

    const handleSuggestClick = (s: RichAutocompleteSuggestion) => {
        recordHistory(s.queryValue);
        closeForNavigation();
        triggerHaptic("light");
        if (enableSmartHomeSearch && s.kind === "office" && s.slug) {
            router.push(`/office/${s.slug}`);
            return;
        }
        onSuggestionClick(s.queryValue);
    };

    const handleCloseDropdownOnly = useCallback(() => {
        if (suggestDebounce.current) clearTimeout(suggestDebounce.current);
        isActiveRef.current = false;
        setShowDropdown(false);
        setIsActive(false);
        if (!query.trim()) {
            restorePreviousScroll();
        }
    }, [query, restorePreviousScroll]);

    const handleClearAndClose = () => {
        if (suggestDebounce.current) clearTimeout(suggestDebounce.current);
        isActiveRef.current = false;
        setSuggestions([]);
        setShowDropdown(false);
        setIsActive(false);
        restorePreviousScroll();
        onClear();
    };

    const hasDropdownContent =
        Boolean(query.trim()) &&
        (Boolean(routeIntent) || Boolean(smartIntent) || visibleSuggestions.length > 0);
    const open = showDropdown && isActive && hasDropdownContent;

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
        const handleClickOutside = (event: PointerEvent) => {
            const target = event.target as Node;
            const inThis = actualContainerRef.current?.contains(target);
            const inSidebar = sidebarRef?.current?.contains(target);
            if (!inThis && !inSidebar && isActiveRef.current) {
                isActiveRef.current = false;
                setShowDropdown(false);
                setIsActive(false);
                if (!query.trim()) {
                    restorePreviousScroll();
                }
            }
        };
        document.addEventListener("pointerdown", handleClickOutside, { passive: true });
        return () => document.removeEventListener("pointerdown", handleClickOutside);
    }, [actualContainerRef, sidebarRef, query, restorePreviousScroll]);

    useEffect(() => {
        if (!enableSmartHomeSearch) {
            setSuggestions([]);
            setShowDropdown(false);
        }
    }, [searchMode, enableSmartHomeSearch]);

    const handleEnterTypeMode = useCallback(() => {
        if (!isActiveRef.current) {
            isActiveRef.current = true;
            scrollSearchBarToTop();
            setIsActive(true);
            if (!getLoadedOfficeIndexSync()) {
                if (enterIndexTimerRef.current !== null) {
                    window.clearTimeout(enterIndexTimerRef.current);
                }
                enterIndexTimerRef.current = window.setTimeout(() => {
                    enterIndexTimerRef.current = null;
                    void ensureLocalOfficeIndex();
                }, 320);
            }
        }
        if (query.trim()) setShowDropdown(true);
    }, [query, scrollSearchBarToTop]);

    const handleComposerSubmit = () => {
        if (open && highlight >= 0 && visibleSuggestions[highlight]) {
            handleSuggestClick(visibleSuggestions[highlight]);
        } else {
            handleSubmit();
        }
    };

    const routePreviewCard: React.ReactNode = routeIntent ? (
        <div
            data-testid="smart-route-preview"
            className="rounded-lg border-2 border-foreground bg-card p-3 space-y-2.5"
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <Route className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                        <span className="font-heading text-sm sm:text-base font-extrabold text-foreground">
                            {routeIntent.origin.name}
                            {routeIntent.origin.shortCode ? ` [${routeIntent.origin.shortCode}]` : ""}
                            {" → "}
                            {routeIntent.dest.name}
                            {routeIntent.dest.shortCode ? ` [${routeIntent.dest.shortCode}]` : ""}
                        </span>
                    </div>
                    <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                        {routeIntent.origin.postalCode || "—"} → {routeIntent.dest.postalCode || "—"} ·{" "}
                        {routeIntent.route.scopeLabel}
                    </p>
                </div>
                <span className="inline-flex shrink-0 items-center rounded-full bg-primary/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-primary">
                    {t("smartPreviewRoute")}
                </span>
            </div>

            <div className="flex flex-wrap items-center gap-1 text-[11px] font-medium">
                {routeIntent.route.steps.map((step, i) => (
                    <React.Fragment key={`${step.role}-${i}`}>
                        <span className="rounded border border-foreground/30 bg-background px-1.5 py-0.5">
                            {step.title}
                        </span>
                        {i < routeIntent.route.steps.length - 1 && (
                            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden="true" />
                        )}
                    </React.Fragment>
                ))}
            </div>

            {routeIntent.route.bagLabel.deliveryWarning && (
                <p className="flex items-start gap-1.5 rounded bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{routeIntent.route.bagLabel.deliveryWarning}</span>
                </p>
            )}

            <Link
                href={routeIntent.routingHref}
                data-testid="smart-route-open-hub"
                onClick={() => {
                    setStation(toStaffStation(routeIntent.origin));
                    recordHistory(query);
                    closeForNavigation();
                }}
                className="tap inline-flex w-full items-center justify-center gap-1.5 rounded-md border-2 border-foreground bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-[0_2px_0_0_hsl(var(--foreground))] hover:opacity-95"
            >
                <span>
                    {t("smartOpenRoute", {
                        from: routeIntent.origin.name,
                        to: routeIntent.dest.name,
                    })}
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
            </Link>
        </div>
    ) : null;

    const inlineSmartPreview: React.ReactNode =
        enableSmartHomeSearch && (routePreviewCard || smartIntent) ? (
            <>
                {routePreviewCard}
                {!routePreviewCard && smartIntent?.kind === "tracking" && (
                    <HomeTrackingDrawerCard
                        intent={smartIntent}
                        onCloseDrawer={() => {
                            recordHistory(query);
                            closeForNavigation();
                        }}
                    />
                )}

                {!routePreviewCard && smartIntent?.kind === "international" && (
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
                                            closeForNavigation();
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
                                        closeForNavigation();
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

                {!routePreviewCard && smartIntent?.kind === "cod" && (
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
                                    closeForNavigation();
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

                {!routePreviewCard && smartIntent?.kind === "domestic" && (
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
                                    closeForNavigation();
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
                                        closeForNavigation();
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
            </>
        ) : null;

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
                    smartPreview={inlineSmartPreview}
                    onSelectOfficeChip={({ value, slug, postalCode }) => {
                        handleSuggestClick({
                            label: value,
                            queryValue: value,
                            slug,
                            postalCode,
                            kind: "office",
                        });
                    }}
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
                                onClick={() => {
                                    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
                                        document.activeElement.blur();
                                    }
                                    onScanAddress();
                                }}
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

            {/* Standard Overlay Autocomplete / Route Preview Dropdown for /browse Page */}
            {!enableSmartHomeSearch && (
                <AnimatePresence>
                    {open && (routePreviewCard || suggestions.length > 0) && (
                        <m.div
                            id={listId}
                            role="listbox"
                            initial={{ opacity: 0, y: -4, scale: 0.99 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.99 }}
                            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                            className="absolute left-0 right-0 top-full z-[60] mt-1.5 overflow-hidden rounded-md border-2 border-foreground bg-card py-1 shadow-[4px_4px_0_0_hsl(var(--foreground))]"
                        >
                            {routePreviewCard ? (
                                <div className="p-2">{routePreviewCard}</div>
                            ) : (
                                <ul>
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
                                </ul>
                            )}
                        </m.div>
                    )}
                </AnimatePresence>
            )}
        </div>
    );
}
