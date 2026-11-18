"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "@/navigation";
import {
    getCachedOfficesList,
    isStandaloneDisplayMode,
    saveOfficesToOfflineCache,
} from "@/lib/pwa";

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
}

interface PWAContextValue {
    isInstalled: boolean;
    canNativePrompt: boolean;
    isIOS: boolean;
    isOnline: boolean;
    isBannerDismissed: boolean;
    showInstallModal: boolean;
    isCachingLocalAssets: boolean;
    localAssetsCached: boolean;
    updateAvailable: boolean;
    offlineOfficesCount: number;
    isOfflineFallbackPage: boolean;
    triggerInstall: () => Promise<void>;
    dismissBanner: () => void;
    closeInstallModal: () => void;
    warmLocalAssets: () => Promise<void>;
    applyUpdate: () => void;
    setOfflineFallbackPage: (active: boolean) => void;
}

const PWAContext = createContext<PWAContextValue | null>(null);

const DISMISSED_SESSION_KEY = "sl-post-pwa-prompt-dismissed-session";
const ASSETS_CACHED_KEY = "sl-post-pwa-assets-cached-v5";

const CORE_ROUTES_TO_WARM = [
    "/",
    "/calculator",
    "/browse",
    "/track",
    "/blog",
    "/offline",
];
const CORE_VISUAL_ASSETS = [
    "/icon-192x192.png",
    "/icon-512x512.png",
    "/icon-maskable-512x512.png",
    "/apple-touch-icon.png",
    "/manifest.webmanifest",
];

export function PWAProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isOnline, setIsOnline] = useState(true);
    const [isBannerDismissed, setIsBannerDismissed] = useState(false);
    const [showInstallModal, setShowInstallModal] = useState(false);
    const [isCachingLocalAssets, setIsCachingLocalAssets] = useState(false);
    const [localAssetsCached, setLocalAssetsCached] = useState(false);
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [offlineOfficesCount, setOfflineOfficesCount] = useState(0);

    const refreshOfflineCount = useCallback(() => {
        setOfflineOfficesCount(getCachedOfficesList().length);
    }, []);

    const warmLocalAssets = useCallback(async () => {
        if (typeof window === "undefined") return;
        setIsCachingLocalAssets(true);
        try {
            // 1. Prefetch Next.js client routes for instant app tab switching
            for (const route of CORE_ROUTES_TO_WARM) {
                try {
                    router.prefetch(route);
                } catch {
                    // Ignore prefetch errors
                }
            }

            // 2. Ask Service Worker to pre-cache UI shells, offline pages, visual icons & 3 locale shells
            if ("serviceWorker" in navigator) {
                const reg = await navigator.serviceWorker.ready.catch(() => null);
                reg?.active?.postMessage({
                    type: "PRECACHE_APP_SHELL",
                    urls: [
                        ...CORE_ROUTES_TO_WARM,
                        "/si",
                        "/ta",
                        "/si/offline",
                        "/ta/offline",
                        ...CORE_VISUAL_ASSETS,
                        "/api/exchange-rate",
                        "/api/autocomplete?q=colombo&mode=all",
                        "/api/autocomplete?q=kandy&mode=all",
                    ],
                });
            }

            // 3. Also warm Cache Storage directly for visual assets
            if ("caches" in window) {
                const cache = await caches.open("sl-post-static-v5").catch(() => null);
                if (cache) {
                    await Promise.allSettled(CORE_VISUAL_ASSETS.map((url) => cache.add(url)));
                }
            }

            // 4. Seed initial offline directory cache if empty and online
            if (navigator.onLine && getCachedOfficesList().length === 0) {
                try {
                    const res = await fetch("/api/offices?limit=24&cursor=0");
                    if (res.ok) {
                        const data = await res.json();
                        if (Array.isArray(data?.offices) && data.offices.length > 0) {
                            const count = saveOfficesToOfflineCache(data.offices);
                            setOfflineOfficesCount(count);
                        }
                    }
                } catch {
                    // Ignore network seed failures
                }
            }

            try {
                localStorage.setItem(ASSETS_CACHED_KEY, "true");
            } catch {
                // Ignore storage errors
            }
            setLocalAssetsCached(true);
            refreshOfflineCount();
        } finally {
            setIsCachingLocalAssets(false);
        }
    }, [router, refreshOfflineCount]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        // Check online state
        setIsOnline(navigator.onLine);
        const onOnline = () => setIsOnline(true);
        const onOffline = () => setIsOnline(false);
        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);

        // Detect standalone mode (installed PWA)
        const checkStandalone = () =>
            isStandaloneDisplayMode(
                (q) => window.matchMedia(q).matches,
                (window.navigator as unknown as { standalone?: boolean }).standalone
            );

        setIsInstalled(checkStandalone());

        const displayModeMql = window.matchMedia("(display-mode: standalone)");
        const onDisplayModeChange = (e: MediaQueryListEvent) => {
            setIsInstalled(e.matches || checkStandalone());
        };
        displayModeMql.addEventListener?.("change", onDisplayModeChange);

        // Detect iOS / iPadOS devices (including iPadOS desktop-class Safari)
        const ua = window.navigator.userAgent.toLowerCase();
        const isTouchMac =
            ua.includes("macintosh") && typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1;
        setIsIOS(/iphone|ipad|ipod/.test(ua) || isTouchMac);

        // Check session dismissal & cached assets status
        try {
            if (sessionStorage.getItem(DISMISSED_SESSION_KEY) === "true") {
                setIsBannerDismissed(true);
            }
            if (localStorage.getItem(ASSETS_CACHED_KEY) === "true") {
                setLocalAssetsCached(true);
            }
        } catch {
            // Ignore storage errors
        }

        refreshOfflineCount();

        const onOfflineCacheUpdated = () => refreshOfflineCount();
        window.addEventListener("slpost-offline-cache-updated", onOfflineCacheUpdated);

        const onSwUpdate = () => setUpdateAvailable(true);
        window.addEventListener("slpost-sw-update", onSwUpdate);
        if (window.__slPostWaitingSw) {
            setUpdateAvailable(true);
        }

        const onBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };

        const onAppInstalled = () => {
            setIsInstalled(true);
            setDeferredPrompt(null);
            setShowInstallModal(false);
            void warmLocalAssets();
        };

        window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
        window.addEventListener("appinstalled", onAppInstalled);

        // Warm core UI shell routes, icons & languages in idle time
        const idleTimer = window.setTimeout(() => {
            void warmLocalAssets();
        }, 1200);

        return () => {
            window.removeEventListener("online", onOnline);
            window.removeEventListener("offline", onOffline);
            window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
            window.removeEventListener("appinstalled", onAppInstalled);
            window.removeEventListener("slpost-offline-cache-updated", onOfflineCacheUpdated);
            window.removeEventListener("slpost-sw-update", onSwUpdate);
            displayModeMql.removeEventListener?.("change", onDisplayModeChange);
            window.clearTimeout(idleTimer);
        };
    }, [warmLocalAssets, refreshOfflineCount]);

    const triggerInstall = useCallback(async () => {
        void warmLocalAssets();

        if (deferredPrompt) {
            try {
                await deferredPrompt.prompt();
                const choice = await deferredPrompt.userChoice;
                if (choice.outcome === "accepted") {
                    setIsInstalled(true);
                    setDeferredPrompt(null);
                }
            } catch {
                setShowInstallModal(true);
            }
            return;
        }

        // Show step-by-step instructions modal for iOS Safari / browsers without native prompt
        setShowInstallModal(true);
    }, [deferredPrompt, warmLocalAssets]);

    const dismissBanner = useCallback(() => {
        setIsBannerDismissed(true);
        try {
            sessionStorage.setItem(DISMISSED_SESSION_KEY, "true");
        } catch {
            // Ignore
        }
    }, []);

    const closeInstallModal = useCallback(() => {
        setShowInstallModal(false);
    }, []);

    const applyUpdate = useCallback(() => {
        const waiting = window.__slPostWaitingSw;
        if (waiting) {
            window.__slPostReloadOnControllerChange = true;
            waiting.postMessage({ type: "SKIP_WAITING" });
            setUpdateAvailable(false);
        } else {
            window.location.reload();
        }
    }, []);

    return (
        <PWAContext.Provider
            value={{
                isInstalled,
                canNativePrompt: Boolean(deferredPrompt),
                isIOS,
                isOnline,
                isBannerDismissed,
                showInstallModal,
                isCachingLocalAssets,
                localAssetsCached,
                updateAvailable,
                offlineOfficesCount,
                triggerInstall,
                dismissBanner,
                closeInstallModal,
                warmLocalAssets,
                applyUpdate,
            }}
        >
            {children}
        </PWAContext.Provider>
    );
}

export function usePWA() {
    const ctx = useContext(PWAContext);
    if (!ctx) {
        throw new Error("usePWA must be used within PWAProvider");
    }
    return ctx;
}
