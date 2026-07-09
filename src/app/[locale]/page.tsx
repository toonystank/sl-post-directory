import { Suspense } from "react";
import { Landmark, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import SearchDirectory from "@/components/SearchDirectory";

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "SL Post Directory",
    "url": "https://lankapost.vercel.app/",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://lankapost.vercel.app/?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Client-side Directory with Search + Infinite Scroll */}
      <Suspense fallback={
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      }>
        <div suppressHydrationWarning className="flex-1 w-full bg-background relative z-20">
          <SearchDirectory />
        </div>
      </Suspense>

      {/* Value-Add Section (Content for AdSense) */}
      <div className="bg-slate-50 dark:bg-slate-900/50 py-16 border-t border-border/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Latest Articles */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold tracking-tight">Latest Postal Guides</h2>
                <a href="/blog" className="text-sm font-medium text-primary hover:underline">
                  View all articles &rarr;
                </a>
              </div>
              <Suspense fallback={<div className="h-40 bg-muted animate-pulse rounded-xl" />}>
                <LatestArticles />
              </Suspense>
            </div>

            {/* Postage Calculator CTA */}
            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-6">Tools & Services</h2>
              <div className="bg-gradient-to-br from-primary/10 to-blue-600/10 border border-primary/20 rounded-2xl p-6 h-[calc(100%-3.5rem)] flex flex-col">
                <div className="w-12 h-12 bg-background rounded-xl shadow-sm flex items-center justify-center mb-4 text-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="M12 12v9"></path><path d="m8 17 4 4 4-4"></path></svg>
                </div>
                <h3 className="text-xl font-bold mb-2">Postage Calculator</h3>
                <p className="text-muted-foreground text-sm mb-6 flex-1">
                  Estimate shipping costs for domestic and international mail. Check rates for letters, parcels, and EMS services instantly.
                </p>
                <a 
                  href="/calculator" 
                  className="w-full inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8"
                >
                  Calculate Postage
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Separate component to fetch articles
async function LatestArticles() {
  // Dynamic import so the server utility isn't required in client bundles accidentally
  const { getLatestPosts } = await import('@/lib/blog');
  const posts = await getLatestPosts(2);
  
  // Dynamic import for the card component
  const BlogCard = (await import('@/components/BlogCard')).default;

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
