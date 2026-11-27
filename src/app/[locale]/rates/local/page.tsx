import type { Metadata } from "next";
import { Link } from "@/navigation";
import {
    DEFAULT_RATE_CONFIG,
    calculateAllDomesticServices,
    formatWeightLabel,
} from "@/lib/postage-rates";
import { formatLkrPlain } from "@/lib/rates-seo";
import { safeJsonLd } from "@/lib/security";
import { buildLocalizedAlternates, buildLocalizedUrl } from "@/lib/site";
import PostageCalculator from "@/components/PostageCalculator";

export const revalidate = 86400;

const LOCAL_WEIGHTS = [30, 100, 250, 500, 1000, 2000, 5000, 10000];

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const title = "Sri Lanka Post Domestic & SLP Courier Rates 2026 — Letters & Parcels";
    const description =
        "Official 2026 Sri Lanka Post local postage rates for Ordinary Letters, Registered Mail, Parcels, and SL Post (SLP) Courier by weight.";
    return {
        title,
        description,
        alternates: buildLocalizedAlternates("/rates/local", locale),
        openGraph: {
            title,
            description,
            url: buildLocalizedUrl("/rates/local", locale),
        },
    };
}

export default async function LocalRatesPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;

    const rows = LOCAL_WEIGHTS.map((weightGrams) => {
        const quotes = calculateAllDomesticServices(DEFAULT_RATE_CONFIG, weightGrams, {
            registered: false,
            arReceipt: false,
        });
        const findPrice = (id: string) => {
            const q = quotes.find((item) => item.service.id === id && !item.result.error && !item.result.exceedsMaxWeight);
            return q ? q.result.totalCost : null;
        };
        return {
            weightGrams,
            label: formatWeightLabel(weightGrams),
            letter: findPrice("letter"),
            parcel: findPrice("parcel"),
            courier: findPrice("courier"),
            openArticle: findPrice("open_article"),
        };
    });

    const breadcrumbJsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: buildLocalizedUrl("/", locale) },
            { "@type": "ListItem", position: 2, name: "Postage Rates", item: buildLocalizedUrl("/rates", locale) },
            { "@type": "ListItem", position: 3, name: "Local Rates", item: buildLocalizedUrl("/rates/local", locale) },
        ],
    };

    return (
        <article className="container mx-auto max-w-5xl px-4 py-5 md:py-10 space-y-8">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }}
            />

            <header className="rounded-xl border-2 border-foreground bg-card overflow-hidden shadow-[4px_4px_0_0_hsl(var(--foreground))]">
                <div className="airmail-stripe h-1.5" aria-hidden="true" />
                <div className="p-5 sm:p-7 space-y-3">
                    <p className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                        Domestic Sri Lanka Post Tariffs (2026 Revision)
                    </p>
                    <h1 className="display text-3xl sm:text-5xl">
                        Sri Lanka Post Local &amp; SLP Courier Rates
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">
                        Compare domestic Sri Lanka Post letter, registered post, ordinary parcel, and SL Post (SLP) Speed Post Courier prices across weights.
                    </p>
                </div>
            </header>

            <section aria-labelledby="local-table-heading">
                <h2 id="local-table-heading" className="font-heading text-xl sm:text-2xl font-extrabold [font-stretch:82%] mb-3">
                    Domestic Postage Rate Chart (LKR)
                </h2>
                <div className="overflow-x-auto rounded-xl border-2 border-foreground bg-card">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="border-b-2 border-foreground bg-muted/60 font-mono text-xs uppercase">
                                <th className="px-3 py-3">Weight</th>
                                <th className="px-3 py-3">Ordinary Letter</th>
                                <th className="px-3 py-3">Open Article</th>
                                <th className="px-3 py-3">Local Parcel</th>
                                <th className="px-3 py-3">SLP Courier</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border font-mono">
                            {rows.map((row) => (
                                <tr key={row.weightGrams} className="hover:bg-secondary/15">
                                    <td className="px-3 py-3 font-bold">{row.label}</td>
                                    <td className="px-3 py-3">{row.letter ? formatLkrPlain(row.letter) : "—"}</td>
                                    <td className="px-3 py-3">{row.openArticle ? formatLkrPlain(row.openArticle) : "—"}</td>
                                    <td className="px-3 py-3">{row.parcel ? formatLkrPlain(row.parcel) : "—"}</td>
                                    <td className="px-3 py-3 font-semibold text-primary">
                                        {row.courier ? formatLkrPlain(row.courier) : "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section aria-labelledby="local-calc-heading">
                <h2 id="local-calc-heading" className="font-heading text-xl sm:text-2xl font-extrabold [font-stretch:82%] mb-3">
                    Interactive Local Postage Calculator
                </h2>
                <PostageCalculator initialMode="domestic" initialWeight="250" />
            </section>

            <div className="flex flex-wrap gap-3 text-sm font-semibold">
                <Link href="/rates/cod" className="text-primary hover:underline">
                    View Cash on Delivery (COD) Rates &rarr;
                </Link>
                <Link href="/rates" className="text-primary hover:underline">
                    View International Rates by Country &rarr;
                </Link>
            </div>
        </article>
    );
}
