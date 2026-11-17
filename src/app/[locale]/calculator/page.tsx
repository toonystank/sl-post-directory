import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import PostageCalculator from "@/components/PostageCalculator";

export const metadata: Metadata = {
    title: "Postage Calculator",
    description:
        "Calculate official Sri Lanka Post shipping costs for domestic letters, parcels, SLP Courier (formerly Speed Post), COD, and international EMS, Air Mail, U-Packet, TDS, and Sea Mail.",
};

export default async function CalculatorPage({ searchParams }: { searchParams: Promise<{ mode?: string | string[] }> }) {
    const { mode } = await searchParams;
    const t = await getTranslations("Calculator");
    const m = Array.isArray(mode) ? mode[0] : mode;
    const initialMode = m === "cod" ? "cod" : m === "local" ? "domestic" : "ems";
    return (
        <div className="container mx-auto px-3 py-2 md:px-4 md:py-10 min-h-[calc(100dvh-var(--appbar-h)-var(--tabbar-h))] md:min-h-[calc(100vh-4rem)] flex flex-col justify-start">
            <header className="hidden md:block max-w-2xl lg:max-w-7xl mx-auto w-full mb-6">
                <p className="label-mono mb-1.5">{t("kicker")}</p>
                <h1 className="display text-4xl lg:text-5xl mb-2">
                    {t("title")}
                </h1>
                <p className="text-muted-foreground text-base max-w-3xl">
                    {t("subtitle")}
                </p>
                <div className="mt-3 border-l-4 border-secondary bg-card px-4 py-2 text-xs text-muted-foreground">
                    <strong className="text-foreground">{t("circularLabel")}</strong> {t("circularBody")}
                </div>
            </header>

            <PostageCalculator key={initialMode} initialMode={initialMode} />
        </div>
    );
}
