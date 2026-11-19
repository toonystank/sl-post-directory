"use client";

import * as React from "react";
import { Download, RefreshCw, Share, PlusSquare, CheckCircle2, WifiOff, X, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Button } from "./ui/button";
import { StampMark } from "./brand/StampLogo";
import { usePWA } from "@/context/PWAContext";

/**
 * Unified PWA UX surface:
 * 1. Compact Offline indicator banner when connectivity drops.
 * 2. Update-ready toast when a newer Service Worker is waiting.
 * 3. Dwell-gated native Install card (waits 12s so it never acts as an arrival popup).
 * 4. Accessible step-by-step Install Guide Modal for iOS Safari & desktop browsers.
 */
export function InstallPrompt() {
    const t = useTranslations("Install");
    const {
        isInstalled,
        canNativePrompt,
        isIOS,
        isOnline,
        isBannerDismissed,
        showInstallModal,
        updateAvailable,
        triggerInstall,
        dismissBanner,
        closeInstallModal,
        applyUpdate,
    } = usePWA();

    const [dwellReady, setDwellReady] = React.useState(false);
    const [offlineDismissed, setOfflineDismissed] = React.useState(false);

    React.useEffect(() => {
        const timer = window.setTimeout(() => setDwellReady(true), 12000);
        return () => window.clearTimeout(timer);
    }, []);

    React.useEffect(() => {
        if (!isOnline) {
            setOfflineDismissed(false);
        }
    }, [isOnline]);

    const showNativeBanner =
        dwellReady && canNativePrompt && !isInstalled && !isBannerDismissed;

    return (
        <>
            {/* 1. Offline Status Indicator */}
            {!isOnline && !offlineDismissed && (
                <div
                    role="status"
                    aria-live="polite"
                    data-testid="pwa-offline-indicator"
                    className="fixed left-3 bottom-tabbar mb-2 z-[75] md:left-4 md:bottom-4 md:mb-0 inline-flex items-center gap-2 rounded-md border-2 border-foreground bg-secondary pl-3 pr-2 py-1.5 text-xs font-bold text-secondary-foreground shadow-[3px_3px_0_0_hsl(var(--foreground))]"
                >
                    <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{t("offlineMode")}</span>
                    <button
                        type="button"
                        onClick={() => setOfflineDismissed(true)}
                        className="tap rounded-full p-0.5 hover:bg-foreground/10"
                        aria-label="Dismiss offline notice"
                    >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                </div>
            )}

            {/* 2. Update Available Banner */}
            {updateAvailable && (
                <div
                    role="status"
                    aria-live="polite"
                    data-testid="pwa-update-banner"
                    className="fixed right-3 bottom-tabbar mb-2 z-[75] md:right-4 md:bottom-4 md:mb-0 flex items-center gap-3 rounded-lg border-2 border-foreground bg-card px-3.5 py-2.5 text-sm shadow-[4px_4px_0_0_hsl(var(--foreground))]"
                >
                    <RefreshCw className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <div className="min-w-0">
                        <p className="font-heading text-xs font-extrabold leading-tight">{t("updateTitle")}</p>
                        <p className="text-xs text-muted-foreground">{t("updateBody")}</p>
                    </div>
                    <Button size="sm" onClick={applyUpdate} className="shrink-0 h-8 px-3 text-xs">
                        {t("updateAction")}
                    </Button>
                </div>
            )}

            {/* 3. Dwell-Gated Floating Install Prompt (Chromium / Android / Desktop) */}
            {showNativeBanner && (
                <div
                    role="dialog"
                    aria-label={t("title")}
                    data-testid="pwa-install-banner"
                    className="fixed left-3 right-3 bottom-tabbar mb-3 z-[70] md:left-auto md:right-6 md:bottom-6 md:mb-0 md:w-[370px] rounded-lg border-2 border-foreground bg-card p-4 shadow-[4px_4px_0_0_hsl(var(--foreground))] animate-in slide-in-from-bottom-5 fade-in duration-300"
                >
                    <div className="flex items-start gap-3">
                        <StampMark size={40} />
                        <div className="flex-1 min-w-0">
                            <h3 className="font-heading text-base font-extrabold leading-tight [font-stretch:85%]">
                                {t("title")}
                            </h3>
                            <p className="mt-0.5 text-sm text-muted-foreground">{t("body")}</p>
                        </div>
                        <button
                            type="button"
                            onClick={dismissBanner}
                            className="tap -mr-1 -mt-1 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                            aria-label={t("notNow")}
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="mt-3 flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={dismissBanner}>
                            {t("notNow")}
                        </Button>
                        <Button className="flex-1 gap-1.5" onClick={() => void triggerInstall()}>
                            <Download className="h-4 w-4" aria-hidden="true" />
                            <span>{t("install")}</span>
                        </Button>
                    </div>
                </div>
            )}

            {/* 4. Step-by-Step Install Guide Modal (iOS Safari & Browsers without native prompt) */}
            <DialogPrimitive.Root open={showInstallModal} onOpenChange={(open) => !open && closeInstallModal()}>
                <DialogPrimitive.Portal>
                    <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/55 dark:bg-black/75 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
                    <DialogPrimitive.Content
                        data-testid="pwa-install-guide-modal"
                        className="fixed left-1/2 top-1/2 z-[105] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-foreground bg-card p-5 text-foreground shadow-[6px_6px_0_0_hsl(var(--foreground))] outline-none"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <StampMark size={42} />
                                <div>
                                    <DialogPrimitive.Title className="font-heading text-lg font-extrabold leading-tight [font-stretch:85%]">
                                        {isIOS ? t("iosTitle") : t("desktopTitle")}
                                    </DialogPrimitive.Title>
                                    <DialogPrimitive.Description className="mt-0.5 text-xs text-muted-foreground">
                                        {isIOS ? t("iosSubtitle") : t("desktopSubtitle")}
                                    </DialogPrimitive.Description>
                                </div>
                            </div>
                            <DialogPrimitive.Close
                                className="tap -mr-1 -mt-1 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                                aria-label="Close"
                            >
                                <X className="h-4 w-4" />
                            </DialogPrimitive.Close>
                        </div>

                        <div className="mt-4 space-y-2.5 text-sm">
                            {isIOS ? (
                                <>
                                    <div className="flex items-center gap-3 rounded-md border border-border bg-background p-3">
                                        <Share className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                                        <span className="font-medium">{t("iosStep1")}</span>
                                    </div>
                                    <div className="flex items-center gap-3 rounded-md border border-border bg-background p-3">
                                        <PlusSquare className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                                        <span className="font-medium">{t("iosStep2")}</span>
                                    </div>
                                    <div className="flex items-center gap-3 rounded-md border border-border bg-background p-3">
                                        <CheckCircle2 className="h-5 w-5 shrink-0 text-[hsl(var(--status-open))]" aria-hidden="true" />
                                        <span className="font-medium">{t("iosStep3")}</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center gap-3 rounded-md border border-border bg-background p-3">
                                        <Smartphone className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                                        <span className="font-medium">{t("desktopStep1")}</span>
                                    </div>
                                    <div className="flex items-center gap-3 rounded-md border border-border bg-background p-3">
                                        <Download className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                                        <span className="font-medium">{t("desktopStep2")}</span>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
                            <span className="text-xs font-medium text-muted-foreground">{t("cachedReady")}</span>
                            <Button onClick={closeInstallModal}>{t("close")}</Button>
                        </div>
                    </DialogPrimitive.Content>
                </DialogPrimitive.Portal>
            </DialogPrimitive.Root>
        </>
    );
}
