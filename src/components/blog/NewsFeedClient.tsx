"use client";

import * as React from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { BookOpen, Star, ArrowRight } from "lucide-react";
import { Link } from "@/navigation";
import BlogCard from "@/components/BlogCard";
import { cn } from "@/lib/utils";

export interface PublicNewsPost {
    slug: string;
    title: string;
    excerpt: string;
    date: string;
    readingTime: number;
    tags: string[];
    category: string;
    coverImage: string | null;
    featured: boolean;
}

const FILTER_KEYS = ["ALL", "ALERT", "TARIFF", "NEWS", "GUIDE"] as const;

export default function NewsFeedClient({ posts }: { posts: PublicNewsPost[] }) {
    const t = useTranslations("Blog");
    const [activeCategory, setActiveCategory] = React.useState<(typeof FILTER_KEYS)[number]>("ALL");

    const filteredPosts = React.useMemo(() => {
        if (activeCategory === "ALL") return posts;
        return posts.filter((p) => (p.category || "GUIDE") === activeCategory);
    }, [posts, activeCategory]);

    const featuredPost =
        activeCategory === "ALL" ? filteredPosts.find((p) => p.featured) ?? null : null;
    const gridPosts = featuredPost
        ? filteredPosts.filter((p) => p.slug !== featuredPost.slug)
        : filteredPosts;

    const categoryLabel = (cat: string) => {
        if (cat === "ALL") return t("catAll");
        if (cat === "ALERT") return t("catAlert");
        if (cat === "TARIFF") return t("catTariff");
        if (cat === "NEWS") return t("catNews");
        return t("catGuide");
    };

    return (
        <div className="space-y-6">
            {/* Category Filter Strip */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide snap-carousel pb-1">
                {FILTER_KEYS.map((key) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setActiveCategory(key)}
                        className={cn(
                            "tap shrink-0 min-h-[42px] rounded-md border-2 px-3.5 text-xs font-extrabold whitespace-nowrap transition-colors",
                            activeCategory === key
                                ? "border-foreground bg-foreground text-background"
                                : "border-border bg-card text-foreground hover:border-foreground"
                        )}
                    >
                        {categoryLabel(key)}
                    </button>
                ))}
            </div>

            {featuredPost && (
                <Link
                    href={`/blog/${featuredPost.slug}`}
                    className="tap group block rounded-md border-2 border-foreground bg-card overflow-hidden shadow-[4px_4px_0_0_hsl(var(--foreground))] hover:-translate-y-0.5 transition-transform"
                >
                    <div className="grid grid-cols-1 lg:grid-cols-12">
                        {featuredPost.coverImage && (
                            <div className="relative aspect-video lg:aspect-auto lg:col-span-5 bg-muted border-b lg:border-b-0 lg:border-r border-border">
                                <Image
                                    src={`${featuredPost.coverImage.endsWith("/") ? featuredPost.coverImage : `${featuredPost.coverImage}/`}-/preview/1000x600/-/quality/smart/`}
                                    alt={featuredPost.title}
                                    fill
                                    unoptimized
                                    className="object-cover"
                                />
                            </div>
                        )}
                        <div className={cn("p-5 sm:p-7 flex flex-col justify-between gap-4", featuredPost.coverImage ? "lg:col-span-7" : "lg:col-span-12")}>
                            <div className="space-y-2.5">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span
                                        className={cn(
                                            "rounded-sm border px-2 py-0.5 font-mono text-[11px] font-bold uppercase",
                                            featuredPost.category === "ALERT"
                                                ? "border-foreground bg-primary text-primary-foreground"
                                                : "border-foreground bg-secondary text-secondary-foreground"
                                        )}
                                    >
                                        {categoryLabel(featuredPost.category)}
                                    </span>
                                    <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase text-primary">
                                        <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                                        {t("pinned")}
                                    </span>
                                </div>
                                <h2 className="display text-2xl sm:text-3xl group-hover:text-primary transition-colors">
                                    {featuredPost.title}
                                </h2>
                                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                                    {featuredPost.excerpt}
                                </p>
                            </div>
                            <div className="flex items-center justify-between border-t border-border pt-3 font-mono text-xs text-muted-foreground">
                                <span>
                                    {new Date(featuredPost.date).toLocaleDateString("en-US", {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric",
                                    })}{" "}
                                    &middot; {t("minRead", { minutes: featuredPost.readingTime })}
                                </span>
                                <span className="font-bold text-primary inline-flex items-center gap-1">
                                    <span>{t("readMore")}</span>
                                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                                </span>
                            </div>
                        </div>
                    </div>
                </Link>
            )}

            {gridPosts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {gridPosts.map((post) => (
                        <BlogCard
                            key={post.slug}
                            slug={post.slug}
                            title={post.title}
                            excerpt={post.excerpt}
                            date={post.date}
                            readingTime={post.readingTime}
                            tags={post.tags}
                            category={post.category}
                            coverImage={post.coverImage}
                            featured={post.featured}
                        />
                    ))}
                </div>
            ) : !featuredPost ? (
                <div className="text-center py-16 bg-card rounded-md border-2 border-dashed border-foreground/30">
                    <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <h3 className="font-heading text-xl font-extrabold [font-stretch:82%] mb-1">
                        {t("noArticles")}
                    </h3>
                    <p className="text-sm text-muted-foreground">{t("noArticlesBody")}</p>
                </div>
            ) : null}
        </div>
    );
}
