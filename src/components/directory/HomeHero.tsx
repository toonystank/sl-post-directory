"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { m } from "motion/react";
import { Link, useRouter } from "@/navigation";
import { BookOpen, FolderOpen, Plane, Banknote, Mail, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import PillarBox from "@/components/brand/PillarBox";
import Postmark from "@/components/brand/Postmark";
import SearchBar from "./SearchBar";
import { SearchMode } from "./types";

interface HomeHeroProps {
    /** Optional controlled search bar element */
    search?: React.ReactNode;
    searchMode?: SearchMode;
    onModeChange?: (mode: SearchMode) => void;
    total?: number;
    activeQuery?: string;
    searchRef?: React.Ref<HTMLDivElement>;
}

/** Segmented "Name | Area" control, printed-form style. */
export function ModeToggle({ searchMode, onModeChange, className }: { searchMode: SearchMode; onModeChange: (m: SearchMode) => void; className?: string }) {
    const t = useTranslations("Search");
    const toggleId = React.useId();
    return (
        <div role="radiogroup" aria-label={t("searchBy")} className={cn("inline-flex rounded-md border-[1.5px] border-foreground p-0.5 text-sm font-semibold", className)}>
            {(["name", "division"] as const).map((mode) => {
                const active = searchMode === mode;
                return (
                    <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onModeChange(mode)}
                        className={cn(
                            "tap relative rounded-[4px] px-3 py-1.5 transition-colors",
                            active ? "text-background" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {active && (
                            <m.span
                                layoutId={`mode-pill-${toggleId}`}
                                transition={{ type: "spring", stiffness: 460, damping: 34 }}
                                className="absolute inset-0 rounded-[4px] bg-foreground"
                                aria-hidden="true"
                            />
                        )}
                        <span className="relative z-10">{mode === "name" ? t("modeName") : t("modeArea")}</span>
                    </button>
                );
            })}
        </div>
    );
}

export default function HomeHero({ search, searchMode: controlledMode, total = 4158, activeQuery, searchRef }: HomeHeroProps) {
    const t = useTranslations("Home");
    const locale = useLocale();
    const isIndic = locale === "si" || locale === "ta";
    const router = useRouter();
    const [localQuery, setLocalQuery] = React.useState("");
    const [localMode] = React.useState<SearchMode>("name");
    const localSearchContainerRef = React.useRef<HTMLDivElement>(null);

    const effectiveMode = controlledMode ?? localMode;
    const effectiveQuery = activeQuery ?? localQuery;

    const navigateToBrowse = (q: string, mode: SearchMode) => {
        const trimmed = q.trim();
        const params = new URLSearchParams();
        if (trimmed) params.set("q", trimmed);
        if (mode !== "name") params.set("mode", mode);
        const qs = params.toString();
        router.push(qs ? `/browse?${qs}` : "/browse");
    };

    return (
        <section className="relative border-b-2 border-foreground md:paper-grain">
            <div className="container mx-auto px-4">
                <div className="grid items-start md:items-center gap-3 md:gap-8 md:grid-cols-[minmax(0,1fr)_auto] pt-2 pb-2 md:pt-8 md:pb-6 lg:pt-10 lg:pb-8">
                    {/* Copy + search */}
                    <div className="min-w-0">
                        {/* Mobile & Desktop Top Split: Text at top-left, Signature PillarBox + Postmarks at top-right on mobile */}
                        <div className="flex items-start justify-between gap-2 md:block">
                            <div className="min-w-0 flex-1 pt-0.5">
                                <p
                                    className={cn(
                                        "font-mono font-bold uppercase tracking-wider text-primary mb-1 md:mb-2",
                                        isIndic ? "text-[9.5px] md:text-xs" : "text-[10px] md:text-xs"
                                    )}
                                >
                                    {t("kicker")}
                                </p>
                                <h1
                                    className={cn(
                                        "break-words font-extrabold",
                                        isIndic
                                            ? "text-[1.08rem] sm:text-[1.25rem] leading-[1.2] md:text-3xl lg:text-4xl"
                                            : "display text-[1.28rem] sm:text-[1.5rem] leading-[1.08] md:text-4xl lg:text-5xl"
                                    )}
                                >
                                    <span className="md:hidden">{t("headlineMobile")}</span>
                                    <span className="hidden md:inline">{t("headlineDesktop")}</span>
                                </h1>
                                <p
                                    className={cn(
                                        "max-w-xl text-muted-foreground",
                                        isIndic
                                            ? "mt-1 md:mt-2.5 text-[10.5px] sm:text-xs md:text-sm leading-[1.35] md:leading-relaxed"
                                            : "mt-1.5 md:mt-3 text-[11.5px] sm:text-xs md:text-base leading-snug md:leading-relaxed"
                                    )}
                                >
                                    {t("lede")}
                                </p>
                            </div>

                            {/* Signature Mobile PillarBox + Colombo & Kandy Postmarks top-aligned on right */}
                            <div
                                className="relative shrink-0 md:hidden w-[118px] h-[106px] flex items-end justify-center select-none pointer-events-none"
                                aria-hidden="true"
                            >
                                <Postmark
                                    code="00100"
                                    size="md"
                                    boxSize={58}
                                    tone="ink"
                                    rotate={14}
                                    label="COLOMBO GPO"
                                    bottomLabel="ශ්‍රී ලංකා · SRI LANKA"
                                    date="17 NOV 26"
                                    time="AM 10.30"
                                    bay="A"
                                    className="absolute right-0 top-0 z-0 rounded-full bg-background"
                                />
                                <Postmark
                                    code="20000"
                                    size="md"
                                    boxSize={58}
                                    tone="ink"
                                    rotate={-16}
                                    label="KANDY"
                                    bottomLabel="ශ්‍රී ලංකා · SRI LANKA"
                                    date="17 NOV 26"
                                    time="PM 14.00"
                                    bay="C"
                                    className="absolute left-0 bottom-1.5 z-0 rounded-full bg-background"
                                />
                                <PillarBox className="relative z-10 w-[70px] h-auto" />
                            </div>
                        </div>

                        <div ref={searchRef ?? localSearchContainerRef} className="mt-2 md:mt-5 md:max-w-2xl">
                            {search ?? (
                                <SearchBar
                                    id="home-hero"
                                    query={localQuery}
                                    onQueryChange={(val) => setLocalQuery(val)}
                                    searchMode={effectiveMode}
                                    enableSmartHomeSearch
                                    onSubmit={() => navigateToBrowse(localQuery, effectiveMode)}
                                    onClear={() => setLocalQuery("")}
                                    loading={false}
                                    onSuggestionClick={(suggestion) => {
                                        setLocalQuery(suggestion);
                                        navigateToBrowse(suggestion, effectiveMode);
                                    }}
                                    containerRef={localSearchContainerRef}
                                />
                            )}
                        </div>

                        <p className="hidden md:block mt-3 font-mono text-xs text-muted-foreground">
                            {total > 0 && !effectiveQuery ? `${total.toLocaleString()} offices · 9 provinces · EN / සිං / த` : "EN / සිං / த"}
                        </p>
                    </div>

                    {/* Desktop illustration */}
                    <div
                        className="relative hidden md:block w-[290px] lg:w-[330px]"
                        aria-hidden="true"
                    >
                        <Postmark
                            code="00100"
                            size="lg"
                            tone="ink"
                            rotate={16}
                            label="COLOMBO GPO"
                            bottomLabel="ශ්‍රී ලංකා · SRI LANKA"
                            date="17 NOV 26"
                            time="AM 10.30"
                            bay="A"
                            className="absolute right-0 top-1 z-0 rounded-full bg-background"
                        />
                        <Postmark
                            code="20000"
                            size="lg"
                            tone="ink"
                            rotate={-18}
                            label="KANDY"
                            bottomLabel="ශ්‍රී ලංකා · SRI LANKA"
                            date="17 NOV 26"
                            time="PM 14.00"
                            bay="C"
                            className="absolute left-0 bottom-7 z-0 rounded-full bg-background"
                        />
                        <PillarBox className="relative z-10 w-[190px] lg:w-[215px] mx-auto" />
                    </div>
                </div>

                {/* Quick tools — calculator first (International + COD + Local, then Directory & Guides) */}
                <div className="pt-2.5 pb-4 md:pt-2 md:pb-10">
                    <h2
                        className={cn(
                            "font-heading font-extrabold [font-stretch:82%] mb-2 md:mb-3",
                            isIndic ? "text-base md:text-xl" : "text-lg md:text-xl"
                        )}
                    >
                        {t("quickTools")}
                    </h2>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 md:gap-4">
                        {/* International — airmail envelope */}
                        <div>
                            <Link
                                href={{ pathname: "/calculator", query: { mode: "intl" } }}
                                className="tap block h-full rounded-xl border-2 border-foreground par-avion-stripe p-[4px] md:p-[6px] shadow-[0_3px_0_0_hsl(var(--foreground))] md:hover:-translate-y-0.5 transition-transform"
                            >
                                <span className="flex h-full min-h-[112px] md:min-h-[146px] flex-col items-center justify-center gap-1 md:gap-2 rounded-lg bg-[#1D4E9E] px-2 py-2.5 md:py-4 text-center text-white">
                                    <span className="flex h-10 w-10 md:h-14 md:w-14 items-center justify-center rounded-full bg-white/15">
                                        <Plane className="h-6 w-6 md:h-9 md:w-9" strokeWidth={2.2} aria-hidden="true" />
                                    </span>
                                    <span
                                        className={cn(
                                            "font-heading font-extrabold leading-tight [font-stretch:85%]",
                                            isIndic ? "text-[14px] md:text-lg" : "text-base md:text-lg"
                                        )}
                                    >
                                        {t("toolIntl")}
                                    </span>
                                    <span
                                        className={cn(
                                            "font-medium leading-tight text-white/85",
                                            isIndic ? "text-[10px] md:text-xs" : "text-[11px] md:text-xs"
                                        )}
                                    >
                                        {t("toolIntlSub")}
                                    </span>
                                </span>
                            </Link>
                        </div>

                        {/* COD — money green */}
                        <div>
                            <Link
                                href={{ pathname: "/calculator", query: { mode: "cod" } }}
                                className="tap block h-full rounded-xl border-2 border-foreground bg-[#15803D] shadow-[0_3px_0_0_hsl(var(--foreground))] md:hover:-translate-y-0.5 transition-transform"
                            >
                                <span className="flex h-full min-h-[112px] md:min-h-[146px] flex-col items-center justify-center gap-1 md:gap-2 px-2 py-2.5 md:py-4 text-center text-white">
                                    <span className="flex h-10 w-10 md:h-14 md:w-14 items-center justify-center rounded-full bg-white/15">
                                        <Banknote className="h-6 w-6 md:h-9 md:w-9" strokeWidth={2.2} aria-hidden="true" />
                                    </span>
                                    <span
                                        className={cn(
                                            "font-heading font-extrabold leading-tight [font-stretch:85%]",
                                            isIndic ? "text-[14px] md:text-lg" : "text-base md:text-lg"
                                        )}
                                    >
                                        {t("toolCod")}
                                    </span>
                                    <span
                                        className={cn(
                                            "font-medium leading-tight text-white/85",
                                            isIndic ? "text-[10px] md:text-xs" : "text-[11px] md:text-xs"
                                        )}
                                    >
                                        {t("toolCodSub")}
                                    </span>
                                </span>
                            </Link>
                        </div>

                        {/* Local — SL Post red, full width on mobile, 3rd card on desktop */}
                        <div className="col-span-2 md:col-span-1">
                            <Link
                                href={{ pathname: "/calculator", query: { mode: "local" } }}
                                className="tap flex h-full items-center gap-2.5 rounded-xl border-2 border-foreground bg-primary px-3 py-2 text-white shadow-[0_3px_0_0_hsl(var(--foreground))] md:min-h-[146px] md:flex-col md:justify-center md:gap-2 md:px-2 md:py-4 md:text-center md:hover:-translate-y-0.5 transition-transform"
                            >
                                <span className="flex h-9 w-9 md:h-14 md:w-14 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                                    <Mail className="h-5 w-5 md:h-9 md:w-9" strokeWidth={2.2} aria-hidden="true" />
                                </span>
                                <span className="min-w-0 flex-1 md:flex-initial">
                                    <span
                                        className={cn(
                                            "block font-heading font-extrabold leading-tight [font-stretch:85%]",
                                            isIndic ? "text-[14px] md:text-lg" : "text-base md:text-lg"
                                        )}
                                    >
                                        {t("toolLocal")}
                                    </span>
                                    <span
                                        className={cn(
                                            "block font-medium leading-tight opacity-85 truncate md:whitespace-normal",
                                            isIndic ? "text-[10px] md:text-xs" : "text-[11px] md:text-xs"
                                        )}
                                    >
                                        {t("toolLocalSub")}
                                    </span>
                                </span>
                                <ChevronRight className="h-5 w-5 shrink-0 md:hidden" aria-hidden="true" />
                            </Link>
                        </div>
                    </div>

                    {/* Secondary tools — Directory & Guides side-by-side */}
                    <div className="mt-2.5 md:mt-3 grid grid-cols-2 gap-2.5 md:gap-4">
                        <div>
                            <Link
                                href="/browse"
                                className={cn(
                                    "tap flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-foreground bg-card px-2.5 py-2 font-bold shadow-[0_2px_0_0_hsl(var(--foreground))] hover:bg-secondary/30 md:hover:-translate-y-0.5 transition-all",
                                    isIndic ? "text-xs md:text-sm" : "text-sm"
                                )}
                            >
                                <FolderOpen className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.2} aria-hidden="true" />
                                <span className="truncate">{t("toolDirectory")}</span>
                            </Link>
                        </div>
                        <div>
                            <Link
                                href="/blog"
                                className={cn(
                                    "tap flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-foreground bg-card px-2.5 py-2 font-bold shadow-[0_2px_0_0_hsl(var(--foreground))] hover:bg-secondary/30 md:hover:-translate-y-0.5 transition-all",
                                    isIndic ? "text-xs md:text-sm" : "text-sm"
                                )}
                            >
                                <BookOpen className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.2} aria-hidden="true" />
                                <span className="truncate">{t("toolGuides")}</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

