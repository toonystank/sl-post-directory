import type { Metadata } from "next";
import TrackerClient from "@/components/tracking/TrackerClient";
import { buildLocalizedAlternates } from "@/lib/site";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    return {
        title: "Track Sri Lanka Post Parcel · COD, SLP Courier & Registered Mail",
        description:
            "Track Sri Lanka Post COD (BD), SLP Mail Courier (NA, BF), Registered Post (RA, BG), and international EMS articles in one place.",
        alternates: buildLocalizedAlternates("/track", locale),
    };
}

export default async function TrackPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; barcode?: string }>;
}) {
    const sp = await searchParams;
    const initialQuery = (sp.q || sp.barcode || "").trim();
    return <TrackerClient initialQuery={initialQuery} />;
}
