import { Suspense } from "react";
import type { Metadata } from "next";
import SearchDirectory from "@/components/SearchDirectory";
import BrowseLoading from "./loading";
import { buildLocalizedAlternates } from "@/lib/site";

export const revalidate = 3600;

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    return {
        title: "Browse Post Offices Directory",
        description: "Search and browse Sri Lanka post offices alphabetically, by 5-digit postal code, division, office type, or postal service.",
        alternates: buildLocalizedAlternates("/browse", locale),
    };
}

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
