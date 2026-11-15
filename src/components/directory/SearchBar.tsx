import React, { useRef, useState, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Search, MapPin, Building2, Loader2, X, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchMode } from "./types";

interface SearchBarProps {
    id: string;
    /** Compact variant used when docked under the mobile app bar / in the sidebar */
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
    inputRef?: React.Ref<HTMLInputElement>;
}

export default function SearchBar({
    id, isSticky = false, query, onQueryChange, searchMode, onSubmit,
    onClear, loading, onSuggestionClick, containerRef, sidebarRef, inputRef
}: SearchBarProps) {
    const t = useTranslations("Search");
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [highlight, setHighlight] = useState(-1);

    const suggestionCache = useRef<Record<string, string[]>>({});
    const suggestDebounce = useRef<NodeJS.Timeout | null>(null);
    const localContainerRef = useRef<HTMLDivElement>(null);
    const actualContainerRef = containerRef || localContainerRef;
    const listId = `suggestions-${id}`;

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
        setHighlight(-1);
        if (suggestDebounce.current) clearTimeout(suggestDebounce.current);
        suggestDebounce.current = setTimeout(() => fetchSuggestions(val, searchMode), 150);
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

    const open = showSuggestions && isActive && suggestions.length > 0;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (open && e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
        } else if (open && e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, -1));
        } else if (e.key === "Escape") {
            setShowSuggestions(false);
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (open && highlight >= 0) handleSuggestClick(suggestions[highlight]);
            else handleSubmit();
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const inThis = actualContainerRef.current?.contains(target);
            const inSidebar = sidebarRef?.current?.contains(target);
            if (!inThis && !inSidebar && isActive) {
                setShowSuggestions(false);
                setIsActive(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [actualContainerRef, sidebarRef, isActive]);

    useEffect(() => {
        setSuggestions([]);
        setShowSuggestions(false);
    }, [searchMode]);

    return (
        <div className="relative w-full" id={`search-container-${id}`} ref={actualContainerRef}>
            <form
                role="search"
                onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
                className={cn(
                    "flex items-stretch overflow-hidden rounded-md border-2 border-foreground bg-card transition-shadow",
                    "focus-within:shadow-[3px_3px_0_0_hsl(var(--foreground))]",
                    isSticky ? "h-11" : "h-14"
                )}
            >
                <label htmlFor={`search-${id}`} className="flex flex-1 items-center gap-2.5 pl-3.5 min-w-0">
                    <span className="sr-only">{t("submit")}</span>
                    {searchMode === "name"
                        ? <Building2 className="h-[1.1rem] w-[1.1rem] shrink-0 text-muted-foreground" aria-hidden="true" />
                        : <MapPin className="h-[1.1rem] w-[1.1rem] shrink-0 text-muted-foreground" aria-hidden="true" />}
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
                            if (suggestions.length > 0 && query.trim()) setShowSuggestions(true);
                        }}
                        placeholder={searchMode === "name" ? t("placeholderName") : t("placeholderArea")}
                        role="combobox"
                        aria-expanded={open}
                        aria-controls={listId}
                        aria-autocomplete="list"
                        aria-activedescendant={open && highlight >= 0 ? `${listId}-${highlight}` : undefined}
                        className={cn(
                            "h-full w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground/80 [&::-webkit-search-cancel-button]:hidden",
                            isSticky ? "text-base" : "text-[1.05rem]"
                        )}
                    />
                </label>
                <div className="flex items-center gap-1 pr-1.5">
                    {(loading || suggestionsLoading) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}
                    {query && (
                        <button type="button" onClick={onClear} className="tap rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={t("clear")}>
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
                <button
                    type="submit"
                    className={cn(
                        "tap flex shrink-0 items-center justify-center gap-2 bg-primary font-semibold text-primary-foreground hover:bg-primary/90",
                        isSticky ? "w-11" : "w-14 md:w-auto md:px-6"
                    )}
                    aria-label={t("submit")}
                >
                    <Search className="h-5 w-5" strokeWidth={2.4} />
                    {!isSticky && <span className="hidden md:inline">{t("submit")}</span>}
                </button>
            </form>

            {open && (
                <ul
                    id={listId}
                    role="listbox"
                    className="absolute left-0 right-0 top-full z-[60] mt-1.5 overflow-hidden rounded-md border-2 border-foreground bg-card py-1 shadow-[4px_4px_0_0_hsl(var(--foreground))]"
                >
                    {suggestions.map((s, i) => (
                        <li key={s + i} id={`${listId}-${i}`} role="option" aria-selected={highlight === i}>
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleSuggestClick(s)}
                                className={cn(
                                    "flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left text-[0.95rem] last:border-0",
                                    highlight === i ? "bg-secondary/30" : "hover:bg-muted"
                                )}
                            >
                                {searchMode === "name"
                                    ? <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    : <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />}
                                <span className="flex-1 truncate">{s}</span>
                                <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
