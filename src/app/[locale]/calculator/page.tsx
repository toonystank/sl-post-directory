import type { Metadata } from "next";
import PostageCalculator from "@/components/PostageCalculator";

export const metadata: Metadata = {
    title: "Postage Calculator",
    description:
        "Calculate official Sri Lanka Post shipping costs for domestic letters, parcels, SLP Courier (formerly Speed Post), COD, and international EMS, Air Mail, U-Packet, TDS, and Sea Mail.",
};

export default async function CalculatorPage({ searchParams }: { searchParams: Promise<{ mode?: string | string[] }> }) {
    const { mode } = await searchParams;
    const m = Array.isArray(mode) ? mode[0] : mode;
    const initialMode = m === "cod" ? "cod" : m === "local" ? "domestic" : "ems";
    return (
        <div className="container mx-auto px-3 py-2 md:px-4 md:py-10 min-h-[calc(100dvh-var(--appbar-h)-var(--tabbar-h))] md:min-h-[calc(100vh-4rem)] flex flex-col justify-start">
            <header className="hidden md:block max-w-2xl mx-auto w-full mb-6">
                <p className="label-mono mb-1.5">Sri Lanka Post Tariff · Effective Feb 9, 2026</p>
                <h1 className="display text-4xl lg:text-5xl mb-2">
                    Postage Calculator
                </h1>
                <p className="text-muted-foreground text-base">
                    Instant rates for international mail &amp; EMS, Cash on Delivery (COD), and domestic post.
                </p>
                <div className="mt-3 border-l-4 border-secondary bg-card px-4 py-2 text-xs text-muted-foreground">
                    <strong className="text-foreground">Official Circular:</strong> Based on official Sri Lanka Post tariff schedules: Domestic Postage Revision (w.e.f. Feb 9, 2026), Tracked Delivery Service (w.e.f. Oct 1, 2025), Cash on Delivery (COD), and Foreign Postage &amp; EMS Country Schedules.
                </div>
            </header>

            <PostageCalculator key={initialMode} initialMode={initialMode} />
        </div>
    );
}
