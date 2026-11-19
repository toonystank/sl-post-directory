"use client";

import { useEffect } from "react";

declare global {
    interface Window {
        __slPostWaitingSw?: ServiceWorker | null;
        __slPostReloadOnControllerChange?: boolean;
    }
}

export function ServiceWorkerRegister() {
    useEffect(() => {
        if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
            return;
        }

        let refreshing = false;
        let lastUpdateCheck = Date.now();
        let activeRegistration: ServiceWorkerRegistration | null = null;

        const notifyUpdateReady = (worker: ServiceWorker | null | undefined) => {
            if (!worker) return;
            window.__slPostWaitingSw = worker;
            window.dispatchEvent(new CustomEvent("slpost-sw-update"));
        };

        const register = () => {
            // In Next.js dev mode, ensure any stale SW static/page/RSC caches from older versions
            // never serve mismatched Turbopack module factories across restarts.
            if (process.env.NODE_ENV === "development" && "caches" in window) {
                void caches.keys().then((keys) =>
                    Promise.all(
                        keys
                            .filter(
                                (k) =>
                                    k.startsWith("sl-post-static-") ||
                                    k.startsWith("sl-post-pages-") ||
                                    k.startsWith("sl-post-rsc-")
                            )
                            .map((k) => caches.delete(k))
                    )
                ).catch(() => undefined);
            }

            navigator.serviceWorker
                .register("/sw.js", { scope: "/", updateViaCache: "none" })
                .then((registration) => {
                    activeRegistration = registration;
                    void registration.update().catch(() => undefined);

                    if (registration.waiting && navigator.serviceWorker.controller) {
                        notifyUpdateReady(registration.waiting);
                    }

                    registration.addEventListener("updatefound", () => {
                        const newWorker = registration.installing;
                        if (!newWorker) return;
                        newWorker.addEventListener("statechange", () => {
                            if (
                                newWorker.state === "installed" &&
                                navigator.serviceWorker.controller
                            ) {
                                notifyUpdateReady(newWorker);
                            }
                        });
                    });
                })
                .catch(() => {
                    // Registration failed silently in unsupported/private contexts
                });
        };

        const onControllerChange = () => {
            if (refreshing) return;
            if (window.__slPostReloadOnControllerChange) {
                refreshing = true;
                window.location.reload();
            }
        };

        const onVisibilityChange = () => {
            if (
                document.visibilityState === "visible" &&
                activeRegistration &&
                Date.now() - lastUpdateCheck > 30 * 60 * 1000
            ) {
                lastUpdateCheck = Date.now();
                void activeRegistration.update().catch(() => undefined);
            }
        };

        const onSwMessage = (event: MessageEvent) => {
            if (event.data?.type === "SW_FORCE_RELOAD_AFTER_PURGE" && !refreshing) {
                const key = "__slp_chunk_recover_ts";
                try {
                    const last = Number(sessionStorage.getItem(key) || "0");
                    if (Date.now() - last < 15000) return;
                    sessionStorage.setItem(key, String(Date.now()));
                } catch {
                    // Ignore storage errors
                }
                refreshing = true;
                window.location.reload();
            }
        };

        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
        navigator.serviceWorker.addEventListener("message", onSwMessage);
        document.addEventListener("visibilitychange", onVisibilityChange);

        if (document.readyState === "complete") {
            register();
        } else {
            window.addEventListener("load", register, { once: true });
        }

        return () => {
            window.removeEventListener("load", register);
            navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
            navigator.serviceWorker.removeEventListener("message", onSwMessage);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, []);

    return null;
}
