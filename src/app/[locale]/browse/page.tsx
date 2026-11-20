import { Suspense } from "react";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import SearchDirectory from "@/components/SearchDirectory";
import type { InitialDirectoryData } from "@/components/directory/useDirectoryState";
import { Link } from "@/navigation";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { loadLocalOffices } from "@/lib/local-sqlite";
import {
    buildLocalizedAlternates,
    buildLocalizedUrl,
    getDefaultOpenGraphImages,
    getOgLocale,
    normalizePostalCode,
    slugifyDivision,
} from "@/lib/site";
import BrowseLoading from "./loading";

export const revalidate = 3600;

const INITIAL_SSR_LIMIT = 24;

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const title = "Browse Post Offices Directory";
    const description =
        "Search and browse Sri Lanka post offices alphabetically, by 5-digit postal code, division, office type, or postal service.";
    return {
        title,
        description,
        alternates: buildLocalizedAlternates("/browse", locale),
        openGraph: {
            title: `${title} | Lanka Post Directory`,
            description,
            url: buildLocalizedUrl("/browse", locale),
            locale: getOgLocale(locale),
            images: getDefaultOpenGraphImages(`${title} | Lanka Post Directory`),
        },
    };
}

async function getInitialBrowseData(): Promise<InitialDirectoryData> {
    const fromLocal = (): InitialDirectoryData => {
        const local = loadLocalOffices();
        const divSet = new Set<string>();
        for (const o of local) {
            const d = o.fields.find((f) => f.name === "Division")?.value?.trim();
            if (d) divSet.add(d);
        }
        const sorted = [...local].sort((a, b) => a.name.localeCompare(b.name));
        const slice = sorted.slice(0, INITIAL_SSR_LIMIT);
        return {
            offices: slice.map((o) => ({
                id: o.id,
                slug: o.slug,
                name: o.name,
                postalCode: normalizePostalCode(o.postalCode),
                services: o.services,
                fields: o.fields.map((f) => ({ name: f.name, value: f.value })),
            })),
            total: sorted.length,
            nextCursor: sorted.length > INITIAL_SSR_LIMIT ? INITIAL_SSR_LIMIT : null,
            divisions: Array.from(divSet).sort((a, b) => a.localeCompare(b)),
        };
    };

    if (!hasDatabaseUrl) {
        return fromLocal();
    }

    try {
        const [rows, total, divRows] = await Promise.all([
            prisma.postOffice.findMany({
                take: INITIAL_SSR_LIMIT,
                orderBy: { name: "asc" },
                include: { fields: { select: { name: true, value: true } } },
            }),
            prisma.postOffice.count(),
            prisma.postOfficeField.findMany({
                where: { name: "Division" },
                distinct: ["value"],
                select: { value: true },
            }),
        ]);

        if (rows.length === 0) return fromLocal();

        const divisions = Array.from(
            new Set(divRows.map((d) => d.value.trim()).filter(Boolean))
        ).sort((a, b) => a.localeCompare(b));

        return {
            offices: rows.map((o) => ({
                id: o.id,
                slug: o.slug,
                name: o.name,
                postalCode: normalizePostalCode(o.postalCode),
                services: o.services,
                fields: o.fields,
            })),
            total,
            nextCursor: total > INITIAL_SSR_LIMIT ? INITIAL_SSR_LIMIT : null,
            divisions,
        };
    } catch {
        return fromLocal();
    }
}

export default async function BrowsePage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    const initialData = await getInitialBrowseData();

    const divisionLinks = initialData.divisions
        .map((name) => ({ name, slug: slugifyDivision(name) }))
        .filter((d) => d.slug);

    return (
        <div className="flex flex-col min-h-screen bg-background">
            <Suspense fallback={<BrowseLoading />}>
                <div suppressHydrationWarning className="flex-1 w-full bg-background relative z-20">
                    <SearchDirectory initialData={initialData} />
                </div>
            </Suspense>

            {divisionLinks.length > 0 && (
                <section className="border-t-2 border-foreground/20 bg-card/40 py-8">
                    <div className="container mx-auto px-4">
                        <h2 className="font-heading text-lg sm:text-xl font-extrabold [font-stretch:82%] mb-3">
                            Browse Post Offices by Postal Division
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {divisionLinks.map((div) => (
                                <Link
                                    key={div.slug}
                                    href={`/district/${div.slug}`}
                                    className="rounded-full border-[1.5px] border-foreground/45 bg-card px-3 py-1.5 text-xs font-semibold hover:border-foreground hover:bg-secondary/35 transition-colors"
                                >
                                    {div.name}
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}
