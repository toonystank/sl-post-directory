import { MetadataRoute } from "next";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { getAllPosts } from "@/lib/blog";
import { loadLocalOffices } from "@/lib/local-sqlite";
import { DEFAULT_RATE_CONFIG } from "@/lib/postage-rates";
import { countryToSlug } from "@/lib/rates-seo";
import { classifyOfficeSitemapTier, sortOfficesForSitemap } from "@/lib/seo-office";
import { buildLocalizedUrl, slugifyDivision } from "@/lib/site";

export const revalidate = 3600;

/** Stable tariff revision timestamp so Google trusts sitemap `lastmod` values instead of ignoring constantly shifting timestamps. */
const TARIFF_REVISION_DATE = new Date("2026-02-09T00:00:00.000Z");
const STATIC_LEGAL_DATE = new Date("2026-11-01T00:00:00.000Z");

/**
 * Emits a trilingual sitemap entry (`en`, `si`, `ta`, `x-default`).
 * Use ONLY for genuinely translated trilingual hub routes so Google doesn't waste
 * crawl budget indexing identical English text under `/si` and `/ta`.
 */
function localizedEntry(
    pathname: string,
    opts: {
        lastModified: Date;
        changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
        priority: number;
    }
): MetadataRoute.Sitemap[number] {
    return {
        url: buildLocalizedUrl(pathname, "en"),
        lastModified: opts.lastModified,
        changeFrequency: opts.changeFrequency,
        priority: opts.priority,
        alternates: {
            languages: {
                en: buildLocalizedUrl(pathname, "en"),
                si: buildLocalizedUrl(pathname, "si"),
                ta: buildLocalizedUrl(pathname, "ta"),
                "x-default": buildLocalizedUrl(pathname, "en"),
            },
        },
    };
}

/**
 * Emits a clean canonical single-URL sitemap entry without duplicate locale alternates.
 */
function canonicalEntry(
    pathname: string,
    opts: {
        lastModified: Date;
        changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
        priority: number;
    }
): MetadataRoute.Sitemap[number] {
    return {
        url: buildLocalizedUrl(pathname, "en"),
        lastModified: opts.lastModified,
        changeFrequency: opts.changeFrequency,
        priority: opts.priority,
    };
}

interface SitemapOfficeRow {
    slug: string;
    name: string;
    postalCode: string;
    type: string | null;
    updatedAt: Date;
}

function getLocalSitemapData(): {
    offices: SitemapOfficeRow[];
    divisions: string[];
} {
    const local = loadLocalOffices();
    const divSet = new Set<string>();
    const offices: SitemapOfficeRow[] = local.map((o) => {
        const d = o.fields.find((f) => f.name === "Division")?.value?.trim();
        if (d) divSet.add(d);
        const type = o.fields.find((f) => f.name === "Type")?.value?.trim() || null;
        return {
            slug: o.slug,
            name: o.name,
            postalCode: o.postalCode,
            type,
            updatedAt: o.updatedAt,
        };
    });
    return { offices, divisions: Array.from(divSet) };
}

async function getSitemapOfficesAndDivisions(): Promise<{
    offices: SitemapOfficeRow[];
    divisions: string[];
}> {
    if (!hasDatabaseUrl) {
        return getLocalSitemapData();
    }

    try {
        const [offices, divRows] = await Promise.all([
            prisma.postOffice.findMany({
                select: {
                    slug: true,
                    name: true,
                    postalCode: true,
                    updatedAt: true,
                    fields: {
                        where: { name: "Type" },
                        select: { value: true },
                    },
                },
            }),
            prisma.postOfficeField.findMany({
                where: { name: "Division" },
                distinct: ["value"],
                select: { value: true },
            }),
        ]);
        return {
            offices: offices.map((o) => ({
                slug: o.slug,
                name: o.name,
                postalCode: o.postalCode,
                type: o.fields[0]?.value?.trim() || null,
                updatedAt: o.updatedAt,
            })),
            divisions: divRows.map((d) => d.value).filter(Boolean),
        };
    } catch {
        return getLocalSitemapData();
    }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const [{ offices, divisions }, posts] = await Promise.all([
        getSitemapOfficesAndDivisions(),
        getAllPosts(),
    ]);

    const latestOfficeUpdate = offices.reduce<Date>(
        (latest, o) => (o.updatedAt > latest ? o.updatedAt : latest),
        TARIFF_REVISION_DATE
    );
    const latestPostDate = posts.reduce<Date>(
        (latest, p) => {
            const d = new Date(p.date);
            return d > latest ? d : latest;
        },
        TARIFF_REVISION_DATE
    );

    // 1. Genuinely trilingual core hub pages (EN / SI / TA alternates)
    const trilingualCoreUrls: MetadataRoute.Sitemap = [
        localizedEntry("/", { lastModified: latestOfficeUpdate, changeFrequency: "daily", priority: 1.0 }),
        localizedEntry("/calculator", { lastModified: TARIFF_REVISION_DATE, changeFrequency: "weekly", priority: 0.95 }),
        localizedEntry("/track", { lastModified: latestOfficeUpdate, changeFrequency: "weekly", priority: 0.9 }),
        localizedEntry("/browse", { lastModified: latestOfficeUpdate, changeFrequency: "weekly", priority: 0.9 }),
        localizedEntry("/blog", { lastModified: latestPostDate, changeFrequency: "weekly", priority: 0.85 }),
        localizedEntry("/privacy", { lastModified: STATIC_LEGAL_DATE, changeFrequency: "yearly", priority: 0.3 }),
    ];

    // 2. Canonical English utility & info pages (avoids duplicate si/ta crawl waste)
    const englishCoreUrls: MetadataRoute.Sitemap = [
        canonicalEntry("/rates", { lastModified: TARIFF_REVISION_DATE, changeFrequency: "monthly", priority: 0.95 }),
        canonicalEntry("/rates/local", { lastModified: TARIFF_REVISION_DATE, changeFrequency: "monthly", priority: 0.9 }),
        canonicalEntry("/rates/cod", { lastModified: TARIFF_REVISION_DATE, changeFrequency: "monthly", priority: 0.9 }),
        canonicalEntry("/about", { lastModified: STATIC_LEGAL_DATE, changeFrequency: "monthly", priority: 0.5 }),
        canonicalEntry("/terms", { lastModified: STATIC_LEGAL_DATE, changeFrequency: "yearly", priority: 0.3 }),
    ];

    // 3. Division / District Hub Pages (30 high-value crawl hubs linking to all 4,000+ offices)
    const seenDivSlugs = new Set<string>();
    const divisionUrls: MetadataRoute.Sitemap = [];
    for (const div of [...divisions].sort((a, b) => a.localeCompare(b))) {
        const slug = slugifyDivision(div);
        if (!slug || seenDivSlugs.has(slug)) continue;
        seenDivSlugs.add(slug);
        divisionUrls.push(
            canonicalEntry(`/district/${slug}`, {
                lastModified: latestOfficeUpdate,
                changeFrequency: "weekly",
                priority: 0.85,
            })
        );
    }

    // 4. Canonical International Country Rate Pages (52 rich country hubs with full weight tables;
    //    weight sub-variants like /rates/taiwan/500g canonicalize to /rates/taiwan to avoid thin-page bloat)
    const countryUrls: MetadataRoute.Sitemap = DEFAULT_RATE_CONFIG.emsCountries.map((country) =>
        canonicalEntry(`/rates/${countryToSlug(country.name)}`, {
            lastModified: TARIFF_REVISION_DATE,
            changeFrequency: "monthly",
            priority: 0.85,
        })
    );

    // 5. Blog articles & postal alerts
    const blogUrls: MetadataRoute.Sitemap = posts.map((post) =>
        canonicalEntry(`/blog/${post.slug}`, {
            lastModified: new Date(post.date),
            changeFrequency: "monthly",
            priority: 0.8,
        })
    );

    // 6. Post Office detail pages ordered by search value:
    //    Tier 1 (Main POs & RMSCs) -> Tier 2 (Coded SPOs) -> Tier 3 (Uncoded SPOs)
    const sortedOffices = sortOfficesForSitemap(offices);
    const officeUrls: MetadataRoute.Sitemap = sortedOffices.map((office) => {
        const { priority, changeFrequency } = classifyOfficeSitemapTier(office);
        return canonicalEntry(`/office/${office.slug}`, {
            lastModified: office.updatedAt,
            changeFrequency,
            priority,
        });
    });

    return [
        ...trilingualCoreUrls,
        ...englishCoreUrls,
        ...divisionUrls,
        ...countryUrls,
        ...blogUrls,
        ...officeUrls,
    ];
}
