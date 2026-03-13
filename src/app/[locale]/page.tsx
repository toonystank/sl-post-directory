import { Suspense } from "react";
import { Landmark, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import SearchDirectory from "@/components/SearchDirectory";

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "SL Post Directory",
    "url": "https://postagedirectory.vercel.app/",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://postagedirectory.vercel.app/?q={search_term_string}",
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
        <div className="flex-1 w-full bg-background relative z-20">
          <SearchDirectory />
        </div>
      </Suspense>
    </div>
  );
}
