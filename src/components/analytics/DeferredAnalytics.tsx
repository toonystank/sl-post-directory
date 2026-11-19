"use client";

import { useEffect } from "react";

declare global {
    interface Window {
        dataLayer?: unknown[];
        gtag?: (...args: unknown[]) => void;
    }
}

/**
 * Defers Google Analytics 4 script loading until after first paint and either
 * the user's first interaction (scroll/pointer/key) or an idle fallback window.
 * Keeps startup LCP, TBT, and mobile CPU completely free of analytics overhead.
 */
export default function DeferredAnalytics({ gaId }: { gaId?: string }) {
    useEffect(() => {
        if (!gaId || typeof window === "undefined") return;

        let triggered = false;
        let idleId: number | null = null;
        let timeoutId: number | null = null;

        const injectGa = () => {
            if (triggered) return;
            triggered = true;
            cleanup();

            const scriptId = `ga4-gtag-${gaId}`;
            if (document.getElementById(scriptId)) return;

            window.dataLayer = window.dataLayer || [];
            window.gtag = function gtag(...args: unknown[]) {
                window.dataLayer?.push(args);
            };
            window.gtag("js", new Date());
            window.gtag("config", gaId);

            const script = document.createElement("script");
            script.id = scriptId;
            script.async = true;
            script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
            document.head.appendChild(script);
        };

        const cleanup = () => {
            window.removeEventListener("pointerdown", injectGa);
            window.removeEventListener("keydown", injectGa);
            window.removeEventListener("scroll", injectGa);
            if (idleId !== null && typeof window.cancelIdleCallback === "function") {
                window.cancelIdleCallback(idleId);
            }
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
            }
        };

        window.addEventListener("pointerdown", injectGa, { passive: true, once: true });
        window.addEventListener("keydown", injectGa, { passive: true, once: true });
        window.addEventListener("scroll", injectGa, { passive: true, once: true });

        if (typeof window.requestIdleCallback === "function") {
            idleId = window.requestIdleCallback(
                () => {
                    timeoutId = globalThis.setTimeout(injectGa, 1500) as unknown as number;
                },
                { timeout: 3500 }
            );
        } else {
            timeoutId = globalThis.setTimeout(injectGa, 4000) as unknown as number;
        }

        return cleanup;
    }, [gaId]);

    return null;
}
