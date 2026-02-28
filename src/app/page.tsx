import { Suspense } from "react";
import { Landmark, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import SearchDirectory from "@/components/SearchDirectory";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative w-full pt-16 pb-28 md:pt-20 md:pb-32 flex items-center justify-center overflow-hidden border-b bg-background">
        {/* Abstract Background Effects */}
        <div className="absolute inset-0 w-full h-full bg-grid-white/[0.02] bg-[size:60px_60px]" />
        <div className="absolute top-0 flex items-center justify-center w-full h-full">
          <div className="w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] opacity-50 mix-blend-screen" />
          <div className="absolute w-[400px] h-[400px] bg-secondary/20 rounded-full blur-[100px] opacity-40 bottom-10 right-10 mix-blend-screen" />
        </div>

        <div className="relative z-10 container px-4 md:px-6 text-center">
          <Badge variant="secondary" className="mb-6 py-1.5 px-4 text-sm rounded-full bg-secondary/10 text-secondary hover:bg-secondary/20 border-secondary/20 transition-colors">
            <Landmark className="w-4 h-4 mr-2" /> V2.0 Redesign Live
          </Badge>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-8">
            Navigate Sri Lanka&apos;s <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
              Postal Network
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-lg md:text-xl text-muted-foreground mb-12">
            The most comprehensive, unified directory for finding every post office, contact detail, and location across the island.
          </p>
        </div>
      </section>

      {/* Client-side Directory with Search + Infinite Scroll */}
      <Suspense fallback={
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      }>
        <SearchDirectory />
      </Suspense>
    </div>
  );
}
