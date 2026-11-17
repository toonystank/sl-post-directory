import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import Postmark from "@/components/brand/Postmark";
import HomeHero from "@/components/directory/HomeHero";

export default async function Home() {
  const t = await getTranslations("Home");

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

      <section className=" bg-card/50 py-10 md:py-14 flex-1">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-heading text-2xl md:text-3xl font-extrabold [font-stretch:82%]">
                  {t("latestGuides")}
                </h2>
                <Link href="/blog" className="text-sm font-semibold text-primary hover:underline">
                  {t("viewAll")} &rarr;
                </Link>
              </div>
              <Suspense fallback={<div className="h-40 bg-muted animate-pulse rounded-md" />}>
                <LatestArticles />
              </Suspense>
            </div>

            <div className="rounded-md border-2 border-foreground bg-card p-6 shadow-[4px_4px_0_0_hsl(var(--foreground))] flex flex-col justify-between gap-4 overflow-hidden">
              <div className="airmail-stripe -mx-6 -mt-6 mb-2 h-1.5" aria-hidden="true" />
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-heading text-2xl font-extrabold [font-stretch:82%]">
                  {t("ratesTitle")}
                </h3>
                <Postmark code="LKR" size="sm" tone="red" rotate={-10} />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("ratesBody")}
              </p>
              <Button asChild className="w-full">
                <Link href="/calculator">{t("ratesCta")}</Link>
              </Button>
            </div>
          </div>

          <p className="md:hidden mt-8 text-center text-xs text-muted-foreground">
            {t("note")}
          </p>
        </div>
      </section>
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
