"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { AlertTriangle, Check, ChevronDown, Info, Search, X } from "lucide-react";
import CountryFlag from "@/components/brand/CountryFlag";
import { Sheet, SheetContent } from "@/components/shell/Sheet";
import { getLocalizedCountryName } from "@/lib/calculator-ui";
import { filterCountries, POPULAR_COUNTRY_CODES } from "@/lib/country-search";
import { triggerHaptic } from "@/lib/haptics";
import type { EmsCountry } from "@/lib/rate-types";
import { cn } from "@/lib/utils";

export interface CountrySelectorLabels {
    searchPlaceholder: string;
    searchAriaLabel: string;
    clearSearchAriaLabel: string;
    popularHeading: string;
    allCountriesLabel: (count: number) => string;
    matchingCountriesLabel: (count: number) => string;
    noResultsLabel: (query: string) => string;
    suspendedSuffix: string;
    noteSuffix: string;
    changeLabel?: string;
    sheetTitle?: string;
}

export interface CountrySelectorProps {
    id: string;
    countries: EmsCountry[];
    value: string;
    locale: string;
    isIndic?: boolean;
    labels: CountrySelectorLabels;
    onChange: (code: string) => void;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

function stripParens(text: string): string {
    return text.replace(/^\s*\((.+)\)\s*$/, "$1").trim();
}

export default function CountrySelector({
    id,
    countries,
    value,
    locale,
    isIndic = false,
    labels,
    onChange,
    open: controlledOpen,
    onOpenChange: controlledOnOpenChange,
}: CountrySelectorProps) {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);

    const isOpen = controlledOpen ?? uncontrolledOpen;

    const triggerRef = useRef<HTMLButtonElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const lastSelectTimeRef = useRef(0);

    const listboxId = useId();
    const searchInputId = useId();

    useEffect(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
        const mq = window.matchMedia("(max-width: 767px)");
        const sync = () => setIsMobile(mq.matches);
        sync();
        mq.addEventListener("change", sync);
        return () => mq.removeEventListener("change", sync);
    }, []);

    const selectedCountry = useMemo(
        () => countries.find((c) => c.code === value) ?? countries[0],
        [countries, value]
    );

    const popularCountries = useMemo(() => {
        const byCode = new Map(countries.map((c) => [c.code.toUpperCase(), c]));
        return POPULAR_COUNTRY_CODES.map((code) => byCode.get(code)).filter(
            (c): c is EmsCountry => Boolean(c)
        );
    }, [countries]);

    const filteredCountries = useMemo(
        () => filterCountries(countries, query, locale),
        [countries, query, locale]
    );

    const trimmedQuery = query.trim();
    const suspendedTag = stripParens(labels.suspendedSuffix);
    const noteTag = stripParens(labels.noteSuffix);

    // Keep activeIndex in bounds whenever filtered results change
    const safeActiveIndex =
        filteredCountries.length === 0
            ? -1
            : Math.min(Math.max(activeIndex, 0), filteredCountries.length - 1);

    const activeOptionId =
        safeActiveIndex >= 0 && filteredCountries[safeActiveIndex]
            ? `${listboxId}-opt-${filteredCountries[safeActiveIndex].code}`
            : undefined;

    // Scroll active keyboard-highlighted option into view smoothly
    useEffect(() => {
        if (!isOpen || safeActiveIndex < 0) return;
        const el = optionRefs.current[safeActiveIndex];
        if (el && typeof el.scrollIntoView === "function") {
            el.scrollIntoView({ block: "nearest" });
        }
    }, [isOpen, safeActiveIndex]);

    const setOpenState = useCallback(
        (nextOpen: boolean) => {
            if (controlledOpen === undefined) {
                setUncontrolledOpen(nextOpen);
            }
            controlledOnOpenChange?.(nextOpen);
        },
        [controlledOpen, controlledOnOpenChange]
    );

    const handleOpenChange = useCallback(
        (nextOpen: boolean) => {
            if (nextOpen && Date.now() - lastSelectTimeRef.current < 150) {
                return;
            }
            setOpenState(nextOpen);
            if (nextOpen) {
                setQuery("");
                const currentIdx = countries.findIndex((c) => c.code === value);
                setActiveIndex(currentIdx >= 0 ? currentIdx : 0);
            }
        },
        [countries, setOpenState, value]
    );

    const handleSelect = (code: string) => {
        lastSelectTimeRef.current = Date.now();
        triggerHaptic("light");
        onChange(code);
        setOpenState(false);
        setQuery("");
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.nativeEvent.isComposing) return;

        const count = filteredCountries.length;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (count > 0) {
                setActiveIndex((prev) => (prev + 1) % count);
            }
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (count > 0) {
                setActiveIndex((prev) => (prev - 1 + count) % count);
            }
        } else if (e.key === "Home") {
            if (count > 0) {
                e.preventDefault();
                setActiveIndex(0);
            }
        } else if (e.key === "End") {
            if (count > 0) {
                e.preventDefault();
                setActiveIndex(count - 1);
            }
        } else if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            if (safeActiveIndex >= 0 && filteredCountries[safeActiveIndex]) {
                handleSelect(filteredCountries[safeActiveIndex].code);
            }
        }
    };

    const localizedSelectedName = getLocalizedCountryName(
        selectedCountry?.code,
        selectedCountry?.name ?? "United Kingdom",
        locale
    );
    const showTriggerEnglishSub =
        locale !== "en" &&
        Boolean(selectedCountry?.name) &&
        localizedSelectedName.toLowerCase() !== (selectedCountry?.name ?? "").toLowerCase();

    const triggerButton = (
        <button
            ref={triggerRef}
            id={id}
            type="button"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            data-testid="country-selector-trigger"
            onClick={() => {
                triggerHaptic("light");
                if (isMobile) {
                    handleOpenChange(true);
                }
            }}
            className="tap relative flex items-center justify-between min-h-[42px] md:min-h-[44px] w-full rounded-xl border border-border md:border-[1.5px] md:border-foreground bg-background px-2.5 py-1.5 gap-2 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25 transition-colors cursor-pointer"
        >
            <span className="flex items-center gap-2.5 min-w-0">
                <CountryFlag
                    code={selectedCountry?.code ?? value}
                    decorative
                    className="w-6 h-4 shrink-0"
                />
                <span className="min-w-0 flex flex-col">
                    <span
                        className={cn(
                            "font-extrabold text-foreground leading-snug break-words",
                            locale === "ta"
                                ? "text-[12px] sm:text-sm md:text-base"
                                : isIndic
                                    ? "text-[12.5px] sm:text-sm md:text-base"
                                    : "text-[13px] sm:text-sm md:text-base"
                        )}
                    >
                        {localizedSelectedName}
                        {selectedCountry?.suspensionStatus === "suspended"
                            ? labels.suspendedSuffix
                            : selectedCountry?.suspensionStatus === "restricted"
                                ? labels.noteSuffix
                                : ""}
                    </span>
                    {showTriggerEnglishSub && selectedCountry?.name && (
                        <span className="text-[10px] text-muted-foreground leading-tight">
                            {selectedCountry.name}
                        </span>
                    )}
                </span>
            </span>
            <span className="inline-flex items-center gap-0.5 text-[11px] md:text-xs font-extrabold text-primary shrink-0">
                <span>{labels.changeLabel ?? "Change"}</span>
                <ChevronDown
                    className={cn(
                        "w-3.5 h-3.5 shrink-0 pointer-events-none transition-transform duration-150",
                        isOpen && "rotate-180"
                    )}
                    strokeWidth={2.5}
                    aria-hidden="true"
                />
            </span>
        </button>
    );

    const pickerBody = (
        <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
            {/* Sticky Search Header */}
            <div className="shrink-0 min-w-0 border-b border-border bg-card p-2.5 space-y-2">
                <search className="relative flex items-center min-w-0">
                    <Search
                        className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                    />
                    <input
                        ref={searchInputRef}
                        id={searchInputId}
                        type="search"
                        role="combobox"
                        aria-expanded={isOpen}
                        aria-controls={listboxId}
                        aria-activedescendant={activeOptionId}
                        aria-autocomplete="list"
                        aria-label={labels.searchAriaLabel}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        enterKeyHint="search"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setActiveIndex(0);
                        }}
                        onKeyDown={handleSearchKeyDown}
                        placeholder={labels.searchPlaceholder}
                        data-testid="country-selector-search"
                        className="h-10 w-full rounded-xl border border-border md:border-[1.5px] md:border-foreground/70 bg-background pl-9 pr-9 text-base sm:text-sm font-medium text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 [&::-webkit-search-cancel-button]:hidden"
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => {
                                setQuery("");
                                setActiveIndex(0);
                                searchInputRef.current?.focus();
                            }}
                            aria-label={labels.clearSearchAriaLabel}
                            className="tap absolute right-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                        >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                    )}
                </search>

                {/* Popular Quick-Pick Pills when search is empty */}
                {!trimmedQuery && popularCountries.length > 0 && (
                    <div className="min-w-0 space-y-1.5 overflow-hidden">
                        <span className="block px-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {labels.popularHeading}
                        </span>
                        <div className="flex max-w-full items-center gap-1.5 overflow-x-auto scrollbar-hide snap-carousel pb-0.5">
                            {popularCountries.map((c) => {
                                const isActive = c.code === value;
                                const cName = getLocalizedCountryName(c.code, c.name, locale);
                                return (
                                    <button
                                        key={c.code}
                                        type="button"
                                        onClick={() => handleSelect(c.code)}
                                        aria-pressed={isActive}
                                        className={cn(
                                            "tap inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer",
                                            isActive
                                                ? "border-foreground bg-foreground text-background"
                                                : "border-border bg-background text-foreground hover:border-foreground hover:bg-secondary/25"
                                        )}
                                    >
                                        <CountryFlag code={c.code} decorative className="w-4 h-3 shrink-0" />
                                        <span className="whitespace-nowrap">{cName}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Section Count Bar */}
            <div
                aria-live="polite"
                className="shrink-0 flex items-center justify-between border-b border-border/60 bg-muted/40 px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
            >
                <span>
                    {trimmedQuery
                        ? labels.matchingCountriesLabel(filteredCountries.length)
                        : labels.allCountriesLabel(countries.length)}
                </span>
            </div>

            {/* Scrollable Country List with Flags (Zone-Free) */}
            <div
                id={listboxId}
                role="listbox"
                aria-label={labels.searchAriaLabel}
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-1.5 space-y-0.5"
            >
                {filteredCountries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
                        <p className="text-sm font-medium text-muted-foreground">
                            {labels.noResultsLabel(trimmedQuery)}
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                setQuery("");
                                setActiveIndex(0);
                                searchInputRef.current?.focus();
                            }}
                            className="tap rounded-xl border border-border bg-card px-3.5 py-1.5 text-xs font-bold text-foreground hover:bg-secondary/30 cursor-pointer"
                        >
                            {labels.clearSearchAriaLabel}
                        </button>
                    </div>
                ) : (
                    filteredCountries.map((c, index) => {
                        const cName = getLocalizedCountryName(c.code, c.name, locale);
                        const showEnglishSubtitle =
                            locale !== "en" && cName.toLowerCase() !== c.name.toLowerCase();
                        const isSelected = c.code === value;
                        const isHighlighted = index === safeActiveIndex;

                        return (
                            <button
                                key={c.code}
                                ref={(el) => {
                                    optionRefs.current[index] = el;
                                }}
                                id={`${listboxId}-opt-${c.code}`}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                data-country-code={c.code}
                                onMouseEnter={() => setActiveIndex(index)}
                                onClick={() => handleSelect(c.code)}
                                className={cn(
                                    "tap flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-ring",
                                    isSelected
                                        ? "bg-secondary/35 text-foreground ring-1 ring-inset ring-foreground/25"
                                        : isHighlighted
                                            ? "bg-accent text-accent-foreground"
                                            : "hover:bg-accent/70"
                                )}
                            >
                                <span className="flex items-center gap-2.5 min-w-0">
                                    <CountryFlag
                                        code={c.code}
                                        decorative
                                        className="w-6 h-4 shrink-0"
                                    />
                                    <span className="min-w-0 flex flex-col">
                                        <span
                                            className={cn(
                                                "text-sm leading-snug",
                                                isSelected ? "font-extrabold" : "font-semibold"
                                            )}
                                        >
                                            {cName}
                                        </span>
                                        {showEnglishSubtitle && (
                                            <span className="text-[11px] text-muted-foreground leading-tight">
                                                {c.name}
                                            </span>
                                        )}
                                    </span>
                                </span>

                                <span className="flex items-center gap-1.5 shrink-0">
                                    {c.suspensionStatus === "suspended" && (
                                        <span className="inline-flex items-center gap-0.5 rounded bg-destructive/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-destructive">
                                            <AlertTriangle className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                                            <span>{suspendedTag}</span>
                                        </span>
                                    )}
                                    {c.suspensionStatus === "restricted" && (
                                        <span className="inline-flex items-center gap-0.5 rounded bg-secondary/40 px-1.5 py-0.5 font-mono text-[10px] font-bold text-foreground">
                                            <Info className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                                            <span>{noteTag}</span>
                                        </span>
                                    )}
                                    <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                                        {c.code}
                                    </span>
                                    {isSelected && (
                                        <Check
                                            className="h-4 w-4 text-primary shrink-0"
                                            strokeWidth={2.8}
                                            aria-hidden="true"
                                        />
                                    )}
                                </span>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );

    if (isMobile) {
        return (
            <>
                {triggerButton}
                <Sheet open={isOpen} onOpenChange={handleOpenChange}>
                    <SheetContent
                        title={labels.sheetTitle ?? "Select Destination Country"}
                        bodyClassName="p-0 flex flex-col min-h-0 overflow-hidden"
                        data-testid="country-selector-dropdown"
                        className="h-[82dvh] max-h-[82dvh]"
                    >
                        {pickerBody}
                    </SheetContent>
                </Sheet>
            </>
        );
    }

    return (
        <PopoverPrimitive.Root open={isOpen} onOpenChange={handleOpenChange}>
            <PopoverPrimitive.Trigger asChild>{triggerButton}</PopoverPrimitive.Trigger>

            <PopoverPrimitive.Portal>
                <PopoverPrimitive.Content
                    side="bottom"
                    align="start"
                    sideOffset={6}
                    collisionPadding={12}
                    avoidCollisions
                    onOpenAutoFocus={(e) => {
                        e.preventDefault();
                        searchInputRef.current?.focus({ preventScroll: true });
                    }}
                    data-testid="country-selector-dropdown"
                    style={{
                        width: "min(calc(100vw - 1.5rem), max(var(--radix-popover-trigger-width, 20rem), 22rem))",
                        maxHeight: "min(25rem, var(--radix-popover-content-available-height, 25rem))",
                    }}
                    className={cn(
                        "z-[100] flex flex-col overflow-hidden rounded-xl border-2 border-foreground bg-popover text-popover-foreground shadow-[4px_4px_0_0_hsl(var(--foreground))]",
                        "data-[state=open]:animate-in data-[state=closed]:animate-out",
                        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                        "data-[side=bottom]:slide-in-from-top-1.5 data-[side=top]:slide-in-from-bottom-1.5",
                        "duration-150 outline-none"
                    )}
                >
                    {pickerBody}
                </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
    );
}
