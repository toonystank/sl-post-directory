"use client";

import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALPHABET, SERVICE_TAGS } from "./types";

/** Maps the DB service tag to a translated label. */
export function useServiceLabel() {
    const t = useTranslations("Browse");
    return (tag: string) => {
        const key = tag.toLowerCase();
        if (key.startsWith("foreign")) return t("serviceForeign");
        if (key.startsWith("postal complex")) return t("serviceComplex");
        if (key.startsWith("regional")) return t("serviceSorting");
        return tag;
    };
}

/** A–Z grid styled like typewriter keys. */
export function LetterKeypad({
    activeLetter,
    onSelect,
    size = "md",
    renderKey,
}: {
    activeLetter: string | null;
    onSelect?: (letter: string) => void;
    size?: "sm" | "md";
    /** Optional custom renderer (e.g. Links on the Browse page) */
    renderKey?: (letter: string, className: string, active: boolean) => React.ReactNode;
}) {
    return (
        <div className={cn("grid grid-cols-7", size === "sm" ? "gap-1" : "gap-1.5")}>
            {ALPHABET.map((letter) => {
                const active = activeLetter === letter;
                const cls = cn(
                    "tap flex items-center justify-center rounded-[5px] border-[1.5px] font-mono font-semibold transition-colors",
                    size === "sm" ? "h-9 text-sm" : "h-11 text-base",
                    active
                        ? "border-foreground bg-primary text-primary-foreground shadow-[0_2px_0_0_hsl(var(--foreground))]"
                        : "border-foreground/70 bg-card shadow-[0_2px_0_0_hsl(var(--foreground)/0.7)] hover:bg-secondary/40 active:translate-y-[2px] active:shadow-none"
                );
                if (renderKey) return <span key={letter} className="contents">{renderKey(letter, cls, active)}</span>;
                return (
                    <button key={letter} onClick={() => onSelect?.(letter)} aria-pressed={active} className={cls}>
                        {letter}
                    </button>
                );
            })}
        </div>
    );
}

/** Service filter as toggle rows. */
export function ServiceToggles({ activeService, onSelect }: { activeService: string | null; onSelect: (tag: string) => void }) {
    const label = useServiceLabel();
    return (
        <ul className="divide-y divide-border border-y border-border">
            {SERVICE_TAGS.map((tag) => {
                const active = activeService === tag;
                return (
                    <li key={tag}>
                        <button
                            onClick={() => onSelect(tag)}
                            aria-pressed={active}
                            className="tap flex w-full items-center gap-3 py-3 text-left text-[0.95rem] font-medium"
                        >
                            <span
                                className={cn(
                                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border-[1.5px] border-foreground",
                                    active && "bg-foreground text-background"
                                )}
                            >
                                {active && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                            </span>
                            {label(tag)}
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}
