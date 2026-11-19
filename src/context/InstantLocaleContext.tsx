"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition } from "react";
import { useRouter as useNextRouter } from "next/navigation";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import enMessages from "../../messages/en.json";
import {
    type AppLocale,
    LOCALE_COOKIE_NAME,
    LOCALE_STORAGE_KEY,
    buildLocalizedUrl,
    getLocaleFromPathname,
    isAppLocale,
    normalizeAppLocale,
    stripLocalePrefix,
} from "@/lib/locale";

export { type AppLocale, stripLocalePrefix, buildLocalizedUrl };

// Keep English inline as the fast default; lazy-load & cache Sinhala/Tamil chunks on demand.
const messageCache: Partial<Record<AppLocale, AbstractIntlMessages>> = {
    en: enMessages as unknown as AbstractIntlMessages,
};

const inFlightLocaleLoads: Partial<Record<AppLocale, Promise<AbstractIntlMessages>>> = {};

async function loadLocaleMessages(target: AppLocale): Promise<AbstractIntlMessages> {
    if (messageCache[target]) {
        return messageCache[target]!;
    }
    if (inFlightLocaleLoads[target]) {
        return inFlightLocaleLoads[target]!;
    }

    const loader = (async () => {
        const mod =
            target === "si"
                ? await import("../../messages/si.json")
                : target === "ta"
                    ? await import("../../messages/ta.json")
                    : { default: enMessages };
        const msgs = (mod.default ?? mod) as unknown as AbstractIntlMessages;
        messageCache[target] = msgs;
        return msgs;
    })().finally(() => {
        delete inFlightLocaleLoads[target];
    });

    inFlightLocaleLoads[target] = loader;
    return loader;
}

const LOCAL_STORAGE_BUNDLE_KEY = "sl-post-i18n-bundle-v7";

interface InstantLocaleContextValue {
    locale: AppLocale;
    setLocale: (next: AppLocale) => void;
    prefetchLocale: (target: AppLocale) => void;
    allMessagesCached: boolean;
}

const InstantLocaleContext = createContext<InstantLocaleContextValue | null>(null);

function readLocaleCookie(): AppLocale | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE_NAME}=([^;]+)`));
    const val = match ? decodeURIComponent(match[1]) : null;
    return isAppLocale(val) ? val : null;
}

function persistLocalePreference(nextLocale: AppLocale) {
    if (typeof window === "undefined") return;
    document.documentElement.lang = nextLocale;
    try {
        localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    } catch {
        // Ignore storage errors
    }
    document.cookie = `${LOCALE_COOKIE_NAME}=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
}

/**
 * Provides fast client-side language switching across English, Sinhala, and Tamil
 * while keeping the initial JS payload lean:
 *
 * - Only the active SSR locale (plus English fallback) is loaded at startup.
 * - Alternate locale chunks (`si`, `ta`) load lazily on hover/touchstart or click and stay cached in memory.
 * - Server Components sync non-blockingly via `startTransition(() => nextRouter.replace(...))`.
 * - User preference is persisted in both cookie and localStorage; defaults to English.
 */
export function InstantLocaleProvider({
    initialLocale,
    initialMessages,
    children,
}: {
    initialLocale: string;
    initialMessages?: AbstractIntlMessages;
    children: React.ReactNode;
}) {
    const nextRouter = useNextRouter();
    const [, startTransition] = useTransition();
    const normalizedInitial = normalizeAppLocale(initialLocale);

    // Hydrate module cache synchronously with SSR-provided messages for the initial locale
    if (initialMessages && !messageCache[normalizedInitial]) {
        messageCache[normalizedInitial] = initialMessages;
    }

    const [locale, setLocaleState] = useState<AppLocale>(normalizedInitial);
    const [activeMessages, setActiveMessages] = useState<AbstractIntlMessages>(
        () => initialMessages || messageCache[normalizedInitial] || messageCache.en!
    );
    const [allMessagesCached, setAllMessagesCached] = useState(
        Boolean(messageCache.en && messageCache.si && messageCache.ta)
    );
    const pendingLocaleRef = useRef<AppLocale | null>(null);

    const prefetchLocale = useCallback((target: AppLocale) => {
        if (messageCache[target]) return;
        void loadLocaleMessages(target).then(() => {
            if (messageCache.en && messageCache.si && messageCache.ta) {
                setAllMessagesCached(true);
            }
        });
    }, []);

    // Sync with Next.js route locale changes (e.g., browser Back/Forward or completed router.replace)
    useEffect(() => {
        if (initialMessages && !messageCache[normalizedInitial]) {
            messageCache[normalizedInitial] = initialMessages;
        }

        if (pendingLocaleRef.current) {
            if (normalizedInitial === pendingLocaleRef.current) {
                pendingLocaleRef.current = null;
                setLocaleState(normalizedInitial);
                if (messageCache[normalizedInitial]) {
                    setActiveMessages(messageCache[normalizedInitial]!);
                }
                if (typeof document !== "undefined") {
                    document.documentElement.lang = normalizedInitial;
                }
            }
            return;
        }

        setLocaleState(normalizedInitial);
        if (messageCache[normalizedInitial]) {
            setActiveMessages(messageCache[normalizedInitial]!);
        } else {
            void loadLocaleMessages(normalizedInitial).then((msgs) => {
                setActiveMessages(msgs);
            });
        }
        if (typeof document !== "undefined") {
            document.documentElement.lang = normalizedInitial;
        }
    }, [normalizedInitial, initialMessages]);

    // Safety net: if cookie was cleared on PWA cold start while localStorage has a saved
    // preference (or offline shell served /), restore the user's remembered language.
    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            if (!localStorage.getItem(LOCAL_STORAGE_BUNDLE_KEY)) {
                localStorage.setItem(
                    LOCAL_STORAGE_BUNDLE_KEY,
                    JSON.stringify({
                        version: 7,
                        locales: ["en", "si", "ta"],
                        cachedAt: Date.now(),
                    })
                );
            }

            const explicitUrlLocale = getLocaleFromPathname(window.location.pathname || "/");
            const cookieLocale = readLocaleCookie();
            const stored = localStorage.getItem(LOCALE_STORAGE_KEY);

            // Only restore from localStorage if URL has no explicit locale prefix AND cookie is missing
            if (!explicitUrlLocale && !cookieLocale && (stored === "si" || stored === "ta")) {
                persistLocalePreference(stored);
                pendingLocaleRef.current = stored;
                void loadLocaleMessages(stored).then((msgs) => {
                    setLocaleState(stored);
                    setActiveMessages(msgs);
                });
                const targetUrl = buildLocalizedUrl(
                    window.location.pathname || "/",
                    stored,
                    window.location.search || "",
                    window.location.hash || ""
                );
                if (navigator.onLine) {
                    startTransition(() => {
                        nextRouter.replace(targetUrl, { scroll: false });
                    });
                } else {
                    window.history.replaceState(window.history.state, "", targetUrl);
                }
            }
        } catch {
            // Ignore storage quota errors in private browsing
        }
    }, [nextRouter]);

    const setLocale = useCallback(
        (nextLocale: AppLocale) => {
            pendingLocaleRef.current = nextLocale;
            persistLocalePreference(nextLocale);

            const applySwitch = (msgs: AbstractIntlMessages) => {
                setLocaleState(nextLocale);
                setActiveMessages(msgs);
                if (messageCache.en && messageCache.si && messageCache.ta) {
                    setAllMessagesCached(true);
                }
            };

            const cached = messageCache[nextLocale];
            if (cached) {
                applySwitch(cached);
            } else {
                void loadLocaleMessages(nextLocale).then(applySwitch);
            }

            if (typeof window === "undefined") return;

            const currentPath = window.location.pathname || "/";
            const currentSearch = window.location.search || "";
            const currentHash = window.location.hash || "";
            const targetUrl = buildLocalizedUrl(currentPath, nextLocale, currentSearch, currentHash);
            const currentFull = `${currentPath}${currentSearch}${currentHash}`;

            if (targetUrl === currentFull) {
                pendingLocaleRef.current = null;
                return;
            }

            if (navigator.onLine) {
                // Keep Next.js App Router & Server Components strictly synchronized without blocking paint
                startTransition(() => {
                    nextRouter.replace(targetUrl, { scroll: false });
                });
            } else {
                // Offline fallback: update URL in place while client dictionary stays active
                window.history.replaceState(window.history.state, "", targetUrl);
            }
        },
        [nextRouter]
    );

    return (
        <InstantLocaleContext.Provider value={{ locale, setLocale, prefetchLocale, allMessagesCached }}>
            <NextIntlClientProvider
                locale={locale}
                messages={activeMessages}
                timeZone="Asia/Colombo"
            >
                {children}
            </NextIntlClientProvider>
        </InstantLocaleContext.Provider>
    );
}

export function useInstantLocale() {
    const ctx = useContext(InstantLocaleContext);
    if (!ctx) {
        throw new Error("useInstantLocale must be used within InstantLocaleProvider");
    }
    return ctx;
}
