import { useTranslations } from "next-intl";
import { Link } from "@/navigation";

interface BlogCardProps {
    slug: string;
    title: string;
    excerpt: string;
    date: Date | string;
    readingTime: number;
    tags: string[];
}

export default function BlogCard({ slug, title, excerpt, date, readingTime, tags }: BlogCardProps) {
    const t = useTranslations("Blog");
    const formattedDate = new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });

    return (
        <Link
            href={`/blog/${slug}`}
            className="tap group flex h-full flex-col justify-between rounded-md border-2 border-foreground bg-card p-5 transition-transform hover:-translate-y-0.5 shadow-[3px_3px_0_0_hsl(var(--foreground))]"
        >
            <div>
                <p className="font-mono text-xs text-muted-foreground">
                    {formattedDate} &middot; {t("minRead", { minutes: readingTime })}
                </p>
                <h3 className="font-heading text-xl font-extrabold leading-snug [font-stretch:85%] group-hover:text-primary mt-2 mb-2 line-clamp-2">
                    {title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-4">
                    {excerpt}
                </p>
            </div>

            {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-3 border-t border-border">
                    {tags.map((tag) => (
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
