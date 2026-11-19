"use client";

import { useInstantLocale, type AppLocale } from "@/context/InstantLocaleContext";
import { cn } from "@/lib/utils";

const LOCALES: { code: AppLocale; label: string; short: string }[] = [
    { code: "en", label: "English", short: "EN" },
    { code: "si", label: "සිංහල", short: "සිං" },
    { code: "ta", label: "தமிழ்", short: "த" },
];

/**
 * Direct 1-tap inline segmented language switcher (EN · සිං · த).
 * Uses `useInstantLocale()` to swap the active dictionary synchronously on the client
 * so all UI text updates in 0ms (<10ms) with zero server wait.
 */
export default function LanguageSwitcher() {
    const { locale, setLocale, prefetchLocale } = useInstantLocale();

    return (
        <div
            role="group"
            aria-label="Switch language"
            data-testid="language-switcher"
            className="inline-flex items-center rounded-full border-2 border-foreground bg-card p-0.5 shadow-[0_1px_0_0_hsl(var(--foreground))]"
        >
            {LOCALES.map(({ code, label, short }) => {
                const active = locale === code;
                return (
                    <button
                        key={code}
                        type="button"
                        lang={code}
                        data-testid={`lang-btn-${code}`}
                        aria-label={`Switch language to ${label}`}
                        aria-pressed={active}
                        onPointerEnter={() => prefetchLocale(code)}
                        onTouchStart={() => prefetchLocale(code)}
                        onFocus={() => prefetchLocale(code)}
                        onMouseDown={(e) => {
                            e.preventDefault();
                        }}
                        onClick={() => setLocale(code)}
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
