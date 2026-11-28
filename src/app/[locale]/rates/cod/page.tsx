import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/navigation";
import {
    DEFAULT_RATE_CONFIG,
    calculateCodPostage,
    formatWeightLabel,
} from "@/lib/postage-rates";
import { formatLkrPlain } from "@/lib/rates-seo";
import { safeJsonLd } from "@/lib/security";
import { buildEnglishCanonicalAlternates, buildLocalizedUrl } from "@/lib/site";
import PostageCalculator from "@/components/PostageCalculator";

export const revalidate = 86400;

const SAMPLE_COD_CASES = [
    { weightGrams: 250, codAmount: 2500 },
    { weightGrams: 500, codAmount: 5000 },
    { weightGrams: 1000, codAmount: 5000 },
    { weightGrams: 1000, codAmount: 10000 },
    { weightGrams: 2000, codAmount: 15000 },
    { weightGrams: 5000, codAmount: 25000 },
];

export async function generateMetadata(): Promise<Metadata> {
    const title = "Sri Lanka Post COD (Cash on Delivery) Charges & Calculator 2026";
    const description =
        "Calculate Sri Lanka Post Cash on Delivery (COD) courier fee, money order commission, COD service fee, and exact net payout for online sellers.";
    return {
        title,
        description,
        alternates: buildEnglishCanonicalAlternates("/rates/cod"),
        openGraph: {
            title,
            description,
            url: buildLocalizedUrl("/rates/cod", "en"),
        },
    };
}

export default async function CodRatesPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);

    const sampleRows = SAMPLE_COD_CASES.map((item) => ({
        ...item,
        weightLabel: formatWeightLabel(item.weightGrams),
        result: calculateCodPostage(DEFAULT_RATE_CONFIG, item.weightGrams, item.codAmount),
    }));

    const breadcrumbJsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: buildLocalizedUrl("/", locale) },
            { "@type": "ListItem", position: 2, name: "Postage Rates", item: buildLocalizedUrl("/rates", locale) },
            { "@type": "ListItem", position: 3, name: "COD Rates", item: buildLocalizedUrl("/rates/cod", locale) },
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
                    <p className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        Sri Lanka Post E-Commerce COD Calculator (2026)
                    </p>
                    <h1 className="display text-3xl sm:text-5xl">
                        Sri Lanka Post COD Charges &amp; Net Payout
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">
                        Exact breakdown of Sri Lanka Post Cash on Delivery (COD) charges: SLP Courier fee, Money Order commission, COD handling fee, and your net remittance.
                    </p>
                </div>
            </header>

            <section aria-labelledby="cod-calc-heading">
                <h2 id="cod-calc-heading" className="font-heading text-xl sm:text-2xl font-extrabold [font-stretch:82%] mb-3">
                    Calculate Your COD Fee &amp; Payout
                </h2>
                <PostageCalculator initialMode="cod" initialWeight="1000" initialCodAmount="5000" />
            </section>

            <section aria-labelledby="cod-table-heading">
                <h2 id="cod-table-heading" className="font-heading text-xl sm:text-2xl font-extrabold [font-stretch:82%] mb-3">
                    Sample Sri Lanka Post COD Fee Table (LKR)
                </h2>
                <div className="overflow-x-auto rounded-xl border-2 border-foreground bg-card">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="border-b-2 border-foreground bg-muted/60 font-mono text-xs uppercase">
                                <th className="px-3 py-3">Weight</th>
                                <th className="px-3 py-3">COD Amount</th>
                                <th className="px-3 py-3">Total COD Fee</th>
                                <th className="px-3 py-3">Net Payout</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border font-mono">
                            {sampleRows.map((row) => (
                                <tr key={`${row.weightGrams}-${row.codAmount}`} className="hover:bg-secondary/15">
                                    <td className="px-3 py-3 font-bold">{row.weightLabel}</td>
                                    <td className="px-3 py-3">{formatLkrPlain(row.codAmount)}</td>
                                    <td className="px-3 py-3 text-primary font-semibold">
                                        {formatLkrPlain(row.result.totalCost)}
                                    </td>
                                    <td className="px-3 py-3 font-bold text-emerald-700 dark:text-emerald-400">
                                        {formatLkrPlain(row.result.netRemittance)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <div className="flex flex-wrap gap-3 text-sm font-semibold">
                <Link href="/rates/local" className="text-primary hover:underline">
                    View Domestic &amp; SLP Courier Rates &rarr;
                </Link>
                <Link href="/rates" className="text-primary hover:underline">
                    View International Rates by Country &rarr;
                </Link>
            </div>
        </article>
    );
}
