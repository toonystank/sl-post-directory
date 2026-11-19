"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "@/navigation";
import { useInstantLocale } from "@/context/InstantLocaleContext";
import {
    getCachedOfficesList,
    isStandaloneDisplayMode,
    isTwaRuntime,
} from "@/lib/pwa";
import {
    ensureLocalOfficeIndex,
    getLocalIndexStoredCount,
} from "@/lib/office-index-client";

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
}

interface PWAContextValue {
    isInstalled: boolean;
    isTWA: boolean;
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
const ASSETS_CACHED_KEY = "sl-post-pwa-assets-cached-v7";

const CORE_ROUTES_TO_WARM = [
    "/",
    "/calculator",
    "/browse",
    "/track",
    "/blog",
    "/offline",
];

export function PWAProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { locale } = useInstantLocale();
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [isTWA, setIsTWA] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isOnline, setIsOnline] = useState(true);
    const [isBannerDismissed, setIsBannerDismissed] = useState(false);
    const [showInstallModal, setShowInstallModal] = useState(false);
    const [isCachingLocalAssets, setIsCachingLocalAssets] = useState(false);
    const [localAssetsCached, setLocalAssetsCached] = useState(false);
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [offlineOfficesCount, setOfflineOfficesCount] = useState(0);
    const [isOfflineFallbackPage, setIsOfflineFallbackPage] = useState(false);

    const refreshOfflineCount = useCallback(() => {
        const localIndexCount = getLocalIndexStoredCount();
        const legacyCount = getCachedOfficesList().length;
        setOfflineOfficesCount(Math.max(localIndexCount, legacyCount));
    }, []);

    const warmLocalAssets = useCallback(async () => {
        if (typeof window === "undefined") return;
        setIsCachingLocalAssets(true);
        try {
            // 1. Prefetch primary Next.js routes for instant tab switching
            for (const route of ["/", "/calculator", "/browse", "/track"]) {
                try {
                    router.prefetch(route);
                } catch {
                    // Ignore prefetch errors
                }
            }

            // 2. Hydrate compact 4,158-office local search index into IndexedDB (1 compressed fetch)
            const engine = await ensureLocalOfficeIndex().catch(() => null);
            if (engine) {
                setOfflineOfficesCount(engine.totalCount);
            }

            // 3. Ask Service Worker to cache ONLY the active locale's shell routes sequentially in background
            if ("serviceWorker" in navigator) {
                const reg = await navigator.serviceWorker.ready.catch(() => null);
                const prefix = locale === "en" ? "" : `/${locale}`;
                const localizedShellUrls = CORE_ROUTES_TO_WARM.map((r) =>
                    r === "/" ? (prefix || "/") : `${prefix}${r}`
                );
                reg?.active?.postMessage({
                    type: "PRECACHE_APP_SHELL",
                    urls: [
                        ...localizedShellUrls,
                        "/api/public/config",
                        "/api/exchange-rate",
                    ],
                });
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
    }, [router, locale, refreshOfflineCount]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        // Check online state
        setIsOnline(navigator.onLine);
        const onOnline = () => setIsOnline(true);
        const onOffline = () => setIsOnline(false);
        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);

        // Detect standalone PWA mode AND Android Play Store TWA runtime
        const matchesQuery = (q: string) => window.matchMedia(q).matches;
        const checkStandalone = () =>
            isStandaloneDisplayMode(
                matchesQuery,
                (window.navigator as unknown as { standalone?: boolean }).standalone
            );
        const twaDetected = isTwaRuntime(document.referrer, matchesQuery);

        setIsTWA(twaDetected);
        setIsInstalled(twaDetected || checkStandalone());

        const displayModeMql = window.matchMedia("(display-mode: standalone)");
        const onDisplayModeChange = (e: MediaQueryListEvent) => {
            setIsInstalled(twaDetected || e.matches || checkStandalone());
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
            if (!twaDetected) {
                setDeferredPrompt(e as BeforeInstallPromptEvent);
            }
        };

        const onAppInstalled = () => {
            setIsInstalled(true);
            setDeferredPrompt(null);
            setShowInstallModal(false);
            void warmLocalAssets();
        };

        window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
        window.addEventListener("appinstalled", onAppInstalled);

        // Defer background shell + 4,158-office index warming until browser is genuinely idle post-paint
        let idleId: number | null = null;
        let fallbackTimer: number | null = null;

        const scheduleWarm = () => {
            if (typeof window.requestIdleCallback === "function") {
                idleId = window.requestIdleCallback(
                    () => {
                        void warmLocalAssets();
                    },
                    { timeout: 4500 }
                );
            } else {
                fallbackTimer = globalThis.setTimeout(() => {
                    void warmLocalAssets();
                }, 3000) as unknown as number;
            }
        };

        const postPaintTimer = window.setTimeout(scheduleWarm, 2200);

        return () => {
            window.removeEventListener("online", onOnline);
            window.removeEventListener("offline", onOffline);
            window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
            window.removeEventListener("appinstalled", onAppInstalled);
            window.removeEventListener("slpost-offline-cache-updated", onOfflineCacheUpdated);
            window.removeEventListener("slpost-sw-update", onSwUpdate);
            displayModeMql.removeEventListener?.("change", onDisplayModeChange);
            window.clearTimeout(postPaintTimer);
            if (idleId !== null && "cancelIdleCallback" in window) {
                window.cancelIdleCallback(idleId);
            }
            if (fallbackTimer !== null) {
                window.clearTimeout(fallbackTimer);
            }
        };
    }, [warmLocalAssets, refreshOfflineCount]);

    const triggerInstall = useCallback(async () => {
        if (isTWA) return;
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
    }, [deferredPrompt, isTWA, warmLocalAssets]);

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
                isTWA,
                canNativePrompt: !isTWA && Boolean(deferredPrompt),
                isIOS,
                isOnline,
                isBannerDismissed,
                showInstallModal,
                isCachingLocalAssets,
                localAssetsCached,
                updateAvailable,
                offlineOfficesCount,
                isOfflineFallbackPage,
                triggerInstall,
                dismissBanner,
                closeInstallModal,
                warmLocalAssets,
                applyUpdate,
                setOfflineFallbackPage: setIsOfflineFallbackPage,
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
