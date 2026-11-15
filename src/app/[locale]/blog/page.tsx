import type { Metadata } from "next";
import { getAllPosts } from "@/lib/blog";
import BlogCard from "@/components/BlogCard";
import { BookOpen } from "lucide-react";

export const metadata: Metadata = {
    title: "Postal Guides & Tips",
    description: "Postal guides, tips, and helpful articles about Sri Lanka Post services, postal codes, shipping, and more.",
};

export default async function BlogPage() {
    const posts = await getAllPosts();

    return (
        <div className="container mx-auto px-4 py-6 md:py-12 min-h-[calc(100vh-4rem)]">
            <header className="mb-8 md:mb-10">
                <p className="label-mono mb-2">Reference & Dispatch</p>
                <h1 className="display text-3xl md:text-5xl">
                    Postal Guides & Tips
                </h1>
                <p className="text-muted-foreground mt-2 max-w-2xl">
                    Helpful articles about Sri Lanka Post services, shipping, and postal codes.
                </p>
            </header>

            {posts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
            ) : (
                <div className="text-center py-16 bg-card rounded-md border-2 border-dashed border-foreground/30">
                    <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <h3 className="font-heading text-xl font-extrabold [font-stretch:82%] mb-1">No articles yet</h3>
                    <p className="text-sm text-muted-foreground">Check back soon for helpful postal guides and tips.</p>
                </div>
            )}
        </div>
    );
}
