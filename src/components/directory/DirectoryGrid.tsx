"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import PillarBox from "@/components/brand/PillarBox";
import { PostOffice, SearchMode } from "./types";
import type { DirectoryExtraFilters } from "./useDirectoryState";
import PostOfficeCard from "./PostOfficeCard";

interface DirectoryGridProps {
    offices: PostOffice[];
    initialLoading: boolean;
    loading: boolean;
    hasActiveFilters: boolean;
    clearAll: () => void;
    nextCursor: number | null;
    total: number;
    query: string;
    activeLetter: string | null;
    searchMode: SearchMode;
    activeService: string | null;
    extraFilters?: DirectoryExtraFilters;
    fetchOffices: (
        q: string,
        letter: string | null,
        mode: SearchMode,
        service: string | null,
        cursor: number,
        append: boolean,
        extra?: DirectoryExtraFilters
    ) => void;
}

export default function DirectoryGrid({
    offices,
    initialLoading,
    loading,
    hasActiveFilters,
    clearAll,
    nextCursor,
    total,
    query,
    activeLetter,
    searchMode,
    activeService,
    extraFilters,
    fetchOffices,
}: DirectoryGridProps) {
    const t = useTranslations("Search");

    if (initialLoading) {
        return (
            <div className="space-y-2.5" aria-busy="true" aria-label={t("searching")}>
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="rounded-xl border-2 border-foreground/30 bg-card px-4 py-3.5 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0 space-y-2">
                            <div className="h-4 w-48 max-w-full bg-muted animate-pulse rounded-sm" />
                            <div className="h-3 w-36 bg-muted animate-pulse rounded-sm" />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <div className="h-8 w-20 bg-muted animate-pulse rounded-md" />
                            <div className="h-8 w-8 bg-muted animate-pulse rounded-md" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (offices.length === 0) {
        return (
            <div className="rounded-xl border-2 border-dashed border-foreground/30 bg-card/50 p-10 text-center">
                <PillarBox className="w-20 mx-auto mb-4" />
                <h3 className="font-heading text-2xl font-extrabold [font-stretch:82%] mb-1">
                    {t("noResults")}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
                    {t("noResultsBody")}
                </p>
                {hasActiveFilters && (
                    <Button variant="outline" onClick={clearAll}>
                        {t("reset")}
                    </Button>
                )}
            </div>
        );
    }

    return (
        <>
            <ul className="space-y-2.5">
                {offices.map((po, index) => (
                    <PostOfficeCard key={po.id} office={po} index={index} />
                ))}
            </ul>

            <div className="mt-8 flex justify-center py-4">
                {nextCursor !== null ? (
                    <Button
                        onClick={() => fetchOffices(query, activeLetter, searchMode, activeService, nextCursor, true, extraFilters)}
                        disabled={loading}
                        variant="outline"
                        size="lg"
                        className="min-w-[200px]"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>{t("loading")}</span>
                            </>
                        ) : (
                            t("loadMore")
                        )}
                    </Button>
                ) : (
                    offices.length > 0 && (
                        <p className="font-mono text-xs text-muted-foreground">
                            {t("endOf", { count: total.toLocaleString() })}
                        </p>
                    )
                )}
            </div>
        </>
    );
}
