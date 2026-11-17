"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/navigation";
import { Globe } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { m, AnimatePresence } from "motion/react";

type AppLocale = "en" | "si" | "ta";

const localeLabels: Record<AppLocale, { label: string; short: string }> = {
    en: { label: "English", short: "EN" },
    si: { label: "සිංහල", short: "සිං" },
    ta: { label: "தமிழ்", short: "த" },
};

export default function LanguageSwitcher() {
    const locale = useLocale() as AppLocale;
    const router = useRouter();
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSwitch = (newLocale: AppLocale) => {
        router.replace(pathname, { locale: newLocale });
        setIsOpen(false);
    };

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="tap flex items-center gap-1.5 rounded-full border-2 border-foreground px-2.5 py-1 text-xs font-semibold hover:bg-muted"
                aria-label="Switch language"
                aria-expanded={isOpen}
            >
                <Globe className="w-3.5 h-3.5" />
                <span lang={locale}>{localeLabels[locale]?.short ?? locale.toUpperCase()}</span>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <m.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute right-0 mt-2 w-44 rounded-md border-2 border-foreground bg-card py-1 shadow-[4px_4px_0_0_hsl(var(--foreground))] z-[100] origin-top-right"
                    >
                        {(Object.entries(localeLabels) as [AppLocale, { label: string; short: string }][]).map(([code, { label }]) => (
                            <button
                                key={code}
                                onClick={() => handleSwitch(code)}
                                lang={code}
                                className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors ${
                                    locale === code
                                        ? "bg-secondary text-secondary-foreground font-semibold"
                                        : "hover:bg-muted"
                                }`}
                            >
                                <span>{label}</span>
                                {locale === code && (
                                    <span className="ml-auto text-xs">✓</span>
                                )}
                            </button>
                        ))}
                    </m.div>
                )}
            </AnimatePresence>
        </div>
    );
}
