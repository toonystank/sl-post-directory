"use client";

import { useTranslations } from "next-intl";
import { useCurrency } from "@/context/CurrencyContext";
import { CURRENCY_META, type Currency } from "@/lib/currency";
import { cn } from "@/lib/utils";

const CURRENCIES: Currency[] = ["LKR", "USD"];

/**
 * Compact segmented currency switcher ("Rs. LKR | $ USD") placed beside the language selector.
 * Defaults to LKR and displays explicit currency symbols for clear price indication.
 */
export default function CurrencySwitcher({ className }: { className?: string }) {
    const t = useTranslations("App");
    const { currency, setCurrency } = useCurrency();

    return (
        <div
            role="radiogroup"
            aria-label={t("currencyLabel")}
            data-testid="currency-switcher"
            className={cn(
                "inline-flex items-center rounded-full border-2 border-foreground bg-card p-0.5 shrink-0",
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
                        onClick={() => setCurrency(code)}
                        className={cn(
                            "tap inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-bold leading-none min-h-[24px] transition-colors",
                            active
                                ? "bg-foreground text-background"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <span aria-hidden="true" className="font-extrabold">
                            {meta.symbol}
                        </span>
                        <span className="hidden min-[360px]:inline tracking-tight">
                            {code}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
