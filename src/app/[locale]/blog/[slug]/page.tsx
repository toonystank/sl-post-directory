import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getPostBySlug } from "@/lib/blog";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { safeJsonLd } from "@/lib/security";
import { getVariablesMap, replacePlaceholders } from "@/lib/variables";
import {
    buildLocalizedAlternates,
    buildLocalizedUrl,
    getDefaultOpenGraphImages,
    getOgLocale,
    getSiteUrl,
} from "@/lib/site";
import { ArrowLeft, Calendar, Clock, User, ExternalLink } from "lucide-react";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const revalidate = 3600;

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
    const { locale, slug } = await params;
    const post = await getPostBySlug(slug);
    if (!post) return { title: "Article Not Found" };

    const canonicalUrl = buildLocalizedUrl(`/blog/${slug}`, locale);
    const ogImages = post.coverImage
        ? [
              {
                  url: `${post.coverImage.endsWith("/") ? post.coverImage : `${post.coverImage}/`}-/preview/1200x630/-/quality/smart/`,
                  width: 1200,
                  height: 630,
                  alt: post.title,
              },
          ]
        : getDefaultOpenGraphImages(post.title);

    return {
        title: post.title,
        description: post.excerpt,
        alternates: buildLocalizedAlternates(`/blog/${slug}`, locale),
        openGraph: {
            title: post.title,
            description: post.excerpt,
            url: canonicalUrl,
            locale: getOgLocale(locale),
            type: "article",
            publishedTime: post.date.toISOString(),
            authors: [post.author],
            images: ogImages,
        },
    };
}

export default async function BlogArticlePage({
    params,
}: {
    params: Promise<{ locale: string; slug: string }>;
}) {
    const { locale, slug } = await params;
    setRequestLocale(locale);
    const [post, t, variables] = await Promise.all([
        getPostBySlug(slug),
        getTranslations("Blog"),
        getVariablesMap(),
    ]);

    if (!post) {
        notFound();
    }

    const htmlContent = sanitizeRichHtml(replacePlaceholders(post.contentHtml, variables));
    const category = post.category || "GUIDE";
    const categoryLabel =
        category === "ALERT"
            ? t("catAlert")
            : category === "TARIFF"
              ? t("catTariff")
              : category === "NEWS"
                ? t("catNews")
                : t("catGuide");

    const formattedDate = new Date(post.date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    const siteUrl = getSiteUrl();
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": category !== "GUIDE" ? "NewsArticle" : "Article",
        headline: post.title,
        description: post.excerpt,
        datePublished: post.date.toISOString(),
        dateModified: post.updatedAt.toISOString(),
        url: buildLocalizedUrl(`/blog/${slug}`, locale),
        ...(post.coverImage
            ? {
                  image: `${post.coverImage.endsWith("/") ? post.coverImage : `${post.coverImage}/`}-/preview/1200x675/-/quality/smart/`,
              }
            : {}),
        author: {
            "@type": "Organization",
            name: post.author,
        },
        publisher: {
            "@type": "Organization",
            name: "Lanka Post Directory",
            url: siteUrl,
        },
    };

    return (
        <div className="container mx-auto px-4 py-6 md:py-12 max-w-3xl min-h-[calc(100vh-4rem)]">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
            />

            <Link
                href="/blog"
                className="hidden md:inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
                <ArrowLeft className="w-4 h-4" />
                {t("backToGuides")}
            </Link>

            <header className="mb-8">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span
                        className={cn(
                            "font-mono text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-sm border",
                            category === "ALERT"
                                ? "border-foreground bg-primary text-primary-foreground"
                                : category === "TARIFF"
                                  ? "border-foreground bg-secondary text-secondary-foreground"
                                  : "border-foreground/30 bg-card text-foreground"
                        )}
                    >
                        {categoryLabel}
                    </span>
                    {post.tags.map((tag) => (
                        <span
                            key={tag}
                            className="font-mono text-[0.68rem] uppercase tracking-wider px-2 py-0.5 border border-foreground/30 bg-card"
                        >
                            {tag}
                        </span>
                    ))}
                </div>
                <h1 className="display text-3xl md:text-5xl mb-5">{post.title}</h1>
                <div className="border-y-2 border-foreground py-2.5 font-mono text-xs text-muted-foreground flex flex-wrap gap-4">
                    <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" aria-hidden="true" />
                        {post.author}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                        {formattedDate}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                        {t("minRead", { minutes: post.readingTime })}
                    </span>
                </div>
            </header>

            {post.coverImage && (
                <figure className="mb-8 rounded-md border-2 border-foreground bg-card overflow-hidden shadow-[4px_4px_0_0_hsl(var(--foreground))]">
                    <div className="relative aspect-video w-full bg-muted">
                        <Image
                            src={`${post.coverImage.endsWith("/") ? post.coverImage : `${post.coverImage}/`}-/preview/1200x675/-/quality/smart/`}
                            alt={post.title}
                            fill
                            unoptimized
                            className="object-cover"
                        />
                    </div>
                    {post.coverCaption && (
                        <figcaption className="border-t border-border bg-muted/40 px-4 py-2 font-mono text-xs text-muted-foreground">
                            {post.coverCaption}
                        </figcaption>
                    )}
                </figure>
            )}

            <article
                className="prose-custom max-w-[68ch] text-base leading-relaxed"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
            />

            {post.sourceUrl && (
                <div className="mt-8 rounded-md border-2 border-foreground bg-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="label-mono">{t("officialSource")}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{post.sourceUrl}</p>
                    </div>
                    <a
                        href={post.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tap shrink-0 inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-md border border-foreground bg-secondary px-3.5 text-xs font-extrabold text-secondary-foreground"
                    >
                        <span>{t("viewCircular")}</span>
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                </div>
            )}

            <div className="mt-12 pt-4">
                <div className="rounded-md border-2 border-foreground bg-card p-6 shadow-[4px_4px_0_0_hsl(var(--foreground))] text-center">
                    <h3 className="font-heading text-xl font-extrabold [font-stretch:82%] mb-2">
                        {t("ctaTitle")}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
                        {t("ctaBody")}
                    </p>
                    <Button asChild>
                        <Link href="/">{t("ctaButton")}</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
