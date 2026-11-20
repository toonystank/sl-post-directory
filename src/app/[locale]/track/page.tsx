import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import TrackerClient from "@/components/tracking/TrackerClient";
import {
    buildLocalizedAlternates,
    buildLocalizedUrl,
    getDefaultOpenGraphImages,
    getOgLocale,
} from "@/lib/site";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const title = "Track Sri Lanka Post Parcel · COD, SLP Courier & Registered Mail";
    const description =
        "Track Sri Lanka Post COD (BD), SLP Mail Courier (NA, BF), Registered Post (RA, BG), and international EMS articles in one place.";
    return {
        title,
        description,
        alternates: buildLocalizedAlternates("/track", locale),
        openGraph: {
            title: `${title} | Lanka Post Directory`,
            description,
            url: buildLocalizedUrl("/track", locale),
            locale: getOgLocale(locale),
            images: getDefaultOpenGraphImages(`${title} | Lanka Post Directory`),
        },
    };
}

export default async function TrackPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ q?: string; barcode?: string }>;
}) {
    const [{ locale }, sp] = await Promise.all([params, searchParams]);
    setRequestLocale(locale);
    const initialQuery = (sp.q || sp.barcode || "").trim();
    return <TrackerClient initialQuery={initialQuery} />;
}
