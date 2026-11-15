import type { Metadata } from "next";
import PostageCalculator from "@/components/PostageCalculator";

export const metadata: Metadata = {
    title: "Postage Calculator",
    description: "Estimate Sri Lanka Post shipping costs for domestic and international mail. Calculate rates for letters, parcels, and EMS.",
};

export default function CalculatorPage() {
    return (
        <div className="container mx-auto px-4 py-6 md:py-12 min-h-[calc(100vh-4rem)]">
            <header className="max-w-2xl mx-auto mb-8">
                <p className="label-mono mb-2">Sri Lanka Post Tariff</p>
                <h1 className="display text-3xl md:text-5xl mb-2">
                    Postage Calculator
                </h1>
                <p className="text-muted-foreground text-sm md:text-base">
                    Estimate shipping costs for Sri Lanka Post services.
                </p>
                <div className="mt-4 border-l-4 border-secondary bg-card px-4 py-2.5 text-xs text-muted-foreground">
                    <strong className="text-foreground">Note:</strong> These rates are approximate estimates based on publicly available Sri Lanka Post tariffs. Actual rates may vary. Please confirm at your nearest post office.
                </div>
            </header>

            <PostageCalculator />
        </div>
    );
}
