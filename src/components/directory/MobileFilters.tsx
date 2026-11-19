"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import { Sheet, SheetContent } from "@/components/shell/Sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LetterKeypad, ServiceToggles } from "./filters";
import { POPULAR_SEARCHES } from "./types";

interface MobileFiltersProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    activeLetter: string | null;
    handleLetterFilter: (letter: string) => void;
    activeService: string | null;
    handleServiceFilter: (service: string) => void;
    activeDivision: string | null;
    availableDivisions: string[];
    handleDivisionFilter: (division: string | null) => void;
    activeOfficeType: string | null;
    availableTypes: string[];
    handleOfficeTypeFilter: (officeType: string | null) => void;
    only24Hour: boolean;
    handleToggle24Hour: () => void;
    handlePopularSearch: (term: string) => void;
    onClear: () => void;
    total: number;
}

/** Filters as a native-style bottom sheet (phones and tablets). */
export default function MobileFilters({
    open,
    onOpenChange,
    activeLetter,
    handleLetterFilter,
    activeService,
    handleServiceFilter,
    activeDivision,
    availableDivisions,
    handleDivisionFilter,
    activeOfficeType,
    availableTypes,
    handleOfficeTypeFilter,
    only24Hour,
    handleToggle24Hour,
    handlePopularSearch,
    onClear,
    total,
}: MobileFiltersProps) {
    const t = useTranslations("Search");
    const tf = useTranslations("Filters");
    const hasSheetFilters = Boolean(
        activeLetter || activeService || activeDivision || activeOfficeType || only24Hour
    );

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                title={t("filtersTitle")}
                footer={
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            className="h-12 flex-1"
                            onClick={onClear}
                            disabled={!hasSheetFilters}
                        >
                            {t("clear")}
                        </Button>
                        <Button className="h-12 flex-[2]" onClick={() => onOpenChange(false)}>
                            {t("apply")} · {total.toLocaleString()}
                        </Button>
                    </div>
                }
            >
                {availableDivisions.length > 0 && (
                    <section className="mb-5">
                        <h3 className="label-mono mb-2">District / Division</h3>
                        <select
                            aria-label="Filter by District or Division"
                            value={activeDivision ?? ""}
                            onChange={(e) => handleDivisionFilter(e.target.value || null)}
                            className="h-11 w-full rounded-lg border-[1.5px] border-foreground bg-card px-3 text-sm font-semibold text-foreground"
                        >
                            <option value="">All divisions ({availableDivisions.length})</option>
                            {availableDivisions.map((div) => (
                                <option key={div} value={div}>
                                    {div}
                                </option>
                            ))}
                        </select>
                    </section>
                )}

                {availableTypes.length > 1 && (
                    <section className="mb-5">
                        <h3 className="label-mono mb-2">Office Type</h3>
                        <div className="flex flex-wrap gap-2">
                            {availableTypes.map((officeType) => {
                                const active = activeOfficeType === officeType;
                                return (
                                    <button
                                        key={officeType}
                                        type="button"
                                        onClick={() => handleOfficeTypeFilter(active ? null : officeType)}
                                        aria-pressed={active}
                                        className={cn(
                                            "tap rounded-lg border-[1.5px] px-3 py-2 text-xs font-bold transition-colors",
                                            active
                                                ? "border-foreground bg-foreground text-background"
                                                : "border-foreground/50 bg-card hover:bg-secondary/30"
                                        )}
                                    >
                                        {officeType}
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                )}

                <section className="mb-5">
                    <button
                        type="button"
                        onClick={handleToggle24Hour}
                        aria-pressed={only24Hour}
                        className={cn(
                            "tap flex w-full items-center justify-between gap-2 rounded-lg border-[1.5px] px-3.5 py-3 text-sm font-bold transition-colors",
                            only24Hour
                                ? "border-foreground bg-primary text-primary-foreground"
                                : "border-foreground/60 bg-card hover:bg-secondary/30"
                        )}
                    >
                        <span className="flex items-center gap-2">
                            <Clock className="h-4 w-4" aria-hidden="true" />
                            24-Hour Post Offices Only
                        </span>
                        <span className="font-mono text-xs">{only24Hour ? "ON" : "OFF"}</span>
                    </button>
                </section>

                <section className="mb-5">
                    <h3 className="label-mono mb-2">{tf("popular")}</h3>
                    <div className="flex flex-wrap gap-2">
                        {POPULAR_SEARCHES.map((term) => (
                            <button
                                key={term}
                                type="button"
                                onClick={() => {
                                    handlePopularSearch(term);
                                    onOpenChange(false);
                                }}
                                className="tap rounded-full border-[1.5px] border-foreground/70 bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary/40"
                            >
                                {term}
                            </button>
                        ))}
                    </div>
                </section>

                <section className="mb-5">
                    <h3 className="label-mono mb-3">{tf("alphabetical")}</h3>
                    <LetterKeypad activeLetter={activeLetter} onSelect={handleLetterFilter} />
                </section>

                <section>
                    <h3 className="label-mono mb-1">{tf("service")}</h3>
                    <ServiceToggles activeService={activeService} onSelect={handleServiceFilter} />
                </section>
            </SheetContent>
        </Sheet>
    );
}
