"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "@/navigation";
import { stripLocalePrefix } from "@/lib/locale";
import { isTwaRuntime } from "@/lib/pwa";
import { getAdSenseClientId } from "@/lib/site";

const NON_CONTENT_PREFIXES = ["/login", "/register", "/dashboard", "/suggest", "/offline"];
const ADS_CONFIG_STORAGE_KEY = "sl-post-ads-config-v1";
const ADS_CONFIG_TTL_MS = 1000 * 60 * 30; // 30 minutes
let cachedAdsEnabled: boolean | null = null;

interface AdContextType {
    adsEnabled: boolean;
    loading: boolean;
    isTwa: boolean;
}

const AdContext = createContext<AdContextType>({ adsEnabled: false, loading: true, isTwa: false });

export function useAds() {
    return useContext(AdContext);
}

type WindowWithCapacitor = Window & {
    Capacitor?: { isNativePlatform?: () => boolean };
};

function isNativePlatform(): boolean {
    return typeof window !== "undefined" && !!(window as WindowWithCapacitor).Capacitor?.isNativePlatform?.();
}

/**
 * Defers AdSense script injection & config network calls until after first paint
 * and either first user interaction (scroll/pointer/key) or an idle fallback window.
 * Uses `/api/public/config` (edge + SW cached) with localStorage SWR so startup LCP/TBT
 * stay completely untouched.
 */
export default function AdManager({ children }: { children: React.ReactNode }) {
    const pathname = stripLocalePrefix(usePathname() || "/");
    const [adsEnabled, setAdsEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isNative, setIsNative] = useState(false);
    const [isTwa, setIsTwa] = useState(false);
    const [paintReady, setPaintReady] = useState(false);

    const isExcludedRoute = NON_CONTENT_PREFIXES.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`)
    );
    const disableInTwa = process.env.NEXT_PUBLIC_DISABLE_ADS_IN_TWA === "true";
    const effectiveAdsEnabled = adsEnabled && !isExcludedRoute && !(isTwa && disableInTwa);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const native = isNativePlatform();
        const twa = isTwaRuntime(
            document.referrer,
            (q) => window.matchMedia(q).matches
        );
        setIsNative(native);
        setIsTwa(twa);

        let isMounted = true;
        let triggered = false;
        let idleId: number | null = null;
        let timeoutId: number | null = null;

        const hydrateConfigAndAds = async () => {
            if (!isMounted) return;

            let resolvedEnabled: boolean | null = cachedAdsEnabled;
            let shouldFetchRemote = resolvedEnabled === null;

            if (resolvedEnabled === null) {
                try {
                    const raw = window.localStorage.getItem(ADS_CONFIG_STORAGE_KEY);
                    if (raw) {
                        const parsed = JSON.parse(raw) as { adsEnabled?: boolean; savedAt?: number };
                        if (typeof parsed.adsEnabled === "boolean") {
                            resolvedEnabled = parsed.adsEnabled;
                            cachedAdsEnabled = resolvedEnabled;
                            if (typeof parsed.savedAt === "number" && Date.now() - parsed.savedAt < ADS_CONFIG_TTL_MS) {
                                shouldFetchRemote = false;
                            }
                        }
                    }
                } catch {
                    // Ignore storage errors
                }
            }

            if (shouldFetchRemote && navigator.onLine) {
                try {
                    const res = await fetch("/api/public/config");
                    if (res.ok) {
                        const data = (await res.json()) as { adsEnabled?: boolean };
                        resolvedEnabled = Boolean(data.adsEnabled);
                        cachedAdsEnabled = resolvedEnabled;
                        try {
                            window.localStorage.setItem(
                                ADS_CONFIG_STORAGE_KEY,
                                JSON.stringify({ adsEnabled: resolvedEnabled, savedAt: Date.now() })
                            );
                        } catch {
                            // Ignore quota errors
                        }
                    }
                } catch {
                    if (resolvedEnabled === null) resolvedEnabled = true;
                }
            }

            if (resolvedEnabled === null) {
                resolvedEnabled = true;
            }

            if (isMounted) {
                setAdsEnabled(resolvedEnabled);
                setPaintReady(true);
                setLoading(false);
            }

            // Initialize AdMob only if running inside legacy Capacitor shell
            if (native && resolvedEnabled) {
                try {
                    const { AdMob } = await import("@capacitor-community/admob");
                    await AdMob.initialize({ testingDevices: [] });
                } catch {
                    // Ignore native init error on web
                }
            }
        };

        const activate = () => {
            if (triggered) return;
            triggered = true;
            cleanup();
            void hydrateConfigAndAds();
        };

        const cleanup = () => {
            window.removeEventListener("pointerdown", activate);
            window.removeEventListener("keydown", activate);
            window.removeEventListener("scroll", activate);
            if (idleId !== null && "cancelIdleCallback" in window) {
                window.cancelIdleCallback(idleId);
            }
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
            }
        };

        window.addEventListener("pointerdown", activate, { passive: true, once: true });
        window.addEventListener("keydown", activate, { passive: true, once: true });
        window.addEventListener("scroll", activate, { passive: true, once: true });

        if (typeof window.requestIdleCallback === "function") {
            idleId = window.requestIdleCallback(
                () => {
                    timeoutId = globalThis.setTimeout(activate, 1800) as unknown as number;
                },
                { timeout: 3500 }
            );
        } else {
            timeoutId = globalThis.setTimeout(activate, 3500) as unknown as number;
        }

        return () => {
            isMounted = false;
            cleanup();
        };
    }, []);

    useEffect(() => {
        if (!paintReady || !effectiveAdsEnabled || isNative) return;
        const scriptSrc =
            `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(getAdSenseClientId())}`;
        if (document.querySelector(`script[src="${scriptSrc}"]`)) return;

        const script = document.createElement("script");
        script.async = true;
        script.src = scriptSrc;
        script.crossOrigin = "anonymous";
        document.head.appendChild(script);
    }, [paintReady, effectiveAdsEnabled, isNative]);

    return (
        <AdContext.Provider value={{ adsEnabled: effectiveAdsEnabled, loading, isTwa }}>
            {children}
        </AdContext.Provider>
    );
}
