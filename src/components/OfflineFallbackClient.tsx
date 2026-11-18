"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { WifiOff, Calculator, FolderOpen, Home, RefreshCw, MapPin } from "lucide-react";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import { getCachedOfficesList } from "@/lib/pwa";
import { usePWA } from "@/context/PWAContext";
import type { PostOffice } from "@/components/directory/types";

export default function OfflineFallbackClient() {
    const t = useTranslations("Install");
    const { setOfflineFallbackPage } = usePWA();
    const [savedOffices, setSavedOffices] = React.useState<PostOffice[]>([]);

    React.useEffect(() => {
        setOfflineFallbackPage(true);
        setSavedOffices(getCachedOfficesList().slice(0, 6));
        return () => {
            setOfflineFallbackPage(false);
        };
    }, [setOfflineFallbackPage]);

    return (
        <div id="slpost-offline-fallback" className="container mx-auto max-w-2xl px-4 py-8 md:py-14">
            <div className="rounded-xl border-2 border-foreground bg-card p-6 md:p-8 shadow-[4px_4px_0_0_hsl(var(--foreground))]">
                <div className="airmail-stripe -mx-6 -mt-6 md:-mx-8 md:-mt-8 mb-6 h-2 rounded-t-[10px]" aria-hidden="true" />

                <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-foreground bg-secondary text-secondary-foreground">
                        <WifiOff className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="font-heading text-2xl md:text-3xl font-extrabold [font-stretch:82%]">
                            {t("offlinePageTitle")}
                        </h1>
                        <p className="mt-1.5 text-sm md:text-base text-muted-foreground leading-relaxed">
                            {t("offlinePageSubtitle")}
                        </p>
                    </div>
                </div>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button asChild className="h-12 justify-start gap-2.5">
                        <Link href="/calculator">
                            <Calculator className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span>{t("offlineCalcCta")}</span>
                        </Link>
                    </Button>
                    <Button asChild variant="outline" className="h-12 justify-start gap-2.5 border-2 border-foreground">
                        <Link href="/browse">
                            <FolderOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span>{t("offlineBrowseCta")}</span>
                        </Link>
                    </Button>
                    <Button asChild variant="outline" className="h-11 justify-start gap-2.5">
                        <Link href="/">
                            <Home className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span>{t("offlineHomeCta")}</span>
                        </Link>
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        className="h-11 justify-start gap-2.5"
                        onClick={() => window.location.reload()}
                    >
                        <RefreshCw className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{t("offlineRetry")}</span>
                    </Button>
                </div>

                {savedOffices.length > 0 && (
                    <section className="mt-7 border-t border-border pt-5">
                        <h2 className="label-mono mb-3">{t("offlineSavedTitle")}</h2>
                        <ul className="divide-y divide-border rounded-md border border-border bg-background">
                            {savedOffices.map((office) => (
                                <li key={office.id}>
                                    <Link
                                        href={`/office/${office.slug}`}
                                        className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm hover:bg-muted/70 transition-colors"
                                    >
                                        <span className="flex items-center gap-2 font-semibold truncate">
                                            <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                                            <span className="truncate">{office.name}</span>
                                        </span>
                                        {office.postalCode && (
                                            <span className="font-mono text-xs font-bold text-muted-foreground tabular-nums shrink-0">
                                                {office.postalCode}
                                            </span>
                                        )}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>
        </div>
    );
}
