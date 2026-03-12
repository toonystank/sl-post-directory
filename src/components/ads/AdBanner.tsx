"use client";

import { useEffect, useState, useRef } from "react";
import { AdMob, BannerAdSize, BannerAdPosition } from "@capacitor-community/admob";
import { Capacitor } from "@capacitor/core";
import { MapPin } from "lucide-react";
import { useAds } from "./AdManager";

interface AdBannerProps {
    position?: "sticky-bottom" | "in-feed";
    className?: string;
    style?: React.CSSProperties;
    adSlot?: string;
}

export default function AdBanner({ position = "in-feed", className = "", style, adSlot }: AdBannerProps) {
    const [isNative, setIsNative] = useState<boolean | null>(null);
    const hasRequestedNativeBanner = useRef(false);
    const { adsEnabled, loading } = useAds();

    useEffect(() => {
        const native = Capacitor.isNativePlatform();
        setIsNative(native);

        if (native && position === "sticky-bottom" && !hasRequestedNativeBanner.current && adsEnabled) {
            hasRequestedNativeBanner.current = true;
            
            const showNativeBanner = async () => {
                try {
                    await AdMob.showBanner({
                        adId: Capacitor.getPlatform() === 'ios' ? 'ca-app-pub-3940256099942544/2934735716' : 'ca-app-pub-3940256099942544/6300978111',
                        adSize: BannerAdSize.BANNER,
                        position: BannerAdPosition.BOTTOM_CENTER,
                        margin: 0,
                        isTesting: true,
                    });
                } catch (error) {
                    console.error("Failed to show AdMob banner:", error);
                }
            };

            showNativeBanner();

            return () => {
                AdMob.hideBanner().catch(console.error);
                AdMob.removeBanner().catch(console.error);
                hasRequestedNativeBanner.current = false;
            };
        }
    }, [position, adsEnabled]);

    // Don't render if ads are disabled or still loading
    if (loading || !adsEnabled) return null;

    // Don't render until we know the platform
    if (isNative === null) return null;

    // For Sticky Bottom on Native, the AdMob SDK handles drawing it OVER the webview.
    if (isNative && position === "sticky-bottom") {
        return null;
    }

    // Native In-Feed placeholder
    if (isNative && position === "in-feed") {
        return (
             <div className={`w-full bg-primary/5 border border-primary/20 rounded-xl p-4 flex flex-col items-center justify-center text-center space-y-2 mb-4 ${className}`} style={style}>
                 <MapPin className="w-6 h-6 text-primary/40" />
                 <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Advertisement</p>
                 <p className="text-sm font-medium text-foreground/80">Support SL Post Directory</p>
             </div>
        );
    }

    // ====== WEB VIEW (ADSENSE) ======
    return (
        <div 
            className={`ad-container flex justify-center items-center overflow-hidden 
                ${position === 'sticky-bottom' ? 'fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-t border-border/50 py-2' : 'w-full my-4 rounded-xl'} 
                ${className}`}
            style={style}
        >
            <ins 
                className="adsbygoogle"
                style={{ display: 'block', textAlign: 'center', width: position === 'sticky-bottom' ? '100%' : '100%', height: position === 'sticky-bottom' ? '50px' : 'auto' }}
                data-ad-client="pub-2503310431210239"
                data-ad-slot={adSlot || "1234567890"}
                data-ad-format={position === 'sticky-bottom' ? "horizontal" : "auto"}
                data-full-width-responsive="true"
            />
            
            <script dangerouslySetInnerHTML={{ __html: `(adsbygoogle = window.adsbygoogle || []).push({});` }} />
        </div>
    );
}
