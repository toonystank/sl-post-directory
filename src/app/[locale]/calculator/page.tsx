import type { Metadata } from "next";
import PostageCalculator from "@/components/PostageCalculator";
import { Calculator } from "lucide-react";

export const metadata: Metadata = {
    title: "Postage Calculator",
    description: "Estimate Sri Lanka Post shipping costs for domestic and international mail. Calculate rates for letters, parcels, and EMS.",
};

export default function CalculatorPage() {
    return (
        <div className="container mx-auto px-4 py-12 min-h-[calc(100vh-4rem)]">
            {/* Header */}
            <div className="max-w-2xl mx-auto mb-10">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-primary/10 text-primary rounded-2xl ring-1 ring-primary/20">
                        <Calculator className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                            Postage Calculator
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            Estimate shipping costs for Sri Lanka Post services.
                        </p>
                    </div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl p-3 text-xs font-medium">
                    <strong>Note:</strong> These rates are approximate estimates based on publicly available Sri Lanka Post tariffs. Actual rates may vary. Please confirm at your nearest post office.
                </div>
            </div>

            <PostageCalculator />
        </div>
    );
}
