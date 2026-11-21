"use client";

import * as React from "react";
import {
    AlertCircle,
    ArrowRight,
    Banknote,
    CheckCircle2,
    Clock,
    ExternalLink,
    Globe,
    Loader2,
    PackageSearch,
    RefreshCw,
    ShieldCheck,
    Truck,
} from "lucide-react";
import { Link } from "@/navigation";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";
import type { TrackingIntent } from "@/lib/smart-search";
import { getUpuTrackingUrl } from "@/lib/tracking/classifier";
import type {
    CodBatchApiResponse,
    SlpCaptchaApiResponse,
    SlpTrackApiResponse,
    UnifiedTrackingResult,
} from "@/lib/tracking/types";

const HISTORY_STORAGE_KEY = "lpd_tracking_history_v1";

// Module-level cache so re-focusing or typing doesn't re-fetch the same barcode repeatedly
const liveResultCache = new Map<
    string,
    | { state: "found"; result: UnifiedTrackingResult }
    | { state: "needs_slp" }
    | { state: "not_found"; message: string }
>();

function saveResultToLocalStorage(result: UnifiedTrackingResult) {
    if (typeof window === "undefined") return;
    try {
        const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
        const existing = raw ? (JSON.parse(raw) as Array<{ barcode: string; result?: UnifiedTrackingResult }>) : [];
        const entry = {
            barcode: result.barcode,
            service: result.service,
            statusLabel: result.statusLabel,
            statusCategory: result.statusCategory,
            checkedAt: result.checkedAt,
            result,
        };
        const filtered = Array.isArray(existing)
            ? existing.filter((i) => i.barcode !== result.barcode)
            : [];
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify([entry, ...filtered].slice(0, 10)));
    } catch {
        // Ignore storage errors
    }
}

interface HomeTrackingDrawerCardProps {
    intent: TrackingIntent;
    onCloseDrawer: () => void;
}

export default function HomeTrackingDrawerCard({
    intent,
    onCloseDrawer,
}: HomeTrackingDrawerCardProps) {
    const primary = intent.primaryBarcode;
    const isSingle = intent.barcodes.length === 1;
    const isIntl = intent.classification === "international";

    const [lookupState, setLookupState] = React.useState<
        "idle" | "checking_cod" | "found" | "needs_slp" | "not_found" | "error"
    >("idle");
    const [liveResult, setLiveResult] = React.useState<UnifiedTrackingResult | null>(null);
    const [statusMessage, setStatusMessage] = React.useState<string | null>(null);

    // Inline SLP CAPTCHA state
    const [captchaImage, setCaptchaImage] = React.useState<string | null>(null);
    const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);
    const [loadingCaptcha, setLoadingCaptcha] = React.useState(false);
    const [captchaCode, setCaptchaCode] = React.useState("");
    const [submittingSlp, setSubmittingSlp] = React.useState(false);
    const [slpError, setSlpError] = React.useState<string | null>(null);

    const fetchSlpCaptcha = React.useCallback(async () => {
        setLoadingCaptcha(true);
        setSlpError(null);
        try {
            const res = await fetch("/api/track/slp/captcha", { cache: "no-store" });
            const data = (await res.json()) as SlpCaptchaApiResponse;
            if (!res.ok || !data.success || !data.image || !data.token) {
                throw new Error(data.error || "Could not load security code.");
            }
            setCaptchaImage(data.image);
            setCaptchaToken(data.token);
            setCaptchaCode("");
        } catch (err) {
            setCaptchaImage(null);
            setCaptchaToken(null);
            setSlpError(err instanceof Error ? err.message : "Failed to load CAPTCHA.");
        } finally {
            setLoadingCaptcha(false);
        }
    }, []);

    // Automatically check COD database when a complete single domestic barcode is entered
    React.useEffect(() => {
        if (!isSingle || isIntl || primary.length < 11) {
            setLookupState("idle");
            setLiveResult(null);
            return;
        }

        const cached = liveResultCache.get(primary);
        if (cached) {
            if (cached.state === "found") {
                setLiveResult(cached.result);
                setLookupState("found");
                return;
            }
            if (cached.state === "needs_slp") {
                setLiveResult(null);
                setLookupState("needs_slp");
                if (!captchaImage && !loadingCaptcha) {
                    void fetchSlpCaptcha();
                }
                return;
            }
            if (cached.state === "not_found") {
                setLiveResult(null);
                setStatusMessage(cached.message);
                setLookupState("not_found");
                return;
            }
        }

        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setLookupState("checking_cod");
            setStatusMessage(null);
            setSlpError(null);

            // If NA or BF (SLP-likely), pre-fetch CAPTCHA in parallel while still checking COD first
            if (intent.classification === "slp_likely" && !captchaImage) {
                void fetchSlpCaptcha();
            }

            try {
                const res = await fetch("/api/track/cod", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ barcodes: [primary] }),
                    signal: controller.signal,
                });
                const data = (await res.json()) as CodBatchApiResponse;
                if (controller.signal.aborted) return;

                if (!res.ok || !data.success) {
                    setLookupState("error");
                    setStatusMessage(data.error || "Could not check status right now.");
                    return;
                }

                const item = data.items[0];
                if (item && item.found && item.result) {
                    liveResultCache.set(primary, { state: "found", result: item.result });
                    saveResultToLocalStorage(item.result);
                    setLiveResult(item.result);
                    setLookupState("found");
                } else if (item && item.eligibleForSlp) {
                    liveResultCache.set(primary, { state: "needs_slp" });
                    setLiveResult(null);
                    setLookupState("needs_slp");
                    if (!captchaImage && !loadingCaptcha) {
                        void fetchSlpCaptcha();
                    }
                } else {
                    const msg = "No record found";
                    liveResultCache.set(primary, { state: "not_found", message: msg });
                    setLiveResult(null);
                    setStatusMessage(msg);
                    setLookupState("not_found");
                }
            } catch (err) {
                if ((err as { name?: string })?.name === "AbortError") return;
                setLookupState("error");
                setStatusMessage("Connection error");
            }
        }, 320);

        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [primary, isSingle, isIntl, intent.classification]);

    const handleVerifySlp = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const trimmed = captchaCode.trim();
        if (!trimmed || !captchaToken || submittingSlp) return;

        triggerHaptic("medium");
        setSubmittingSlp(true);
        setSlpError(null);

        try {
            const res = await fetch("/api/track/slp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    barcode: primary,
                    captcha: trimmed,
                    token: captchaToken,
                }),
            });
            const data = (await res.json()) as SlpTrackApiResponse;

            if (data.status === "invalid_captcha") {
                setSlpError("Invalid code — try again");
                await fetchSlpCaptcha();
                return;
            }

            if (data.status === "error") {
                setSlpError(data.error || "Verification failed");
                return;
            }

            if (data.status === "ok" && data.result) {
                triggerHaptic("success");
                liveResultCache.set(primary, { state: "found", result: data.result });
                saveResultToLocalStorage(data.result);
                setLiveResult(data.result);
                setLookupState("found");
            } else {
                const msg = "No record found";
                liveResultCache.set(primary, { state: "not_found", message: msg });
                setStatusMessage(msg);
                setLookupState("not_found");
            }
        } catch {
            setSlpError("Network error");
        } finally {
            setSubmittingSlp(false);
        }
    };

    const isCodTheme =
        (liveResult?.service === "cod" || intent.classification === "cod_only") &&
        lookupState !== "needs_slp";

    const shortServiceTag = liveResult
        ? liveResult.service === "cod"
            ? "COD"
            : "SLP Courier"
        : intent.classification === "cod_only"
            ? "COD"
            : isIntl
                ? "International"
                : intent.classification === "slp_likely"
                    ? "SLP Courier"
                    : "COD / SLP";

    return (
        <div
            data-testid="smart-tracking-preview"
            onMouseDown={(e) => {
                // Keep drawer open when user interacts with the inline CAPTCHA input or buttons
                e.stopPropagation();
            }}
            className={cn(
                "overflow-hidden rounded-lg border-2 border-foreground bg-card shadow-[0_2px_0_0_hsl(var(--foreground))]",
                isIntl && "par-avion-stripe p-[3px]"
            )}
        >
            {!isIntl && (
                <div
                    aria-hidden="true"
                    className={cn(
                        "h-1.5 w-full border-b-[1.5px] border-foreground",
                        isCodTheme ? "bg-[#15803D]" : "airmail-stripe"
                    )}
                />
            )}

            <div className="rounded-md bg-card p-2.5 sm:p-3 space-y-2.5">
                {/* Row 1: Compact Barcode Ticket (Left) + Short Service Tag (Right) — fits on 1 row on mobile */}
                <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md border-[1.5px] border-dashed border-foreground bg-background px-2 py-0.5 font-mono text-xs sm:text-sm font-extrabold text-foreground min-w-0 truncate">
                        <PackageSearch className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="truncate">
                            {isSingle ? primary : `${intent.barcodes.length} Barcodes`}
                        </span>
                    </span>

                    <span
                        className={cn(
                            "shrink-0 rounded border border-foreground px-2 py-0.5 font-mono text-[10px] font-bold uppercase",
                            isCodTheme
                                ? "bg-[#15803D] text-white"
                                : isIntl
                                    ? "bg-[#1D4E9E] text-white"
                                    : "bg-secondary text-secondary-foreground"
                        )}
                    >
                        {shortServiceTag}
                    </span>
                </div>

                {/* Row 2: ONLY Latest Status (Left) + Full Details Button (Right) */}
                {lookupState !== "needs_slp" && (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-dashed border-foreground/20">
                        {/* Left: Latest Status Only */}
                        <div className="min-w-0 flex items-center gap-1.5">
                            {lookupState === "checking_cod" ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                                    <span className="truncate">Checking status...</span>
                                </span>
                            ) : lookupState === "found" && liveResult ? (
                                <span
                                    className={cn(
                                        "inline-flex items-center gap-1.5 rounded-md border-[1.5px] border-foreground px-2.5 py-1 font-heading text-xs font-extrabold uppercase shadow-[0_1px_0_0_hsl(var(--foreground))] truncate",
                                        liveResult.statusCategory === "settled" ||
                                        liveResult.statusCategory === "delivered"
                                            ? "bg-[#15803D] text-white"
                                            : liveResult.statusCategory === "returned"
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-secondary text-secondary-foreground"
                                    )}
                                >
                                    {liveResult.statusCategory === "settled" ? (
                                        <Banknote className="h-3.5 w-3.5 shrink-0" />
                                    ) : liveResult.statusCategory === "delivered" ? (
                                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                    ) : (
                                        <Truck className="h-3.5 w-3.5 shrink-0" />
                                    )}
                                    <span className="truncate">{liveResult.statusLabel}</span>
                                </span>
                            ) : lookupState === "not_found" || lookupState === "error" ? (
                                <span className="inline-flex items-center gap-1 rounded border border-foreground/40 bg-muted px-2 py-0.5 font-mono text-[11px] font-bold text-muted-foreground truncate">
                                    <Clock className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{statusMessage || "No record found"}</span>
                                </span>
                            ) : (
                                <span className="font-mono text-[11px] text-muted-foreground truncate">
                                    {isIntl
                                        ? "UPU Global Track & Trace"
                                        : isSingle
                                            ? "Ready to track"
                                            : `${intent.barcodes.length} items ready`}
                                </span>
                            )}
                        </div>

                        {/* Right: Full Details / Action Button */}
                        {isIntl ? (
                            <a
                                href={getUpuTrackingUrl(primary)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => onCloseDrawer()}
                                className="tap shrink-0 inline-flex items-center gap-1 rounded-md border-2 border-foreground bg-[#1D4E9E] px-2.5 py-1 text-xs font-extrabold text-white shadow-[0_2px_0_0_hsl(var(--foreground))]"
                            >
                                <Globe className="h-3 w-3" />
                                <span>UPU Track</span>
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        ) : (
                            <Link
                                href={intent.trackHref}
                                data-testid="smart-tracking-open"
                                onClick={() => onCloseDrawer()}
                                className={cn(
                                    "tap shrink-0 inline-flex items-center gap-1 rounded-md border-2 border-foreground px-3 py-1 text-xs font-extrabold shadow-[0_2px_0_0_hsl(var(--foreground))] hover:opacity-95",
                                    isCodTheme
                                        ? "bg-[#15803D] text-white"
                                        : "bg-primary text-primary-foreground"
                                )}
                            >
                                <span>
                                    {isSingle ? "Full Details" : `Track All (${intent.barcodes.length})`}
                                </span>
                                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                            </Link>
                        )}
                    </div>
                )}

                {/* Row 2 (SLP Courier CAPTCHA Verification): Mobile-friendly compact prompt */}
                {lookupState === "needs_slp" && (
                    <div
                        data-testid="home-slp-captcha-box"
                        className="rounded-lg border-[1.5px] border-foreground bg-secondary/20 p-2.5 space-y-2"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 font-heading text-xs font-extrabold text-foreground">
                                <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" strokeWidth={2.4} />
                                <span>Verify CAPTCHA for SLP Courier status</span>
                            </span>
                            <Link
                                href={intent.trackHref}
                                onClick={() => onCloseDrawer()}
                                className="shrink-0 font-mono text-[10px] font-bold text-primary hover:underline"
                            >
                                Full page →
                            </Link>
                        </div>

                        {slpError && (
                            <div className="flex items-center gap-1.5 rounded border border-primary bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary">
                                <AlertCircle className="h-3 w-3 shrink-0" />
                                <span>{slpError}</span>
                            </div>
                        )}

                        {/* Clean 2-row CAPTCHA bar with min-w-0 so input and Verify never clip */}
                        <div className="flex flex-col gap-2">
                            <div className="flex w-full min-w-0 items-center gap-1.5">
                                <div className="flex h-9 min-w-0 flex-1 items-center justify-center rounded border-[1.5px] border-dashed border-foreground bg-white px-2">
                                    {loadingCaptcha ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-600" />
                                    ) : captchaImage ? (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img
                                            src={captchaImage}
                                            alt="SLP Courier CAPTCHA"
                                            className="h-6 w-auto object-contain select-none contrast-125"
                                        />
                                    ) : (
                                        <span className="font-mono text-[10px] text-neutral-500">Retry</span>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        triggerHaptic("light");
                                        void fetchSlpCaptcha();
                                    }}
                                    disabled={loadingCaptcha || submittingSlp}
                                    className="tap inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border-[1.5px] border-foreground bg-card text-foreground hover:bg-secondary/40 disabled:opacity-50"
                                    title="Refresh security code"
                                >
                                    <RefreshCw className={cn("h-3.5 w-3.5", loadingCaptcha && "animate-spin")} />
                                </button>
                            </div>

                            <div className="flex w-full min-w-0 items-center gap-1.5">
                                <input
                                    type="text"
                                    value={captchaCode}
                                    onChange={(e) => setCaptchaCode(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            void handleVerifySlp(e);
                                        }
                                    }}
                                    placeholder="Code..."
                                    autoComplete="off"
                                    spellCheck={false}
                                    disabled={submittingSlp || loadingCaptcha || !captchaImage}
                                    className="h-9 min-w-0 flex-1 rounded border-[1.5px] border-foreground bg-card px-2.5 font-mono text-xs sm:text-sm font-extrabold tracking-widest text-foreground placeholder:font-sans placeholder:text-xs placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground focus:outline-none"
                                />

                                <button
                                    type="button"
                                    onClick={(e) => void handleVerifySlp(e)}
                                    disabled={submittingSlp || loadingCaptcha || !captchaImage || !captchaCode.trim()}
                                    className="tap shrink-0 inline-flex h-9 items-center justify-center gap-1 rounded border-2 border-foreground bg-primary px-3 text-xs font-extrabold text-primary-foreground shadow-[0_1px_0_0_hsl(var(--foreground))] hover:opacity-95 disabled:opacity-50"
                                >
                                    {submittingSlp ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <>
                                            <span>Verify</span>
                                            <ArrowRight className="h-3 w-3" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
