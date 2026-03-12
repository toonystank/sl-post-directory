import React, { useRef, useState, useCallback, useEffect } from "react";
import { Search, MapPin, Building2, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchMode } from "./types";

interface SearchBarProps {
    id: string;
    isSticky?: boolean;
    query: string;
    onQueryChange: (val: string, id: string) => void;
    searchMode: SearchMode;
    onSubmit: () => void;
    onClear: () => void;
    loading: boolean;
    onSuggestionClick: (suggestion: string) => void;
    containerRef?: React.RefObject<HTMLDivElement | null>;
    sidebarRef?: React.RefObject<HTMLDivElement | null>;
}

export default function SearchBar({
    id, isSticky = false, query, onQueryChange, searchMode, onSubmit,
    onClear, loading, onSuggestionClick, containerRef, sidebarRef
}: SearchBarProps) {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    
    // We only show suggestions for the active search bar
    const [isActive, setIsActive] = useState(false);

    const suggestionCache = useRef<Record<string, string[]>>({});
    const suggestDebounce = useRef<NodeJS.Timeout | null>(null);
    const localContainerRef = useRef<HTMLDivElement>(null);

    const actualContainerRef = containerRef || localContainerRef;

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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        onQueryChange(val, id);

        if (suggestDebounce.current) clearTimeout(suggestDebounce.current);
        suggestDebounce.current = setTimeout(() => {
            fetchSuggestions(val, searchMode);
        }, 150);
    };

    const handleSubmit = () => {
        if (suggestDebounce.current) clearTimeout(suggestDebounce.current);
        setShowSuggestions(false);
        onSubmit();
    };

    const handleSuggestClick = (s: string) => {
        setShowSuggestions(false);
        if (suggestDebounce.current) clearTimeout(suggestDebounce.current);
        onSuggestionClick(s);
    };

    // Close suggestions on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const clickedInThis = actualContainerRef.current?.contains(target);
            const clickedInSidebar = sidebarRef?.current?.contains(target);

            if (!clickedInThis && !clickedInSidebar && isActive) {
                setShowSuggestions(false);
                setIsActive(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [actualContainerRef, sidebarRef, isActive]);

    // Clear suggestions when search mode changes
    useEffect(() => {
        setSuggestions([]);
        setShowSuggestions(false);
    }, [searchMode]);

    return (
        <div className="w-full relative" id={`search-container-${id}`} ref={actualContainerRef}>
            <div className={`bg-background/90 backdrop-blur-md border shadow-sm flex items-center gap-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all ${isSticky ? 'rounded-b-2xl p-2 px-3' : 'rounded-xl p-1.5'}`}>
                <div className="flex-1 flex items-center pl-3">
                    <Search className={`text-muted-foreground shrink-0 ${isSticky ? 'w-5 h-5 text-primary/80' : 'w-4 h-4'}`} />
                    <Input
                        type="text"
                        value={query}
                        onChange={handleChange}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                handleSubmit();
                            }
                        }}
                        placeholder={`Search ${searchMode === 'name' ? 'offices' : 'areas'}...`}
                        className={`border-0 shadow-none focus-visible:ring-0 !ring-0 w-full bg-transparent dark:bg-transparent placeholder:text-muted-foreground/70 ${isSticky ? 'text-base py-4 font-medium' : 'text-sm py-3'}`}
                        onFocus={() => {
                            setIsActive(true);
                            if (suggestions.length > 0 && query.trim()) setShowSuggestions(true);
                        }}
                    />
                </div>
                <div className="flex items-center gap-1.5 pr-1">
                    {loading && !suggestionsLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                    {query && (
                        <button type="button" onClick={onClear} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors mr-1">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                    <Button
                        size="sm"
                        onClick={handleSubmit}
                        className={`font-semibold shrink-0 transition-all ${isSticky ? 'h-10 px-4 rounded-xl' : 'h-8 px-3 rounded-lg text-xs'}`}
                    >
                        Search
                    </Button>
                </div>
            </div>

            {/* Autocomplete Dropdown */}
            {showSuggestions && isActive && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 mx-1 lg:mx-0 bg-card border border-border/50 shadow-2xl rounded-xl overflow-hidden z-[60] animate-in fade-in slide-in-from-top-2">
                    <ul className="py-1.5">
                        {suggestions.map((s, i) => (
                            <li key={i}>
                                <button
                                    onClick={() => handleSuggestClick(s)}
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
}
