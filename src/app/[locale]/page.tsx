import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import HomeHero from "@/components/directory/HomeHero";
import HomeBottomSection, { type DivisionLink } from "@/components/directory/HomeBottomSection";
import BlogCard from "@/components/BlogCard";
import { getFeaturedAlert, getLatestPosts } from "@/lib/blog";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { loadLocalOffices } from "@/lib/local-sqlite";
import { safeJsonLd } from "@/lib/security";
import {
    buildLocalizedAlternates,
    buildLocalizedUrl,
    getDefaultOpenGraphImages,
    getOgLocale,
    getSiteUrl,
    slugifyDivision,
} from "@/lib/site";

export const revalidate = 3600;

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    return {
        alternates: buildLocalizedAlternates("/", locale),
        openGraph: {
            url: buildLocalizedUrl("/", locale),
            locale: getOgLocale(locale),
            images: getDefaultOpenGraphImages(),
        },
    };
}

function dedupeDivisionLinks(names: string[]): DivisionLink[] {
    const seen = new Set<string>();
    const list: DivisionLink[] = [];
    for (const raw of names) {
        const name = raw.trim();
        const slug = slugifyDivision(name);
        if (!name || !slug || seen.has(slug)) continue;
        seen.add(slug);
        list.push({ name, slug });
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
}

async function getHomeDirectoryStats(): Promise<{
    totalOffices: number;
    divisions: DivisionLink[];
}> {
    const fallbackFromLocal = () => {
        const local = loadLocalOffices();
        const divNames = local
            .map((o) => o.fields.find((f) => f.name === "Division")?.value || "")
            .filter(Boolean);
        return {
            totalOffices: local.length || 4024,
            divisions: dedupeDivisionLinks(divNames),
        };
    };

    if (!hasDatabaseUrl) {
        return fallbackFromLocal();
    }
    try {
        const [count, divRows] = await Promise.all([
            prisma.postOffice.count(),
            prisma.postOfficeField.findMany({
                where: { name: "Division" },
                distinct: ["value"],
                select: { value: true },
            }),
        ]);
        const divisions = dedupeDivisionLinks(divRows.map((d) => d.value));
        if (count > 0 && divisions.length > 0) {
            return { totalOffices: count, divisions };
        }
        return fallbackFromLocal();
    } catch {
        return fallbackFromLocal();
    }
}

export default async function Home({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    const [posts, featuredAlert, { totalOffices, divisions }] = await Promise.all([
        getLatestPosts(2),
        getFeaturedAlert(),
        getHomeDirectoryStats(),
    ]);

    const siteUrl = getSiteUrl();
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Lanka Post Directory",
        url: buildLocalizedUrl("/", locale),
        potentialAction: {
            "@type": "SearchAction",
            target: `${siteUrl}/browse?q={search_term_string}`,
            "query-input": "required name=search_term_string",
        },
    };

    return (
        <div className="flex flex-col min-h-screen bg-background overflow-x-clip">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
            />
            <div suppressHydrationWarning className="w-full bg-background relative z-20">
                <HomeHero total={totalOffices} />
            </div>

            <HomeBottomSection
                divisions={divisions}
                featuredAlert={
                    featuredAlert
                        ? {
                              slug: featuredAlert.slug,
                              title: featuredAlert.title,
                              excerpt: featuredAlert.excerpt,
                          }
                        : null
                }
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {posts.map((post) => (
                        <BlogCard
                            key={post.slug}
                            slug={post.slug}
                            title={post.title}
                            excerpt={post.excerpt}
                            date={post.date}
                            readingTime={post.readingTime}
                            tags={post.tags}
                            category={post.category || "GUIDE"}
                            coverImage={post.coverImage}
                            featured={Boolean(post.featured)}
                        />
                    ))}
                </div>
            </HomeBottomSection>
        </div>
    );
}
