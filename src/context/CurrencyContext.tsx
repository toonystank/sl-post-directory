"use client";

import * as React from "react";
import {
    Currency,
    CURRENCY_STORAGE_KEY,
    DEFAULT_CURRENCY,
    DEFAULT_USD_TO_LKR_RATE,
    isSupportedCurrency,
} from "@/lib/currency";

const FX_CACHE_KEY = "sl-post-fx-cache-v1";
const FX_CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

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
        let isCacheFresh = false;
        try {
            const saved = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
            if (isSupportedCurrency(saved)) {
                setCurrencyState(saved);
            }

            const rawFx = window.localStorage.getItem(FX_CACHE_KEY);
            if (rawFx) {
                const parsed = JSON.parse(rawFx) as {
                    rate?: number;
                    source?: "live" | "fallback";
                    savedAt?: number;
                };
                if (typeof parsed.rate === "number" && Number.isFinite(parsed.rate) && parsed.rate > 0) {
                    setLkrPerUsd(parsed.rate);
                    setRateSource(parsed.source === "live" ? "live" : "fallback");
                    if (typeof parsed.savedAt === "number" && Date.now() - parsed.savedAt < FX_CACHE_TTL_MS) {
                        isCacheFresh = true;
                    }
                }
            }
        } catch {
            // Ignore localStorage restrictions
        }

        if (isCacheFresh) return;

        let active = true;
        let idleId: number | null = null;
        let timeoutId: number | null = null;

        const refreshRate = () => {
            if (!active || (typeof navigator !== "undefined" && !navigator.onLine)) return;
            fetch("/api/exchange-rate")
                .then((r) => (r.ok ? r.json() : null))
                .then((data: { rate?: number; source?: "live" | "fallback" } | null) => {
                    if (!active || !data) return;
                    if (typeof data.rate === "number" && Number.isFinite(data.rate) && data.rate > 0) {
                        const source = data.source === "live" ? "live" : "fallback";
                        setLkrPerUsd(data.rate);
                        setRateSource(source);
                        try {
                            window.localStorage.setItem(
                                FX_CACHE_KEY,
                                JSON.stringify({ rate: data.rate, source, savedAt: Date.now() })
                            );
                        } catch {
                            // Ignore quota errors
                        }
                    }
                })
                .catch(() => {
                    // Keep cached/fallback rate silently
                });
        };

        // Defer live FX fetch until browser is idle so it never competes with first paint
        if (typeof window.requestIdleCallback === "function") {
            idleId = window.requestIdleCallback(refreshRate, { timeout: 2500 });
        } else {
            timeoutId = globalThis.setTimeout(refreshRate, 1500) as unknown as number;
        }

        return () => {
            active = false;
            if (idleId !== null && "cancelIdleCallback" in window) {
                window.cancelIdleCallback(idleId);
            }
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
            }
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
