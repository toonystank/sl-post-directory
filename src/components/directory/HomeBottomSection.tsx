"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, ChevronDown, ChevronRight, Truck } from "lucide-react";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import CountryFlag from "@/components/brand/CountryFlag";
import Postmark from "@/components/brand/Postmark";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const POPULAR_RATE_LINKS = [
    { href: "/rates/taiwan", label: "Taiwan", flagCode: "TW" },
    { href: "/rates/united-kingdom", label: "United Kingdom", flagCode: "GB" },
    { href: "/rates/united-states", label: "United States", flagCode: "US" },
    { href: "/rates/australia", label: "Australia", flagCode: "AU" },
    { href: "/rates/united-arab-emirates", label: "UAE / Dubai", flagCode: "AE" },
    { href: "/rates/japan", label: "Japan", flagCode: "JP" },
    { href: "/rates/canada", label: "Canada", flagCode: "CA" },
    { href: "/rates/india", label: "India", flagCode: "IN" },
    { href: "/rates/local", label: "Local & SLP Courier", flagCode: "LK" },
    { href: "/rates/cod", label: "COD Charges", flagCode: "LK" },
];

const TRACKING_HISTORY_KEY = "lpd_tracking_history_v1";
const TERMINAL_STATUSES = new Set([
    "delivered",
    "settled",
    "returned",
    "not_found",
    "error",
]);

interface ActiveParcelPeek {
    barcode: string;
    statusLabel: string;
    statusCategory: string;
}

export interface DivisionLink {
    name: string;
    slug: string;
}

export interface FeaturedAlertPeek {
    slug: string;
    title: string;
    excerpt: string;
}

export default function HomeBottomSection({
    children,
    divisions = [],
    featuredAlert = null,
}: {
    children: React.ReactNode;
    divisions?: DivisionLink[];
    featuredAlert?: FeaturedAlertPeek | null;
}) {
    const t = useTranslations("Home");
    const [divisionsOpen, setDivisionsOpen] = React.useState(false);
    const [activeParcel, setActiveParcel] = React.useState<ActiveParcelPeek | null>(null);

    React.useEffect(() => {
        if (typeof window === "undefined") return;
        const readLatestParcel = () => {
            try {
                const raw = window.localStorage.getItem(TRACKING_HISTORY_KEY);
                if (!raw) {
                    setActiveParcel(null);
                    return;
                }
                const parsed = JSON.parse(raw) as Array<{
                    barcode?: string;
                    statusLabel?: string;
                    statusCategory?: string;
                }>;
                if (!Array.isArray(parsed) || parsed.length === 0) {
                    setActiveParcel(null);
                    return;
                }
                const valid = parsed.filter((e) => e?.barcode && e?.statusLabel);
                if (valid.length === 0) {
                    setActiveParcel(null);
                    return;
                }
                const chosen =
                    valid.find(
                        (e) =>
                            e.statusCategory && !TERMINAL_STATUSES.has(e.statusCategory)
                    ) ?? valid[0];
                setActiveParcel({
                    barcode: String(chosen.barcode),
                    statusLabel: String(chosen.statusLabel),
                    statusCategory: String(chosen.statusCategory || "in_transit"),
                });
            } catch {
                setActiveParcel(null);
            }
        };

        readLatestParcel();
        window.addEventListener("storage", readLatestParcel);
        window.addEventListener("focus", readLatestParcel);
        return () => {
            window.removeEventListener("storage", readLatestParcel);
            window.removeEventListener("focus", readLatestParcel);
        };
    }, []);

    return (
        <section className="bg-card/50 py-6 md:py-14 flex-1">
            <div className="container mx-auto px-4 space-y-6 md:space-y-10">
                {featuredAlert && (
                    <Link
                        href={`/blog/${featuredAlert.slug}`}
                        onClick={() => triggerHaptic("light")}
                        className="tap flex items-center gap-3 rounded-md border-2 border-foreground bg-primary/10 p-3.5 shadow-[3px_3px_0_0_hsl(var(--foreground))] hover:bg-primary/15 transition-colors"
                    >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-foreground bg-primary text-primary-foreground">
                            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary block">
                                {t("breakingAlert")}
                            </span>
                            <span className="font-heading text-sm sm:text-base font-extrabold text-foreground block truncate">
                                {featuredAlert.title}
                            </span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    </Link>
                )}

                {/* Active Parcel Peek Card (mobile + desktop when user has tracked parcels) */}
                {activeParcel && (
                    <Link
                        href={`/track?q=${encodeURIComponent(activeParcel.barcode)}`}
                        onClick={() => triggerHaptic("light")}
                        className="tap flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-[var(--shadow-elev-1)] hover:border-foreground/40 transition-colors"
                    >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary/25 text-foreground">
                            <Truck className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                                <span className="font-mono text-xs font-extrabold tracking-wide text-foreground truncate">
                                    {activeParcel.barcode}
                                </span>
                                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-tight text-secondary-foreground shrink-0">
                                    {activeParcel.statusLabel}
                                </span>
                            </span>
                            <span className="block text-xs text-muted-foreground truncate mt-0.5">
                                {activeParcel.barcode}
                            </span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Link>
                )}

                {/* Popular Postage Rate Links (horizontal snap carousel on mobile; wrap grid on desktop + Googlebot crawl hub) */}
                <div className="rounded-2xl border border-border md:border-2 md:border-foreground bg-card p-4 sm:p-5 shadow-[var(--shadow-elev-1)] md:shadow-none">
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <h2 className="font-heading text-lg sm:text-xl font-extrabold [font-stretch:82%]">
                            Popular Sri Lanka Post Rates
                        </h2>
                        <Link
                            href="/rates"
                            className="text-xs sm:text-sm font-semibold text-primary hover:underline shrink-0"
                        >
                            All countries &rarr;
                        </Link>
                    </div>
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide snap-carousel pb-1 md:flex-wrap md:overflow-visible md:pb-0">
                        {POPULAR_RATE_LINKS.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => triggerHaptic("light")}
                                className="tap inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border md:border-[1.5px] md:border-foreground/60 bg-background px-3 py-1.5 font-mono text-xs font-semibold hover:border-foreground hover:bg-secondary/35 transition-colors whitespace-nowrap"
                            >
                                <CountryFlag
                                    code={item.flagCode}
                                    decorative
                                    className="w-4 h-3 shrink-0"
                                />
                                <span>{item.label}</span>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Browse Post Offices by Postal Division (horizontal snap strip on mobile so all division hubs remain crawlable by Googlebot Smartphone; tap count pill to expand full grid) */}
                {divisions.length > 0 && (
                    <div className="rounded-2xl border border-border md:border-2 md:border-foreground bg-card p-4 sm:p-5 shadow-[var(--shadow-elev-1)] md:shadow-none">
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="font-heading text-lg sm:text-xl font-extrabold [font-stretch:82%]">
                                Browse Post Offices by Division
                            </h2>
                            <div className="flex items-center gap-2 shrink-0">
                                <Link
                                    href="/browse"
                                    className="hidden md:inline text-xs sm:text-sm font-semibold text-primary hover:underline shrink-0"
                                >
                                    All offices &rarr;
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => {
                                        triggerHaptic("selection");
                                        setDivisionsOpen((prev) => !prev);
                                    }}
                                    aria-expanded={divisionsOpen}
                                    className="tap md:hidden inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 font-mono text-[11px] font-bold text-foreground"
                                >
                                    <span>{divisions.length}</span>
                                    <ChevronDown
                                        className={cn(
                                            "h-3.5 w-3.5 transition-transform duration-150",
                                            divisionsOpen && "rotate-180"
                                        )}
                                        aria-hidden="true"
                                    />
                                </button>
                            </div>
                        </div>
                        <div
                            className={cn(
                                "gap-2 mt-3",
                                divisionsOpen
                                    ? "flex flex-wrap"
                                    : "flex overflow-x-auto scrollbar-hide snap-carousel pb-1 md:flex-wrap md:overflow-visible md:pb-0"
                            )}
                        >
                            {divisions.map((div) => (
                                <Link
                                    key={div.slug}
                                    href={`/district/${div.slug}`}
                                    className="tap shrink-0 whitespace-nowrap rounded-full border border-border md:border-[1.5px] md:border-foreground/50 bg-background px-3 py-1.5 text-xs font-semibold hover:border-foreground hover:bg-secondary/35 transition-colors"
                                >
                                    {div.name}
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    <div className="lg:col-span-2">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="font-heading text-2xl md:text-3xl font-extrabold [font-stretch:82%]">
                                {t("latestGuides")}
                            </h2>
                            <Link href="/blog" className="text-sm font-semibold text-primary hover:underline">
                                {t("viewAll")} &rarr;
                            </Link>
                        </div>
                        {children}
                    </div>

                    <div className="rounded-2xl md:rounded-md border border-border md:border-2 md:border-foreground bg-card p-6 shadow-[var(--shadow-elev-1)] md:shadow-[4px_4px_0_0_hsl(var(--foreground))] flex flex-col justify-between gap-4 overflow-hidden">
                        <div className="airmail-stripe -mx-6 -mt-6 mb-2 h-1.5" aria-hidden="true" />
                        <div className="flex items-start justify-between gap-3">
                            <h3 className="font-heading text-2xl font-extrabold [font-stretch:82%]">
                                {t("ratesTitle")}
                            </h3>
                            <Postmark code="LKR" size="sm" tone="red" rotate={-10} />
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {t("ratesBody")}
                        </p>
                        <Button asChild className="w-full rounded-xl md:rounded-md">
                            <Link href="/calculator">{t("ratesCta")}</Link>
                        </Button>
                    </div>
                </div>

                <p className="md:hidden mt-8 text-center text-xs text-muted-foreground">
                    {t("note")}
                </p>
            </div>
        </section>
    );
}
