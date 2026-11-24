import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Link } from "@/navigation";
import {
    POPULAR_WEIGHT_GRAMS,
    buildCountryTariffTable,
    buildInternationalRateSeoData,
    formatLkrPlain,
    formatWeightSlug,
    resolveCountryFromSlug,
} from "@/lib/rates-seo";
import { buildLocalizedAlternates, buildLocalizedUrl } from "@/lib/site";
import CountryFlag from "@/components/brand/CountryFlag";
import PostageCalculator from "@/components/PostageCalculator";

export const revalidate = 86400;

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string; country: string }>;
}): Promise<Metadata> {
    const { locale, country: rawCountry } = await params;
    const resolved = resolveCountryFromSlug(rawCountry);
    if (!resolved) {
        return { title: "Country Postage Rates Not Found" };
    }

    const seo1kg = buildInternationalRateSeoData(resolved.country, 1000, locale);
    const priceSnippet = seo1kg.cheapest
        ? `1kg from ${formatLkrPlain(seo1kg.cheapest.result.totalCost)}`
        : "2026 Tariffs";
    const title = `Sri Lanka Post Rates to ${resolved.country.name} (${priceSnippet}) — EMS, Air & Sea`;
    const description = `${seo1kg.answerSentence} Compare 250g, 500g, 1kg, 2kg, 5kg, and 10kg postage prices from Sri Lanka to ${resolved.country.name}.`;

    return {
        title,
        description,
        alternates: buildLocalizedAlternates(`/rates/${resolved.canonicalSlug}`, locale),
        openGraph: {
            title,
            description,
            url: buildLocalizedUrl(`/rates/${resolved.canonicalSlug}`, locale),
        },
    };
}

export default async function CountryRatesPage({
    params,
}: {
    params: Promise<{ locale: string; country: string }>;
}) {
    const { locale, country: rawCountry } = await params;
    const resolved = resolveCountryFromSlug(rawCountry);

    if (!resolved) {
        notFound();
    }

    if (!resolved.isCanonical) {
        const prefix = locale === "en" ? "" : `/${locale}`;
        permanentRedirect(`${prefix}/rates/${resolved.canonicalSlug}`);
    }

    const { country, canonicalSlug } = resolved;
    const seo1kg = buildInternationalRateSeoData(country, 1000, locale);
    const tariffRows = buildCountryTariffTable(country.code);

    const breadcrumbJsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: buildLocalizedUrl("/", locale) },
            { "@type": "ListItem", position: 2, name: "Postage Rates", item: buildLocalizedUrl("/rates", locale) },
            { "@type": "ListItem", position: 3, name: country.name, item: buildLocalizedUrl(`/rates/${canonicalSlug}`, locale) },
        ],
    };

    return (
        <article className="container mx-auto max-w-5xl px-4 py-5 md:py-10 space-y-8">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(breadcrumbJsonLd)
                        .replace(/</g, "\\u003c")
                        .replace(/>/g, "\\u003e")
                        .replace(/&/g, "\\u0026"),
                }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(seo1kg.faqJsonLd)
                        .replace(/</g, "\\u003c")
                        .replace(/>/g, "\\u003e")
                        .replace(/&/g, "\\u0026"),
                }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(seo1kg.serviceJsonLd)
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
                <span className="text-foreground font-semibold">{country.name}</span>
            </nav>

            {/* Answer-first Hero */}
            <header className="rounded-xl border-2 border-foreground bg-card overflow-hidden shadow-[4px_4px_0_0_hsl(var(--foreground))]">
                <div className="par-avion-stripe h-2" aria-hidden="true" />
                <div className="p-5 sm:p-7 space-y-4">
                    <div className="flex items-center gap-3">
                        <CountryFlag code={country.code} className="w-8 h-6 shrink-0" />
                        <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                            Sri Lanka &rarr; {country.name} · {seo1kg.zoneLabel}
                        </span>
                    </div>

                    <h1 className="display text-3xl sm:text-5xl">
                        Sri Lanka Post Rates to {country.name} (2026)
                    </h1>

                    <p className="rounded-lg border border-border bg-secondary/20 dark:bg-secondary/12 px-4 py-3 text-sm sm:text-base font-medium leading-relaxed">
                        {seo1kg.answerSentence}
                    </p>

                    {/* Weight Shortcut Pills */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="font-mono text-xs font-semibold uppercase text-muted-foreground mr-1">
                            Quick weights:
                        </span>
                        {POPULAR_WEIGHT_GRAMS.map((g) => {
                            const wSlug = formatWeightSlug(g);
                            return (
                                <Link
                                    key={wSlug}
                                    href={`/rates/${canonicalSlug}/${wSlug}`}
                                    className="tap rounded-full border-[1.5px] border-foreground bg-background px-3 py-1 font-mono text-xs font-bold hover:bg-secondary/40"
                                >
                                    {country.name} {wSlug}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </header>

            {/* Clean HTML Tariff Table (Google Featured Snippet friendly) */}
            <section aria-labelledby="tariff-table-heading">
                <h2 id="tariff-table-heading" className="font-heading text-xl sm:text-2xl font-extrabold [font-stretch:82%] mb-3">
                    {country.name} Postage Price Chart (LKR)
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
                            {tariffRows.map((row) => (
                                <tr key={row.weightSlug} className="hover:bg-secondary/15">
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
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Live Interactive Calculator pre-loaded */}
            <section aria-labelledby="interactive-calc-heading">
                <h2 id="interactive-calc-heading" className="font-heading text-xl sm:text-2xl font-extrabold [font-stretch:82%] mb-3">
                    Calculate Exact Weight to {country.name}
                </h2>
                <PostageCalculator
                    initialMode="ems"
                    initialCountry={country.code}
                    initialWeight="1000"
                />
            </section>

            {/* FAQs */}
            <section aria-labelledby="faq-heading" className="rounded-xl border-2 border-foreground bg-card p-5 sm:p-6 space-y-4">
                <h2 id="faq-heading" className="font-heading text-xl sm:text-2xl font-extrabold [font-stretch:82%]">
                    Frequently Asked Questions — Posting to {country.name}
                </h2>
                <dl className="divide-y divide-border">
                    {seo1kg.faqs.map((faq) => (
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
