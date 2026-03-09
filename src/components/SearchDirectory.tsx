"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, MapPin, Building2, Store, ChevronRight, Loader2, Phone, X, Sparkles, ArrowUp, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import HeroSection from "@/components/HeroSection";
import AddOfficeModal from "@/components/AddOfficeModal";

interface OfficeField {
    name: string;
    value: string;
}

interface PostOffice {
    id: string;
    name: string;
    postalCode: string;
    services: string[];
    fields: OfficeField[];
}

interface SearchResponse {
    offices: PostOffice[];
    total: number;
    nextCursor: number | null;
}



const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const POPULAR_SEARCHES = ["Colombo", "Kandy", "Nugegoda", "Galle", "Matara", "Jaffna", "Kurunegala", "Negombo"];
const SERVICE_TAGS = ["Foreign parcel unit", "postal complex", "regional sorting unit"];

type SearchMode = "name" | "division";

export default function SearchDirectory() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Initialize state from URL params (restores context on back navigation)
    const [query, setQuery] = useState(searchParams.get("q") || "");
    const [searchMode, setSearchMode] = useState<SearchMode>(
        (searchParams.get("mode") as SearchMode) || "name"
    );
    const [activeLetter, setActiveLetter] = useState<string | null>(
        searchParams.get("letter") || null
    );
    const [activeService, setActiveService] = useState<string | null>(
        searchParams.get("service") || null
    );

    const [offices, setOffices] = useState<PostOffice[]>([]);
    const [total, setTotal] = useState(0);
    const [nextCursor, setNextCursor] = useState<number | null>(null);
    const [isMobileExpanded, setIsMobileExpanded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [showStickySearch, setShowStickySearch] = useState(false);
    const [activeSearchId, setActiveSearchId] = useState<string | null>(null);

    const suggestionCache = useRef<Record<string, string[]>>({});
    const suggestDebounce = useRef<NodeJS.Timeout | null>(null);
    const searchContainerRef = useRef<HTMLDivElement>(null);
    const stickySearchContainerRef = useRef<HTMLDivElement>(null);
    const primarySearchObserverRef = useRef<IntersectionObserver | null>(null);

    const [isAlphabetExpanded, setIsAlphabetExpanded] = useState<boolean>(() => {
        const initialLetter = searchParams.get("letter");
        if (!initialLetter) return false;
        return ALPHABET.indexOf(initialLetter.toUpperCase()) >= 12;
    });
    const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
    const isRestoringRef = useRef(false);

    // Sync state to URL params (without full page reload)
    const updateUrl = useCallback(
        (q: string, mode: SearchMode, letter: string | null, service: string | null) => {
            const params = new URLSearchParams();
            if (q) params.set("q", q);
            if (mode !== "name") params.set("mode", mode);
            if (letter) params.set("letter", letter);
            if (service) params.set("service", service);
            const paramString = params.toString();
            const newUrl = paramString ? `/?${paramString}` : "/";
            router.replace(newUrl, { scroll: false });
        },
        [router]
    );

    const fetchOffices = useCallback(
        async (searchQuery: string, letter: string | null, mode: SearchMode, service: string | null, cursor: number, append: boolean) => {
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
                if (!res.ok) {
                    throw new Error(`API Error: ${res.status}`);
                }
                const data: SearchResponse = await res.json();

                setOffices((prev) => {
                    const incomingOffices = data?.offices || [];
                    if (!append) return incomingOffices;

                    const existingIds = new Set(prev.map(o => o.id));
                    const newOffices = incomingOffices.filter((o: typeof incomingOffices[0]) => !existingIds.has(o.id));

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
        },
        []
    );

    // On mount: load offices based on URL params, then restore scroll
    useEffect(() => {
        const q = searchParams.get("q") || "";
        const mode = (searchParams.get("mode") as SearchMode) || "name";
        const letter = searchParams.get("letter") || null;
        const service = searchParams.get("service") || null;

        // Check if we have cached data to restore
        const cached = sessionStorage.getItem("directory-cache");
        if (cached) {
            try {
                const data = JSON.parse(cached);
                if (data.q === q && data.mode === mode && data.letter === letter && data.service === service) {
                    // Restore cached results
                    setOffices(data.offices);
                    setTotal(data.total);
                    setNextCursor(data.nextCursor);
                    setInitialLoading(false);
                    isRestoringRef.current = true;

                    // Restore scroll position after render
                    requestAnimationFrame(() => {
                        const scrollY = sessionStorage.getItem("directory-scroll");
                        if (scrollY) {
                            window.scrollTo(0, parseInt(scrollY));
                        }
                        isRestoringRef.current = false;
                    });
                    return;
                }
            } catch { }
        }

        fetchOffices(q, letter, mode, service, 0, false);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Save scroll position periodically and on navigate
    useEffect(() => {
        const saveScroll = () => {
            if (!isRestoringRef.current) {
                sessionStorage.setItem("directory-scroll", window.scrollY.toString());
            }
        };

        window.addEventListener("scroll", saveScroll, { passive: true });
        return () => window.removeEventListener("scroll", saveScroll);
    }, []);

    // Cache the current results whenever they change
    useEffect(() => {
        if (offices.length > 0 && !initialLoading) {
            sessionStorage.setItem(
                "directory-cache",
                JSON.stringify({
                    q: query,
                    mode: searchMode,
                    letter: activeLetter,
                    service: activeService,
                    offices,
                    total,
                    nextCursor,
                })
            );
        }
    }, [offices, total, nextCursor, query, searchMode, activeLetter, activeService, initialLoading]);

    const fetchSuggestions = useCallback(async (val: string, mode: SearchMode) => {
        if (!val.trim()) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        const cacheKey = `${mode}-${val.trim().toLowerCase()}`;
        if (suggestionCache.current[cacheKey]) {
            setSuggestions(suggestionCache.current[cacheKey]);
            setShowSuggestions(true);
            return;
        }

        setSuggestionsLoading(true);
        try {
            const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(val)}&mode=${mode}`);
            if (res.ok) {
                const data = await res.json();
                suggestionCache.current[cacheKey] = data.suggestions || [];
                setSuggestions(data.suggestions || []);
                setShowSuggestions(data.suggestions?.length > 0);
            }
        } catch (err) {
            console.error("Autocomplete error:", err);
        } finally {
            setSuggestionsLoading(false);
        }
    }, []);

    const handleInputChange = (value: string, id?: string) => {
        setQuery(value);
        if (id) setActiveSearchId(id);

        // Autocomplete debounce ONLY
        if (suggestDebounce.current) clearTimeout(suggestDebounce.current);
        suggestDebounce.current = setTimeout(() => {
            fetchSuggestions(value, searchMode);
        }, 150);
    };

    const submitSearch = () => {
        // Clear any pending suggestions to prevent popups after search
        if (suggestDebounce.current) clearTimeout(suggestDebounce.current);
        setShowSuggestions(false);

        // Execute the actual search
        updateUrl(query, searchMode, activeLetter, activeService);
        fetchOffices(query, activeLetter, searchMode, activeService, 0, false);
    };

    const handleSuggestionClick = (suggestion: string) => {
        setQuery(suggestion);
        setShowSuggestions(false);
        if (suggestDebounce.current) clearTimeout(suggestDebounce.current);

        // Execute the search immediately with the clicked suggestion
        updateUrl(suggestion, searchMode, activeLetter, activeService);
        fetchOffices(suggestion, activeLetter, searchMode, activeService, 0, false);
    };

    // Intersection Observer for Sticky Search
    useEffect(() => {
        if (!searchContainerRef.current) return;

        primarySearchObserverRef.current = new IntersectionObserver(
            ([entry]) => {
                // If it's intersecting (visible), don't show sticky.
                // If it's NOT intersecting (hidden off top), show sticky.
                // Only matters on mobile, but we can set the state cleanly here.
                setShowStickySearch(!entry.isIntersecting);
            },
            {
                root: null, // viewport
                threshold: 0,
                rootMargin: "-65px 0px 0px 0px" // offset for navbar
            }
        );

        primarySearchObserverRef.current.observe(searchContainerRef.current);
        return () => {
            if (primarySearchObserverRef.current) primarySearchObserverRef.current.disconnect();
        };
    }, []);

    // Close suggestions on outside click for both search fields
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const clickedInPrimary = searchContainerRef.current?.contains(target);
            const clickedInSticky = stickySearchContainerRef.current?.contains(target);
            const clickedInSidebar = sidebarRef.current?.contains(target);

            if (!clickedInPrimary && !clickedInSticky && !clickedInSidebar) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleModeSwitch = (mode: SearchMode) => {
        setSearchMode(mode);
        // Clear suggestions when switching modes
        setSuggestions([]);
        setShowSuggestions(false);
        updateUrl(query, mode, activeLetter, activeService);
        if (query) {
            fetchOffices(query, activeLetter, mode, activeService, 0, false);
            fetchSuggestions(query, mode);
        }
    };

    const handleLetterFilter = (letter: string) => {
        if (activeLetter === letter) {
            setActiveLetter(null);
            updateUrl(query, searchMode, null, activeService);
            fetchOffices(query, null, searchMode, activeService, 0, false);
        } else {
            setActiveLetter(letter);
            updateUrl(query, searchMode, letter, activeService);
            fetchOffices(query, letter, searchMode, activeService, 0, false);
        }
    };

    const handleServiceFilter = (service: string) => {
        if (activeService === service) {
            setActiveService(null);
            updateUrl(query, searchMode, activeLetter, null);
            fetchOffices(query, activeLetter, searchMode, null, 0, false);
        } else {
            setActiveService(service);
            updateUrl(query, searchMode, activeLetter, service);
            fetchOffices(query, activeLetter, searchMode, service, 0, false);
        }
    };

    const handlePopularSearch = (term: string) => {
        setQuery(term);
        setActiveLetter(null);
        setActiveService(null);
        updateUrl(term, searchMode, null, null);
        fetchOffices(term, null, searchMode, null, 0, false);
    };

    const clearSearch = () => {
        setQuery("");
        updateUrl("", searchMode, activeLetter, activeService);
        fetchOffices("", activeLetter, searchMode, activeService, 0, false);
    };

    const clearLetter = () => {
        setActiveLetter(null);
        updateUrl(query, searchMode, null, activeService);
        fetchOffices(query, null, searchMode, activeService, 0, false);
    };

    const clearService = () => {
        setActiveService(null);
        updateUrl(query, searchMode, activeLetter, null);
        fetchOffices(query, activeLetter, searchMode, null, 0, false);
    };

    const clearAll = () => {
        setQuery("");
        setActiveLetter(null);
        setActiveService(null);
        updateUrl("", searchMode, null, null);
        fetchOffices("", null, searchMode, null, 0, false);
    };


    const sidebarRef = useRef<HTMLDivElement>(null);
    const sidebarScrollPos = useRef<number>(0);

    // Save sidebar scroll position internally
    const handleSidebarScroll = (e: React.UIEvent<HTMLDivElement>) => {
        sidebarScrollPos.current = e.currentTarget.scrollTop;
    };

    // Restore sidebar scroll position after re-renders
    useEffect(() => {
        if (sidebarRef.current) {
            sidebarRef.current.scrollTop = sidebarScrollPos.current;
        }
    }, [offices, loading, initialLoading]);

    const hasActiveFilters = query || activeLetter || activeService;

    // Extracted Search Bar render function for reuse
    const renderSearchBar = (id: string, isSticky = false) => (
        <div className="w-full relative" id={`search-container-${id}`}>
            <div className={`bg-background/90 backdrop-blur-md border shadow-sm flex items-center gap-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all ${isSticky ? 'rounded-b-2xl p-2 px-3' : 'rounded-xl p-1.5'}`}>
                <div className="flex-1 flex items-center pl-3">
                    <Search className={`text-muted-foreground shrink-0 ${isSticky ? 'w-5 h-5 text-primary/80' : 'w-4 h-4'}`} />
                    <Input
                        type="text"
                        value={query}
                        onChange={(e) => handleInputChange(e.target.value, id)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                submitSearch();
                            }
                        }}
                        placeholder={`Search ${searchMode === 'name' ? 'offices' : 'areas'}...`}
                        className={`border-0 shadow-none focus-visible:ring-0 !ring-0 w-full bg-transparent dark:bg-transparent placeholder:text-muted-foreground/70 ${isSticky ? 'text-base py-4 font-medium' : 'text-sm py-3'}`}
                        onFocus={() => {
                            setActiveSearchId(id);
                            if (suggestions.length > 0 && query.trim()) setShowSuggestions(true);
                        }}
                    />
                </div>
                <div className="flex items-center gap-1.5 pr-1">
                    {loading && !suggestionsLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                    {query && (
                        <button type="button" onClick={clearSearch} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors mr-1">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                    <Button
                        size="sm"
                        onClick={submitSearch}
                        className={`font-semibold shrink-0 transition-all ${isSticky ? 'h-10 px-4 rounded-xl' : 'h-8 px-3 rounded-lg text-xs'}`}
                    >
                        Search
                    </Button>
                </div>
            </div>

            {/* Autocomplete Dropdown */}
            {showSuggestions && activeSearchId === id && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 mx-1 lg:mx-0 bg-card border border-border/50 shadow-2xl rounded-xl overflow-hidden z-[60] animate-in fade-in slide-in-from-top-2">
                    <ul className="py-1.5">
                        {suggestions.map((s, i) => (
                            <li key={i}>
                                <button
                                    onClick={() => handleSuggestionClick(s)}
                                    className="w-full text-left px-5 py-3 text-sm hover:focus-visible:ring-0 hover:bg-muted/50 focus:bg-muted/50 transition-colors focus:outline-none flex items-center gap-3"
                                >
                                    {searchMode === "name" ? (
                                        <Building2 className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                                    ) : (
                                        <MapPin className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                                    )}
                                    <span className="truncate flex-1">{s}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );

    const renderHeroFilters = () => (
        <div className="w-full mt-4 text-left">
            {/* Search Modes (Always visible) */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => handleModeSwitch("name")}
                        className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${searchMode === "name" ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card/60 backdrop-blur-md text-muted-foreground border-border/50 hover:bg-white/10 hover:text-white hover:border-white/30 hover:scale-105"}`}
                    >
                        Name
                    </button>
                    <button
                        onClick={() => handleModeSwitch("division")}
                        className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${searchMode === "division" ? "bg-secondary text-secondary-foreground border-secondary shadow-sm" : "bg-card/60 backdrop-blur-md text-muted-foreground border-border/50 hover:bg-white/10 hover:text-white hover:border-white/30 hover:scale-105"}`}
                    >
                        Area
                    </button>
                </div>
                <button
                    onClick={() => setIsMobileExpanded(!isMobileExpanded)}
                    className={`text-[10px] px-4 py-1.5 rounded-full font-bold uppercase tracking-wider border transition-all flex items-center gap-1 ${isMobileExpanded || activeLetter || activeService ? "bg-primary/20 text-primary border-primary/30 backdrop-blur-md" : "bg-card/60 backdrop-blur-md text-muted-foreground border-border/50 hover:bg-card/80"}`}
                >
                    {isMobileExpanded ? "Hide Filters" : "More Filters"}
                </button>
            </div>

            {/* Collapsible Mobile Filters */}
            <div className={`transition-all duration-300 ease-in-out ${isMobileExpanded ? "block mt-3 opacity-100" : "hidden opacity-0"}`}>
                <div className="bg-card/50 backdrop-blur-xl border border-border/50 p-4 rounded-2xl space-y-5 mb-2 shadow-xl">
                    {/* Alphabet Grid */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-[11px] uppercase text-muted-foreground font-bold tracking-wider">Alphabetically</h3>
                            {activeLetter && (
                                <button onClick={clearLetter} className="text-[10px] text-destructive hover:text-destructive/80 font-medium">Clear</button>
                            )}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {ALPHABET.map((letter) => (
                                <button
                                    key={letter}
                                    onClick={() => handleLetterFilter(letter)}
                                    className={`h-8 rounded-md text-[11px] font-semibold transition-all flex items-center justify-center border ${activeLetter === letter
                                        ? "bg-primary text-primary-foreground border-primary shadow-sm scale-105"
                                        : "bg-background/50 border-border/50 text-muted-foreground hover:bg-primary/10"
                                        }`}
                                >
                                    {letter}
                                </button>
                            ))}
                        </div>
                    </div>

                    <Separator className="opacity-30" />

                    {/* Services Row */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-[11px] uppercase text-muted-foreground font-bold tracking-wider">Services</h3>
                            {activeService && (
                                <button onClick={clearService} className="text-[10px] text-destructive hover:text-destructive/80 font-medium">Clear</button>
                            )}
                        </div>
                        <div className="flex flex-col gap-1.5">
                            {SERVICE_TAGS.map((tag) => (
                                <button
                                    key={tag}
                                    onClick={() => handleServiceFilter(tag)}
                                    className={`text-left px-3 py-2 rounded-lg text-sm transition-all border ${activeService === tag
                                        ? "bg-blue-500/10 text-blue-400 border-blue-500/30 font-medium"
                                        : "bg-background/40 text-muted-foreground border-transparent hover:bg-muted/50"
                                        }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="truncate capitalize">{tag}</span>
                                        {activeService === tag && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></div>}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <section className="relative w-full">
            {/* ====== HERO SECTION (Desktop & Mobile) ====== */}
            <div ref={searchContainerRef}>
                <HeroSection>
                    <div className="w-full flex justify-center items-center flex-col">
                        {renderSearchBar("hero", false)}
                        {renderHeroFilters()}
                    </div>
                </HeroSection>
            </div>

            <div className="container mx-auto px-4 py-8 md:py-10 relative z-20">

                {/* ====== MOBILE STICKY SEARCH BAR ====== */}
                {showStickySearch && (
                    <div
                        ref={stickySearchContainerRef}
                        className="fixed top-[64px] left-0 right-0 z-[60] lg:hidden animate-in slide-in-from-top-4 fade-in duration-300 drop-shadow-xl border-b border-border/50"
                    >
                        <div className="bg-background/95 backdrop-blur-md px-4 py-2">
                            {renderSearchBar("sticky", true)}
                        </div>
                    </div>
                )}

                <div className="flex flex-col lg:flex-row items-start">

                    {/* ====== LEFT SIDEBAR (Desktop) ====== */}
                    <aside
                        ref={sidebarRef}
                        onScroll={handleSidebarScroll}
                        className={`hidden lg:flex flex-col flex-shrink-0 lg:sticky lg:top-24 bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl transition-all duration-500 ease-in-out lg:max-h-[calc(100vh-6.5rem)] lg:overflow-y-auto lg:overflow-x-hidden scrollbar-hide ${showStickySearch
                            ? "w-full lg:w-80 p-4 lg:p-5 opacity-100 translate-x-0 mr-8"
                            : "w-0 p-0 opacity-0 -translate-x-12 mr-0 border-transparent shadow-none"
                            }`}
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        {/* Inner wrapper to prevent squishing during width transition */}
                        <div className={`transition-opacity duration-500 min-w-[17rem] ${showStickySearch ? "opacity-100 delay-150" : "opacity-0"}`}>

                            {/* Search Bar - Conditionally visible only on desktop when scrolled past hero */}
                            <div className={`transition-all duration-300 ease-in-out ${showStickySearch ? 'opacity-100 max-h-32 mb-5' : 'opacity-0 max-h-0 overflow-hidden'}`}>
                                {renderSearchBar("sidebar", false)}
                            </div>

                            {/* Desktop Focus: Vertical Filters */}
                            <div className="space-y-6">

                                {/* Search Modes */}
                                <div>
                                    <h3 className="text-[11px] uppercase text-muted-foreground font-bold mb-2 tracking-wider">Search Method</h3>
                                    <div className="flex flex-col gap-1.5">
                                        <button
                                            onClick={() => handleModeSwitch("name")}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${searchMode === "name"
                                                ? "bg-primary/10 text-primary border border-primary/20"
                                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
                                                }`}
                                        >
                                            <Building2 className="w-4 h-4" /> By Post Office Name
                                        </button>
                                        <button
                                            onClick={() => handleModeSwitch("division")}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${searchMode === "division"
                                                ? "bg-secondary/10 text-secondary border border-secondary/20"
                                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
                                                }`}
                                        >
                                            <MapPin className="w-4 h-4" /> By Area / City
                                        </button>
                                    </div>
                                </div>

                                <Separator className="opacity-30" />

                                {/* Alphabet Grid */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-[11px] uppercase text-muted-foreground font-bold tracking-wider">Alphabetically</h3>
                                        {activeLetter && (
                                            <button onClick={clearLetter} className="text-[10px] text-destructive hover:text-destructive/80 font-medium">Clear</button>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <div className="grid grid-cols-7 gap-1 overflow-hidden">
                                            {(isAlphabetExpanded ? ALPHABET : ALPHABET.slice(0, 21)).map((letter) => (
                                                <button
                                                    key={letter}
                                                    onClick={() => handleLetterFilter(letter)}
                                                    className={`h-8 rounded-md text-xs font-semibold transition-all flex items-center justify-center border ${activeLetter === letter
                                                        ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20 scale-105"
                                                        : "bg-background/40 border-border/40 text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                                                        }`}
                                                >
                                                    {letter}
                                                </button>
                                            ))}
                                        </div>
                                        {!isAlphabetExpanded && (
                                            <div className="absolute -bottom-1 left-0 right-0 h-16 bg-gradient-to-t from-card via-card/80 to-transparent flex items-end justify-center pb-0 backdrop-blur-[2px]">
                                                <button
                                                    onClick={() => setIsAlphabetExpanded(true)}
                                                    className="px-4 py-1.5 rounded-full text-[11px] font-semibold bg-primary/20 text-primary border border-primary/30 shadow-sm transition-all hover:bg-primary/30 hover:scale-105 backdrop-blur-md"
                                                >
                                                    Show all
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <Separator className="opacity-30" />

                                {/* Services Filter */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-[11px] uppercase text-muted-foreground font-bold tracking-wider">Services</h3>
                                        {activeService && (
                                            <button onClick={clearService} className="text-[10px] text-destructive hover:text-destructive/80 font-medium">Clear</button>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        {SERVICE_TAGS.map((tag) => (
                                            <button
                                                key={tag}
                                                onClick={() => handleServiceFilter(tag)}
                                                className={`text-left px-3 py-1.5 rounded-lg text-sm transition-all border ${activeService === tag
                                                    ? "bg-blue-500/10 text-blue-400 border-blue-500/30 font-medium"
                                                    : "bg-transparent text-muted-foreground border-transparent hover:bg-muted/50 hover:text-foreground"
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="truncate capitalize">{tag}</span>
                                                    {activeService === tag && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></div>}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Popular Searches */}
                                {!hasActiveFilters && (
                                    <>
                                        <Separator className="opacity-30" />
                                        <div>
                                            <h3 className="text-xs uppercase text-muted-foreground font-bold mb-3 tracking-wider flex items-center gap-1.5">
                                                <Sparkles className="w-3.5 h-3.5" /> Popular
                                            </h3>
                                            <div className="flex flex-wrap gap-2">
                                                {POPULAR_SEARCHES.slice(0, 5).map((term) => (
                                                    <Badge
                                                        key={term}
                                                        variant="outline"
                                                        className="px-2.5 py-1 font-normal cursor-pointer hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all text-xs border-border/50"
                                                        onClick={() => handlePopularSearch(term)}
                                                    >
                                                        {term}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </aside>

                    {/* ====== RIGHT GRID SECTION ====== */}
                    <section className="flex-1 w-full min-w-0">

                        {/* Active Filter Summary Header */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 pb-4 border-b border-border/40 gap-4">
                            <div>
                                <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-1">
                                    {activeLetter && query
                                        ? `Results for "${query}" in "${activeLetter}"`
                                        : activeLetter
                                            ? `Starting with "${activeLetter}"`
                                            : query
                                                ? `Results for "${query}"`
                                                : "All Post Offices"}
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    {initialLoading ? "Searching directory..." : `Found ${total.toLocaleString()} locations`}
                                </p>
                            </div>

                            <div className="flex items-center gap-3 w-full md:w-auto">
                                {hasActiveFilters && (
                                    <button
                                        onClick={clearAll}
                                        className="text-xs font-medium text-destructive hover:bg-destructive/10 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
                                    >
                                        <X className="w-3.5 h-3.5" /> Clear All Filters
                                    </button>
                                )}
                                <AddOfficeModal>
                                    <Button variant="default" size="sm" className="rounded-xl font-medium shadow-sm w-full md:w-auto bg-primary hover:bg-primary/90">
                                        <Plus className="w-4 h-4 mr-1.5" /> Add Post Office
                                    </Button>
                                </AddOfficeModal>
                            </div>
                        </div>

                        {/* Grid Content */}
                        {initialLoading ? (
                            <div className="flex justify-center py-20">
                                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                            </div>
                        ) : offices.length === 0 ? (
                            <div className="text-center py-16 bg-card/30 rounded-2xl border border-border/30 border-dashed">
                                <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <Search className="w-8 h-8 text-muted-foreground opacity-50" />
                                </div>
                                <p className="text-lg font-medium mb-1">No post offices found</p>
                                <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
                                    Try adjusting your filters or search terms. Browse the alphabet sidebar to explore all locations.
                                </p>
                                {hasActiveFilters && (
                                    <button
                                        onClick={clearAll}
                                        className="px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
                                    >
                                        Reset Filters
                                    </button>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                                    {offices.map((po) => {
                                        const fieldMap = Object.fromEntries(po.fields.map(f => [f.name, f.value]));
                                        const type = fieldMap["Type"];
                                        const phone = fieldMap["Phone"];
                                        const division = fieldMap["Division"];
                                        const delivery = fieldMap["Delivery"];
                                        const isRealPostcode = po.postalCode && po.postalCode.length > 0;

                                        return (
                                            <Link key={po.id} href={`/office/${po.id}`} className="group h-full">
                                                <Card className="h-full flex flex-col bg-card/40 backdrop-blur-sm hover:bg-card hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
                                                    <CardHeader className="px-5 pt-4 pb-2">
                                                        <div className="flex justify-between items-start mb-2.5">
                                                            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors text-primary shadow-inner">
                                                                {type === "Sub Post office" ? (
                                                                    <Store className="w-5 h-5" />
                                                                ) : (
                                                                    <Building2 className="w-5 h-5" />
                                                                )}
                                                            </div>
                                                            <div className="flex gap-1.5 flex-col items-end">
                                                                {isRealPostcode && (
                                                                    <div className="px-2 py-0.5 rounded-md font-mono text-[10px] bg-primary/10 text-primary font-medium border border-primary/20">
                                                                        {po.postalCode}
                                                                    </div>
                                                                )}
                                                                {delivery === "Yes" && (
                                                                    <div className="px-2 py-0.5 rounded-md text-[10px] bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20">
                                                                        Delivery
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <CardTitle className="text-base group-hover:text-primary transition-colors leading-tight line-clamp-2">
                                                            {po.name}
                                                        </CardTitle>
                                                        {type && (
                                                            <p className="text-xs text-primary/80 mt-1 font-medium">{type}</p>
                                                        )}
                                                    </CardHeader>

                                                    <CardContent className="px-5 pb-4 flex-1">
                                                        <div className="space-y-2.5 text-sm text-muted-foreground mt-1">
                                                            {division && (
                                                                <div className="flex items-center gap-2.5">
                                                                    <MapPin className="w-4 h-4 text-muted-foreground/70 shrink-0" />
                                                                    <span className="truncate">{division}</span>
                                                                </div>
                                                            )}
                                                            {phone && (
                                                                <div className="flex items-center gap-2.5">
                                                                    <Phone className="w-4 h-4 text-muted-foreground/70 shrink-0" />
                                                                    <span>{phone}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {po.services && po.services.length > 0 && (
                                                            <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-border/30">
                                                                {po.services.map((service, idx) => (
                                                                    <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded-sm bg-blue-500/10 text-blue-400 font-medium">
                                                                        {service}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            </Link>
                                        );
                                    })}
                                </div>

                                {/* Pagination Controls */}
                                <div className="mt-12 flex justify-center py-4">
                                    {nextCursor !== null && (
                                        <Button
                                            onClick={() => fetchOffices(query, activeLetter, searchMode, activeService, nextCursor, true)}
                                            disabled={loading}
                                            variant="outline"
                                            size="lg"
                                            className="rounded-xl border-primary/20 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all duration-300 gap-2 min-w-[200px]"
                                        >
                                            {loading ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                                    <span>Loading...</span>
                                                </>
                                            ) : (
                                                "Load More Results"
                                            )}
                                        </Button>
                                    )}
                                    {nextCursor === null && offices.length > 0 && (
                                        <p className="text-sm font-medium text-muted-foreground opacity-60">
                                            End of directory — {total.toLocaleString()} locations
                                        </p>
                                    )}
                                </div>
                            </>
                        )}
                    </section>
                </div>
            </div>
        </section>
    );
}
