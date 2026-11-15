"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Building2, MapPin } from "lucide-react";
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
    searchMode, handleModeSwitch,
    activeLetter, handleLetterFilter, clearLetter,
    activeService, handleServiceFilter, clearService,
    handlePopularSearch,
}: DirectorySidebarProps) {
    const t = useTranslations("Search");
    const tf = useTranslations("Filters");

    return (
        <aside className="hidden lg:block w-[17.5rem] shrink-0">
            <div className="sticky top-[5.5rem] max-h-[calc(100dvh-6.5rem)] overflow-y-auto scrollbar-hide space-y-7 pb-6 pr-1">
                <section>
                    <SectionHeading>{t("searchBy")}</SectionHeading>
                    <div className="grid grid-cols-2 gap-2">
                        {([
                            { mode: "name", label: t("modeName"), Icon: Building2 },
                            { mode: "division", label: t("modeArea"), Icon: MapPin },
                        ] as const).map(({ mode, label, Icon }) => (
                            <button
                                key={mode}
                                onClick={() => handleModeSwitch(mode)}
                                aria-pressed={searchMode === mode}
                                className={cn(
                                    "tap flex items-center justify-center gap-2 rounded-md border-[1.5px] py-2 text-sm font-semibold",
                                    searchMode === mode ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground/50"
                                )}
                            >
                                <Icon className="h-4 w-4" /> {label}
                            </button>
                        ))}
                    </div>
                </section>

                <section>
                    <SectionHeading clearLabel={t("clear")} onClear={clearLetter} show={!!activeLetter}>{tf("alphabetical")}</SectionHeading>
                    <LetterKeypad activeLetter={activeLetter} onSelect={handleLetterFilter} size="sm" />
                </section>

                <section>
                    <SectionHeading clearLabel={t("clear")} onClear={clearService} show={!!activeService}>{tf("service")}</SectionHeading>
                    <ServiceToggles activeService={activeService} onSelect={handleServiceFilter} />
                </section>

                <section>
                    <SectionHeading>{tf("popular")}</SectionHeading>
                    <div className="flex flex-wrap gap-1.5">
                        {POPULAR_SEARCHES.map((term) => (
                            <button
                                key={term}
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
