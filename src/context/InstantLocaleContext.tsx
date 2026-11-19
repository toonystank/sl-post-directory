"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition } from "react";
import { useRouter as useNextRouter } from "next/navigation";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import enMessages from "../../messages/en.json";
import siMessages from "../../messages/si.json";
import taMessages from "../../messages/ta.json";
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

const ALL_MESSAGES: Record<AppLocale, AbstractIntlMessages> = {
    en: enMessages as unknown as AbstractIntlMessages,
    si: siMessages as unknown as AbstractIntlMessages,
    ta: taMessages as unknown as AbstractIntlMessages,
};

const LOCAL_STORAGE_BUNDLE_KEY = "sl-post-i18n-bundle-v6";

interface InstantLocaleContextValue {
    locale: AppLocale;
    setLocale: (next: AppLocale) => void;
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
 * Provides instant client-side language switching across English, Sinhala, and Tamil
 * while staying 100% synchronized with Next.js App Router & Server Components.
 *
 * - Client Components update synchronously in 0ms via pre-bundled messages.
 * - Server Components sync immediately via `nextRouter.replace(targetUrl, { scroll: false })`.
 * - User preference is persisted in both cookie and localStorage; defaults to English.
 */
export function InstantLocaleProvider({
    initialLocale,
    children,
}: {
    initialLocale: string;
    children: React.ReactNode;
}) {
    const nextRouter = useNextRouter();
    const [, startTransition] = useTransition();
    const normalizedInitial = normalizeAppLocale(initialLocale);

    const [locale, setLocaleState] = useState<AppLocale>(normalizedInitial);
    const [allMessagesCached, setAllMessagesCached] = useState(true);
    const pendingLocaleRef = useRef<AppLocale | null>(null);

    // Sync with Next.js route locale changes (e.g., browser Back/Forward or completed router.replace)
    useEffect(() => {
        if (pendingLocaleRef.current) {
            if (normalizedInitial === pendingLocaleRef.current) {
                pendingLocaleRef.current = null;
                setLocaleState(normalizedInitial);
                if (typeof document !== "undefined") {
                    document.documentElement.lang = normalizedInitial;
                }
            }
            return;
        }
        setLocaleState(normalizedInitial);
        if (typeof document !== "undefined") {
            document.documentElement.lang = normalizedInitial;
        }
    }, [normalizedInitial]);

    // Safety net: if cookie was cleared on PWA cold start while localStorage has a saved
    // preference (or offline shell served /), restore the user's remembered language.
    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            if (!localStorage.getItem(LOCAL_STORAGE_BUNDLE_KEY)) {
                localStorage.setItem(
                    LOCAL_STORAGE_BUNDLE_KEY,
                    JSON.stringify({
                        version: 6,
                        locales: ["en", "si", "ta"],
                        cachedAt: Date.now(),
                    })
                );
            }
            setAllMessagesCached(true);

            const explicitUrlLocale = getLocaleFromPathname(window.location.pathname || "/");
            const cookieLocale = readLocaleCookie();
            const stored = localStorage.getItem(LOCALE_STORAGE_KEY);

            // Only restore from localStorage if URL has no explicit locale prefix AND cookie is missing
            if (!explicitUrlLocale && !cookieLocale && (stored === "si" || stored === "ta")) {
                persistLocalePreference(stored);
                pendingLocaleRef.current = stored;
                setLocaleState(stored);
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
            setLocaleState(nextLocale);
            persistLocalePreference(nextLocale);

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
                // Keep Next.js App Router & Server Components strictly synchronized with the chosen locale
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
        <InstantLocaleContext.Provider value={{ locale, setLocale, allMessagesCached }}>
            <NextIntlClientProvider
                locale={locale}
                messages={ALL_MESSAGES[locale]}
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
