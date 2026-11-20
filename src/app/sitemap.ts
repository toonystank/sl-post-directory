import { MetadataRoute } from "next";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { getAllPosts } from "@/lib/blog";
import { loadLocalOffices } from "@/lib/local-sqlite";
import { DEFAULT_RATE_CONFIG } from "@/lib/postage-rates";
import {
    POPULAR_WEIGHT_GRAMS,
    TOP_SEO_COUNTRY_CODES,
    countryToSlug,
    formatWeightSlug,
} from "@/lib/rates-seo";
import { buildLocalizedUrl } from "@/lib/site";

function slugifyDivision(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

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

async function getSitemapOfficesAndDivisions(): Promise<{
    offices: { slug: string; updatedAt: Date }[];
    divisions: string[];
}> {
    if (!hasDatabaseUrl) {
        const local = loadLocalOffices();
        const divSet = new Set<string>();
        for (const o of local) {
            const d = o.fields.find((f) => f.name === "Division")?.value;
            if (d) divSet.add(d);
        }
        return {
            offices: local.map((o) => ({ slug: o.slug, updatedAt: o.updatedAt })),
            divisions: Array.from(divSet),
        };
    }

    try {
        const [offices, divRows] = await Promise.all([
            prisma.postOffice.findMany({
                select: { slug: true, updatedAt: true },
            }),
            prisma.postOfficeField.findMany({
                where: { name: "Division" },
                distinct: ["value"],
                select: { value: true },
            }),
        ]);
        return {
            offices,
            divisions: divRows.map((d) => d.value).filter(Boolean),
        };
    } catch {
        const local = loadLocalOffices();
        return {
            offices: local.map((o) => ({ slug: o.slug, updatedAt: o.updatedAt })),
            divisions: [],
        };
    }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const now = new Date();
    const [{ offices, divisions }, posts] = await Promise.all([
        getSitemapOfficesAndDivisions(),
        getAllPosts(),
    ]);

    const coreUrls: MetadataRoute.Sitemap = [
        localizedEntry("/", { lastModified: now, changeFrequency: "daily", priority: 1.0 }),
        localizedEntry("/rates", { lastModified: now, changeFrequency: "weekly", priority: 0.95 }),
        localizedEntry("/track", { lastModified: now, changeFrequency: "weekly", priority: 0.9 }),
        localizedEntry("/calculator", { lastModified: now, changeFrequency: "weekly", priority: 0.9 }),
        localizedEntry("/browse", { lastModified: now, changeFrequency: "weekly", priority: 0.9 }),
        localizedEntry("/rates/local", { lastModified: now, changeFrequency: "monthly", priority: 0.85 }),
        localizedEntry("/rates/cod", { lastModified: now, changeFrequency: "monthly", priority: 0.85 }),
        localizedEntry("/blog", { lastModified: now, changeFrequency: "weekly", priority: 0.85 }),
        localizedEntry("/privacy", { lastModified: now, changeFrequency: "yearly", priority: 0.4 }),
    ];

    // Programmatic International Country Rate Pages (/rates/taiwan, /rates/united-kingdom, etc.)
    const countryUrls: MetadataRoute.Sitemap = DEFAULT_RATE_CONFIG.emsCountries.map((country) =>
        localizedEntry(`/rates/${countryToSlug(country.name)}`, {
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.85,
        })
    );

    // High-intent Country + Weight Pages (/rates/taiwan/1kg, /rates/uk/500g, etc.)
    const topCountryWeightUrls: MetadataRoute.Sitemap = [];
    for (const code of TOP_SEO_COUNTRY_CODES) {
        const country = DEFAULT_RATE_CONFIG.emsCountries.find((c) => c.code === code);
        if (!country) continue;
        const cSlug = countryToSlug(country.name);
        for (const grams of POPULAR_WEIGHT_GRAMS) {
            topCountryWeightUrls.push(
                localizedEntry(`/rates/${cSlug}/${formatWeightSlug(grams)}`, {
                    lastModified: now,
                    changeFrequency: "monthly",
                    priority: 0.85,
                })
            );
        }
    }

    // Division / District Hub Pages (/district/colombo, /district/kandy, etc.)
    const seenDivSlugs = new Set<string>();
    const divisionUrls: MetadataRoute.Sitemap = [];
    for (const div of divisions) {
        const slug = slugifyDivision(div);
        if (!slug || seenDivSlugs.has(slug)) continue;
        seenDivSlugs.add(slug);
        divisionUrls.push(
            localizedEntry(`/district/${slug}`, {
                lastModified: now,
                changeFrequency: "weekly",
                priority: 0.8,
            })
        );
    }

    // Blog articles
    const blogUrls: MetadataRoute.Sitemap = posts.map((post) =>
        localizedEntry(`/blog/${post.slug}`, {
            lastModified: new Date(post.date),
            changeFrequency: "monthly",
            priority: 0.75,
        })
    );

    // All Post Office detail pages
    const officeUrls: MetadataRoute.Sitemap = offices.map((office) =>
        localizedEntry(`/office/${office.slug}`, {
            lastModified: office.updatedAt,
            changeFrequency: "weekly",
            priority: 0.75,
        })
    );

    return [
        ...coreUrls,
        ...countryUrls,
        ...topCountryWeightUrls,
        ...divisionUrls,
        ...blogUrls,
        ...officeUrls,
    ];
}
