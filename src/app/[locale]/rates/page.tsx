import type { Metadata } from "next";
import { Link } from "@/navigation";
import { Plane, Banknote, Mail, ArrowRight, Globe } from "lucide-react";
import { DEFAULT_RATE_CONFIG, calculateAllInternationalServices } from "@/lib/postage-rates";
import {
    TOP_SEO_COUNTRY_CODES,
    POPULAR_WEIGHT_GRAMS,
    countryToSlug,
    formatLkrPlain,
    formatWeightSlug,
} from "@/lib/rates-seo";
import { buildLocalizedAlternates, buildLocalizedUrl } from "@/lib/site";
import CountryFlag from "@/components/brand/CountryFlag";

export const revalidate = 86400;

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const title = "Sri Lanka Post Postage Rates 2026 — International, EMS, COD & Local";
    const description =
        "Compare official 2026 Sri Lanka Post international air mail, EMS Express, sea parcel, domestic SLP Courier, and Cash on Delivery (COD) postage prices by country and weight.";
    return {
        title,
        description,
        alternates: buildLocalizedAlternates("/rates", locale),
        openGraph: {
            title,
            description,
            url: buildLocalizedUrl("/rates", locale),
        },
    };
}

export default async function RatesHubPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;

    const topCountries = TOP_SEO_COUNTRY_CODES.map((code) =>
        DEFAULT_RATE_CONFIG.emsCountries.find((c) => c.code === code)
    ).filter((c): c is NonNullable<typeof c> => Boolean(c));

    const allCountriesSorted = [...DEFAULT_RATE_CONFIG.emsCountries].sort((a, b) =>
        a.name.localeCompare(b.name)
    );

    const breadcrumbJsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: buildLocalizedUrl("/", locale) },
            { "@type": "ListItem", position: 2, name: "Postage Rates", item: buildLocalizedUrl("/rates", locale) },
        ],
    };

    return (
        <div className="container mx-auto max-w-5xl px-4 py-6 md:py-10 space-y-8">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />

            {/* Header */}
            <header className="rounded-xl border-2 border-foreground bg-card overflow-hidden shadow-[4px_4px_0_0_hsl(var(--foreground))]">
                <div className="airmail-stripe h-1.5" aria-hidden="true" />
                <div className="p-5 sm:p-7">
                    <p className="font-mono text-xs font-bold uppercase tracking-widest text-primary mb-2">
                        2026 Sri Lanka Post Tariff Directory
                    </p>
                    <h1 className="display text-3xl sm:text-5xl">
                        Sri Lanka Post Postage Rates
                    </h1>
                    <p className="mt-2.5 text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">
                        Browse official Air Parcel, EMS Express, Sea Mail, Domestic, and Cash on Delivery (COD) rates from Sri Lanka to {allCountriesSorted.length}+ destinations worldwide.
                    </p>

                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Link
                            href="/calculator"
                            className="tap flex items-center justify-between gap-2 rounded-lg border-2 border-foreground bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-[0_2px_0_0_hsl(var(--foreground))]"
                        >
                            <span className="flex items-center gap-2">
                                <Plane className="h-4 w-4" aria-hidden="true" />
                                Interactive Calculator
                            </span>
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                        <Link
                            href="/rates/local"
                            className="tap flex items-center justify-between gap-2 rounded-lg border-2 border-foreground bg-background px-4 py-3 text-sm font-bold hover:bg-secondary/30"
                        >
                            <span className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-primary" aria-hidden="true" />
                                Local & SLP Courier Rates
                            </span>
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                        <Link
                            href="/rates/cod"
                            className="tap flex items-center justify-between gap-2 rounded-lg border-2 border-foreground bg-background px-4 py-3 text-sm font-bold hover:bg-secondary/30"
                        >
                            <span className="flex items-center gap-2">
                                <Banknote className="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                                COD Fee Breakdown
                            </span>
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                    </div>
                </div>
            </header>

            {/* Popular Destinations with instant 1kg price */}
            <section aria-labelledby="popular-destinations-heading">
                <div className="flex items-center justify-between gap-2 mb-4">
                    <h2 id="popular-destinations-heading" className="font-heading text-2xl font-extrabold [font-stretch:82%]">
                        Popular International Destinations (1 kg Starting Rates)
                    </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {topCountries.map((country) => {
                        const slug = countryToSlug(country.name);
                        const quotes = calculateAllInternationalServices(DEFAULT_RATE_CONFIG, country.code, 1000);
                        const valid = quotes
                            .filter((q) => q.available && !q.result.error && !q.result.exceedsMaxWeight)
                            .sort((a, b) => a.result.totalCost - b.result.totalCost);
                        const cheapest = valid[0];
                        const ems = valid.find((q) => q.service.id === "ems");

                        return (
                            <div
                                key={country.code}
                                className="rounded-xl border-2 border-foreground bg-card p-4 shadow-[0_2px_0_0_hsl(var(--foreground))] flex flex-col justify-between gap-3"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <Link
                                        href={`/rates/${slug}`}
                                        className="group flex items-center gap-2.5 min-w-0"
                                    >
                                        <CountryFlag code={country.code} className="w-6 h-4 shrink-0" />
                                        <span className="font-heading text-lg font-extrabold truncate group-hover:text-primary">
                                            {country.name}
                                        </span>
                                    </Link>
                                    {cheapest && (
                                        <span className="shrink-0 rounded-md bg-secondary/40 px-2 py-0.5 font-mono text-xs font-bold">
                                            1kg: {formatLkrPlain(cheapest.result.totalCost)}
                                        </span>
                                    )}
                                </div>

                                {ems && (
                                    <p className="text-xs text-muted-foreground font-mono">
                                        EMS 1kg: {formatLkrPlain(ems.result.totalCost)} · Max {Math.round((country.emsMaxWeight ?? 20000) / 1000)}kg
                                    </p>
                                )}

                                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border">
                                    {POPULAR_WEIGHT_GRAMS.map((g) => {
                                        const wSlug = formatWeightSlug(g);
                                        return (
                                            <Link
                                                key={wSlug}
                                                href={`/rates/${slug}/${wSlug}`}
                                                className="tap rounded-md border border-foreground/40 bg-background px-2 py-1 font-mono text-xs font-semibold hover:bg-secondary/40"
                                            >
                                                {wSlug}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* All Destinations A–Z */}
            <section aria-labelledby="all-countries-heading" className="pt-2">
                <h2 id="all-countries-heading" className="font-heading text-2xl font-extrabold [font-stretch:82%] mb-4 flex items-center gap-2">
                    <Globe className="h-5 w-5 text-primary" aria-hidden="true" />
                    All International Destinations ({allCountriesSorted.length})
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {allCountriesSorted.map((country) => (
                        <Link
                            key={country.code}
                            href={`/rates/${countryToSlug(country.name)}`}
                            className="tap flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:border-foreground hover:bg-secondary/20"
                        >
                            <CountryFlag code={country.code} className="w-5 h-3.5 shrink-0" />
                            <span className="truncate">{country.name}</span>
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
}
