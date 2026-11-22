"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { m } from "motion/react";
import { useCurrency } from "@/context/CurrencyContext";
import { CURRENCY_META, type Currency } from "@/lib/currency";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const CURRENCIES: Currency[] = ["LKR", "USD"];

/**
 * Compact segmented currency switcher ("Rs. LKR | $ USD") placed beside the language selector.
 * Defaults to LKR and animates smoothly between options via shared layoutId.
 */
export default function CurrencySwitcher({
    className,
    compact = false,
}: {
    className?: string;
    compact?: boolean;
}) {
    const t = useTranslations("App");
    const { currency, setCurrency } = useCurrency();
    const switcherId = React.useId();

    return (
        <div
            role="radiogroup"
            aria-label={t("currencyLabel")}
            data-testid="currency-switcher"
            className={cn(
                "inline-flex items-center rounded-full bg-card p-0.5 shrink-0",
                compact
                    ? "h-8 border border-border shadow-[var(--shadow-elev-1)]"
                    : "border-2 border-foreground",
                className
            )}
        >
            {CURRENCIES.map((code) => {
                const active = currency === code;
                const meta = CURRENCY_META[code];
                return (
                    <button
                        key={code}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={`${meta.label} (${meta.symbol} ${code})`}
                        data-testid={`currency-option-${code}`}
                        onClick={() => {
                            triggerHaptic("selection");
                            setCurrency(code);
                        }}
                        className={cn(
                            "tap relative inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-bold leading-none transition-colors",
                            compact ? "min-h-[26px]" : "min-h-[24px]",
                            active ? "text-background" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {active && (
                            <m.span
                                layoutId={`currency-pill-${switcherId}`}
                                transition={{ type: "spring", stiffness: 500, damping: 35 }}
                                className="absolute inset-0 rounded-full bg-foreground"
                                aria-hidden="true"
                            />
                        )}
                        <span aria-hidden="true" className="relative z-10 font-extrabold">
                            {meta.symbol}
                        </span>
                        <span className="relative z-10 hidden min-[360px]:inline tracking-tight">
                            {code}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
