import { Suspense } from "react";
import { Landmark, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import SearchDirectory from "@/components/SearchDirectory";
import HeroSection from "@/components/HeroSection";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Animated Hero Section */}
      <HeroSection />

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
