"use client";

import * as React from "react";
import {
    CheckCircle2,
    Clock,
    Copy,
    Check,
    ExternalLink,
    MapPin,
    Printer,
    Share2,
    Truck,
    AlertTriangle,
    CalendarClock,
    Building2,
    Banknote,
    ChevronDown,
    ChevronRight,
    RefreshCw,
} from "lucide-react";
import { Link } from "@/navigation";
import Postmark from "@/components/brand/Postmark";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";
import {
    ensureLocalOfficeIndex,
    getLoadedOfficeIndexSync,
} from "@/lib/office-index-client";
import type { LocalOfficeSearchEngine } from "@/lib/office-index";
import { getBarcodePrefixLabel, getUpuTrackingUrl } from "@/lib/tracking/classifier";
import {
    formatTrackingTimestamp,
    resolveTrackingOffice,
} from "@/lib/tracking/format";
import type {
    CodTrackingResult,
    SlpTrackingResult,
    TrackingStatusCategory,
    TrackingStep,
    UnifiedTrackingResult,
} from "@/lib/tracking/types";

function getStatusBadgeStyle(category: TrackingStatusCategory): {
    className: string;
    icon: React.ReactNode;
} {
    switch (category) {
        case "settled":
            return {
                className:
                    "border-[1.5px] border-foreground bg-[#15803D] text-white shadow-[0_1px_0_0_hsl(var(--foreground))]",
                icon: <Banknote className="h-3.5 w-3.5 shrink-0" />,
            };
        case "delivered":
            return {
                className:
                    "border-[1.5px] border-foreground bg-[#15803D] text-white shadow-[0_1px_0_0_hsl(var(--foreground))]",
                icon: <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />,
            };
        case "returned":
        case "error":
            return {
                className:
                    "border-[1.5px] border-foreground bg-primary text-primary-foreground shadow-[0_1px_0_0_hsl(var(--foreground))]",
                icon: <AlertTriangle className="h-3.5 w-3.5 shrink-0" />,
            };
        case "out_for_delivery":
        case "arrived":
            return {
                className:
                    "border-[1.5px] border-foreground bg-secondary text-secondary-foreground shadow-[0_1px_0_0_hsl(var(--foreground))]",
                icon: <Truck className="h-3.5 w-3.5 shrink-0" />,
            };
        default:
            return {
                className:
                    "border-[1.5px] border-foreground bg-background text-foreground shadow-[0_1px_0_0_hsl(var(--foreground))]",
                icon: <Clock className="h-3.5 w-3.5 shrink-0" />,
            };
    }
}

/**
 * Mobile-first Progress Stepper that fits 4 or 5 steps cleanly on a 320px+ phone screen
 * without horizontal scrolling.
 */
function ProgressStepper({
    steps,
    accentColor,
}: {
    steps: TrackingStep[];
    accentColor: "cod" | "slp";
}) {
    const completedBg =
        accentColor === "cod"
            ? "bg-[#15803D] text-white"
            : "bg-primary text-primary-foreground";
    const completedLine = accentColor === "cod" ? "bg-[#15803D]" : "bg-primary";

    return (
        <div className="rounded-xl border-[1.5px] border-foreground/85 bg-background/80 px-2.5 py-3 sm:px-4">
            <div className="flex items-start w-full">
                {steps.map((step, idx) => {
                    const isCompleted = step.state === "completed";
                    const isActive = step.state === "active";
                    const isError = step.state === "error";
                    const nextStep = steps[idx + 1];
                    const lineFilled = isCompleted && nextStep && nextStep.state !== "upcoming";

                    return (
                        <React.Fragment key={`${step.label}-${idx}`}>
                            <div
                                title={step.detail || step.label}
                                className="flex flex-col items-center text-center min-w-0 flex-1 px-0.5"
                            >
                                <div
                                    className={cn(
                                        "flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-md border-[1.5px] border-foreground font-mono text-[10px] sm:text-xs font-extrabold transition-colors shrink-0",
                                        isError
                                            ? "bg-primary text-primary-foreground shadow-[0_1px_0_0_hsl(var(--foreground))]"
                                            : isCompleted
                                                ? cn(completedBg, "shadow-[0_1px_0_0_hsl(var(--foreground))]")
                                                : isActive
                                                    ? "bg-secondary text-secondary-foreground shadow-[0_1px_0_0_hsl(var(--foreground))] ring-2 ring-secondary/50"
                                                    : "border-dashed border-foreground/45 bg-muted/60 text-muted-foreground"
                                    )}
                                >
                                    {isCompleted ? (
                                        <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={3} />
                                    ) : isError ? (
                                        <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                    ) : (
                                        idx + 1
                                    )}
                                </div>
                                <span
                                    className={cn(
                                        "mt-1.5 font-heading text-[10px] sm:text-xs font-extrabold leading-tight break-words",
                                        isError
                                            ? "text-primary"
                                            : isCompleted || isActive
                                                ? "text-foreground"
                                                : "text-muted-foreground"
                                    )}
                                >
                                    {step.label}
                                </span>
                            </div>
                            {idx < steps.length - 1 && (
                                <div
                                    aria-hidden="true"
                                    className={cn(
                                        "mt-3 sm:mt-3.5 h-[2.5px] w-3 sm:w-8 shrink-0 rounded-full transition-colors",
                                        lineFilled
                                            ? completedLine
                                            : "border-t-2 border-dashed border-foreground/30"
                                    )}
                                />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}

function ResolvedOfficeBadge({
    rawLabel,
    rawQuery,
    engine,
    compact = false,
}: {
    rawLabel: string;
    rawQuery?: string;
    engine: LocalOfficeSearchEngine | null;
    compact?: boolean;
}) {
    const resolved = React.useMemo(
        () => resolveTrackingOffice(rawLabel, rawQuery, engine),
        [rawLabel, rawQuery, engine]
    );

    const displayLabel = React.useMemo(() => {
        if (!compact) return resolved.displayName;
        return resolved.displayName
            .replace(/\s+Post\s+Office$/i, "")
            .replace(/^PO\s+/i, "")
            .trim();
    }, [compact, resolved.displayName]);

    return (
        <Link
            href={resolved.href}
            onClick={() => triggerHaptic("light")}
            className={cn(
                "tap group inline-flex items-center gap-1 rounded-md border-[1.5px] border-foreground bg-card font-bold text-foreground shadow-[0_1px_0_0_hsl(var(--foreground))] hover:bg-secondary/35 transition-colors max-w-full",
                compact ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs sm:text-sm"
            )}
            title={
                resolved.postalCode
                    ? `Open ${resolved.displayName} (${resolved.postalCode}) in Lanka Post Directory`
                    : `Search ${resolved.displayName} in Lanka Post Directory`
            }
        >
            <Building2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0 text-primary" />
            <span className="font-heading font-extrabold group-hover:text-primary transition-colors truncate">
                {displayLabel}
            </span>
            {resolved.postalCode && (
                <span className="shrink-0 rounded border border-dashed border-foreground/60 bg-background px-1 py-px font-mono text-[9.5px] font-bold text-foreground">
                    {resolved.postalCode}
                </span>
            )}
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-foreground transition-transform" />
        </Link>
    );
}

/**
 * Compact 2-Column Origin -> Destination Route Strip (side-by-side even on mobile).
 */
function RouteSummaryCards({
    acceptingOffice,
    acceptingQuery,
    dateAccepted,
    deliveryOffice,
    deliveryQuery,
    deliveryDate,
    deliveryDateLabel,
    engine,
}: {
    acceptingOffice?: string;
    acceptingQuery?: string;
    dateAccepted?: string;
    deliveryOffice?: string;
    deliveryQuery?: string;
    deliveryDate?: string;
    deliveryDateLabel: string;
    engine: LocalOfficeSearchEngine | null;
}) {
    if (!acceptingOffice && !deliveryOffice) return null;

    const acceptedFmt = formatTrackingTimestamp(dateAccepted);
    const deliveryFmt = formatTrackingTimestamp(deliveryDate);

    return (
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {/* Origin / Accepting Post Office */}
            <div className="flex flex-col justify-between rounded-xl border-[1.5px] border-foreground bg-background/70 p-2.5 sm:p-3.5 min-w-0">
                <div className="min-w-0">
                    <span className="label-mono block text-[9.5px] sm:text-[11px] truncate">
                        Origin · Accepting
                    </span>
                    <div className="mt-1.5">
                        {acceptingOffice ? (
                            <ResolvedOfficeBadge
                                rawLabel={acceptingOffice}
                                rawQuery={acceptingQuery}
                                engine={engine}
                                compact
                            />
                        ) : (
                            <span className="text-xs font-semibold text-muted-foreground">—</span>
                        )}
                    </div>
                </div>
                {acceptedFmt && (
                    <div className="mt-2 pt-1.5 border-t border-dashed border-foreground/20 flex flex-wrap items-center justify-between gap-1 text-[11px]">
                        <span className="font-bold text-foreground">{acceptedFmt.dateShort}</span>
                        {acceptedFmt.timeShort && (
                            <span className="font-mono text-[10px] font-semibold text-muted-foreground tabular-nums">
                                {acceptedFmt.timeShort}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Destination / Delivery Post Office */}
            <div className="flex flex-col justify-between rounded-xl border-[1.5px] border-foreground bg-background/70 p-2.5 sm:p-3.5 min-w-0">
                <div className="min-w-0">
                    <span className="label-mono block text-[9.5px] sm:text-[11px] truncate">
                        Destination · Delivery
                    </span>
                    <div className="mt-1.5">
                        {deliveryOffice ? (
                            <ResolvedOfficeBadge
                                rawLabel={deliveryOffice}
                                rawQuery={deliveryQuery}
                                engine={engine}
                                compact
                            />
                        ) : (
                            <span className="text-xs font-semibold text-muted-foreground">—</span>
                        )}
                    </div>
                </div>
                {deliveryFmt && (
                    <div className="mt-2 pt-1.5 border-t border-dashed border-foreground/20 flex flex-wrap items-center justify-between gap-1 text-[11px]">
                        <span className="font-bold text-foreground">
                            {deliveryDateLabel}: {deliveryFmt.dateShort}
                        </span>
                        {deliveryFmt.timeShort && (
                            <span className="font-mono text-[10px] font-semibold text-muted-foreground tabular-nums">
                                {deliveryFmt.timeShort}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function CodDetailsSection({
    result,
    engine,
}: {
    result: CodTrackingResult;
    engine: LocalOfficeSearchEngine | null;
}) {
    const settledFmt = formatTrackingTimestamp(result.settledDate);

    return (
        <div className="space-y-2.5">
            <RouteSummaryCards
                acceptingOffice={result.acceptingOffice}
                acceptingQuery={result.acceptingOfficeQuery}
                dateAccepted={result.dateAccepted}
                deliveryOffice={result.deliveryOffice}
                deliveryQuery={result.deliveryOfficeQuery}
                deliveryDate={result.receivedDate}
                deliveryDateLabel="Received"
                engine={engine}
            />

            {/* COD Settlement Ledger Strip */}
            {(result.settledOffice || result.settledDate) && (
                <div className="rounded-xl border-2 border-foreground bg-[#15803D]/10 dark:bg-emerald-500/15 p-3 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-[1.5px] border-foreground bg-[#15803D] text-white shadow-[0_1px_0_0_hsl(var(--foreground))]">
                            <Banknote className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                            <span className="label-mono block text-[10px] text-[#15803D] dark:text-emerald-300">
                                COD Remittance Settled
                            </span>
                            {settledFmt ? (
                                <p className="text-xs font-bold text-foreground truncate">
                                    {settledFmt.dateShort}
                                    {settledFmt.timeShort ? ` · ${settledFmt.timeShort}` : ""}
                                </p>
                            ) : (
                                <p className="text-xs font-bold text-foreground">
                                    Payment settled to sender
                                </p>
                            )}
                        </div>
                    </div>
                    {result.settledOffice && (
                        <ResolvedOfficeBadge
                            rawLabel={result.settledOffice}
                            rawQuery={result.settledOfficeQuery}
                            engine={engine}
                            compact
                        />
                    )}
                </div>
            )}

            {result.extraFields && result.extraFields.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                    {result.extraFields.map((ef) => (
                        <div
                            key={ef.key}
                            className="rounded-lg border-[1.5px] border-foreground/40 bg-background/70 px-2.5 py-2"
                        >
                            <span className="label-mono block text-[10px]">{ef.label}</span>
                            <div className="mt-0.5 text-xs sm:text-sm font-bold text-foreground">{ef.value}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function SlpTimeline({
    result,
    engine,
}: {
    result: SlpTrackingResult;
    engine: LocalOfficeSearchEngine | null;
}) {
    const orderedEvents = [...result.events].reverse();

    return (
        <div className="space-y-3">
            <RouteSummaryCards
                acceptingOffice={result.acceptingOffice}
                acceptingQuery={result.acceptingOfficeQuery}
                dateAccepted={result.dateAccepted}
                deliveryOffice={result.deliveryOffice}
                deliveryQuery={result.deliveryOfficeQuery}
                deliveryDate={result.deliveredDate || result.receivedDate}
                deliveryDateLabel={result.deliveredDate ? "Delivered" : "Arrived"}
                engine={engine}
            />

            {/* Printed Postal Dispatch Log */}
            <div className="rounded-xl border-[1.5px] border-foreground bg-background/60 overflow-hidden">
                <div className="flex items-center justify-between gap-2 border-b-[1.5px] border-foreground bg-muted/70 px-3 py-2">
                    <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-foreground">
                        Dispatch Log ({orderedEvents.length})
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                        Newest first
                    </span>
                </div>

                <div className="divide-y divide-dashed divide-foreground/20 p-2.5 sm:p-3.5">
                    {orderedEvents.map((ev, idx) => {
                        const isLatest = idx === 0;
                        const isLast = idx === orderedEvents.length - 1;
                        const fmt = formatTrackingTimestamp(ev.dateTime);
                        const resolvedLoc = ev.location
                            ? resolveTrackingOffice(ev.location, ev.officeQuery, engine)
                            : null;

                        return (
                            <div
                                key={`${ev.id}-${ev.dateTime}`}
                                className={cn(
                                    "flex gap-2.5",
                                    idx > 0 && "pt-2.5",
                                    !isLast && "pb-2.5"
                                )}
                            >
                                {/* Dedicated Step Node Column */}
                                <div className="flex flex-col items-center shrink-0 w-5 pt-0.5">
                                    <span
                                        className={cn(
                                            "flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-foreground font-mono text-[10px] font-bold",
                                            isLatest
                                                ? "bg-primary text-primary-foreground shadow-[0_1px_0_0_hsl(var(--foreground))]"
                                                : "bg-card text-muted-foreground"
                                        )}
                                    >
                                        {ev.id}
                                    </span>
                                </div>

                                {/* Event Content */}
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <p
                                                className={cn(
                                                    "font-heading text-xs sm:text-sm font-extrabold leading-snug",
                                                    isLatest ? "text-foreground" : "text-foreground/85"
                                                )}
                                            >
                                                {ev.event}
                                            </p>
                                            {isLatest && (
                                                <span className="rounded bg-secondary px-1.5 py-px font-mono text-[8.5px] font-bold uppercase text-secondary-foreground border border-foreground/40">
                                                    Latest
                                                </span>
                                            )}
                                        </div>

                                        {fmt && (
                                            <span className="font-mono text-[10.5px] font-semibold text-muted-foreground tabular-nums shrink-0">
                                                {fmt.dateShort}
                                                {fmt.timeShort ? ` · ${fmt.timeShort}` : ""}
                                            </span>
                                        )}
                                    </div>

                                    {resolvedLoc && (
                                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                            <Link
                                                href={resolvedLoc.href}
                                                onClick={() => triggerHaptic("light")}
                                                className="tap inline-flex items-center gap-1 rounded border border-foreground/35 bg-card px-2 py-0.5 text-[11px] font-semibold text-foreground hover:border-foreground hover:bg-secondary/30 transition-colors"
                                            >
                                                <MapPin className="h-3 w-3 shrink-0 text-primary" />
                                                <span>{resolvedLoc.displayName}</span>
                                                {resolvedLoc.postalCode && (
                                                    <span className="ml-0.5 font-mono text-[10px] font-bold text-primary">
                                                        · {resolvedLoc.postalCode}
                                                    </span>
                                                )}
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default function TrackingResultCard({
    result,
    isOfflineCache = false,
    onRefreshLive,
    expanded,
    defaultExpanded = true,
    onToggleExpand,
}: {
    result: UnifiedTrackingResult;
    isOfflineCache?: boolean;
    onRefreshLive?: (barcode: string) => void;
    expanded?: boolean;
    defaultExpanded?: boolean;
    onToggleExpand?: () => void;
}) {
    const [copiedLink, setCopiedLink] = React.useState(false);
    const [copiedCode, setCopiedCode] = React.useState(false);
    const [localExpanded, setLocalExpanded] = React.useState(defaultExpanded);
    const [officeEngine, setOfficeEngine] = React.useState<LocalOfficeSearchEngine | null>(() =>
        getLoadedOfficeIndexSync()
    );

    const isExpanded = expanded ?? localExpanded;
    const handleToggleExpand = React.useCallback(() => {
        triggerHaptic("light");
        if (onToggleExpand) {
            onToggleExpand();
        } else {
            setLocalExpanded((prev) => !prev);
        }
    }, [onToggleExpand]);

    React.useEffect(() => {
        if (!officeEngine) {
            void ensureLocalOfficeIndex().then((eng) => {
                if (eng) setOfficeEngine(eng);
            });
        }
    }, [officeEngine]);

    const badge = getStatusBadgeStyle(result.statusCategory);
    const prefixLabel = getBarcodePrefixLabel(result.barcode);
    const isCod = result.service === "cod";

    const stampData = React.useMemo(() => {
        const primaryOfficeRaw = result.deliveryOffice || result.acceptingOffice || "SRI LANKA";
        const primaryQuery = result.deliveryOfficeQuery || result.acceptingOfficeQuery;
        const resolved = resolveTrackingOffice(primaryOfficeRaw, primaryQuery, officeEngine);

        const rawDate =
            result.service === "cod"
                ? result.settledDate || result.receivedDate || result.dateAccepted
                : result.deliveredDate || result.receivedDate || result.dateAccepted;
        const fmt = formatTrackingTimestamp(rawDate);

        const labelClean = (primaryQuery || primaryOfficeRaw)
            .replace(/^PO\s+/i, "")
            .replace(/\s*\([A-Z]{2,4}\)\s*$/i, "")
            .replace(/\s+Post\s+Office$/i, "")
            .trim()
            .toUpperCase();

        return {
            code: resolved.postalCode || (isCod ? "COD" : "SLP"),
            label: labelClean || "SRI LANKA POST",
            date: fmt?.postmarkDate || "SL POST",
            time: fmt?.postmarkTime,
        };
    }, [result, officeEngine, isCod]);

    const shareUrl =
        typeof window !== "undefined"
            ? `${window.location.origin}/track/${encodeURIComponent(result.barcode)}`
            : `/track/${encodeURIComponent(result.barcode)}`;

    const handleCopyBarcode = async () => {
        try {
            await navigator.clipboard.writeText(result.barcode);
            triggerHaptic("success");
            setCopiedCode(true);
            setTimeout(() => setCopiedCode(false), 1800);
        } catch {
            // Clipboard unavailable
        }
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            triggerHaptic("success");
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2000);
        } catch {
            // Clipboard unavailable
        }
    };

    const whatsappText = React.useMemo(() => {
        const lines = [
            `📦 *Lanka Post Directory — Tracking*`,
            `Barcode: *${result.barcode}* (${isCod ? "COD" : "SLP Courier"})`,
            `Status: *${result.statusLabel}*`,
        ];
        if (result.acceptingOffice) lines.push(`Origin: ${result.acceptingOffice}`);
        if (result.deliveryOffice) lines.push(`Destination: ${result.deliveryOffice}`);
        if (result.service === "cod" && result.settledDate) {
            lines.push(`Settled Date: ${result.settledDate}`);
        }
        if (result.service === "slp" && result.events.length > 0) {
            const latest = result.events[result.events.length - 1];
            lines.push(`Latest: ${latest.event} (${latest.dateTime} · ${latest.location})`);
        }
        lines.push(`\n🔗 ${shareUrl}`);
        return lines.join("\n");
    }, [result, isCod, shareUrl]);

    const handleNativeOrWhatsappShare = async () => {
        triggerHaptic("light");
        if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
            try {
                await navigator.share({
                    title: `Track ${result.barcode} · Lanka Post Directory`,
                    text: whatsappText,
                    url: shareUrl,
                });
                return;
            } catch {
                // User cancelled or Web Share failed
            }
        }
        window.open(`https://wa.me/?text=${encodeURIComponent(whatsappText)}`, "_blank", "noopener,noreferrer");
    };

    const compactSummary = React.useMemo(() => {
        const parts: string[] = [];
        const from = result.acceptingOfficeQuery || result.acceptingOffice;
        const to = result.deliveryOfficeQuery || result.deliveryOffice;
        const route = [from, to].filter(Boolean).join(" → ");
        if (route) parts.push(route);
        if (result.service === "slp" && result.events.length > 0) {
            const latest = result.events[result.events.length - 1];
            if (latest?.event) parts.push(latest.event);
        }
        if (stampData.date && stampData.date !== "SL POST") {
            parts.push(stampData.date);
        }
        return parts.join(" · ");
    }, [result, stampData.date]);

    return (
        <article
            data-testid={`tracking-result-${result.barcode}`}
            className="animate-fade-slide-up overflow-hidden rounded-2xl border-2 border-foreground bg-card shadow-[3px_3px_0_0_hsl(var(--foreground))] print:shadow-none"
        >
            {/* Service-Specific Top Envelope Stripe */}
            <div
                aria-hidden="true"
                className={cn(
                    "h-2 w-full border-b-2 border-foreground",
                    isCod ? "bg-[#15803D]" : "airmail-stripe"
                )}
            />

            {/* Compact Mobile-First Header (click anywhere outside buttons/links to toggle) */}
            <div
                onClick={(e) => {
                    if ((e.target as HTMLElement).closest("button, a")) return;
                    handleToggleExpand();
                }}
                className={cn(
                    "cursor-pointer bg-muted/35 p-3 sm:px-5 sm:py-4 space-y-2.5",
                    isExpanded && "border-b-2 border-foreground"
                )}
            >
                {/* Row 1: Service Tag + Action Buttons */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <span
                            className={cn(
                                "rounded-[4px] border-[1.5px] border-foreground px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider",
                                isCod
                                    ? "bg-[#15803D] text-white"
                                    : "bg-primary text-primary-foreground"
                            )}
                        >
                            {isCod ? "COD" : "SLP Courier"}
                        </span>
                        <span className="font-mono text-[11px] font-semibold text-muted-foreground truncate">
                            {prefixLabel}
                        </span>
                        {isOfflineCache && (
                            <span className="rounded border border-foreground/40 bg-secondary px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase text-secondary-foreground">
                                Saved
                            </span>
                        )}
                    </div>

                    {/* Action Bar (Refresh + Copy Link + Share + Print + Collapse Toggle) */}
                    <div className="flex items-center gap-1.5 shrink-0 print:hidden">
                        {onRefreshLive && (
                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic("light");
                                    onRefreshLive(result.barcode);
                                }}
                                className="tap inline-flex h-8 items-center gap-1 rounded-md border-[1.5px] border-foreground bg-card px-2 text-[11px] font-bold text-foreground shadow-[0_1px_0_0_hsl(var(--foreground))] hover:bg-secondary/40"
                                title="Check live status from server"
                            >
                                <RefreshCw className="h-3 w-3" />
                                <span className="hidden xs:inline">Refresh</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleCopyLink}
                            className="tap inline-flex h-8 items-center gap-1 rounded-md border-[1.5px] border-foreground bg-card px-2 text-[11px] font-bold text-foreground shadow-[0_1px_0_0_hsl(var(--foreground))] hover:bg-secondary/40"
                            title="Copy shareable tracking link"
                        >
                            {copiedLink ? (
                                <Check className="h-3.5 w-3.5 text-[#15803D] dark:text-emerald-400" />
                            ) : (
                                <Copy className="h-3.5 w-3.5" />
                            )}
                            <span className="hidden sm:inline">{copiedLink ? "Copied" : "Link"}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleNativeOrWhatsappShare()}
                            className="tap inline-flex h-8 items-center gap-1 rounded-md border-[1.5px] border-foreground bg-card px-2 text-[11px] font-bold text-foreground shadow-[0_1px_0_0_hsl(var(--foreground))] hover:bg-secondary/40"
                            title="Share tracking status"
                        >
                            <Share2 className="h-3.5 w-3.5 text-[#15803D] dark:text-emerald-400" />
                            <span className="hidden sm:inline">Share</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic("light");
                                window.print();
                            }}
                            className="tap hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-md border-[1.5px] border-foreground bg-card text-foreground shadow-[0_1px_0_0_hsl(var(--foreground))] hover:bg-secondary/40"
                            title="Print or Save as PDF"
                        >
                            <Printer className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={handleToggleExpand}
                            aria-expanded={isExpanded}
                            data-testid={`tracking-toggle-${result.barcode}`}
                            aria-label={isExpanded ? `Collapse ${result.barcode}` : `Expand ${result.barcode}`}
                            className="tap inline-flex h-8 items-center gap-1 rounded-md border-[1.5px] border-foreground bg-card px-2 text-[11px] font-bold text-foreground shadow-[0_1px_0_0_hsl(var(--foreground))] hover:bg-secondary/40"
                        >
                            <span className="hidden xs:inline">{isExpanded ? "Hide" : "Details"}</span>
                            <ChevronDown
                                className={cn(
                                    "h-3.5 w-3.5 motion-safe:transition-transform motion-safe:duration-200",
                                    isExpanded && "rotate-180"
                                )}
                                aria-hidden="true"
                            />
                        </button>
                    </div>
                </div>

                {/* Row 2: Copyable Barcode Ticket + Prominent Status Badge + Desktop Postmark */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <button
                            type="button"
                            onClick={handleCopyBarcode}
                            title={copiedCode ? "Copied barcode!" : `Tap to copy ${result.barcode}`}
                            className={cn(
                                "tap inline-flex items-center gap-1.5 rounded-lg border-2 border-dashed px-2.5 py-1 font-mono text-sm sm:text-lg font-extrabold tracking-wide transition-colors",
                                copiedCode
                                    ? "border-[#15803D] dark:border-emerald-400 bg-[#15803D]/10 dark:bg-emerald-500/15 text-[#15803D] dark:text-emerald-300"
                                    : "border-foreground bg-background text-foreground hover:bg-secondary/30"
                            )}
                        >
                            <span>{result.barcode}</span>
                            {copiedCode ? (
                                <Check className="h-3.5 w-3.5 text-[#15803D] dark:text-emerald-400 shrink-0" />
                            ) : (
                                <Copy className="h-3 w-3 text-muted-foreground shrink-0" />
                            )}
                        </button>

                        <span
                            className={cn(
                                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-heading text-xs sm:text-sm font-extrabold uppercase tracking-wide",
                                badge.className
                            )}
                        >
                            {badge.icon}
                            <span>{result.statusLabel}</span>
                        </span>
                    </div>

                    <Postmark
                        code={stampData.code}
                        label={stampData.label}
                        date={stampData.date}
                        time={stampData.time}
                        size="sm"
                        boxSize={56}
                        tone={isCod ? "ink" : "red"}
                        rotate={-11}
                        className="hidden md:block shrink-0"
                    />
                </div>

                {/* Compact 1-line summary visible only when collapsed */}
                {!isExpanded && compactSummary && (
                    <p className="font-mono text-[11px] font-medium text-muted-foreground truncate">
                        {compactSummary}
                    </p>
                )}
            </div>

            {/* Collapsible Body */}
            <div
                inert={!isExpanded || undefined}
                aria-hidden={!isExpanded}
                className={cn(
                    "grid motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-200 motion-safe:ease-out print:grid-rows-[1fr] print:opacity-100",
                    isExpanded
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0 pointer-events-none"
                )}
            >
                <div className="min-h-0 overflow-hidden">
                    <div className="p-3 sm:p-5 space-y-3 sm:space-y-4">
                        <ProgressStepper steps={result.steps} accentColor={result.service} />

                        {result.deliveryEstimate && (
                            <div className="flex items-center gap-2 rounded-xl border-[1.5px] border-foreground bg-secondary/25 px-3 py-2 text-xs font-bold text-foreground">
                                <CalendarClock className="h-4 w-4 text-primary shrink-0" />
                                <span>{result.deliveryEstimate}</span>
                            </div>
                        )}

                        {result.service === "cod" ? (
                            <CodDetailsSection result={result} engine={officeEngine} />
                        ) : (
                            <SlpTimeline result={result} engine={officeEngine} />
                        )}

                        {/* Footer Ledger Strip */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-dashed border-foreground/25 text-[10.5px] text-muted-foreground print:hidden">
                            <span className="font-mono">
                                Source: {isCod ? "bepost.lk (COD)" : "slpmail.slpost.gov.lk (SLP)"}
                            </span>
                            <a
                                href={getUpuTrackingUrl(result.barcode)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="tap inline-flex items-center gap-1 font-mono font-bold text-foreground hover:text-primary transition-colors"
                            >
                                <span>UPU International</span>
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </article>
    );
}
