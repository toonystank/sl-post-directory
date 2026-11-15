"use client";

import { useEffect, useState, useRef } from "react";
import { MapPin } from "lucide-react";
import { useAds } from "./AdManager";

type WindowWithCapacitor = Window & {
    Capacitor?: { isNativePlatform?: () => boolean };
};

function isNativePlatform(): boolean {
    return typeof window !== 'undefined' && !!(window as WindowWithCapacitor).Capacitor?.isNativePlatform?.();
}

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
        const native = isNativePlatform();
        setIsNative(native);

        if (native && position === "sticky-bottom" && !hasRequestedNativeBanner.current && adsEnabled) {
            hasRequestedNativeBanner.current = true;
            
            const showNativeBanner = async () => {
                try {
                    const { AdMob, BannerAdSize, BannerAdPosition } = await import("@capacitor-community/admob");
                    const { Capacitor } = await import("@capacitor/core");
                    await AdMob.showBanner({
                        adId: Capacitor.getPlatform() === 'ios' ? 'ca-app-pub-3940256099942544/2934735716' : 'ca-app-pub-3940256099942544/6300978111',
                        adSize: BannerAdSize.BANNER,
                        position: BannerAdPosition.BOTTOM_CENTER,
                        // keep the native banner above the app's bottom tab bar
                        margin: 60,
                        isTesting: true,
                    });
                } catch (error) {
                    console.error("Failed to show AdMob banner:", error);
                }
            };

            showNativeBanner();

            return () => {
                import("@capacitor-community/admob").then(({ AdMob }) => {
                    AdMob.hideBanner().catch(console.error);
                    AdMob.removeBanner().catch(console.error);
                }).catch(console.error);
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
             <div className={`w-full border border-dashed border-foreground/30 rounded-md p-4 flex flex-col items-center justify-center text-center space-y-1 my-2 ${className}`} style={style}>
                 <MapPin className="w-5 h-5 text-muted-foreground" />
                 <p className="label-mono">Advertisement</p>
                 <p className="text-sm font-medium text-foreground/80">Support Lanka Post Directory</p>
             </div>
        );
    }

    // ====== WEB VIEW (ADSENSE) ======
    return (
        <div 
            className={`ad-container flex justify-center items-center overflow-hidden 
                ${position === 'sticky-bottom' ? 'fixed bottom-tabbar left-0 right-0 z-40 bg-background border-t border-border py-1 min-h-[50px]' : 'w-full my-4 rounded-md min-h-[250px] bg-muted/50'} 
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
