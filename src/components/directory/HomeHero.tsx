"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
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
    return (
        <div role="radiogroup" aria-label={t("searchBy")} className={cn("inline-flex rounded-md border-[1.5px] border-foreground p-0.5 text-sm font-semibold", className)}>
            {(["name", "division"] as const).map((m) => (
                <button
                    key={m}
                    type="button"
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

export default function HomeHero({ search, searchMode: controlledMode, onModeChange, total = 4158, activeQuery, searchRef }: HomeHeroProps) {
    const t = useTranslations("Home");
    const router = useRouter();
    const [localQuery, setLocalQuery] = React.useState("");
    const [localMode, setLocalMode] = React.useState<SearchMode>("name");
    const localSearchContainerRef = React.useRef<HTMLDivElement>(null);

    const effectiveMode = controlledMode ?? localMode;
    const effectiveQuery = activeQuery ?? localQuery;

    const handleModeChange = (mode: SearchMode) => {
        if (onModeChange) {
            onModeChange(mode);
        } else {
            setLocalMode(mode);
        }
    };

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
                <div className="grid items-center gap-6 md:gap-8 md:grid-cols-[minmax(0,1fr)_auto] pt-2 pb-2 md:pt-10 md:pb-6 lg:pt-12 lg:pb-8">
                    {/* Copy + search */}
                    <div className="min-w-0">
                        <p className="label-mono hidden md:block mb-4">{t("kicker")}</p>

                        {/* Mobile Top Split: Headline + Name|Area toggle on left, PillarBox + Postmarks on right */}
                        <div className="flex items-end justify-between gap-2 md:block">
                            <div className="min-w-0 flex-1">
                                <h1 className="display text-[clamp(1.65rem,7vw,2.35rem)] leading-[1.02] md:text-6xl lg:text-7xl break-words">
                                    <span className="md:hidden">{t("headlineMobile")}</span>
                                    <span className="hidden md:inline">{t("headlineDesktop")}</span>
                                </h1>
                                <p className="hidden md:block mt-4 max-w-xl text-lg text-muted-foreground">{t("lede")}</p>

                                <div className="mt-3 md:mt-7 mb-1.5 md:mb-2">
                                    <ModeToggle searchMode={effectiveMode} onModeChange={handleModeChange} />
                                </div>
                            </div>

                            {/* Mobile illustration beside headline + ModeToggle (explicit dimensions, no overflow) */}
                            <div className="relative shrink-0 md:hidden w-[132px] h-[120px] flex items-end justify-center select-none pointer-events-none" aria-hidden="true">
                                <Postmark
                                    code="00100"
                                    size="md"
                                    boxSize={66}
                                    tone="ink"
                                    rotate={14}
                                    label="COLOMBO GPO"
                                    bottomLabel="ශ්‍රී ලංකා · SRI LANKA"
                                    date="17 NOV 26"
                                    time="AM 10.30"
                                    bay="A"
                                    className="absolute right-0 top-0.5 z-0 rounded-full bg-background"
                                />
                                <Postmark
                                    code="20000"
                                    size="md"
                                    boxSize={66}
                                    tone="ink"
                                    rotate={-16}
                                    label="KANDY"
                                    bottomLabel="ශ්‍රී ලංකා · SRI LANKA"
                                    date="17 NOV 26"
                                    time="PM 14.00"
                                    bay="C"
                                    className="absolute left-0 bottom-2 z-0 rounded-full bg-background"
                                />
                                <PillarBox className="relative z-10 w-[80px] h-auto" />
                            </div>
                        </div>

                        <div ref={searchRef ?? localSearchContainerRef} className="mt-1.5 md:mt-0 md:max-w-2xl">
                            {search ?? (
                                <SearchBar
                                    id="home-hero"
                                    query={localQuery}
                                    onQueryChange={(val) => setLocalQuery(val)}
                                    searchMode={effectiveMode}
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
                    <div className="relative hidden md:block w-[290px] lg:w-[330px]" aria-hidden="true">
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
                <div className="pt-3 pb-5 md:pt-2 md:pb-10">
                    <h2 className="font-heading text-lg md:text-xl font-extrabold [font-stretch:82%] mb-2.5 md:mb-3">{t("quickTools")}</h2>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 md:gap-4">
                        {/* International — airmail envelope */}
                        <Link
                            href={{ pathname: "/calculator", query: { mode: "intl" } }}
                            className="tap block rounded-xl border-2 border-foreground par-avion-stripe p-[5px] md:p-[6px] shadow-[0_3px_0_0_hsl(var(--foreground))]"
                        >
                            <span className="flex h-full min-h-[122px] md:min-h-[150px] flex-col items-center justify-center gap-1.5 md:gap-2 rounded-lg bg-[#1D4E9E] px-2 py-3 md:py-4 text-center text-white">
                                <span className="flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full bg-white/15">
                                    <Plane className="h-7 w-7 md:h-9 md:w-9" strokeWidth={2.2} aria-hidden="true" />
                                </span>
                                <span className="font-heading text-base md:text-lg font-extrabold leading-tight [font-stretch:85%]">{t("toolIntl")}</span>
                                <span className="text-[11px] font-medium leading-tight text-white/85">{t("toolIntlSub")}</span>
                            </span>
                        </Link>

                        {/* COD — money green */}
                        <Link
                            href={{ pathname: "/calculator", query: { mode: "cod" } }}
                            className="tap block rounded-xl border-2 border-foreground bg-[#15803D] shadow-[0_3px_0_0_hsl(var(--foreground))]"
                        >
                            <span className="flex h-full min-h-[122px] md:min-h-[150px] flex-col items-center justify-center gap-1.5 md:gap-2 px-2 py-3 md:py-4 text-center text-white">
                                <span className="flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full bg-white/15">
                                    <Banknote className="h-7 w-7 md:h-9 md:w-9" strokeWidth={2.2} aria-hidden="true" />
                                </span>
                                <span className="font-heading text-base md:text-lg font-extrabold leading-tight [font-stretch:85%]">{t("toolCod")}</span>
                                <span className="text-[11px] font-medium leading-tight text-white/85">{t("toolCodSub")}</span>
                            </span>
                        </Link>

                        {/* Local — SL Post red, full width on mobile, 3rd card on desktop */}
                        <Link
                            href={{ pathname: "/calculator", query: { mode: "local" } }}
                            className="tap col-span-2 md:col-span-1 flex items-center gap-3 rounded-xl border-2 border-foreground bg-primary px-3.5 py-2.5 text-white shadow-[0_3px_0_0_hsl(var(--foreground))] md:min-h-[150px] md:flex-col md:justify-center md:gap-2 md:px-2 md:py-4 md:text-center"
                        >
                            <span className="flex h-10 w-10 md:h-14 md:w-14 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                                <Mail className="h-5 w-5 md:h-9 md:w-9" strokeWidth={2.2} aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1 md:flex-initial">
                                <span className="block font-heading text-base md:text-lg font-extrabold leading-tight [font-stretch:85%]">{t("toolLocal")}</span>
                                <span className="block text-[11px] font-medium leading-tight opacity-85 truncate md:whitespace-normal">{t("toolLocalSub")}</span>
                            </span>
                            <ChevronRight className="h-5 w-5 shrink-0 md:hidden" aria-hidden="true" />
                        </Link>
                    </div>

                    {/* Secondary tools — Directory & Guides side-by-side */}
                    <div className="mt-2.5 md:mt-3 grid grid-cols-2 gap-2.5 md:gap-4">
                        <Link
                            href="/browse"
                            className="tap flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-card px-3 py-2.5 text-sm font-bold shadow-[0_2px_0_0_hsl(var(--foreground))] hover:bg-secondary/30 transition-colors"
                        >
                            <FolderOpen className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.2} aria-hidden="true" />
                            <span className="truncate">{t("toolDirectory")}</span>
                        </Link>
                        <Link
                            href="/blog"
                            className="tap flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-card px-3 py-2.5 text-sm font-bold shadow-[0_2px_0_0_hsl(var(--foreground))] hover:bg-secondary/30 transition-colors"
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
