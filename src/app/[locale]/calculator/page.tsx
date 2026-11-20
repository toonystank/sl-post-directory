import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import PostageCalculator from "@/components/PostageCalculator";
import CalculatorHeader from "@/components/CalculatorHeader";
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
    const title = "Postage Calculator";
    const description =
        "Calculate official Sri Lanka Post shipping costs for domestic letters, parcels, SLP Courier (formerly Speed Post), COD, and international EMS, Air Mail, U-Packet, TDS, and Sea Mail.";
    return {
        title,
        description,
        alternates: buildLocalizedAlternates("/calculator", locale),
        openGraph: {
            title: `${title} | Lanka Post Directory`,
            description,
            url: buildLocalizedUrl("/calculator", locale),
            locale: getOgLocale(locale),
            images: getDefaultOpenGraphImages(`${title} | Lanka Post Directory`),
        },
    };
}

type SearchParamValue = string | string[] | undefined;

function firstParam(val: SearchParamValue): string | undefined {
    if (Array.isArray(val)) return val[0];
    return val;
}

export default async function CalculatorPage({
    params: routeParams,
    searchParams,
}: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{
        mode?: SearchParamValue;
        country?: SearchParamValue;
        weight?: SearchParamValue;
        codAmount?: SearchParamValue;
        service?: SearchParamValue;
        transport?: SearchParamValue;
        registered?: SearchParamValue;
    }>;
}) {
    const [{ locale }, params] = await Promise.all([routeParams, searchParams]);
    setRequestLocale(locale);
    const m = firstParam(params.mode);
    const initialMode = m === "cod" ? "cod" : m === "local" ? "domestic" : "ems";
    const initialCountry = firstParam(params.country)?.toUpperCase();
    const initialWeight = firstParam(params.weight);
    const initialCodAmount = firstParam(params.codAmount);
    const initialService = firstParam(params.service);
    const initialTransport = firstParam(params.transport) === "sea" ? "sea" : firstParam(params.transport) === "air" ? "air" : undefined;
    const initialRegistered = firstParam(params.registered) === "1" || firstParam(params.registered) === "true";

    const deepLinkKey = `${initialMode}-${initialCountry ?? ""}-${initialWeight ?? ""}-${initialCodAmount ?? ""}-${initialService ?? ""}-${initialTransport ?? ""}-${initialRegistered}`;

    return (
        <div className="container mx-auto px-3 py-2 md:px-4 md:py-10 min-h-[calc(100dvh-var(--appbar-h)-var(--tabbar-h))] md:min-h-[calc(100vh-4rem)] flex flex-col justify-start">
            <CalculatorHeader />

            <PostageCalculator
                key={deepLinkKey}
                initialMode={initialMode}
                initialCountry={initialCountry}
                initialWeight={initialWeight}
                initialCodAmount={initialCodAmount}
                initialService={initialService}
                initialTransport={initialTransport}
                initialRegistered={initialRegistered}
            />
        </div>
    );
}
