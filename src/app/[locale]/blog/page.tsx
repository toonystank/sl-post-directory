import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAllPosts } from "@/lib/blog";
import { getLocalizedPageMetadata } from "@/lib/seo-office";
import {
    buildLocalizedAlternates,
    buildLocalizedUrl,
    getDefaultOpenGraphImages,
    getOgLocale,
} from "@/lib/site";
import NewsFeedClient from "@/components/blog/NewsFeedClient";

export const revalidate = 3600;

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const { title, description } = getLocalizedPageMetadata("blog", locale);
    return {
        title,
        description,
        alternates: buildLocalizedAlternates("/blog", locale),
        openGraph: {
            title: `${title} | Lanka Post Directory`,
            description,
            url: buildLocalizedUrl("/blog", locale),
            locale: getOgLocale(locale),
            images: getDefaultOpenGraphImages(`${title} | Lanka Post Directory`),
        },
    };
}

export default async function BlogPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    const posts = await getAllPosts();
    const t = await getTranslations("Blog");

    const serializedPosts = posts.map((post) => ({
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        date: post.date.toISOString(),
        readingTime: post.readingTime,
        tags: post.tags,
        category: post.category || "GUIDE",
        coverImage: post.coverImage ?? null,
        featured: Boolean(post.featured),
    }));

    return (
        <div className="container mx-auto px-4 py-6 md:py-12 min-h-[calc(100vh-4rem)]">
            <header className="mb-6 md:mb-10">
                <p className="label-mono mb-2">{t("kicker")}</p>
                <h1 className="display text-3xl md:text-5xl">{t("title")}</h1>
                <p className="text-muted-foreground mt-2 max-w-2xl">{t("lede")}</p>
            </header>

            <NewsFeedClient posts={serializedPosts} />
        </div>
    );
}
