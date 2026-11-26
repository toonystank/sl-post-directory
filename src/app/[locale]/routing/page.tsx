import { Suspense } from "react";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import RoutingHubClient from "@/components/routing/RoutingHubClient";
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
    const title = "Mail Routing, RMSC Hubs & Forwarding Guide";
    const description =
        "Free Sri Lanka Post routing finder, RMSC/TPO sorting hub directory, 00–91 postal code prefix map, redirection rules, and sorting practice quiz for postal employees and trainees.";
    return {
        title,
        description,
        alternates: buildLocalizedAlternates("/routing", locale),
        openGraph: {
            title: `${title} | Lanka Post Directory`,
            description,
            url: buildLocalizedUrl("/routing", locale),
            locale: getOgLocale(locale),
            images: getDefaultOpenGraphImages(`${title} | Lanka Post Directory`),
        },
    };
}

export default async function RoutingPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);

    return (
        <Suspense
            fallback={
                <div className="container mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">
                    Loading Mail Routing &amp; Forwarding Hub...
                </div>
            }
        >
            <RoutingHubClient />
        </Suspense>
    );
}
