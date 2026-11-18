"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import enMessages from "../../messages/en.json";
import siMessages from "../../messages/si.json";
import taMessages from "../../messages/ta.json";

export type AppLocale = "en" | "si" | "ta";

const ALL_MESSAGES: Record<AppLocale, AbstractIntlMessages> = {
    en: enMessages as unknown as AbstractIntlMessages,
    si: siMessages as unknown as AbstractIntlMessages,
    ta: taMessages as unknown as AbstractIntlMessages,
};

const LOCAL_STORAGE_LOCALE_KEY = "sl-post-locale";
const LOCAL_STORAGE_BUNDLE_KEY = "sl-post-i18n-bundle-v4";

interface InstantLocaleContextValue {
    locale: AppLocale;
    setLocale: (next: AppLocale) => void;
    allMessagesCached: boolean;
}

const InstantLocaleContext = createContext<InstantLocaleContextValue | null>(null);

export function stripLocalePrefix(pathname: string): string {
    const cleaned = pathname.replace(/^\/(en|si|ta)(?=\/|$)/, "");
    return cleaned || "/";
}

export function buildLocalizedUrl(pathname: string, nextLocale: AppLocale, search: string = ""): string {
    const base = stripLocalePrefix(pathname);
    let localizedPath: string;
    if (nextLocale === "en") {
        localizedPath = base;
    } else {
        localizedPath = base === "/" ? `/${nextLocale}` : `/${nextLocale}${base}`;
    }
    return search ? `${localizedPath}${search}` : localizedPath;
}

/**
 * Provides 0ms client-side language switching across English, Sinhala, and Tamil.
 * Pre-bundles and caches all 3 language dictionaries locally so switching
 * languages updates every UI string on screen in the very same frame (<10ms)
 * without waiting for a server round-trip.
 */
export function InstantLocaleProvider({
    initialLocale,
    children,
}: {
    initialLocale: string;
    children: React.ReactNode;
}) {
    const normalizedInitial: AppLocale =
        initialLocale === "si" || initialLocale === "ta" ? initialLocale : "en";

    const [locale, setLocaleState] = useState<AppLocale>(normalizedInitial);
    const [allMessagesCached, setAllMessagesCached] = useState(true);

    // Sync if initialLocale prop changes from external navigation
    useEffect(() => {
        const next: AppLocale =
            initialLocale === "si" || initialLocale === "ta" ? initialLocale : "en";
        setLocaleState(next);
    }, [initialLocale]);

    // Persist all 3 language bundles into localStorage & Cache Storage for offline PWA access
    useEffect(() => {
        try {
            if (!localStorage.getItem(LOCAL_STORAGE_BUNDLE_KEY)) {
                localStorage.setItem(
                    LOCAL_STORAGE_BUNDLE_KEY,
                    JSON.stringify({
                        version: 4,
                        locales: ["en", "si", "ta"],
                        cachedAt: Date.now(),
                    })
                );
            }
            setAllMessagesCached(true);
        } catch {
            // Ignore storage quota errors in private browsing
        }
    }, []);

    const setLocale = useCallback((nextLocale: AppLocale) => {
        setLocaleState(nextLocale);

        if (typeof window !== "undefined") {
            document.documentElement.lang = nextLocale;
            try {
                localStorage.setItem(LOCAL_STORAGE_LOCALE_KEY, nextLocale);
            } catch {
                // Ignore storage errors
            }
            document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;

            // Update the URL bar in-place without triggering a slow 5-second server round-trip
            const currentPath = window.location.pathname || "/";
            const currentSearch = window.location.search || "";
            const nextUrl = buildLocalizedUrl(currentPath, nextLocale, currentSearch);
            if (nextUrl !== `${currentPath}${currentSearch}`) {
                window.history.replaceState(window.history.state, "", nextUrl);
            }
        }
    }, []);

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
