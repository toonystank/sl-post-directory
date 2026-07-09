import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug } from "@/lib/blog";
import { getVariablesMap, replacePlaceholders } from "@/lib/variables";
import { ArrowLeft, Calendar, Clock, User } from "lucide-react";
import Link from "next/link";

export async function generateStaticParams() {
    const posts = await getAllPosts();
    return posts.map((post) => ({ slug: post.slug }));
}

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

    // Fetch dynamic variables for placeholders
    const variables = await getVariablesMap();
    
    // Replace placeholders in the stored HTML content
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
            "name": "SL Post Directory",
            "url": "https://postagedirectory.vercel.app",
        },
    };

    return (
        <div className="container mx-auto px-4 py-12 max-w-3xl min-h-[calc(100vh-4rem)]">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            {/* Back Link */}
            <Link
                href="/blog"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to Blog
            </Link>

            {/* Article Header */}
            <header className="mb-10">
                <div className="flex flex-wrap gap-2 mb-4">
                    {post.tags.map((tag) => (
                        <span
                            key={tag}
                            className="text-xs uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium border border-primary/20"
                        >
                            {tag}
                        </span>
                    ))}
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
                    {post.title}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        <User className="w-4 h-4" />
                        {post.author}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {formattedDate}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        {post.readingTime} min read
                    </span>
                </div>
            </header>

            {/* Article Content - rendered from WYSIWYG HTML */}
            <article
                className="prose-custom"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
            />

            {/* Footer CTA */}
            <div className="mt-16 pt-8 border-t border-border/40">
                <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10 text-center">
                    <h3 className="text-lg font-bold mb-2">Find Your Nearest Post Office</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Use our directory to search for any post office in Sri Lanka with contact details and operating hours.
                    </p>
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
                    >
                        Search Directory
                    </Link>
                </div>
            </div>
        </div>
    );
}
