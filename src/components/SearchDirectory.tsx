"use client";

import React, { useRef, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import HeroSection from "@/components/HeroSection";
import AddOfficeModal from "@/components/AddOfficeModal";

// Extracted Components
import { useDirectoryState } from "./directory/useDirectoryState";
import SearchBar from "./directory/SearchBar";
import DirectorySidebar from "./directory/DirectorySidebar";
import MobileFilters from "./directory/MobileFilters";
import DirectoryGrid from "./directory/DirectoryGrid";

export default function SearchDirectory() {
    const t = useTranslations("Search");
    const {
        query, setQuery,
        searchMode, setSearchMode,
        activeLetter, setActiveLetter,
        activeService, setActiveService,
        offices, total, nextCursor,
        loading, initialLoading,
        updateUrl, fetchOffices
    } = useDirectoryState();

    const [isMobileExpanded, setIsMobileExpanded] = useState(false);
    const [showStickySearch, setShowStickySearch] = useState(false);
    const [isAlphabetExpanded, setIsAlphabetExpanded] = useState<boolean>(() => {
        if (!activeLetter) return false;
        return activeLetter.toUpperCase().charCodeAt(0) - 65 >= 12; // A=65
    });

    const searchContainerRef = useRef<HTMLDivElement>(null);
    const stickySearchContainerRef = useRef<HTMLDivElement>(null);
    const sidebarRef = useRef<HTMLDivElement>(null);
    const primarySearchObserverRef = useRef<IntersectionObserver | null>(null);
    const sidebarScrollPos = useRef<number>(0);

    const hasActiveFilters = Boolean(query || activeLetter || activeService);

    const submitSearch = () => {
        updateUrl(query, searchMode, activeLetter, activeService);
        fetchOffices(query, activeLetter, searchMode, activeService, 0, false);
    };

    const handleSuggestionClick = (suggestion: string) => {
        setQuery(suggestion);
        updateUrl(suggestion, searchMode, activeLetter, activeService);
        fetchOffices(suggestion, activeLetter, searchMode, activeService, 0, false);
    };

    const handleModeSwitch = (mode: typeof searchMode) => {
        setSearchMode(mode);
        updateUrl(query, mode, activeLetter, activeService);
        if (query) fetchOffices(query, activeLetter, mode, activeService, 0, false);
    };

    const handleLetterFilter = (letter: string) => {
        const newLetter = activeLetter === letter ? null : letter;
        setActiveLetter(newLetter);
        updateUrl(query, searchMode, newLetter, activeService);
        fetchOffices(query, newLetter, searchMode, activeService, 0, false);
    };

    const handleServiceFilter = (service: string) => {
        const newService = activeService === service ? null : service;
        setActiveService(newService);
        updateUrl(query, searchMode, activeLetter, newService);
        fetchOffices(query, activeLetter, searchMode, newService, 0, false);
    };

    const handlePopularSearch = (term: string) => {
        setQuery(term);
        setActiveLetter(null);
        setActiveService(null);
        updateUrl(term, searchMode, null, null);
        fetchOffices(term, null, searchMode, null, 0, false);
    };

    const clearAll = () => {
        setQuery("");
        setActiveLetter(null);
        setActiveService(null);
        updateUrl("", searchMode, null, null);
        fetchOffices("", null, searchMode, null, 0, false);
    };

    // Intersection Observer for Sticky Search
    useEffect(() => {
        if (!searchContainerRef.current) return;
        primarySearchObserverRef.current = new IntersectionObserver(
            ([entry]) => setShowStickySearch(!entry.isIntersecting),
            { root: null, threshold: 0, rootMargin: "-65px 0px 0px 0px" }
        );
        primarySearchObserverRef.current.observe(searchContainerRef.current);
        return () => primarySearchObserverRef.current?.disconnect();
    }, []);

    // Save/Restore Sidebar scroll
    const handleSidebarScroll = (e: React.UIEvent<HTMLDivElement>) => {
        sidebarScrollPos.current = e.currentTarget.scrollTop;
    };

    useEffect(() => {
        if (sidebarRef.current) sidebarRef.current.scrollTop = sidebarScrollPos.current;
    }, [offices, loading, initialLoading]);

    return (
        <section className="relative w-full">
            {/* ====== HERO SECTION ====== */}
            <div ref={searchContainerRef}>
                <HeroSection>
                    <div className="w-full flex justify-center items-center flex-col">
                        <SearchBar
                            id="hero"
                            query={query}
                            onQueryChange={setQuery}
                            searchMode={searchMode}
                            onSubmit={submitSearch}
                            onClear={() => {
                                setQuery("");
                                updateUrl("", searchMode, activeLetter, activeService);
                                fetchOffices("", activeLetter, searchMode, activeService, 0, false);
                            }}
                            loading={loading}
                            onSuggestionClick={handleSuggestionClick}
                            containerRef={searchContainerRef}
                        />
                        <div className="w-full mt-4 text-left">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => handleModeSwitch("name")}
                                        className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${searchMode === "name" ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-white dark:bg-card/60 shadow-sm backdrop-blur-md text-muted-foreground border-border/50 hover:bg-card hover:text-foreground hover:border-border hover:scale-105"}`}
                                    >
                                        {t("modeName")}
                                    </button>
                                    <button
                                        onClick={() => handleModeSwitch("division")}
                                        className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${searchMode === "division" ? "bg-secondary text-secondary-foreground border-secondary shadow-sm" : "bg-white dark:bg-card/60 shadow-sm backdrop-blur-md text-muted-foreground border-border/50 hover:bg-card hover:text-foreground hover:border-border hover:scale-105"}`}
                                    >
                                        {t("modeArea")}
                                    </button>
                                </div>
                                <button
                                    onClick={() => setIsMobileExpanded(!isMobileExpanded)}
                                    className={`text-xs px-4 py-1.5 rounded-full font-bold uppercase tracking-wider border transition-all flex items-center gap-1 shadow-sm ${isMobileExpanded || activeLetter || activeService ? "bg-primary/20 text-primary border-primary/30 backdrop-blur-md" : "bg-white dark:bg-card/60 backdrop-blur-md text-muted-foreground border-border/50 hover:bg-card hover:text-foreground"}`}
                                >
                                    {isMobileExpanded ? t("hideFilters") : t("moreFilters")}
                                </button>
                            </div>
                            <MobileFilters
                                isMobileExpanded={isMobileExpanded}
                                activeLetter={activeLetter}
                                handleLetterFilter={handleLetterFilter}
                                clearLetter={() => handleLetterFilter(activeLetter || "")}
                                activeService={activeService}
                                handleServiceFilter={handleServiceFilter}
                                clearService={() => handleServiceFilter(activeService || "")}
                            />
                        </div>
                    </div>
                </HeroSection>
            </div>

            <div className="container mx-auto px-4 py-8 md:py-10 relative z-20">
                {/* ====== STICKY SEARCH BAR ====== */}
                {showStickySearch && (
                    <div ref={stickySearchContainerRef} className="fixed top-[64px] left-0 right-0 z-[60] lg:hidden animate-in slide-in-from-top-4 fade-in duration-300 drop-shadow-xl border-b border-border/50">
                        <div className="bg-background/95 backdrop-blur-md px-4 py-2">
                            <SearchBar
                                id="sticky"
                                isSticky
                                query={query}
                                onQueryChange={setQuery}
                                searchMode={searchMode}
                                onSubmit={submitSearch}
                                onClear={() => {
                                    setQuery("");
                                    updateUrl("", searchMode, activeLetter, activeService);
                                    fetchOffices("", activeLetter, searchMode, activeService, 0, false);
                                }}
                                loading={loading}
                                onSuggestionClick={handleSuggestionClick}
                                containerRef={stickySearchContainerRef}
                            />
                        </div>
                    </div>
                )}

                <div className="flex flex-col lg:flex-row items-start">
                    {/* ====== LEFT SIDEBAR ====== */}
                    <DirectorySidebar
                        sidebarRef={sidebarRef}
                        handleSidebarScroll={handleSidebarScroll}
                        showStickySearch={showStickySearch}
                        searchMode={searchMode}
                        handleModeSwitch={handleModeSwitch}
                        activeLetter={activeLetter}
                        handleLetterFilter={handleLetterFilter}
                        clearLetter={() => handleLetterFilter(activeLetter || "")}
                        isAlphabetExpanded={isAlphabetExpanded}
                        setIsAlphabetExpanded={setIsAlphabetExpanded}
                        activeService={activeService}
                        handleServiceFilter={handleServiceFilter}
                        clearService={() => handleServiceFilter(activeService || "")}
                        hasActiveFilters={hasActiveFilters}
                        handlePopularSearch={handlePopularSearch}
                        query={query}
                        onQueryChange={(val) => setQuery(val)}
                        onSubmit={submitSearch}
                        onClear={() => {
                            setQuery("");
                            updateUrl("", searchMode, activeLetter, activeService);
                            fetchOffices("", activeLetter, searchMode, activeService, 0, false);
                        }}
                        loading={loading}
                        onSuggestionClick={handleSuggestionClick}
                    />

                    {/* ====== RIGHT GRID SECTION ====== */}
                    <section className="flex-1 w-full min-w-0">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 pb-4 border-b border-border/40 gap-4">
                            <div>
                                <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-1">
                                    {activeLetter && query ? t("resultsForIn", { query, letter: activeLetter })
                                        : activeLetter ? t("startingWith", { letter: activeLetter })
                                        : query ? t("resultsFor", { query })
                                        : t("allOffices")}
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    {initialLoading ? t("searching") : t("found", { count: total.toLocaleString() })}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
                                {hasActiveFilters && (
                                    <button onClick={clearAll} className="text-xs font-medium text-destructive hover:bg-destructive/10 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 border border-transparent hover:border-destructive/20">
                                        <X className="w-3.5 h-3.5" /> {t("clearAll")}
                                    </button>
                                )}
                                <div className="flex-1 min-w-[140px]">
                                    <AddOfficeModal>
                                        <Button variant="default" size="sm" className="rounded-xl font-medium shadow-sm w-full bg-primary hover:bg-primary/90 overflow-hidden">
                                            <Plus className="w-4 h-4 mr-1.5 shrink-0" />
                                            <span className="truncate">{t("addOffice")}</span>
                                        </Button>
                                    </AddOfficeModal>
                                </div>
                            </div>
                        </div>

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
                            fetchOffices={fetchOffices}
                        />
                    </section>
                </div>
            </div>
        </section>
    );
}
