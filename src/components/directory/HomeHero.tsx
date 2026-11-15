"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { Search, Calculator, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import PillarBox from "@/components/brand/PillarBox";
import Postmark from "@/components/brand/Postmark";
import { POPULAR_SEARCHES, SearchMode } from "./types";

interface HomeHeroProps {
    /** The search bar element (rendered by SearchDirectory so state stays there) */
    search: React.ReactNode;
    searchMode: SearchMode;
    onModeChange: (mode: SearchMode) => void;
    onPopular: (term: string) => void;
    onPostcodeTool: () => void;
    total: number;
    activeQuery: string;
    searchRef?: React.Ref<HTMLDivElement>;
}

/** Segmented "Name | Area" control, printed-form style. */
export function ModeToggle({ searchMode, onModeChange, className }: { searchMode: SearchMode; onModeChange: (m: SearchMode) => void; className?: string }) {
    const t = useTranslations("Search");
    return (
        <div role="radiogroup" aria-label={t("searchBy")} className={cn("inline-flex rounded-md border-[1.5px] border-foreground p-0.5 text-sm font-semibold", className)}>
            {(["name", "division"] as const).map((m) => (
                <button
                    key={m}
                    role="radio"
                    aria-checked={searchMode === m}
                    onClick={() => onModeChange(m)}
                    className={cn(
                        "tap rounded-[4px] px-3 py-1.5 transition-colors",
                        searchMode === m ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    {m === "name" ? t("modeName") : t("modeArea")}
                </button>
            ))}
        </div>
    );
}

export default function HomeHero({ search, searchMode, onModeChange, onPopular, onPostcodeTool, total, activeQuery, searchRef }: HomeHeroProps) {
    const t = useTranslations("Home");

    const tools = [
        { key: "postcode", label: t("toolPostcode"), icon: Search, onClick: onPostcodeTool },
        { key: "rates", label: t("toolRates"), icon: Calculator, href: "/calculator" as const },
        { key: "guides", label: t("toolGuides"), icon: BookOpen, href: "/blog" as const },
    ];

    return (
        <section className="relative border-b-2 border-foreground md:paper-grain">
            <div className="container mx-auto px-4">
                <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:py-12 lg:py-14">
                    {/* Copy + search */}
                    <div className="min-w-0">
                        <p className="label-mono hidden md:block mb-4">{t("kicker")}</p>
                        <h1 className="display pt-5 text-[clamp(1.75rem,6.8vw,2.5rem)] md:pt-0 md:text-6xl lg:text-7xl break-words">
                            <span className="md:hidden">{t("headlineMobile")}</span>
                            <span className="hidden md:inline">{t("headlineDesktop")}</span>
                        </h1>
                        <p className="hidden md:block mt-4 max-w-xl text-lg text-muted-foreground">{t("lede")}</p>

                        {/* Search (SearchDirectory docks a copy under the app bar once this scrolls away) */}
                        <div ref={searchRef} className="mt-4 md:mt-7 md:max-w-2xl">
                            {search}
                        </div>

                        <div className="mt-2 flex items-center gap-3 md:mt-4">
                            <ModeToggle searchMode={searchMode} onModeChange={onModeChange} />
                            <p className="hidden md:block font-mono text-xs text-muted-foreground">
                                {total > 0 && !activeQuery ? `${total.toLocaleString()} offices · 9 provinces · EN / සිං / த` : "EN / සිං / த"}
                            </p>
                        </div>

                        {/* Popular chips — horizontal scroll on phones */}
                        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide md:hidden">
                            {POPULAR_SEARCHES.map((term) => (
                                <button
                                    key={term}
                                    onClick={() => onPopular(term)}
                                    className="tap shrink-0 rounded-full border-[1.5px] border-foreground px-3.5 py-1.5 text-sm font-medium hover:bg-muted"
                                >
                                    {term}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Desktop illustration */}
                    <div className="relative hidden md:block w-[270px] lg:w-[315px]" aria-hidden="true">
                        <Postmark
                            code="00100"
                            size="lg"
                            tone="ink"
                            rotate={16}
                            label="COLOMBO"
                            className="absolute right-0 top-2 z-0 rounded-full bg-background"
                        />
                        <Postmark
                            code="20000"
                            size="lg"
                            tone="ink"
                            rotate={-18}
                            label="KANDY"
                            className="absolute left-0 bottom-8 z-0 rounded-full bg-background"
                        />
                        <PillarBox className="relative z-10 w-[190px] lg:w-[215px] mx-auto" />
                    </div>
                </div>

                {/* Mobile quick tools — stamp tiles */}
                <div className="md:hidden pt-5 pb-6">
                    <h2 className="font-heading text-xl font-extrabold [font-stretch:82%] mb-3">{t("quickTools")}</h2>
                    <div className="grid grid-cols-3 gap-3">
                        {tools.map(({ key, label, icon: Icon, href, onClick }) => {
                            const inner = (
                                <span className="stamp-edge flex aspect-square flex-col items-center justify-center gap-1.5 bg-secondary p-[9px] min-w-0">
                                    <span className="flex h-full w-full min-w-0 flex-col items-center justify-center gap-1.5 bg-card px-1 text-center">
                                        <Icon className="h-5 w-5 text-primary shrink-0" strokeWidth={2.2} />
                                        <span className="font-heading text-[0.8rem] sm:text-[0.92rem] font-extrabold leading-[1.15] [font-stretch:82%] break-words max-w-full">{label}</span>
                                    </span>
                                </span>
                            );
                            return href ? (
                                <Link key={key} href={href} className="tap block">{inner}</Link>
                            ) : (
                                <button key={key} onClick={onClick} className="tap block w-full">{inner}</button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
}
