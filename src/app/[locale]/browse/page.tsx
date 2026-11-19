import { Suspense } from "react";
import type { Metadata } from "next";
import SearchDirectory from "@/components/SearchDirectory";
import BrowseLoading from "./loading";

export const revalidate = 3600;

export const metadata: Metadata = {
    title: "Browse Post Offices Directory",
    description: "Search and browse all 4,158 Sri Lanka post offices alphabetically, by postal code, division, or postal service.",
};

export default function BrowsePage() {
    return (
        <div className="flex flex-col min-h-screen bg-background">
            <Suspense fallback={<BrowseLoading />}>
                <div suppressHydrationWarning className="flex-1 w-full bg-background relative z-20">
                    <SearchDirectory />
                </div>
            </Suspense>
        </div>
    );
}
