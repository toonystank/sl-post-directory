"use client";

import { useEffect, useState, useRef } from "react";
import { MapPin } from "lucide-react";
import { usePathname } from "@/navigation";
import { stripLocalePrefix } from "@/lib/locale";
import { useAds } from "./AdManager";

const HIDDEN_ON = ["/login", "/register", "/dashboard"];

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

export default function AdBanner({ position = "in-feed", className = "", style }: AdBannerProps) {
    const pathname = stripLocalePrefix(usePathname() || "/");
    const [isNative, setIsNative] = useState<boolean | null>(null);
    const hasRequestedNativeBanner = useRef(false);
    const { adsEnabled, loading } = useAds();
    const isHiddenRoute = HIDDEN_ON.some((p) => pathname.startsWith(p));

    useEffect(() => {
        if (isHiddenRoute) return;
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
    }, [position, adsEnabled, isHiddenRoute]);

    // Hide on auth/admin workspace or when disabled
    if (isHiddenRoute || loading || !adsEnabled) return null;

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

    // Web ads are handled exclusively via AdSense Auto Ads (loaded in AdManager)
    // to avoid sticky/in-list placements near navigation elements.
    return null;
}
