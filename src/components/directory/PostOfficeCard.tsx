"use client";

import React, { useState } from "react";
import { Link } from "@/navigation";
import {
    Building2,
    ChevronRight,
    ChevronDown,
    Copy,
    Check,
    Phone,
    Route,
    CheckCircle2,
    XCircle,
} from "lucide-react";
import { m, AnimatePresence } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { PostOffice } from "./types";
import { getPostOfficeStatus } from "@/lib/holidays";
import { formatSriLankaPhone, normalizePostalCode } from "@/lib/site";
import { triggerHaptic } from "@/lib/haptics";
import { useStaffStation } from "@/context/StaffStationContext";
import { buildRoutingHref } from "@/lib/staff-station";
import StatusDot from "@/components/brand/StatusDot";
import { cn } from "@/lib/utils";

interface PostOfficeCardProps {
    office: PostOffice;
    index: number;
}

/**
 * Mobile-first neo-brutalist office card showing name, short code, copyable postcode,
 * live status, delivery badge, Controlling Office link, RMSC hub, and 1-tap Call/Route actions.
 */
const PostOfficeCard = React.memo(function PostOfficeCard({ office }: PostOfficeCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [copied, setCopied] = useState(false);
    const locale = useLocale();
    const t = useTranslations("Status");
    const ts = useTranslations("Search");
    const tActions = useTranslations("Actions");
    const tOffice = useTranslations("Office");
    const tStaff = useTranslations("Staff");
    const { station, hydrated, mailRoutingEnabled } = useStaffStation();
    const isMyStation = hydrated && station?.slug === office.slug;

    const fieldMap = Object.fromEntries(office.fields.map((f) => [f.name, f.value]));
    const type = fieldMap["Type"] || tOffice("typeDefault");
    const grade = fieldMap["Grade"];
    const shortCode = fieldMap["Short Code"];
    const delivery = fieldMap["Delivery"];
    const rawPhone = fieldMap["Phone"] || fieldMap["Telephone"];
    const primaryPhone = rawPhone ? formatSriLankaPhone(rawPhone.split("/")[0].trim()) : "";
    const division = fieldMap["Division"];
    const is24Hour = fieldMap["Is24Hour"] === "true";
    const normalizedCode = normalizePostalCode(office.postalCode);
    const hasCode = Boolean(normalizedCode && !/^(na|n\/a|-|—|none|null)$/i.test(normalizedCode));

    const status = getPostOfficeStatus(
        locale,
        is24Hour,
        office.operatingHours || fieldMap["Working Hours"]
    );
    const statusLabel = status.status === "holiday" ? t("holiday") : t(status.label);

    const subs = office.controlledOffices ?? [];
    const ctrl = office.controllingOffice;
    const ctrlCode = ctrl?.postalCode ? normalizePostalCode(ctrl.postalCode) : "";
    const metaParts = [grade ? `${type} · ${grade}` : type, division].filter(Boolean).join(" · ");
    const isDeliveryYes = /^yes|delivery$/i.test(delivery || "");
    const isDeliveryNo = /^no|non/i.test(delivery || "");

    const handleCopyCode = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!normalizedCode) return;
        try {
            await navigator.clipboard.writeText(normalizedCode);
            triggerHaptic("success");
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            // fallback ignored
        }
    };

    return (
        <li className="cv-auto rounded-xl border-2 border-foreground bg-card shadow-[0_2px_0_0_hsl(var(--foreground))] transition-transform duration-150 hover:-translate-y-0.5 hover:border-primary/80 overflow-hidden">
            {/* Primary Info & Postcode Row */}
            <div className="px-3.5 pt-3 pb-2.5 sm:px-4">
                <div className="flex items-start justify-between gap-2.5 sm:gap-4">
                    <Link
                        href={`/office/${office.slug}`}
                        className="group min-w-0 flex-1 focus:outline-none"
                    >
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-heading text-[1.05rem] sm:text-lg font-extrabold leading-snug text-foreground group-hover:text-primary break-words">
                                {office.name}
                            </span>
                            {shortCode && (
                                <span className="inline-block rounded border border-foreground/35 bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold text-foreground">
                                    {shortCode}
                                </span>
                            )}
                            {isMyStation && (
                                <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                                    {tStaff("myStationShort")}
                                </span>
                            )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs sm:text-[0.82rem] font-medium text-muted-foreground">
                            {metaParts && <span>{metaParts}</span>}
                            {metaParts && <span aria-hidden="true">·</span>}
                            <StatusDot status={status.status} label={statusLabel} className="text-xs sm:text-[0.82rem]" />
                            {isDeliveryYes && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                                    {tOffice("deliveryShort")}
                                </span>
                            )}
                            {isDeliveryNo && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:text-amber-300">
                                    <XCircle className="h-3 w-3" aria-hidden="true" />
                                    {tOffice("nonDeliveryShort")}
                                </span>
                            )}
                        </div>
                    </Link>

                    {/* Copyable Postcode Badge */}
                    <div className="shrink-0">
                        {hasCode ? (
                            <button
                                type="button"
                                onClick={handleCopyCode}
                                aria-label={`${tActions("copy")} ${normalizedCode}`}
                                title={copied ? tActions("copied") : `${tActions("copy")}: ${normalizedCode}`}
                                className={cn(
                                    "tap inline-flex h-10 items-center gap-1.5 rounded-md border-[1.5px] border-dashed px-2.5 font-mono text-xs sm:text-sm font-bold tracking-wide transition-colors",
                                    copied
                                        ? "border-emerald-700 dark:border-emerald-400 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                                        : "border-foreground/75 bg-background/70 text-foreground hover:bg-secondary/35"
                                )}
                            >
                                <span>{normalizedCode}</span>
                                {copied ? (
                                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                                ) : (
                                    <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                )}
                            </button>
                        ) : (
                            <span
                                className="inline-flex h-10 items-center px-2 font-mono text-sm text-muted-foreground select-none"
                                aria-hidden="true"
                            >
                                —
                            </span>
                        )}
                    </div>
                </div>

                {/* Controlling Office & RMSC Routing Strip */}
                {(ctrl || office.rmsc) && (
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-secondary/15 px-2.5 py-2 text-xs">
                        {ctrl ? (
                            <Link
                                href={`/office/${ctrl.slug}`}
                                className="tap inline-flex items-center gap-1.5 min-w-0 font-semibold text-foreground hover:text-primary"
                            >
                                <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                                <span className="text-muted-foreground shrink-0">{tOffice("controlledBy")}:</span>
                                <span className="truncate underline decoration-foreground/30 underline-offset-2">
                                    {ctrl.name}
                                </span>
                                {ctrl.shortCode && (
                                    <span className="rounded bg-card px-1 py-px font-mono text-[10px] font-bold border border-border shrink-0">
                                        {ctrl.shortCode}
                                    </span>
                                )}
                                {ctrlCode && (
                                    <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                                        {ctrlCode}
                                    </span>
                                )}
                            </Link>
                        ) : (
                            <span className="font-mono text-[11px] text-muted-foreground">
                                {tOffice("rmsc")}: <strong className="text-foreground">{office.rmsc}</strong>
                            </span>
                        )}

                        {ctrl && office.rmsc && (
                            <span className="font-mono text-[10px] font-semibold text-muted-foreground shrink-0">
                                {office.rmsc}
                            </span>
                        )}
                    </div>
                )}

                {/* Expandable Sub-Offices Drawer */}
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
                                                className="tap flex items-center justify-between gap-2 py-1.5 text-sm hover:text-primary"
                                            >
                                                <span className="flex items-center gap-1.5 min-w-0">
                                                    <span className="truncate font-medium">{sub.name}</span>
                                                    {sub.shortCode && (
                                                        <span className="rounded border border-border bg-muted px-1 py-px font-mono text-[10px] font-bold shrink-0">
                                                            {sub.shortCode}
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="font-mono text-xs font-bold text-muted-foreground shrink-0">
                                                    {normalizePostalCode(sub.postalCode) || "—"}
                                                </span>
                                            </Link>
                                        </li>
                                    ))}
                                </m.ul>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Mobile-first Quick Action Bar */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] divide-x divide-border border-t border-border bg-muted/25 text-xs font-semibold">
                {primaryPhone && (
                    <a
                        href={`tel:${primaryPhone.replace(/[^0-9+]/g, "")}`}
                        aria-label={`${tActions("call")} ${office.name} (${primaryPhone})`}
                        className="tap flex h-10 items-center justify-center gap-1.5 px-2 text-foreground hover:bg-secondary/35 transition-colors"
                    >
                        <Phone className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2.2} aria-hidden="true" />
                        <span className="truncate">{primaryPhone}</span>
                    </a>
                )}

                {mailRoutingEnabled && (
                    <Link
                        href={buildRoutingHref(office.slug, hydrated ? station : null)}
                        className="tap flex h-10 items-center justify-center gap-1.5 px-2 text-foreground hover:bg-secondary/35 transition-colors"
                    >
                        <Route className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                        <span>{tOffice("routeAction")}</span>
                    </Link>
                )}

                <Link
                    href={`/office/${office.slug}`}
                    className="tap flex h-10 items-center justify-center gap-1 px-2 text-foreground hover:bg-secondary/35 transition-colors"
                >
                    <span>{tOffice("detailsAction")}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
            </div>
        </li>
    );
});

export default PostOfficeCard;
