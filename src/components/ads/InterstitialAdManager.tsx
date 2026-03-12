"use client";

import { useEffect, useRef } from "react";
import { AdMob, InterstitialAdPluginEvents } from "@capacitor-community/admob";
import { Capacitor } from "@capacitor/core";

// Simple global tracker so we don't show an ad EVERY single click
let adClickCounter = 0;
const CLICKS_BEFORE_AD = 3; 

export default function InterstitialAdManager() {
    const isLoaded = useRef(false);

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        // Listen for when ad is closed so we can preload the next one
        const listener = AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
             preloadInterstitial();
        });

        // Initial load
        preloadInterstitial();

        return () => {
            listener.then(l => l.remove());
        };
    }, []);

    const preloadInterstitial = async () => {
         try {
             await AdMob.prepareInterstitial({
                 // Test Interstitial App ID
                 adId: Capacitor.getPlatform() === 'ios' ? 'ca-app-pub-3940256099942544/4411468910' : 'ca-app-pub-3940256099942544/1033173712',
                 isTesting: true 
             });
             isLoaded.current = true;
         } catch (error) {
             console.error("Failed to prepare interstitial:", error);
         }
    };

    return null;
}

/**
 * Call this function when the user performs a high-value navigation.
 * It will only trigger if enough clicks have happened and native platform is detected.
 */
export const tryShowInterstitial = async () => {
    if (!Capacitor.isNativePlatform()) return;

    adClickCounter++;
    
    if (adClickCounter >= CLICKS_BEFORE_AD) {
        try {
            await AdMob.showInterstitial();
            adClickCounter = 0; // Reset counter after showing
        } catch (error) {
            console.error("Failed to show interstitial:", error);
        }
    }
}
