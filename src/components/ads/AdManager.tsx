"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Script from "next/script";
import { Capacitor } from "@capacitor/core";
import { AdMob } from "@capacitor-community/admob";

interface AdContextType {
    adsEnabled: boolean;
    loading: boolean;
}

const AdContext = createContext<AdContextType>({ adsEnabled: true, loading: true });

export function useAds() {
    return useContext(AdContext);
}

export default function AdManager({ children }: { children: React.ReactNode }) {
    const [adsEnabled, setAdsEnabled] = useState(true);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

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

            // Initialize AdMob for native
            if (Capacitor.isNativePlatform()) {
                try {
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

        setTimeout(init, 500);

        return () => {
            isMounted = false;
        };
    }, []);

    return (
        <AdContext.Provider value={{ adsEnabled, loading }}>
            {/* Conditionally load AdSense script only when ads are enabled */}
            {adsEnabled && !Capacitor.isNativePlatform() && (
                <Script
                    async
                    src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2503310431210239"
                    crossOrigin="anonymous"
                    strategy="afterInteractive"
                />
            )}
            {children}
        </AdContext.Provider>
    );
}
