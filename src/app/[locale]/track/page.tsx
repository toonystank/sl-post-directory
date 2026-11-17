import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/navigation";
import { Package, Calculator, FolderOpen, Construction, CheckCircle2, Barcode } from "lucide-react";
import Postmark from "@/components/brand/Postmark";
import TrackMotionCard from "@/components/directory/TrackMotionCard";

export const metadata: Metadata = {
    title: "Track Parcel & Mail · Coming Soon",
    description: "Unified Sri Lanka Post tracking for EMS Speed Post, Registered Post, U-Packet, and Domestic COD is coming soon.",
};

export default async function TrackPage() {
    const t = await getTranslations("Track");

    const upcomingServices = [
        { name: t("serviceEms"), code: t("serviceEmsCode") },
        { name: t("serviceReg"), code: t("serviceRegCode") },
        { name: t("serviceTracked"), code: t("serviceTrackedCode") },
        { name: t("serviceCod"), code: t("serviceCodCode") },
    ];

    return (
        <div className="container mx-auto max-w-3xl px-4 py-6 md:py-12">
            <TrackMotionCard className="overflow-hidden rounded-2xl border-2 border-foreground bg-card shadow-[4px_4px_0_0_hsl(var(--foreground))]">
                {/* Yellow-and-black construction hazard top stripe */}
                <div
                    className="h-3 w-full border-b-2 border-foreground"
                    style={{
                        backgroundImage:
                            "repeating-linear-gradient(-45deg, #FACC15, #FACC15 12px, #111827 12px, #111827 24px)",
                    }}
                    aria-hidden="true"
                />

                <div className="p-5 sm:p-8 md:p-10">
                    {/* Top badge + Postmark */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-2 rounded-md border-[1.5px] border-foreground bg-secondary px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-secondary-foreground">
                            <Construction className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>{t("badge")}</span>
                        </span>
                        <Postmark code="TRACK" size="sm" tone="red" rotate={-10} className="hidden sm:flex" />
                    </div>

                    {/* Icon + Headline */}
                    <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-foreground bg-primary text-primary-foreground shadow-[0_3px_0_0_hsl(var(--foreground))]">
                            <Package className="h-8 w-8" strokeWidth={2.2} aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl font-extrabold [font-stretch:85%] leading-tight">
                                {t("title")}
                            </h1>
                            <p className="mt-2 text-sm sm:text-base text-muted-foreground leading-relaxed">
                                {t("subtitle")}
                            </p>
                        </div>
                    </div>

                    {/* Disabled Preview Barcode Input */}
                    <div className="mt-6 rounded-xl border-2 border-dashed border-foreground/40 bg-background/70 p-4">
                        <p className="label-mono mb-2 flex items-center gap-1.5 text-muted-foreground">
                            <Barcode className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{t("previewLabel")}</span>
                        </p>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 opacity-75">
                            <input
                                type="text"
                                disabled
                                readOnly
                                placeholder={t("previewPlaceholder")}
                                aria-label={t("previewLabel")}
                                className="h-11 w-full sm:flex-1 rounded-md border-[1.5px] border-foreground/50 bg-muted/60 px-3.5 font-mono text-xs sm:text-sm text-muted-foreground cursor-not-allowed"
                            />
                            <button
                                type="button"
                                disabled
                                className="h-11 shrink-0 rounded-md border-[1.5px] border-foreground/50 bg-muted px-4 font-heading text-xs sm:text-sm font-bold text-muted-foreground cursor-not-allowed"
                            >
                                {t("previewButton")}
                            </button>
                        </div>
                    </div>

                    {/* Upcoming Supported Services Grid */}
                    <div className="mt-6">
                        <h2 className="label-mono mb-3">{t("servicesTitle")}</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {upcomingServices.map((svc) => (
                                <div
                                    key={svc.name}
                                    className="flex items-center justify-between gap-3 rounded-xl border-[1.5px] border-foreground bg-background px-3.5 py-2.5"
                                >
                                    <span className="flex items-center gap-2 font-semibold text-sm min-w-0">
                                        <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                                        <span className="truncate">{svc.name}</span>
                                    </span>
                                    <span className="shrink-0 rounded border border-dashed border-foreground/60 bg-card px-2 py-0.5 font-mono text-xs font-bold">
                                        {svc.code}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick CTAs while under construction */}
                    <div className="mt-7 border-t-2 border-dashed border-border pt-6">
                        <p className="text-xs sm:text-sm font-semibold text-muted-foreground mb-3">
                            {t("meanwhile")}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Link
                                href="/calculator"
                                className="tap flex items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-[0_3px_0_0_hsl(var(--foreground))] hover:bg-primary/90 transition-colors"
                            >
                                <Calculator className="h-4 w-4 shrink-0" aria-hidden="true" />
                                <span>{t("ctaRates")}</span>
                            </Link>
                            <Link
                                href="/browse"
                                className="tap flex items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-card px-4 py-3 text-sm font-bold text-foreground shadow-[0_3px_0_0_hsl(var(--foreground))] hover:bg-secondary/30 transition-colors"
                            >
                                <FolderOpen className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                                <span>{t("ctaBrowse")}</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </TrackMotionCard>
        </div>
    );
}
