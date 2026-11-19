"use client";

import React, { useState } from "react";
import { Link } from "@/navigation";
import { ChevronRight, ChevronDown, Copy, Check, Phone } from "lucide-react";
import { m, AnimatePresence } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { PostOffice } from "./types";
import { getPostOfficeStatus } from "@/lib/holidays";
import StatusDot from "@/components/brand/StatusDot";
import { cn } from "@/lib/utils";

interface PostOfficeCardProps {
    office: PostOffice;
    index: number;
}

/**
 * Rich neo-brutalist office card in the results list.
 * Left: Bold Office Name + "Type · Division · StatusDot (Open/Closed)"
 * Right: Copyable dashed postcode badge ([ 20000 📋 ] or —), 1-tap Phone Call button ([ 📞 ]), and Chevron (>).
 */
const PostOfficeCard = React.memo(function PostOfficeCard({ office }: PostOfficeCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [copied, setCopied] = useState(false);
    const locale = useLocale();
    const t = useTranslations("Status");
    const ts = useTranslations("Search");
    const tActions = useTranslations("Actions");
    const tOffice = useTranslations("Office");

    const fieldMap = Object.fromEntries(office.fields.map((f) => [f.name, f.value]));
    const type = fieldMap["Type"] || tOffice("typeDefault");
    const phone = fieldMap["Phone"] || fieldMap["Telephone"];
    const division = fieldMap["Division"];
    const is24Hour = fieldMap["Is24Hour"] === "true";
    const rawCode = (office.postalCode || "").trim();
    const hasCode = Boolean(rawCode && !/^(na|n\/a|-|—|none|null)$/i.test(rawCode));

    const status = getPostOfficeStatus(locale, is24Hour);
    const statusLabel = status.status === "holiday" ? t("holiday") : t(status.label);

    const subs = office.controlledOffices ?? [];
    const metaParts = [type, division].filter(Boolean).join(" · ");

    const handleCopyCode = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!office.postalCode) return;
        try {
            await navigator.clipboard.writeText(office.postalCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            // fallback ignored
        }
    };

    return (
        <li className="cv-auto rounded-xl border-2 border-foreground bg-card px-3.5 py-3 shadow-[0_2px_0_0_hsl(var(--foreground))] transition-transform duration-150 hover:-translate-y-0.5 hover:border-primary/80">
            <div className="flex items-center justify-between gap-2.5 sm:gap-4">
                {/* Left: Office Name + Type · Division · Open/Closed */}
                <Link
                    href={`/office/${office.slug}`}
                    className="group min-w-0 flex-1 py-0.5 focus:outline-none"
                >
                    <span className="block font-heading text-[1.05rem] sm:text-lg font-extrabold leading-snug text-foreground group-hover:text-primary break-words">
                        {office.name}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs sm:text-[0.82rem] font-medium text-muted-foreground">
                        {metaParts && <span>{metaParts}</span>}
                        {metaParts && <span aria-hidden="true">·</span>}
                        <StatusDot status={status.status} label={statusLabel} className="text-xs sm:text-[0.82rem]" />
                    </span>
                </Link>

                {/* Right Action Bar: Copyable Postcode Badge + Phone Button + Chevron */}
                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                    {hasCode ? (
                        <button
                            type="button"
                            onClick={handleCopyCode}
                            aria-label={`${tActions("copy")} ${office.postalCode}`}
                            title={copied ? tActions("copied") : `${tActions("copy")}: ${office.postalCode}`}
                            className={cn(
                                "tap inline-flex h-9 items-center gap-1.5 rounded-md border-[1.5px] border-dashed px-2.5 font-mono text-xs sm:text-sm font-bold tracking-wide transition-colors",
                                copied
                                    ? "border-emerald-700 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                                    : "border-foreground/75 bg-background/70 text-foreground hover:bg-secondary/35"
                            )}
                        >
                            <span>{office.postalCode}</span>
                            {copied ? (
                                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                            ) : (
                                <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                            )}
                        </button>
                    ) : (
                        <span
                            className="inline-flex h-9 items-center px-2 font-mono text-sm text-muted-foreground select-none"
                            aria-hidden="true"
                        >
                            —
                        </span>
                    )}

                    {phone && (
                        <a
                            href={`tel:${phone.replace(/[^0-9+]/g, "")}`}
                            aria-label={`${tActions("call")} ${office.name} (${phone})`}
                            title={`${tActions("call")}: ${phone}`}
                            className="tap inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border-[1.5px] border-foreground bg-background text-foreground shadow-[0_1px_0_0_hsl(var(--foreground))] hover:bg-secondary/40 transition-colors"
                        >
                            <Phone className="h-4 w-4" strokeWidth={2.1} aria-hidden="true" />
                        </a>
                    )}

                    <Link
                        href={`/office/${office.slug}`}
                        aria-label={office.name}
                        className="tap inline-flex h-9 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-primary"
                    >
                        <ChevronRight className="h-5 w-5" aria-hidden="true" />
                    </Link>
                </div>
            </div>

            {subs.length > 0 && (
                <div className="mt-2 border-t border-dashed border-border pt-2">
                    <button
                        type="button"
                        onClick={() => setIsExpanded((v) => !v)}
                        aria-expanded={isExpanded}
                        className="tap -ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs font-semibold text-muted-foreground hover:text-primary"
                    >
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-150", isExpanded && "rotate-180")} />
                        {ts("subOffices", { count: subs.length })}
                    </button>
                    <AnimatePresence initial={false}>
                        {isExpanded && (
                            <m.ul
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                                className="ml-1 mt-1.5 space-y-1 border-l-2 border-secondary pl-3"
                            >
                                {subs.map((sub) => (
                                    <li key={sub.id}>
                                        <Link
                                            href={`/office/${sub.slug}`}
                                            className="tap flex items-center justify-between gap-3 py-1.5 text-sm hover:text-primary"
                                        >
                                            <span className="truncate font-medium">{sub.name}</span>
                                            <span className="font-mono text-xs font-bold text-muted-foreground">{sub.postalCode || "—"}</span>
                                        </Link>
                                    </li>
                                ))}
                            </m.ul>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </li>
    );
});

export default PostOfficeCard;
