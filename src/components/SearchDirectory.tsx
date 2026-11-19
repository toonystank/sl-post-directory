"use client";

import React, { useRef, useEffect, useState } from "react";
import { Plus, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import AddOfficeModal from "@/components/AddOfficeModal";

import { useDirectoryState } from "./directory/useDirectoryState";
import { ModeToggle } from "./directory/HomeHero";
import SearchBar from "./directory/SearchBar";
import DirectorySidebar from "./directory/DirectorySidebar";
import MobileFilters from "./directory/MobileFilters";
import DirectoryGrid from "./directory/DirectoryGrid";
import { useServiceLabel } from "./directory/filters";
import { ALPHABET, POPULAR_SEARCHES } from "./directory/types";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";

export default function SearchDirectory() {
    const t = useTranslations("Search");
    const tBrowse = useTranslations("Browse");
    const tInstall = useTranslations("Install");
    const serviceLabel = useServiceLabel();

    const {
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
    } = useDirectoryState();

    const [filtersOpen, setFiltersOpen] = useState(false);
    const [showStickySearch, setShowStickySearch] = useState(false);

    const searchContainerRef = useRef<HTMLDivElement>(null);
    const stickySearchContainerRef = useRef<HTMLDivElement>(null);
    const heroInputRef = useRef<HTMLInputElement>(null);
    const resultsSectionRef = useRef<HTMLElement>(null);

    const currentExtra = {
        division: activeDivision,
        officeType: activeOfficeType,
        is24Hour: only24Hour,
    };

    const hasActiveFilters = Boolean(
        query || activeLetter || activeService || activeDivision || activeOfficeType || only24Hour
    );
    const activeFilterCount =
        (activeLetter ? 1 : 0) +
        (activeService ? 1 : 0) +
        (activeDivision ? 1 : 0) +
        (activeOfficeType ? 1 : 0) +
        (only24Hour ? 1 : 0);

    const scrollToResults = () => {
        requestAnimationFrame(() => {
            resultsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    };

    const submitSearch = () => {
        updateUrl(query, searchMode, activeLetter, activeService, currentExtra);
        fetchOffices(query, activeLetter, searchMode, activeService, 0, false, currentExtra);
        scrollToResults();
    };

    const handleClearQuery = () => {
        setQuery("");
        updateUrl("", searchMode, activeLetter, activeService, currentExtra);
        fetchOffices("", activeLetter, searchMode, activeService, 0, false, currentExtra);
    };

    const handleSuggestionClick = (suggestion: string) => {
        setQuery(suggestion);
        updateUrl(suggestion, searchMode, activeLetter, activeService, currentExtra);
        fetchOffices(suggestion, activeLetter, searchMode, activeService, 0, false, currentExtra);
        scrollToResults();
    };

    const handleModeSwitch = (mode: typeof searchMode) => {
        if (mode === searchMode && !hasActiveFilters) return;
        triggerHaptic("light");
        setSearchMode(mode);
        setQuery("");
        setActiveLetter(null);
        setActiveService(null);
        setActiveDivision(null);
        setActiveOfficeType(null);
        setOnly24Hour(false);
        setFiltersOpen(false);
        updateUrl("", mode, null, null, {});
        fetchOffices("", null, mode, null, 0, false, {});
    };

    const handleLetterFilter = (letter: string) => {
        triggerHaptic("light");
        const newLetter = activeLetter === letter ? null : letter;
        setActiveLetter(newLetter);
        updateUrl(query, searchMode, newLetter, activeService, currentExtra);
        fetchOffices(query, newLetter, searchMode, activeService, 0, false, currentExtra);
    };

    const handleServiceFilter = (service: string) => {
        triggerHaptic("light");
        const newService = activeService === service ? null : service;
        setActiveService(newService);
        updateUrl(query, searchMode, activeLetter, newService, currentExtra);
        fetchOffices(query, activeLetter, searchMode, newService, 0, false, currentExtra);
    };

    const handleDivisionFilter = (division: string | null) => {
        triggerHaptic("light");
        setActiveDivision(division);
        const nextExtra = { ...currentExtra, division };
        updateUrl(query, searchMode, activeLetter, activeService, nextExtra);
        fetchOffices(query, activeLetter, searchMode, activeService, 0, false, nextExtra);
    };

    const handleOfficeTypeFilter = (officeType: string | null) => {
        triggerHaptic("light");
        setActiveOfficeType(officeType);
        const nextExtra = { ...currentExtra, officeType };
        updateUrl(query, searchMode, activeLetter, activeService, nextExtra);
        fetchOffices(query, activeLetter, searchMode, activeService, 0, false, nextExtra);
    };

    const handleToggle24Hour = () => {
        triggerHaptic("light");
        const next = !only24Hour;
        setOnly24Hour(next);
        const nextExtra = { ...currentExtra, is24Hour: next };
        updateUrl(query, searchMode, activeLetter, activeService, nextExtra);
        fetchOffices(query, activeLetter, searchMode, activeService, 0, false, nextExtra);
    };

    const handlePopularSearch = (term: string) => {
        triggerHaptic("light");
        setQuery(term);
        setActiveLetter(null);
        setActiveService(null);
        setActiveDivision(null);
        setActiveOfficeType(null);
        setOnly24Hour(false);
        updateUrl(term, searchMode, null, null, {});
        fetchOffices(term, null, searchMode, null, 0, false, {});
        scrollToResults();
    };

    const clearAll = () => {
        setQuery("");
        setActiveLetter(null);
        setActiveService(null);
        setActiveDivision(null);
        setActiveOfficeType(null);
        setOnly24Hour(false);
        updateUrl("", searchMode, null, null, {});
        fetchOffices("", null, searchMode, null, 0, false, {});
    };

    const clearSheetFilters = () => {
        setActiveLetter(null);
        setActiveService(null);
        setActiveDivision(null);
        setActiveOfficeType(null);
        setOnly24Hour(false);
        updateUrl(query, searchMode, null, null, {});
        fetchOffices(query, null, searchMode, null, 0, false, {});
    };

    useEffect(() => {
        const el = searchContainerRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => setShowStickySearch(!entry.isIntersecting),
            { root: null, threshold: 0, rootMargin: "-60px 0px 0px 0px" }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <section className="relative w-full overflow-x-clip">
            {/* Browse Directory Header */}
            <div className="border-b-2 border-foreground bg-card/40 md:paper-grain">
                <div className="container mx-auto px-4 py-5 md:py-8">
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                        <div className="min-w-0">
                            <h1 className="display text-2xl sm:text-3xl md:text-5xl break-words">
                                {tBrowse("title")}
                            </h1>
                            <p className="mt-1 text-sm md:text-base text-muted-foreground max-w-2xl">
                                {tBrowse("lede")}
                            </p>
                        </div>
                        {/* Shown only when left sidebar is collapsed (< lg) to avoid duplicate Name | Area toggle on desktop */}
                        <ModeToggle
                            searchMode={searchMode}
                            onModeChange={handleModeSwitch}
                            className="lg:hidden self-start md:self-auto shrink-0"
                        />
                    </div>

                    <div ref={searchContainerRef} className="mt-4 max-w-3xl">
                        <SearchBar
                            id="browse-hero"
                            inputRef={heroInputRef}
                            query={query}
                            onQueryChange={setQuery}
                            searchMode={searchMode}
                            onSubmit={submitSearch}
                            onClear={handleClearQuery}
                            loading={loading}
                            onSuggestionClick={handleSuggestionClick}
                            containerRef={searchContainerRef}
                        />
                    </div>

                    {/* Mobile & Tablet (< lg) quick A-Z strip + Popular town pills */}
                    <div className="mt-4 lg:hidden space-y-2.5">
                        <div
                            className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide"
                            role="group"
                            aria-label={tBrowse("byLetter")}
                        >
                            <button
                                type="button"
                                onClick={() => {
                                    if (activeLetter) handleLetterFilter(activeLetter);
                                }}
                                aria-pressed={!activeLetter}
                                className={cn(
                                    "tap shrink-0 rounded-[5px] border-[1.5px] border-foreground px-2.5 h-9 font-mono text-xs font-bold transition-colors",
                                    !activeLetter
                                        ? "bg-foreground text-background"
                                        : "bg-card text-foreground hover:bg-secondary/40"
                                )}
                            >
                                ALL
                            </button>
                            {ALPHABET.map((letter) => {
                                const isSelected = activeLetter === letter;
                                return (
                                    <button
                                        key={letter}
                                        type="button"
                                        onClick={() => handleLetterFilter(letter)}
                                        aria-pressed={isSelected}
                                        className={cn(
                                            "tap shrink-0 flex h-9 w-9 items-center justify-center rounded-[5px] border-[1.5px] border-foreground font-mono text-xs font-bold transition-colors",
                                            isSelected
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-card text-foreground hover:bg-secondary/40"
                                        )}
                                    >
                                        {letter}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
                            {POPULAR_SEARCHES.map((term) => (
                                <button
                                    key={term}
                                    type="button"
                                    onClick={() => handlePopularSearch(term)}
                                    className="tap shrink-0 rounded-full border border-foreground/50 bg-background px-2.5 py-1 text-xs font-semibold hover:bg-secondary/40"
                                >
                                    {term}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {showStickySearch && (
                <div
                    ref={stickySearchContainerRef}
                    className="fixed top-[calc(var(--appbar-h)+env(safe-area-inset-top))] inset-x-0 z-40 lg:hidden border-b-2 border-foreground bg-background px-3 py-2"
                >
                    <SearchBar
                        id="sticky"
                        isSticky
                        query={query}
                        onQueryChange={setQuery}
                        searchMode={searchMode}
                        onSubmit={submitSearch}
                        onClear={handleClearQuery}
                        loading={loading}
                        onSuggestionClick={handleSuggestionClick}
                        containerRef={stickySearchContainerRef}
                    />
                </div>
            )}

            <div className="container mx-auto px-4 py-6 md:py-10">
                <div className="flex flex-col lg:flex-row items-start gap-8">
                    <DirectorySidebar
                        searchMode={searchMode}
                        handleModeSwitch={handleModeSwitch}
                        activeLetter={activeLetter}
                        handleLetterFilter={handleLetterFilter}
                        clearLetter={() => handleLetterFilter(activeLetter || "")}
                        activeService={activeService}
                        handleServiceFilter={handleServiceFilter}
                        clearService={() => handleServiceFilter(activeService || "")}
                        activeDivision={activeDivision}
                        availableDivisions={availableDivisions}
                        handleDivisionFilter={handleDivisionFilter}
                        activeOfficeType={activeOfficeType}
                        availableTypes={availableTypes}
                        handleOfficeTypeFilter={handleOfficeTypeFilter}
                        only24Hour={only24Hour}
                        handleToggle24Hour={handleToggle24Hour}
                        handlePopularSearch={handlePopularSearch}
                    />

                    <section ref={resultsSectionRef} className="flex-1 w-full min-w-0 scroll-mt-28 lg:scroll-mt-8">
                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div className="min-w-0">
                                <h2 className="font-heading text-2xl md:text-3xl font-extrabold [font-stretch:82%] truncate">
                                    {activeLetter && query
                                        ? t("resultsForIn", { query, letter: activeLetter })
                                        : activeLetter
                                        ? t("startingWith", { letter: activeLetter })
                                        : query
                                        ? t("resultsFor", { query })
                                        : activeDivision
                                        ? `${activeDivision} Offices`
                                        : t("allOffices")}
                                </h2>
                                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                                    {initialLoading
                                        ? t("searching")
                                        : isOfflineFallback
                                            ? tInstall("offlineShowingSaved", { count: total.toLocaleString() })
                                            : t("found", { count: total.toLocaleString() })}
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="lg:hidden h-10"
                                    onClick={() => {
                                        triggerHaptic("light");
                                        setFiltersOpen(true);
                                    }}
                                >
                                    <SlidersHorizontal className="h-4 w-4" />
                                    <span>{t("moreFilters")}</span>
                                    {activeFilterCount > 0 && (
                                        <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 font-mono text-[0.7rem] font-semibold text-primary-foreground">
                                            {activeFilterCount}
                                        </span>
                                    )}
                                </Button>

                                <AddOfficeModal>
                                    <Button variant="default" size="sm" className="h-10">
                                        <Plus className="h-4 w-4" />
                                        <span>{t("addOffice")}</span>
                                    </Button>
                                </AddOfficeModal>
                            </div>
                        </div>

                        {hasActiveFilters && (
                            <div className="mb-4 flex flex-wrap items-center gap-2">
                                {query && (
                                    <button
                                        type="button"
                                        onClick={handleClearQuery}
                                        className="tap inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-foreground bg-secondary/40 px-3 py-1 text-xs font-semibold hover:bg-secondary/70"
                                    >
                                        <span>&ldquo;{query}&rdquo;</span>
                                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                                    </button>
                                )}
                                {activeDivision && (
                                    <button
                                        type="button"
                                        onClick={() => handleDivisionFilter(null)}
                                        className="tap inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-foreground bg-secondary/40 px-3 py-1 text-xs font-semibold hover:bg-secondary/70"
                                    >
                                        <span>{activeDivision}</span>
                                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                                    </button>
                                )}
                                {activeOfficeType && (
                                    <button
                                        type="button"
                                        onClick={() => handleOfficeTypeFilter(null)}
                                        className="tap inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-foreground bg-secondary/40 px-3 py-1 text-xs font-semibold hover:bg-secondary/70"
                                    >
                                        <span>{activeOfficeType}</span>
                                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                                    </button>
                                )}
                                {only24Hour && (
                                    <button
                                        type="button"
                                        onClick={handleToggle24Hour}
                                        className="tap inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-foreground bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold"
                                    >
                                        <span>24-Hour</span>
                                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                                    </button>
                                )}
                                {activeLetter && (
                                    <button
                                        type="button"
                                        onClick={() => handleLetterFilter(activeLetter)}
                                        className="tap inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-foreground bg-secondary/40 px-3 py-1 font-mono text-xs font-semibold hover:bg-secondary/70"
                                    >
                                        <span>{activeLetter}</span>
                                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                                    </button>
                                )}
                                {activeService && (
                                    <button
                                        type="button"
                                        onClick={() => handleServiceFilter(activeService)}
                                        className="tap inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-foreground bg-secondary/40 px-3 py-1 text-xs font-semibold hover:bg-secondary/70"
                                    >
                                        <span>{serviceLabel(activeService)}</span>
                                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={clearAll}
                                    className="tap px-2 py-1 text-xs font-semibold text-primary hover:underline underline-offset-4"
                                >
                                    {t("clearAll")}
                                </button>
                            </div>
                        )}

                        <DirectoryGrid
                            offices={offices}
                            initialLoading={initialLoading}
                            loading={loading}
                            hasActiveFilters={hasActiveFilters}
                            clearAll={clearAll}
                            nextCursor={nextCursor}
                            total={total}
                            query={query}
                            activeLetter={activeLetter}
                            searchMode={searchMode}
                            activeService={activeService}
                            extraFilters={currentExtra}
                            fetchOffices={fetchOffices}
                        />
                    </section>
                </div>
            </div>

            <MobileFilters
                open={filtersOpen}
                onOpenChange={setFiltersOpen}
                activeLetter={activeLetter}
                handleLetterFilter={handleLetterFilter}
                activeService={activeService}
                handleServiceFilter={handleServiceFilter}
                activeDivision={activeDivision}
                availableDivisions={availableDivisions}
                handleDivisionFilter={handleDivisionFilter}
                activeOfficeType={activeOfficeType}
                availableTypes={availableTypes}
                handleOfficeTypeFilter={handleOfficeTypeFilter}
                only24Hour={only24Hour}
                handleToggle24Hour={handleToggle24Hour}
                handlePopularSearch={handlePopularSearch}
                onClear={clearSheetFilters}
                total={total}
            />
        </section>
    );
}
