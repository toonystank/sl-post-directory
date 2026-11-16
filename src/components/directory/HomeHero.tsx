"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { BookOpen, Plane, Banknote, Mail, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import PillarBox from "@/components/brand/PillarBox";
import Postmark from "@/components/brand/Postmark";
import { SearchMode } from "./types";

interface HomeHeroProps {
    /** The search bar element (rendered by SearchDirectory so state stays there) */
    search: React.ReactNode;
    searchMode: SearchMode;
    onModeChange: (mode: SearchMode) => void;
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

export default function HomeHero({ search, searchMode, onModeChange, total, activeQuery, searchRef }: HomeHeroProps) {
    const t = useTranslations("Home");

    return (
        <section className="relative border-b-2 border-foreground md:paper-grain">
            <div className="container mx-auto px-4">
                <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:pt-12 md:pb-6 lg:pt-14 lg:pb-8">
                    {/* Copy + search */}
                    <div className="min-w-0">
                        <p className="label-mono hidden md:block mb-4">{t("kicker")}</p>
                        <h1 className="display pt-5 text-[clamp(1.75rem,6.8vw,2.5rem)] md:pt-0 md:text-6xl lg:text-7xl break-words">
                            <span className="md:hidden">{t("headlineMobile")}</span>
                            <span className="hidden md:inline">{t("headlineDesktop")}</span>
                        </h1>
                        <p className="hidden md:block mt-4 max-w-xl text-lg text-muted-foreground">{t("lede")}</p>

                        {/* Mode toggle + Mobile illustration */}
                        <div className="mt-3 md:mt-7 mb-2 flex items-end justify-between gap-3 md:max-w-2xl">
                            <ModeToggle searchMode={searchMode} onModeChange={onModeChange} />

                            {/* Mobile illustration beside ModeToggle */}
                            <div className="relative shrink-0 md:hidden w-[105px] h-[82px] select-none pointer-events-none" aria-hidden="true">
                                <div className="absolute right-0 bottom-0 w-[270px] origin-bottom-right scale-[0.38]">
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
                                    <PillarBox className="relative z-10 w-[190px] mx-auto" />
                                </div>
                            </div>
                        </div>

                        <div ref={searchRef} className="md:max-w-2xl">
                            {search}
                        </div>

                        <p className="mt-2 md:mt-3 font-mono text-xs text-muted-foreground">
                            {total > 0 && !activeQuery ? `${total.toLocaleString()} offices · 9 provinces · EN / සිං / த` : "EN / සිං / த"}
                        </p>
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

                {/* Quick tools — calculator first (International + COD + Local, then Guides) */}
                <div className="pt-5 pb-6 md:pt-2 md:pb-10">
                    <h2 className="font-heading text-xl font-extrabold [font-stretch:82%] mb-3">{t("quickTools")}</h2>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                        {/* International — airmail envelope */}
                        <Link
                            href={{ pathname: "/calculator", query: { mode: "intl" } }}
                            className="tap block rounded-xl par-avion-stripe p-[6px] shadow-[0_3px_0_0_hsl(var(--foreground))]"
                        >
                            <span className="flex h-full min-h-[150px] flex-col items-center justify-center gap-2 rounded-lg bg-[#1D4E9E] px-2 py-4 text-center text-white">
                                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
                                    <Plane className="h-9 w-9" strokeWidth={2.2} aria-hidden="true" />
                                </span>
                                <span className="font-heading text-lg font-extrabold leading-tight [font-stretch:85%]">{t("toolIntl")}</span>
                                <span className="text-[11px] font-medium leading-tight text-white/85">{t("toolIntlSub")}</span>
                            </span>
                        </Link>

                        {/* COD — money green */}
                        <Link
                            href={{ pathname: "/calculator", query: { mode: "cod" } }}
                            className="tap block rounded-xl border-2 border-foreground bg-[#15803D] shadow-[0_3px_0_0_hsl(var(--foreground))]"
                        >
                            <span className="flex h-full min-h-[150px] flex-col items-center justify-center gap-2 px-2 py-4 text-center text-white">
                                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
                                    <Banknote className="h-9 w-9" strokeWidth={2.2} aria-hidden="true" />
                                </span>
                                <span className="font-heading text-lg font-extrabold leading-tight [font-stretch:85%]">{t("toolCod")}</span>
                                <span className="text-[11px] font-medium leading-tight text-white/85">{t("toolCodSub")}</span>
                            </span>
                        </Link>

                        {/* Local — SL Post red, full width on mobile, 3rd card on desktop */}
                        <Link
                            href={{ pathname: "/calculator", query: { mode: "local" } }}
                            className="tap col-span-2 md:col-span-1 flex items-center gap-3 rounded-xl border-2 border-foreground bg-primary px-4 py-3 text-white shadow-[0_3px_0_0_hsl(var(--foreground))] md:min-h-[150px] md:flex-col md:justify-center md:gap-2 md:px-2 md:py-4 md:text-center"
                        >
                            <span className="flex h-11 w-11 md:h-14 md:w-14 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                                <Mail className="h-6 w-6 md:h-9 md:w-9" strokeWidth={2.2} aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1 md:flex-initial">
                                <span className="block font-heading text-base md:text-lg font-extrabold leading-tight [font-stretch:85%]">{t("toolLocal")}</span>
                                <span className="block text-[11px] font-medium leading-tight opacity-85 truncate md:whitespace-normal">{t("toolLocalSub")}</span>
                            </span>
                            <ChevronRight className="h-5 w-5 shrink-0 md:hidden" aria-hidden="true" />
                        </Link>
                    </div>

                    {/* Secondary tool — Guides */}
                    <div className="mt-3">
                        <Link
                            href="/blog"
                            className="tap flex w-full items-center justify-center gap-2 rounded-full border-[1.5px] border-foreground bg-card px-3 py-2 text-sm font-semibold"
                        >
                            <BookOpen className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.2} aria-hidden="true" />
                            <span className="truncate">{t("toolGuides")}</span>
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}
