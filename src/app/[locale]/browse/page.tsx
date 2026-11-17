import { Suspense } from "react";
import type { Metadata } from "next";
import { Loader2 } from "lucide-react";
import SearchDirectory from "@/components/SearchDirectory";

export const metadata: Metadata = {
    title: "Browse Post Offices Directory",
    description: "Search and browse all 4,158 Sri Lanka post offices alphabetically, by postal code, division, or postal service.",
};

export default function BrowsePage() {
    return (
        <div className="flex flex-col min-h-screen bg-background">
            <Suspense
                fallback={
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    </div>
                }
            >
                <div suppressHydrationWarning className="flex-1 w-full bg-background relative z-20">
                    <SearchDirectory />
                </div>
            </Suspense>
        </div>
    );
}
