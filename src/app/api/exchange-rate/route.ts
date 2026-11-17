import { NextResponse } from "next/server";
import { DEFAULT_USD_TO_LKR_RATE } from "@/lib/currency";

interface ExchangeRateCache {
    rate: number;
    source: "live" | "fallback";
    updatedAt: string;
    expiresAt: number;
}

let cachedRate: ExchangeRateCache | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function GET() {
    const now = Date.now();
    if (cachedRate && cachedRate.expiresAt > now) {
        return NextResponse.json({
            base: "USD",
            target: "LKR",
            rate: cachedRate.rate,
            source: cachedRate.source,
            updatedAt: cachedRate.updatedAt,
        });
    }

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        const res = await fetch("https://open.er-api.com/v6/latest/USD", {
            signal: controller.signal,
            next: { revalidate: 3600 },
        });
        clearTimeout(timer);

        if (res.ok) {
            const data = (await res.json()) as { rates?: { LKR?: number }; time_last_update_utc?: string };
            const lkr = data?.rates?.LKR;
            if (typeof lkr === "number" && Number.isFinite(lkr) && lkr > 100 && lkr < 2000) {
                cachedRate = {
                    rate: Number(lkr.toFixed(2)),
                    source: "live",
                    updatedAt: data.time_last_update_utc || new Date().toISOString(),
                    expiresAt: now + CACHE_TTL_MS,
                };
                return NextResponse.json({
                    base: "USD",
                    target: "LKR",
                    rate: cachedRate.rate,
                    source: cachedRate.source,
                    updatedAt: cachedRate.updatedAt,
                });
            }
        }
    } catch {
        // Fallback smoothly if network is unavailable
    }

    return NextResponse.json({
        base: "USD",
        target: "LKR",
        rate: DEFAULT_USD_TO_LKR_RATE,
        source: "fallback",
        updatedAt: new Date().toISOString(),
    });
}
