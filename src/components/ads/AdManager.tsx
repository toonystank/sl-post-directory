"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Script from "next/script";

interface AdContextType {
    adsEnabled: boolean;
    loading: boolean;
}

const AdContext = createContext<AdContextType>({ adsEnabled: true, loading: true });

export function useAds() {
    return useContext(AdContext);
}

function isNativePlatform(): boolean {
    return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
}

export default function AdManager({ children }: { children: React.ReactNode }) {
    const [adsEnabled, setAdsEnabled] = useState(true);
    const [loading, setLoading] = useState(true);
    const [isNative, setIsNative] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const native = isNativePlatform();
        setIsNative(native);

        const init = async () => {
            // Fetch ad settings
            try {
                const res = await fetch("/api/admin/settings");
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted) setAdsEnabled(data.adsEnabled);
                }
            } catch {
                // Default to true on error
            }

            // Initialize AdMob for native — dynamically imported
            if (native) {
                try {
                    const { AdMob } = await import("@capacitor-community/admob");
                    await AdMob.initialize({
                        testingDevices: [],
                    });
                    console.log("AdMob initialized successfully");
                } catch (error) {
                    console.error("Failed to initialize AdMob:", error);
                }
            }

            if (isMounted) setLoading(false);
        };

        // Use requestIdleCallback when available, fallback to setTimeout
        const scheduleInit = typeof window !== 'undefined' && 'requestIdleCallback' in window
            ? (cb: () => void) => (window as any).requestIdleCallback(cb)
            : (cb: () => void) => setTimeout(cb, 1000);
        scheduleInit(init);

        return () => {
            isMounted = false;
        };
    }, []);

    return (
        <AdContext.Provider value={{ adsEnabled, loading }}>
            {/* Conditionally load AdSense script only when ads are enabled */}
            {adsEnabled && !isNative && (
                <Script
                    async
                    src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2503310431210239"
                    crossOrigin="anonymous"
                    strategy="lazyOnload"
                />
            )}
            {children}
        </AdContext.Provider>
    );
}
