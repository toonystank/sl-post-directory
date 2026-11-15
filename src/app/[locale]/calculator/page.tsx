import type { Metadata } from "next";
import PostageCalculator from "@/components/PostageCalculator";

export const metadata: Metadata = {
    title: "Postage Calculator",
    description:
        "Calculate official Sri Lanka Post shipping costs for domestic letters, parcels, Speed Post, SL Post Courier, COD, and international EMS.",
};

export default function CalculatorPage() {
    return (
        <div className="container mx-auto px-3 py-2 md:px-4 md:py-10 min-h-[calc(100dvh-var(--appbar-h)-var(--tabbar-h))] md:min-h-[calc(100vh-4rem)] flex flex-col justify-start">
            <header className="hidden md:block max-w-2xl mx-auto w-full mb-6">
                <p className="label-mono mb-1.5">Sri Lanka Post Tariff · Effective Feb 9, 2026</p>
                <h1 className="display text-4xl lg:text-5xl mb-2">
                    Postage Calculator
                </h1>
                <p className="text-muted-foreground text-base">
                    Instant rates for domestic mail, Cash on Delivery (COD), and international EMS.
                </p>
                <div className="mt-3 border-l-4 border-secondary bg-card px-4 py-2 text-xs text-muted-foreground">
                    <strong className="text-foreground">Official Circular:</strong> Based on the Sri Lanka Post Domestic Postage Revision effective February 9, 2026. International EMS rates are approximate estimates—confirm at your nearest post office.
                </div>
            </header>

            <PostageCalculator />
        </div>
    );
}
