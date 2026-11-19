"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import Postmark from "@/components/brand/Postmark";

const POPULAR_RATE_LINKS = [
    { href: "/rates/taiwan/1kg", label: "Taiwan 1kg" },
    { href: "/rates/united-kingdom/1kg", label: "UK 1kg" },
    { href: "/rates/united-states/1kg", label: "USA 1kg" },
    { href: "/rates/australia/2kg", label: "Australia 2kg" },
    { href: "/rates/united-arab-emirates/1kg", label: "UAE / Dubai 1kg" },
    { href: "/rates/japan/1kg", label: "Japan 1kg" },
    { href: "/rates/canada/1kg", label: "Canada 1kg" },
    { href: "/rates/india/1kg", label: "India 1kg" },
    { href: "/rates/local", label: "Local & SLP Courier" },
    { href: "/rates/cod", label: "COD Charges" },
];

export default function HomeBottomSection({
    children,
}: {
    children: React.ReactNode;
}) {
    const t = useTranslations("Home");

    return (
        <section className="bg-card/50 py-10 md:py-14 flex-1">
            <div className="container mx-auto px-4 space-y-10">
                {/* Popular Postage Rate Links (fast mobile shortcuts + Googlebot crawl hub) */}
                <div className="rounded-xl border-2 border-foreground bg-card p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <h2 className="font-heading text-lg sm:text-xl font-extrabold [font-stretch:82%]">
                            Popular Sri Lanka Post Rates
                        </h2>
                        <Link
                            href="/rates"
                            className="text-xs sm:text-sm font-semibold text-primary hover:underline shrink-0"
                        >
                            All countries &rarr;
                        </Link>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {POPULAR_RATE_LINKS.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="tap rounded-full border-[1.5px] border-foreground/60 bg-background px-3 py-1.5 font-mono text-xs font-semibold hover:border-foreground hover:bg-secondary/35 transition-colors"
                            >
                                {item.label}
                            </Link>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    <div className="lg:col-span-2">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="font-heading text-2xl md:text-3xl font-extrabold [font-stretch:82%]">
                                {t("latestGuides")}
                            </h2>
                            <Link href="/blog" className="text-sm font-semibold text-primary hover:underline">
                                {t("viewAll")} &rarr;
                            </Link>
                        </div>
                        {children}
                    </div>

                    <div className="rounded-md border-2 border-foreground bg-card p-6 shadow-[4px_4px_0_0_hsl(var(--foreground))] flex flex-col justify-between gap-4 overflow-hidden">
                        <div className="airmail-stripe -mx-6 -mt-6 mb-2 h-1.5" aria-hidden="true" />
                        <div className="flex items-start justify-between gap-3">
                            <h3 className="font-heading text-2xl font-extrabold [font-stretch:82%]">
                                {t("ratesTitle")}
                            </h3>
                            <Postmark code="LKR" size="sm" tone="red" rotate={-10} />
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {t("ratesBody")}
                        </p>
                        <Button asChild className="w-full">
                            <Link href="/calculator">{t("ratesCta")}</Link>
                        </Button>
                    </div>
                </div>

                <p className="md:hidden mt-8 text-center text-xs text-muted-foreground">
                    {t("note")}
                </p>
            </div>
        </section>
    );
}
