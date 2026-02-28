"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, MapPin, Building2, Store, ChevronRight, Loader2, Phone, X, Sparkles, ArrowUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface OfficeField {
    name: string;
    value: string;
}

interface PostOffice {
    id: string;
    name: string;
    postalCode: string;
    fields: OfficeField[];
}

interface SearchResponse {
    offices: PostOffice[];
    total: number;
    nextCursor: number | null;
}



const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const POPULAR_SEARCHES = ["Colombo", "Kandy", "Nugegoda", "Galle", "Matara", "Jaffna", "Kurunegala", "Negombo"];

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

    const [offices, setOffices] = useState<PostOffice[]>([]);
    const [total, setTotal] = useState(0);
    const [nextCursor, setNextCursor] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
    const isRestoringRef = useRef(false);

    // Sync state to URL params (without full page reload)
    const updateUrl = useCallback(
        (q: string, mode: SearchMode, letter: string | null) => {
            const params = new URLSearchParams();
            if (q) params.set("q", q);
            if (mode !== "name") params.set("mode", mode);
            if (letter) params.set("letter", letter);
            const paramString = params.toString();
            const newUrl = paramString ? `/?${paramString}` : "/";
            router.replace(newUrl, { scroll: false });
        },
        [router]
    );

    const fetchOffices = useCallback(
        async (searchQuery: string, letter: string | null, mode: SearchMode, cursor: number, append: boolean) => {
            if (cursor === 0) setInitialLoading(true);
            else setLoading(true);

            try {
                const params = new URLSearchParams();
                if (searchQuery) params.set("q", searchQuery);
                if (letter) params.set("letter", letter);
                params.set("mode", mode);
                params.set("cursor", cursor.toString());
                params.set("limit", "12");

                const res = await fetch(`/api/offices?${params.toString()}`);
                const data: SearchResponse = await res.json();

                setOffices((prev) => (append ? [...prev, ...data.offices] : data.offices));
                setTotal(data.total);
                setNextCursor(data.nextCursor);
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

        // Check if we have cached data to restore
        const cached = sessionStorage.getItem("directory-cache");
        if (cached) {
            try {
                const data = JSON.parse(cached);
                if (data.q === q && data.mode === mode && data.letter === letter) {
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

        fetchOffices(q, letter, mode, 0, false);
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
                    offices,
                    total,
                    nextCursor,
                })
            );
        }
    }, [offices, total, nextCursor, query, searchMode, activeLetter, initialLoading]);

    const handleSearch = (value: string) => {
        setQuery(value);
        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
        debounceTimeout.current = setTimeout(() => {
            updateUrl(value, searchMode, activeLetter);
            fetchOffices(value, activeLetter, searchMode, 0, false);
        }, 300);
    };

    const handleModeSwitch = (mode: SearchMode) => {
        setSearchMode(mode);
        updateUrl(query, mode, activeLetter);
        if (query) {
            fetchOffices(query, activeLetter, mode, 0, false);
        }
    };

    const handleLetterFilter = (letter: string) => {
        if (activeLetter === letter) {
            setActiveLetter(null);
            updateUrl(query, searchMode, null);
            fetchOffices(query, null, searchMode, 0, false);
        } else {
            setActiveLetter(letter);
            updateUrl(query, searchMode, letter);
            fetchOffices(query, letter, searchMode, 0, false);
        }
    };

    const handlePopularSearch = (term: string) => {
        setQuery(term);
        setActiveLetter(null);
        updateUrl(term, searchMode, null);
        fetchOffices(term, null, searchMode, 0, false);
    };

    const clearSearch = () => {
        setQuery("");
        updateUrl("", searchMode, activeLetter);
        fetchOffices("", activeLetter, searchMode, 0, false);
    };

    const clearLetter = () => {
        setActiveLetter(null);
        updateUrl(query, searchMode, null);
        fetchOffices(query, null, searchMode, 0, false);
    };

    const clearAll = () => {
        setQuery("");
        setActiveLetter(null);
        updateUrl("", searchMode, null);
        fetchOffices("", null, searchMode, 0, false);
    };

    // Infinite scroll
    useEffect(() => {
        if (observerRef.current) observerRef.current.disconnect();

        observerRef.current = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && nextCursor !== null && !loading) {
                    fetchOffices(query, activeLetter, searchMode, nextCursor, true);
                }
            },
            { threshold: 0.1 }
        );

        if (sentinelRef.current) {
            observerRef.current.observe(sentinelRef.current);
        }

        return () => observerRef.current?.disconnect();
    }, [nextCursor, loading, query, activeLetter, searchMode, fetchOffices]);

    const hasActiveFilters = query || activeLetter;

    return (
        <section className="container mx-auto px-4 py-20 relative z-20">
            {/* Search Bar */}
            <div className="mx-auto max-w-2xl bg-card border shadow-2xl rounded-2xl p-2 flex items-center gap-2 transition-all hover:border-primary/50 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 mb-4 -mt-28 relative z-30">
                <div className="flex-1 flex items-center pl-4 bg-transparent">
                    <Search className="w-5 h-5 text-muted-foreground shrink-0" />
                    <Input
                        type="text"
                        value={query}
                        onChange={(e) => handleSearch(e.target.value)}
                        placeholder={
                            activeLetter
                                ? `Search within "${activeLetter}" offices...`
                                : searchMode === "name"
                                    ? "Type a post office name or postal code..."
                                    : "Search by area (e.g. Colombo, Kandy, Galle)..."
                        }
                        className="border-0 shadow-none focus-visible:ring-0 text-base py-6 w-full placeholder:text-muted-foreground"
                    />
                </div>
                {(loading || query) && (
                    <div className="flex items-center gap-1 mr-2">
                        {loading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
                        {query && (
                            <button onClick={clearSearch} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Search Mode Toggle */}
            <div className="flex justify-center mb-4">
                <div className="inline-flex bg-card border rounded-xl p-1 gap-1">
                    <button
                        onClick={() => handleModeSwitch("name")}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${searchMode === "name"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                    >
                        <Building2 className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
                        Post Office
                    </button>
                    <button
                        onClick={() => handleModeSwitch("division")}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${searchMode === "division"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                    >
                        <MapPin className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
                        By Area
                    </button>
                </div>
            </div>

            {/* Active Filter Chips */}
            {hasActiveFilters && (
                <div className="flex flex-wrap justify-center gap-2 mb-4">
                    {activeLetter && (
                        <Badge
                            variant="secondary"
                            className="pl-3 pr-1.5 py-1.5 text-sm bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-all gap-1.5"
                        >
                            📍 Letter: {activeLetter}
                            <button
                                onClick={clearLetter}
                                className="ml-1 p-0.5 rounded-full hover:bg-primary/20 transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </Badge>
                    )}
                    {query && (
                        <Badge
                            variant="secondary"
                            className="pl-3 pr-1.5 py-1.5 text-sm bg-secondary/10 text-secondary border-secondary/20 hover:bg-secondary/20 transition-all gap-1.5"
                        >
                            🔍 Search: &ldquo;{query}&rdquo;
                            <button
                                onClick={clearSearch}
                                className="ml-1 p-0.5 rounded-full hover:bg-secondary/20 transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </Badge>
                    )}
                    {query && activeLetter && (
                        <Badge
                            variant="outline"
                            className="px-3 py-1.5 text-sm cursor-pointer hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-all"
                            onClick={clearAll}
                        >
                            <X className="w-3 h-3 mr-1" /> Show All
                        </Badge>
                    )}
                </div>
            )}

            {/* Popular Searches — visible when no filters active */}
            {!hasActiveFilters && (
                <div className="flex flex-col items-center gap-2 mb-6">
                    <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" /> Popular searches
                    </span>
                    <div className="flex flex-wrap justify-center gap-2">
                        {POPULAR_SEARCHES.map((term) => (
                            <Badge
                                key={term}
                                variant="outline"
                                className="px-3.5 py-1.5 cursor-pointer hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all text-sm"
                                onClick={() => handlePopularSearch(term)}
                            >
                                {term}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}

            {/* Alphabet Filter */}
            <div className="mb-10">
                <p className="text-xs text-muted-foreground text-center mb-3 font-medium">Browse by letter</p>
                <div className="flex md:flex-wrap md:justify-center gap-1.5 px-4 overflow-x-auto scrollbar-hide pb-2 md:pb-0">
                    {ALPHABET.map((letter) => (
                        <button
                            key={letter}
                            onClick={() => handleLetterFilter(letter)}
                            className={`w-10 h-10 md:w-9 md:h-9 rounded-lg text-sm font-semibold transition-all shrink-0 ${activeLetter === letter
                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-110"
                                : "bg-card border border-border/50 text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                                }`}
                        >
                            {letter}
                        </button>
                    ))}
                </div>
            </div>

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center md:items-end mb-10 gap-4 text-center md:text-left">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight mb-2">
                        {activeLetter && query
                            ? `Results for "${query}" in "${activeLetter}"`
                            : activeLetter
                                ? `Post Offices Starting with "${activeLetter}"`
                                : query
                                    ? `Results for "${query}"`
                                    : "All Post Offices"}
                    </h2>
                    <p className="text-muted-foreground">
                        {initialLoading ? "Loading..." : `${total.toLocaleString()} post offices found`}
                    </p>
                </div>
            </div>

            <Separator className="mb-10 opacity-50" />

            {/* Grid */}
            {initialLoading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                </div>
            ) : offices.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                    <Building2 className="w-16 h-16 mx-auto mb-4 opacity-15" />
                    <p className="text-lg font-medium mb-2">We couldn&apos;t find that post office</p>
                    <p className="text-sm mb-8 max-w-md mx-auto">
                        Try a different name, check the spelling, or browse the letters above.
                    </p>

                    {/* Helpful suggestions in empty state */}
                    <div className="flex flex-col items-center gap-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground animate-bounce">
                            <ArrowUp className="w-4 h-4" />
                            <span>Try browsing by letter above</span>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-muted-foreground font-medium">Or try one of these:</span>
                            <div className="flex flex-wrap justify-center gap-2">
                                {POPULAR_SEARCHES.slice(0, 5).map((term) => (
                                    <Badge
                                        key={term}
                                        variant="outline"
                                        className="px-3 py-1.5 cursor-pointer hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all text-sm"
                                        onClick={() => handlePopularSearch(term)}
                                    >
                                        {term}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                        {hasActiveFilters && (
                            <button
                                onClick={clearAll}
                                className="mt-2 px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
                            >
                                Show All Post Offices
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {offices.map((po) => {
                            const fieldMap = Object.fromEntries(po.fields.map(f => [f.name, f.value]));
                            const type = fieldMap["Type"];
                            const phone = fieldMap["Phone"];
                            const division = fieldMap["Division"];
                            const delivery = fieldMap["Delivery"];
                            const isRealPostcode = po.postalCode && po.postalCode.length > 0;

                            return (
                                <Link key={po.id} href={`/office/${po.id}`} className="group h-full">
                                    <Card className="h-full flex flex-col hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                                        <CardHeader className="pb-3">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="p-2.5 bg-primary/10 rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-colors text-primary">
                                                    {type === "Sub Post office" ? (
                                                        <Store className="w-5 h-5" />
                                                    ) : (
                                                        <Building2 className="w-5 h-5" />
                                                    )}
                                                </div>
                                                <div className="flex gap-2 items-center">
                                                    {delivery === "Yes" && (
                                                        <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-500 bg-emerald-500/10">
                                                            Delivery
                                                        </Badge>
                                                    )}
                                                    {isRealPostcode && (
                                                        <Badge variant="secondary" className="font-mono bg-secondary/10 text-secondary border-none">
                                                            {po.postalCode}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <CardTitle className="text-lg group-hover:text-primary transition-colors leading-tight">
                                                {po.name}
                                            </CardTitle>
                                            {type && (
                                                <p className="text-xs text-muted-foreground mt-1">{type}</p>
                                            )}
                                        </CardHeader>

                                        <CardContent className="pb-4 flex-1">
                                            <div className="space-y-1.5 text-sm text-muted-foreground">
                                                {division && (
                                                    <div className="flex items-center gap-2">
                                                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                                                        <span className="truncate">{division}</span>
                                                    </div>
                                                )}
                                                {phone && (
                                                    <div className="flex items-center gap-2">
                                                        <Phone className="w-3.5 h-3.5 shrink-0" />
                                                        <span>{phone}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>

                                        <CardFooter className="pt-3 border-t border-border/40 pb-3">
                                            <div className="flex items-center text-sm font-medium text-primary w-full justify-between">
                                                View Details
                                                <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        </CardFooter>
                                    </Card>
                                </Link>
                            );
                        })}
                    </div>

                    {/* Infinite scroll sentinel */}
                    <div ref={sentinelRef} className="mt-8 flex justify-center py-8">
                        {nextCursor !== null && (
                            <div className="flex items-center gap-3 text-muted-foreground">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span className="text-sm">Loading more...</span>
                            </div>
                        )}
                        {nextCursor === null && offices.length > 0 && (
                            <p className="text-sm text-muted-foreground">
                                You&apos;ve reached the end — {total.toLocaleString()} offices total
                            </p>
                        )}
                    </div>
                </>
            )}
        </section>
    );
}
