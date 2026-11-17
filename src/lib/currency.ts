export type Currency = "LKR" | "USD";

export const DEFAULT_CURRENCY: Currency = "LKR";
export const DEFAULT_USD_TO_LKR_RATE = 333.0;
export const CURRENCY_STORAGE_KEY = "lankapost-currency";

export interface CurrencyMeta {
    code: Currency;
    symbol: string;
    shortSymbol: string;
    label: string;
}

export const CURRENCY_META: Record<Currency, CurrencyMeta> = {
    LKR: {
        code: "LKR",
        symbol: "Rs.",
        shortSymbol: "₨",
        label: "Sri Lankan Rupee",
    },
    USD: {
        code: "USD",
        symbol: "$",
        shortSymbol: "$",
        label: "US Dollar",
    },
};

export function isSupportedCurrency(value: unknown): value is Currency {
    return value === "LKR" || value === "USD";
}

/**
 * Converts an amount in Sri Lankan Rupees (LKR) to the target display currency.
 */
export function convertLkrToCurrency(
    amountLkr: number,
    currency: Currency,
    lkrPerUsd: number = DEFAULT_USD_TO_LKR_RATE
): number {
    if (!Number.isFinite(amountLkr)) return 0;
    if (currency === "LKR") return amountLkr;
    const safeRate = Number.isFinite(lkrPerUsd) && lkrPerUsd > 0 ? lkrPerUsd : DEFAULT_USD_TO_LKR_RATE;
    return Number((amountLkr / safeRate).toFixed(2));
}

/**
 * Splits a converted price into its display currency symbol and formatted numeric value.
 */
export function splitCurrencyPrice(
    amountLkr: number,
    currency: Currency,
    lkrPerUsd: number = DEFAULT_USD_TO_LKR_RATE
): { symbol: string; value: string; code: Currency } {
    const converted = convertLkrToCurrency(amountLkr, currency, lkrPerUsd);
    if (currency === "USD") {
        return {
            symbol: CURRENCY_META.USD.symbol,
            value: converted.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }),
            code: "USD",
        };
    }

    return {
        symbol: CURRENCY_META.LKR.symbol,
        value: Math.round(converted).toLocaleString("en-US"),
        code: "LKR",
    };
}

/**
 * Formats an LKR amount in the chosen currency with its symbol (e.g. "Rs. 7,750" or "$23.27").
 */
export function formatCurrencyAmount(
    amountLkr: number,
    currency: Currency,
    lkrPerUsd: number = DEFAULT_USD_TO_LKR_RATE,
    options?: { plus?: boolean }
): string {
    const { symbol, value } = splitCurrencyPrice(amountLkr, currency, lkrPerUsd);
    const prefix = options?.plus ? "+" : "";
    if (currency === "USD") {
        return `${prefix}${symbol}${value}`;
    }
    return `${prefix}${symbol} ${value}`;
}
