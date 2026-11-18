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
            navigator.serviceWorker
                .register("/sw.js", { scope: "/" })
                .then((registration) => {
                    activeRegistration = registration;

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

        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
        document.addEventListener("visibilitychange", onVisibilityChange);

        if (document.readyState === "complete") {
            register();
        } else {
            window.addEventListener("load", register, { once: true });
        }

        return () => {
            window.removeEventListener("load", register);
            navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, []);

    return null;
}
