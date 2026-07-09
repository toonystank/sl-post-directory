import { Link } from "@/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Clock, Calendar } from "lucide-react";

interface BlogCardProps {
    slug: string;
    title: string;
    excerpt: string;
    date: Date | string;
    readingTime: number;
    tags: string[];
}

export default function BlogCard({ slug, title, excerpt, date, readingTime, tags }: BlogCardProps) {
    const formattedDate = new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });

    return (
        <Link href={`/blog/${slug}`} className="group h-full">
            <Card className="h-full flex flex-col bg-card hover:bg-muted/50 border-border/40 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1">
                <CardHeader className="px-5 pt-5 pb-3">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 text-primary">
                            <BookOpen className="w-4 h-4" />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formattedDate}
                            </span>
                            <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {readingTime} min read
                            </span>
                        </div>
                    </div>
                    <CardTitle className="text-base group-hover:text-primary transition-colors leading-tight line-clamp-2">
                        {title}
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 flex-1">
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-4">
                        {excerpt}
                    </p>
                    {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-3 border-t border-border/30">
                            {tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="text-xs uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary font-medium"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </Link>
    );
}
