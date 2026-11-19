import type { Metadata } from "next";
import HomeHero from "@/components/directory/HomeHero";
import HomeBottomSection from "@/components/directory/HomeBottomSection";
import BlogCard from "@/components/BlogCard";
import { getLatestPosts } from "@/lib/blog";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { loadLocalOffices } from "@/lib/local-sqlite";
import { buildLocalizedAlternates, buildLocalizedUrl, getSiteUrl } from "@/lib/site";

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
        },
    };
}

async function getTotalOfficeCount(): Promise<number> {
    if (!hasDatabaseUrl) {
        return loadLocalOffices().length || 4024;
    }
    try {
        const count = await prisma.postOffice.count();
        return count > 0 ? count : loadLocalOffices().length || 4024;
    } catch {
        return loadLocalOffices().length || 4024;
    }
}

export default async function Home({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    const [posts, totalOffices] = await Promise.all([
        getLatestPosts(2),
        getTotalOfficeCount(),
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
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <div suppressHydrationWarning className="w-full bg-background relative z-20">
                <HomeHero total={totalOffices} />
            </div>

            <HomeBottomSection>
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
                        />
                    ))}
                </div>
            </HomeBottomSection>
        </div>
    );
}
