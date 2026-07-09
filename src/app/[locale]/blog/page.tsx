import type { Metadata } from "next";
import { getAllPosts } from "@/lib/blog";
import BlogCard from "@/components/BlogCard";
import { BookOpen } from "lucide-react";

export const metadata: Metadata = {
    title: "Blog",
    description: "Postal guides, tips, and helpful articles about Sri Lanka Post services, postal codes, shipping, and more.",
};

export default async function BlogPage() {
    const posts = await getAllPosts();

    return (
        <div className="container mx-auto px-4 py-12 min-h-[calc(100vh-4rem)]">
            {/* Header */}
            <div className="mb-10">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-primary/10 text-primary rounded-2xl ring-1 ring-primary/20">
                        <BookOpen className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                            Postal Guides & Tips
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            Helpful articles about Sri Lanka Post services, shipping, and postal codes.
                        </p>
                    </div>
                </div>
            </div>

            {/* Blog Grid */}
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
                <div className="text-center py-20 bg-card/20 rounded-3xl border border-border/40 border-dashed">
                    <BookOpen className="w-12 h-12 text-primary/40 mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">No articles yet</h3>
                    <p className="text-sm text-muted-foreground">Check back soon for helpful postal guides and tips.</p>
                </div>
            )}
        </div>
    );
}
