import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import TrackerClient from "@/components/tracking/TrackerClient";
import { buildLocalizedAlternates } from "@/lib/site";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string; barcode: string }>;
}): Promise<Metadata> {
    const { locale, barcode } = await params;
    const clean = decodeURIComponent(barcode).trim().toUpperCase();
    return {
        title: `Track ${clean} · Sri Lanka Post`,
        description: `Live Sri Lanka Post tracking status for ${clean} (COD & SLP Mail Courier).`,
        alternates: buildLocalizedAlternates(`/track/${encodeURIComponent(clean)}`, locale),
        robots: {
            index: false,
            follow: false,
        },
    };
}

export default async function TrackBarcodePage({
    params,
}: {
    params: Promise<{ locale: string; barcode: string }>;
}) {
    const { locale, barcode } = await params;
    setRequestLocale(locale);
    const clean = decodeURIComponent(barcode).trim();
    return <TrackerClient initialQuery={clean} />;
}
