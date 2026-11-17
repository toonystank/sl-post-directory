"use client";

import * as React from "react";
import {
    Currency,
    CURRENCY_STORAGE_KEY,
    DEFAULT_CURRENCY,
    DEFAULT_USD_TO_LKR_RATE,
    isSupportedCurrency,
} from "@/lib/currency";

interface CurrencyContextValue {
    currency: Currency;
    setCurrency: (currency: Currency) => void;
    toggleCurrency: () => void;
    lkrPerUsd: number;
    rateSource: "live" | "fallback";
}

const CurrencyContext = React.createContext<CurrencyContextValue>({
    currency: DEFAULT_CURRENCY,
    setCurrency: () => {},
    toggleCurrency: () => {},
    lkrPerUsd: DEFAULT_USD_TO_LKR_RATE,
    rateSource: "fallback",
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
    const [currency, setCurrencyState] = React.useState<Currency>(DEFAULT_CURRENCY);
    const [lkrPerUsd, setLkrPerUsd] = React.useState<number>(DEFAULT_USD_TO_LKR_RATE);
    const [rateSource, setRateSource] = React.useState<"live" | "fallback">("fallback");

    React.useEffect(() => {
        try {
            const saved = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
            if (isSupportedCurrency(saved)) {
                setCurrencyState(saved);
            }
        } catch {
            // Ignore localStorage restrictions
        }

        let active = true;
        fetch("/api/exchange-rate")
            .then((r) => (r.ok ? r.json() : null))
            .then((data: { rate?: number; source?: "live" | "fallback" } | null) => {
                if (!active || !data) return;
                if (typeof data.rate === "number" && Number.isFinite(data.rate) && data.rate > 0) {
                    setLkrPerUsd(data.rate);
                    setRateSource(data.source === "live" ? "live" : "fallback");
                }
            })
            .catch(() => {
                // Keep fallback rate silently
            });

        return () => {
            active = false;
        };
    }, []);

    const setCurrency = React.useCallback((next: Currency) => {
        setCurrencyState(next);
        try {
            window.localStorage.setItem(CURRENCY_STORAGE_KEY, next);
        } catch {
            // Ignore localStorage restrictions
        }
    }, []);

    const toggleCurrency = React.useCallback(() => {
        setCurrencyState((prev) => {
            const next: Currency = prev === "LKR" ? "USD" : "LKR";
            try {
                window.localStorage.setItem(CURRENCY_STORAGE_KEY, next);
            } catch {
                // Ignore
            }
            return next;
        });
    }, []);

    const value = React.useMemo(
        () => ({ currency, setCurrency, toggleCurrency, lkrPerUsd, rateSource }),
        [currency, setCurrency, toggleCurrency, lkrPerUsd, rateSource]
    );

    return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
    return React.useContext(CurrencyContext);
}
