"use client";

import Image from "next/image";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { cn } from "@/lib/utils";

interface BlogCardProps {
    slug: string;
    title: string;
    excerpt: string;
    date: Date | string;
    readingTime: number;
    tags: string[];
    category?: string;
    coverImage?: string | null;
    featured?: boolean;
}

const CATEGORY_CLASS: Record<string, string> = {
    ALERT: "border-foreground bg-primary text-primary-foreground",
    TARIFF: "border-foreground bg-secondary text-secondary-foreground",
    NEWS: "border-foreground/50 bg-background text-foreground",
    GUIDE: "border-border bg-muted text-foreground",
};

export default function BlogCard({
    slug,
    title,
    excerpt,
    date,
    readingTime,
    tags,
    category = "GUIDE",
    coverImage,
    featured = false,
}: BlogCardProps) {
    const t = useTranslations("Blog");
    const formattedDate = new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });

    const normalizedCategory = ["NEWS", "ALERT", "TARIFF", "GUIDE"].includes(category)
        ? category
        : "GUIDE";

    const categoryLabel =
        normalizedCategory === "ALERT"
            ? t("catAlert")
            : normalizedCategory === "TARIFF"
              ? t("catTariff")
              : normalizedCategory === "NEWS"
                ? t("catNews")
                : t("catGuide");

    return (
        <Link
            href={`/blog/${slug}`}
            className="tap group flex h-full flex-col justify-between rounded-md border-2 border-foreground bg-card overflow-hidden transition-transform hover:-translate-y-0.5 shadow-[3px_3px_0_0_hsl(var(--foreground))]"
        >
            <div>
                {coverImage && (
                    <div className="relative aspect-video w-full border-b border-border bg-muted overflow-hidden">
                        <Image
                            src={`${coverImage.endsWith("/") ? coverImage : `${coverImage}/`}-/preview/800x450/-/quality/smart/`}
                            alt={title}
                            fill
                            unoptimized
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                    </div>
                )}

                <div className="p-5">
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        <span
                            className={cn(
                                "rounded-sm border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider",
                                CATEGORY_CLASS[normalizedCategory] || CATEGORY_CLASS.GUIDE
                            )}
                        >
                            {categoryLabel}
                        </span>
                        {featured && (
                            <span className="inline-flex items-center gap-0.5 font-mono text-[10px] font-bold uppercase text-primary">
                                <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                                {t("pinned")}
                            </span>
                        )}
                    </div>

                    <p className="font-mono text-xs text-muted-foreground">
                        {formattedDate} &middot; {t("minRead", { minutes: readingTime })}
                    </p>
                    <h3 className="font-heading text-xl font-extrabold leading-snug [font-stretch:85%] group-hover:text-primary mt-1.5 mb-2 line-clamp-2">
                        {title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                        {excerpt}
                    </p>
                </div>
            </div>

            {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-5 py-3 border-t border-border">
                    {tags.slice(0, 4).map((tag) => (
                        <span
                            key={tag}
                            className="font-mono text-[0.68rem] uppercase tracking-wider px-2 py-0.5 border border-foreground/30 bg-background"
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            )}
        </Link>
    );
}
