import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Link } from "@/navigation";
import {
    POPULAR_WEIGHT_GRAMS,
    buildCountryTariffTable,
    buildInternationalRateSeoData,
    formatLkrPlain,
    formatWeightSlug,
    parseWeightSlug,
    resolveCountryFromSlug,
} from "@/lib/rates-seo";
import { buildLocalizedAlternates, buildLocalizedUrl } from "@/lib/site";
import CountryFlag from "@/components/brand/CountryFlag";
import PostageCalculator from "@/components/PostageCalculator";

export const revalidate = 86400;

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string; country: string; weight: string }>;
}): Promise<Metadata> {
    const { locale, country: rawCountry, weight: rawWeight } = await params;
    const resolvedCountry = resolveCountryFromSlug(rawCountry);
    const parsedWeight = parseWeightSlug(rawWeight);

    if (!resolvedCountry || !parsedWeight) {
        return { title: "Postage Rate Not Found" };
    }

    const seo = buildInternationalRateSeoData(
        resolvedCountry.country,
        parsedWeight.grams,
        locale
    );
    const headlinePrice = seo.cheapest
        ? formatLkrPlain(seo.cheapest.result.totalCost)
        : "";
    const title = `Sri Lanka Post ${resolvedCountry.country.name} ${seo.weightLabel} Price${headlinePrice ? ` (${headlinePrice})` : ""} — EMS & Air Parcel 2026`;
    const description = `${seo.answerSentence} Full 2026 Sri Lanka Post international shipping calculator for ${resolvedCountry.country.name}.`;
    const canonicalPath = `/rates/${resolvedCountry.canonicalSlug}/${parsedWeight.canonicalSlug}`;

    return {
        title,
        description,
        alternates: buildLocalizedAlternates(canonicalPath, locale),
        openGraph: {
            title,
            description,
            url: buildLocalizedUrl(canonicalPath, locale),
        },
    };
}

export default async function CountryWeightRatePage({
    params,
}: {
    params: Promise<{ locale: string; country: string; weight: string }>;
}) {
    const { locale, country: rawCountry, weight: rawWeight } = await params;
    const resolvedCountry = resolveCountryFromSlug(rawCountry);
    const parsedWeight = parseWeightSlug(rawWeight);

    if (!resolvedCountry || !parsedWeight) {
        notFound();
    }

    // Consolidate aliases & typos (e.g. /rates/thaiwan/1kg -> /rates/taiwan/1kg) with permanent redirect
    if (
        !resolvedCountry.isCanonical ||
        rawWeight.toLowerCase() !== parsedWeight.canonicalSlug
    ) {
        const prefix = locale === "en" ? "" : `/${locale}`;
        permanentRedirect(
            `${prefix}/rates/${resolvedCountry.canonicalSlug}/${parsedWeight.canonicalSlug}`
        );
    }

    const { country, canonicalSlug } = resolvedCountry;
    const seo = buildInternationalRateSeoData(country, parsedWeight.grams, locale);
    const tariffRows = buildCountryTariffTable(country.code);

    return (
        <article className="container mx-auto max-w-5xl px-4 py-5 md:py-10 space-y-8">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(seo.breadcrumbJsonLd)
                        .replace(/</g, "\\u003c")
                        .replace(/>/g, "\\u003e")
                        .replace(/&/g, "\\u0026"),
                }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(seo.faqJsonLd)
                        .replace(/</g, "\\u003c")
                        .replace(/>/g, "\\u003e")
                        .replace(/&/g, "\\u0026"),
                }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(seo.serviceJsonLd)
                        .replace(/</g, "\\u003c")
                        .replace(/>/g, "\\u003e")
                        .replace(/&/g, "\\u0026"),
                }}
            />

            {/* Breadcrumbs */}
            <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-2 text-xs font-mono text-muted-foreground">
                <Link href="/" className="hover:text-foreground">Home</Link>
                <span>/</span>
                <Link href="/rates" className="hover:text-foreground">Rates</Link>
                <span>/</span>
                <Link href={`/rates/${canonicalSlug}`} className="hover:text-foreground">{country.name}</Link>
                <span>/</span>
                <span className="text-foreground font-semibold">{seo.weightLabel}</span>
            </nav>

            {/* Answer-First Featured Snippet Card */}
            <header className="rounded-xl border-2 border-foreground bg-card overflow-hidden shadow-[4px_4px_0_0_hsl(var(--foreground))]">
                <div className="par-avion-stripe h-2" aria-hidden="true" />
                <div className="p-5 sm:p-7 space-y-4">
                    <div className="flex items-center gap-3">
                        <CountryFlag code={country.code} className="w-8 h-6 shrink-0" />
                        <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                            Sri Lanka &rarr; {country.name} · {seo.weightLabel} · {seo.zoneLabel}
                        </span>
                    </div>

                    <h1 className="display text-3xl sm:text-5xl">
                        Sri Lanka Post to {country.name} ({seo.weightLabel}) Price
                    </h1>

                    <p className="rounded-lg border-2 border-foreground/20 bg-secondary/25 dark:bg-secondary/12 px-4 py-3 text-sm sm:text-base font-semibold leading-relaxed">
                        {seo.answerSentence}
                    </p>

                    {/* Instant Service Price Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                        {seo.validQuotes.map((quote, idx) => (
                            <div
                                key={quote.service.id}
                                className={`rounded-lg border-2 p-3.5 ${
                                    idx === 0
                                        ? "border-foreground bg-secondary/20 dark:bg-secondary/12"
                                        : "border-border bg-background"
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-heading text-base font-extrabold">
                                        {quote.service.name}
                                    </span>
                                    {idx === 0 && (
                                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                                            Cheapest
                                        </span>
                                    )}
                                </div>
                                <p className="mt-1.5 font-mono text-2xl font-extrabold text-primary">
                                    {formatLkrPlain(quote.result.totalCost)}
                                </p>
                                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                                    Tier: {quote.result.tierLabel} · {quote.service.transport === "sea" ? "Sea Mail" : "Air Mail"}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Switch Weight Pills */}
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                        <span className="font-mono text-xs font-semibold uppercase text-muted-foreground mr-1">
                            Compare weight:
                        </span>
                        {POPULAR_WEIGHT_GRAMS.map((g) => {
                            const wSlug = formatWeightSlug(g);
                            const isActive = g === parsedWeight.grams;
                            return (
                                <Link
                                    key={wSlug}
                                    href={`/rates/${canonicalSlug}/${wSlug}`}
                                    aria-current={isActive ? "page" : undefined}
                                    className={`tap rounded-full border-[1.5px] px-3 py-1 font-mono text-xs font-bold ${
                                        isActive
                                            ? "border-foreground bg-foreground text-background"
                                            : "border-foreground/60 bg-background hover:bg-secondary/40"
                                    }`}
                                >
                                    {wSlug}
                                </Link>
                            );
                        })}
                        <Link
                            href={`/rates/${canonicalSlug}`}
                            className="tap rounded-full border border-border px-3 py-1 font-mono text-xs font-semibold text-muted-foreground hover:text-foreground"
                        >
                            All {country.name} rates &rarr;
                        </Link>
                    </div>
                </div>
            </header>

            {/* Embedded Interactive Calculator pre-loaded for this exact country & weight */}
            <section aria-labelledby="calc-heading">
                <h2 id="calc-heading" className="font-heading text-xl sm:text-2xl font-extrabold [font-stretch:82%] mb-3">
                    Adjust Weight or Currency ({country.name})
                </h2>
                <PostageCalculator
                    initialMode="ems"
                    initialCountry={country.code}
                    initialWeight={String(parsedWeight.grams)}
                />
            </section>

            {/* Full Weight Chart */}
            <section aria-labelledby="table-heading">
                <h2 id="table-heading" className="font-heading text-xl sm:text-2xl font-extrabold [font-stretch:82%] mb-3">
                    Full {country.name} Postage Rate Table (2026)
                </h2>
                <div className="overflow-x-auto rounded-xl border-2 border-foreground bg-card">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="border-b-2 border-foreground bg-muted/60 font-mono text-xs uppercase">
                                <th className="px-3 py-3">Weight</th>
                                <th className="px-3 py-3">Air Letter</th>
                                <th className="px-3 py-3">Air Parcel</th>
                                <th className="px-3 py-3">EMS Express</th>
                                <th className="px-3 py-3">Sea Parcel</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border font-mono">
                            {tariffRows.map((row) => {
                                const isCurrent = row.weightGrams === parsedWeight.grams;
                                return (
                                    <tr
                                        key={row.weightSlug}
                                        className={isCurrent ? "bg-secondary/30 font-bold" : "hover:bg-secondary/10"}
                                    >
                                        <td className="px-3 py-3 font-bold">
                                            <Link
                                                href={`/rates/${canonicalSlug}/${row.weightSlug}`}
                                                className="text-primary underline underline-offset-4"
                                            >
                                                {row.weightLabel}
                                            </Link>
                                        </td>
                                        <td className="px-3 py-3">
                                            {row.airLetterLkr ? formatLkrPlain(row.airLetterLkr) : "—"}
                                        </td>
                                        <td className="px-3 py-3">
                                            {row.airParcelLkr ? formatLkrPlain(row.airParcelLkr) : "—"}
                                        </td>
                                        <td className="px-3 py-3 font-semibold">
                                            {row.emsLkr ? formatLkrPlain(row.emsLkr) : "—"}
                                        </td>
                                        <td className="px-3 py-3">
                                            {row.seaParcelLkr ? formatLkrPlain(row.seaParcelLkr) : "—"}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* FAQs */}
            <section aria-labelledby="faq-heading" className="rounded-xl border-2 border-foreground bg-card p-5 sm:p-6 space-y-4">
                <h2 id="faq-heading" className="font-heading text-xl sm:text-2xl font-extrabold [font-stretch:82%]">
                    FAQ — Sending {seo.weightLabel} to {country.name}
                </h2>
                <dl className="divide-y divide-border">
                    {seo.faqs.map((faq) => (
                        <div key={faq.question} className="py-3.5 first:pt-0 last:pb-0">
                            <dt className="font-bold text-foreground mb-1">{faq.question}</dt>
                            <dd className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</dd>
                        </div>
                    ))}
                </dl>
            </section>
        </article>
    );
}
