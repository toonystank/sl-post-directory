import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import TrackerClient from "@/components/tracking/TrackerClient";
import { getLocalizedPageMetadata } from "@/lib/seo-office";
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
    const { title, description } = getLocalizedPageMetadata("track", locale);
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
