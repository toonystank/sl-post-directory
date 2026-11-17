import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPostBySlug } from "@/lib/blog";
import { getVariablesMap, replacePlaceholders } from "@/lib/variables";
import { ArrowLeft, Calendar, Clock, User } from "lucide-react";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const post = await getPostBySlug(slug);
    if (!post) return { title: "Article Not Found" };

    return {
        title: post.title,
        description: post.excerpt,
        openGraph: {
            title: post.title,
            description: post.excerpt,
            type: "article",
            publishedTime: post.date.toISOString(),
            authors: [post.author],
        },
    };
}

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const post = await getPostBySlug(slug);

    if (!post) {
        notFound();
    }

    const t = await getTranslations("Blog");
    const variables = await getVariablesMap();
    const htmlContent = replacePlaceholders(post.contentHtml, variables);

    const formattedDate = new Date(post.date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": post.title,
        "description": post.excerpt,
        "datePublished": post.date.toISOString(),
        "author": {
            "@type": "Organization",
            "name": post.author,
        },
        "publisher": {
            "@type": "Organization",
            "name": "Lanka Post Directory",
            "url": "https://lankapost.vercel.app",
        },
    };

    return (
        <div className="container mx-auto px-4 py-6 md:py-12 max-w-3xl min-h-[calc(100vh-4rem)]">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            <Link
                href="/blog"
                className="hidden md:inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
                <ArrowLeft className="w-4 h-4" />
                {t("backToGuides")}
            </Link>

            <header className="mb-8">
                {post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                        {post.tags.map((tag) => (
                            <span
                                key={tag}
                                className="font-mono text-[0.68rem] uppercase tracking-wider px-2 py-0.5 border border-foreground/30 bg-card"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
                <h1 className="display text-3xl md:text-5xl mb-5">
                    {post.title}
                </h1>
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

            <article
                className="prose-custom max-w-[68ch] text-base leading-relaxed"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
            />

            <div className="mt-12 pt-4">
                <div className="rounded-md border-2 border-foreground bg-card p-6 shadow-[4px_4px_0_0_hsl(var(--foreground))] text-center">
                    <h3 className="font-heading text-xl font-extrabold [font-stretch:82%] mb-2">
                        {t("ctaTitle")}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
                        {t("ctaBody")}
                    </p>
                    <Button asChild>
                        <Link href="/">
                            {t("ctaButton")}
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
