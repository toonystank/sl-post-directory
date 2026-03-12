import React from "react";
import { Building2, MapPin, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ALPHABET, SERVICE_TAGS, SearchMode, POPULAR_SEARCHES } from "./types";
import SearchBar from "./SearchBar";

interface DirectorySidebarProps {
    sidebarRef: React.RefObject<HTMLDivElement | null>;
    handleSidebarScroll: (e: React.UIEvent<HTMLDivElement>) => void;
    showStickySearch: boolean;
    searchMode: SearchMode;
    handleModeSwitch: (mode: SearchMode) => void;
    activeLetter: string | null;
    handleLetterFilter: (letter: string) => void;
    clearLetter: () => void;
    isAlphabetExpanded: boolean;
    setIsAlphabetExpanded: (val: boolean) => void;
    activeService: string | null;
    handleServiceFilter: (service: string) => void;
    clearService: () => void;
    hasActiveFilters: boolean;
    handlePopularSearch: (term: string) => void;
    // For the embedded SearchBar
    query: string;
    onQueryChange: (val: string, id: string) => void;
    onSubmit: () => void;
    onClear: () => void;
    loading: boolean;
    onSuggestionClick: (suggestion: string) => void;
}

export default function DirectorySidebar({
    sidebarRef, handleSidebarScroll, showStickySearch,
    searchMode, handleModeSwitch,
    activeLetter, handleLetterFilter, clearLetter,
    isAlphabetExpanded, setIsAlphabetExpanded,
    activeService, handleServiceFilter, clearService,
    hasActiveFilters, handlePopularSearch,
    query, onQueryChange, onSubmit, onClear, loading, onSuggestionClick
}: DirectorySidebarProps) {
    return (
        <aside
            ref={sidebarRef as React.RefObject<HTMLDivElement>}
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
                    <SearchBar
                        id="sidebar"
                        query={query}
                        onQueryChange={onQueryChange}
                        searchMode={searchMode}
                        onSubmit={onSubmit}
                        onClear={onClear}
                        loading={loading}
                        onSuggestionClick={onSuggestionClick}
                        sidebarRef={sidebarRef}
                    />
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
    );
}
