"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/navigation";
import { Globe } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const localeLabels: Record<string, { label: string; flag: string }> = {
    en: { label: "English", flag: "🇬🇧" },
    si: { label: "සිංහල", flag: "🇱🇰" },
    ta: { label: "தமிழ்", flag: "🇱🇰" },
};

export default function LanguageSwitcher() {
    const locale = useLocale();
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

    const handleSwitch = (newLocale: string) => {
        router.replace(pathname, { locale: newLocale as any });
        setIsOpen(false);
    };

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200 border border-transparent hover:border-border/50"
                aria-label="Switch language"
            >
                <Globe className="w-4 h-4" />
                <span className="hidden sm:inline text-xs uppercase tracking-wider font-bold">
                    {locale}
                </span>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-44 rounded-xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-xl shadow-black/20 py-1.5 z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                    {Object.entries(localeLabels).map(([code, { label, flag }]) => (
                        <button
                            key={code}
                            onClick={() => handleSwitch(code)}
                            className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors ${
                                locale === code
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                            }`}
                        >
                            <span className="text-base">{flag}</span>
                            <span>{label}</span>
                            {locale === code && (
                                <span className="ml-auto text-xs text-primary">✓</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
