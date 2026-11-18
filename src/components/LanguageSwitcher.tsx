"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/navigation";
import { useEffect, useState, useTransition } from "react";
import { cn } from "@/lib/utils";

type AppLocale = "en" | "si" | "ta";

const LOCALES: { code: AppLocale; label: string; short: string }[] = [
    { code: "en", label: "English", short: "EN" },
    { code: "si", label: "සිංහල", short: "සිං" },
    { code: "ta", label: "தமிழ்", short: "த" },
];

/**
 * Direct 1-tap inline segmented language switcher (EN · සිං · த).
 * - Eliminates the 2-tap dropdown menu on mobile & desktop.
 * - Prefetches all 3 locale routes on idle so switching is near-instant.
 * - Uses optimistic state + `onMouseDown={(e) => e.preventDefault()}` so a focused
 *   search input never swallows the first tap on mobile touchscreens.
 */
export default function LanguageSwitcher() {
    const locale = useLocale() as AppLocale;
    const router = useRouter();
    const pathname = usePathname() || "/";
    const [isPending, startTransition] = useTransition();
    const [optimisticLocale, setOptimisticLocale] = useState<AppLocale>(locale);

    useEffect(() => {
        setOptimisticLocale(locale);
    }, [locale]);

    // Prefetch the sibling locale routes so tapping EN / සිං / த swaps immediately from cache
    useEffect(() => {
        const timer = window.setTimeout(() => {
            for (const item of LOCALES) {
                if (item.code !== locale) {
                    try {
                        router.prefetch(pathname, { locale: item.code });
                    } catch {
                        // Ignore prefetch errors in dev
                    }
                }
            }
        }, 120);
        return () => window.clearTimeout(timer);
    }, [pathname, locale, router]);

    const handleSwitch = (newLocale: AppLocale) => {
        if (newLocale === optimisticLocale && !isPending) return;
        setOptimisticLocale(newLocale);
        const search = typeof window !== "undefined" ? window.location.search : "";
        const targetHref = search ? `${pathname}${search}` : pathname;
        startTransition(() => {
            router.replace(targetHref, { locale: newLocale, scroll: false });
        });
    };

    const activeLocale = optimisticLocale;

    return (
        <div
            role="group"
            aria-label="Switch language"
            data-testid="language-switcher"
            data-pending={isPending ? "true" : "false"}
            className="inline-flex items-center rounded-full border-2 border-foreground bg-card p-0.5 shadow-[0_1px_0_0_hsl(var(--foreground))]"
        >
            {LOCALES.map(({ code, label, short }) => {
                const active = activeLocale === code;
                return (
                    <button
                        key={code}
                        type="button"
                        lang={code}
                        data-testid={`lang-btn-${code}`}
                        aria-label={`Switch language to ${label}`}
                        aria-pressed={active}
                        onMouseDown={(e) => {
                            // Prevent input blur from swallowing the first tap on mobile
                            e.preventDefault();
                        }}
                        onClick={() => handleSwitch(code)}
                        className={cn(
                            "tap relative flex h-6 min-w-[28px] sm:h-6.5 sm:min-w-[30px] items-center justify-center rounded-full px-1.5 sm:px-2 text-[11px] sm:text-xs font-extrabold leading-none transition-colors",
                            active
                                ? "bg-foreground text-background shadow-2xs"
                                : "text-foreground/75 hover:text-foreground hover:bg-muted/70"
                        )}
                    >
                        <span>{short}</span>
                    </button>
                );
            })}
        </div>
    );
}
