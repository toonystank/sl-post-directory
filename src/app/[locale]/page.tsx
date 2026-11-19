import { Suspense } from "react";
import HomeHero from "@/components/directory/HomeHero";
import HomeBottomSection from "@/components/directory/HomeBottomSection";

export const revalidate = 3600;

export default async function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Lanka Post Directory",
    "url": "https://lankapost.vercel.app/",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://lankapost.vercel.app/browse?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div suppressHydrationWarning className="w-full bg-background relative z-20">
        <HomeHero />
      </div>

      <HomeBottomSection>
        <Suspense fallback={<div className="h-40 bg-muted animate-pulse rounded-md" />}>
          <LatestArticles />
        </Suspense>
      </HomeBottomSection>
    </div>
  );
}

async function LatestArticles() {
  const { getLatestPosts } = await import("@/lib/blog");
  const posts = await getLatestPosts(2);
  const BlogCard = (await import("@/components/BlogCard")).default;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
  );
}
