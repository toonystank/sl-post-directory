"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Building2, Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchMode, POPULAR_SEARCHES } from "./types";
import { LetterKeypad, ServiceToggles } from "./filters";

interface DirectorySidebarProps {
    searchMode: SearchMode;
    handleModeSwitch: (mode: SearchMode) => void;
    activeLetter: string | null;
    handleLetterFilter: (letter: string) => void;
    clearLetter: () => void;
    activeService: string | null;
    handleServiceFilter: (service: string) => void;
    clearService: () => void;
    activeDivision: string | null;
    availableDivisions: string[];
    handleDivisionFilter: (division: string | null) => void;
    activeOfficeType: string | null;
    availableTypes: string[];
    handleOfficeTypeFilter: (officeType: string | null) => void;
    only24Hour: boolean;
    handleToggle24Hour: () => void;
    activeDelivery: "yes" | "no" | null;
    handleDeliveryFilter: (delivery: "yes" | "no" | null) => void;
    handlePopularSearch: (term: string) => void;
}

function SectionHeading({
    children,
    clearLabel,
    onClear,
    show,
}: {
    children: React.ReactNode;
    clearLabel?: string;
    onClear?: () => void;
    show?: boolean;
}) {
    return (
        <div className="mb-3 flex items-center justify-between">
            <h3 className="label-mono">{children}</h3>
            {show && onClear && clearLabel && (
                <button onClick={onClear} className="text-xs font-semibold text-primary underline-offset-4 hover:underline">
                    {clearLabel}
                </button>
            )}
        </div>
    );
}

/** Desktop filter rail — flat, ruled, typewriter keypad. */
export default function DirectorySidebar({
    searchMode,
    handleModeSwitch,
    activeLetter,
    handleLetterFilter,
    clearLetter,
    activeService,
    handleServiceFilter,
    clearService,
    activeDivision,
    availableDivisions,
    handleDivisionFilter,
    activeOfficeType,
    availableTypes,
    handleOfficeTypeFilter,
    only24Hour,
    handleToggle24Hour,
    activeDelivery,
    handleDeliveryFilter,
    handlePopularSearch,
}: DirectorySidebarProps) {
    const t = useTranslations("Search");
    const tf = useTranslations("Filters");

    return (
        <aside className="hidden lg:block w-[17.5rem] shrink-0">
            <div className="sticky top-[5.5rem] max-h-[calc(100dvh-6.5rem)] overflow-y-auto scrollbar-hide space-y-6 pb-6 pr-1">
                <section>
                    <SectionHeading>{t("searchBy")}</SectionHeading>
                    <div className="grid grid-cols-2 gap-2">
                        {([
                            { mode: "name", label: t("modeName"), Icon: Building2 },
                            { mode: "division", label: t("modeArea"), Icon: MapPin },
                        ] as const).map(({ mode, label, Icon }) => (
                            <button
                                key={mode}
                                type="button"
                                onClick={() => handleModeSwitch(mode)}
                                aria-pressed={searchMode === mode}
                                className={cn(
                                    "tap flex items-center justify-center gap-2 rounded-md border-[1.5px] py-2 text-sm font-semibold",
                                    searchMode === mode
                                        ? "border-foreground bg-foreground text-background"
                                        : "border-border hover:border-foreground/50"
                                )}
                            >
                                <Icon className="h-4 w-4" /> {label}
                            </button>
                        ))}
                    </div>
                </section>

                {availableDivisions.length > 0 && (
                    <section>
                        <SectionHeading
                            clearLabel={t("clear")}
                            onClear={() => handleDivisionFilter(null)}
                            show={Boolean(activeDivision)}
                        >
                            District / Division
                        </SectionHeading>
                        <select
                            aria-label="Filter by District or Division"
                            value={activeDivision ?? ""}
                            onChange={(e) => handleDivisionFilter(e.target.value || null)}
                            className="h-10 w-full rounded-md border-[1.5px] border-foreground bg-card px-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                    <section>
                        <SectionHeading
                            clearLabel={t("clear")}
                            onClear={() => handleOfficeTypeFilter(null)}
                            show={Boolean(activeOfficeType)}
                        >
                            Office Type
                        </SectionHeading>
                        <div className="flex flex-wrap gap-1.5">
                            {availableTypes.map((officeType) => {
                                const active = activeOfficeType === officeType;
                                return (
                                    <button
                                        key={officeType}
                                        type="button"
                                        onClick={() => handleOfficeTypeFilter(active ? null : officeType)}
                                        aria-pressed={active}
                                        className={cn(
                                            "tap rounded-md border-[1.5px] px-2.5 py-1.5 text-xs font-semibold transition-colors",
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

                <section>
                    <SectionHeading
                        clearLabel={t("clear")}
                        onClear={() => handleDeliveryFilter(null)}
                        show={Boolean(activeDelivery)}
                    >
                        {tf("deliveryStatus")}
                    </SectionHeading>
                    <div className="grid grid-cols-3 gap-1.5">
                        {(
                            [
                                { val: null, label: tf("deliveryAll") },
                                { val: "yes", label: tf("deliveryYes") },
                                { val: "no", label: tf("deliveryNo") },
                            ] as const
                        ).map((opt) => {
                            const active = activeDelivery === opt.val;
                            return (
                                <button
                                    key={opt.label}
                                    type="button"
                                    onClick={() => handleDeliveryFilter(opt.val)}
                                    aria-pressed={active}
                                    className={cn(
                                        "tap rounded-md border-[1.5px] px-2 py-1.5 text-xs font-semibold transition-colors",
                                        active
                                            ? "border-foreground bg-foreground text-background"
                                            : "border-foreground/50 bg-card hover:bg-secondary/30"
                                    )}
                                >
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section>
                    <button
                        type="button"
                        onClick={handleToggle24Hour}
                        aria-pressed={only24Hour}
                        className={cn(
                            "tap flex w-full items-center justify-between gap-2 rounded-md border-[1.5px] px-3 py-2.5 text-sm font-semibold transition-colors",
                            only24Hour
                                ? "border-foreground bg-primary text-primary-foreground"
                                : "border-foreground/60 bg-card hover:bg-secondary/30"
                        )}
                    >
                        <span className="flex items-center gap-2">
                            <Clock className="h-4 w-4" aria-hidden="true" />
                            24-Hour Offices Only
                        </span>
                        <span className="font-mono text-xs">{only24Hour ? "ON" : "OFF"}</span>
                    </button>
                </section>

                <section>
                    <SectionHeading clearLabel={t("clear")} onClear={clearLetter} show={!!activeLetter}>
                        {tf("alphabetical")}
                    </SectionHeading>
                    <LetterKeypad activeLetter={activeLetter} onSelect={handleLetterFilter} size="sm" />
                </section>

                <section>
                    <SectionHeading clearLabel={t("clear")} onClear={clearService} show={!!activeService}>
                        {tf("service")}
                    </SectionHeading>
                    <ServiceToggles activeService={activeService} onSelect={handleServiceFilter} />
                </section>

                <section>
                    <SectionHeading>{tf("popular")}</SectionHeading>
                    <div className="flex flex-wrap gap-1.5">
                        {POPULAR_SEARCHES.map((term) => (
                            <button
                                key={term}
                                type="button"
                                onClick={() => handlePopularSearch(term)}
                                className="tap rounded-full border-[1.5px] border-foreground/70 px-3 py-1 text-sm hover:bg-secondary/40"
                            >
                                {term}
                            </button>
                        ))}
                    </div>
                </section>
            </div>
        </aside>
    );
}
