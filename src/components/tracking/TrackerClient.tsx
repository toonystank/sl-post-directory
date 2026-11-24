"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import {
    AlertCircle,
    ArrowRight,
    Barcode,
    Banknote,
    Building2,
    Calculator,
    Camera,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    ClipboardPaste,
    ExternalLink,
    Globe,
    History,
    HelpCircle,
    Loader2,
    Package,
    Search,
    Trash2,
    Truck,
    X,
} from "lucide-react";
import { Link } from "@/navigation";
import Postmark from "@/components/brand/Postmark";
import PillarBox from "@/components/brand/PillarBox";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";
import {
    classifyBarcode,
    getBarcodeCountrySuffix,
    getBarcodePrefixLabel,
    getUpuTrackingUrl,
    parseBarcodes,
} from "@/lib/tracking/classifier";
import { formatTrackingTimestamp } from "@/lib/tracking/format";
import { normalizeCodTrackingResult } from "@/lib/tracking/status";
import type {
    CodBatchApiResponse,
    SlpCaptchaApiResponse,
    SlpTrackApiResponse,
    UnifiedTrackingResult,
} from "@/lib/tracking/types";
import TrackingResultCard from "./TrackingResultCard";
import SlpCaptchaPrompt from "./SlpCaptchaPrompt";

const BarcodeScannerSheet = dynamic(() => import("./BarcodeScannerSheet"), {
    ssr: false,
});

const HISTORY_STORAGE_KEY = "lpd_tracking_history_v1";
const MAX_HISTORY_ITEMS = 10;

interface HistoryEntry {
    barcode: string;
    service: "cod" | "slp";
    statusLabel: string;
    statusCategory: UnifiedTrackingResult["statusCategory"];
    checkedAt: string;
    result: UnifiedTrackingResult;
}

interface NotFoundItem {
    barcode: string;
    reason: string;
    checkedSlp: boolean;
}

interface InternationalItem {
    barcode: string;
    countryCode: string;
    upuUrl: string;
}

interface TrackerClientProps {
    initialQuery?: string;
}

function readHistoryFromStorage(): Map<string, HistoryEntry> {
    const map = new Map<string, HistoryEntry>();
    if (typeof window === "undefined") return map;
    try {
        const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
        if (!raw) return map;
        const parsed = JSON.parse(raw) as HistoryEntry[];
        if (!Array.isArray(parsed)) return map;
        for (const entry of parsed) {
            if (!entry?.barcode || !entry?.result) continue;
            const fixedResult =
                entry.result.service === "cod"
                    ? normalizeCodTrackingResult(entry.result)
                    : entry.result;
            map.set(entry.barcode, {
                ...entry,
                statusLabel: fixedResult.statusLabel,
                statusCategory: fixedResult.statusCategory,
                result: fixedResult,
            });
        }
    } catch {
        // Ignore localStorage parse errors
    }
    return map;
}

export default function TrackerClient({ initialQuery = "" }: TrackerClientProps) {
    const t = useTranslations("Track");
    const locale = useLocale();
    const isIndic = locale === "si" || locale === "ta";

    const [input, setInput] = React.useState(initialQuery);
    const [loadingCod, setLoadingCod] = React.useState(false);
    const [globalError, setGlobalError] = React.useState<string | null>(null);
    const [isOfflineMode, setIsOfflineMode] = React.useState(false);
    const [guideOpen, setGuideOpen] = React.useState(false);
    const [scannerOpen, setScannerOpen] = React.useState(false);

    const [results, setResults] = React.useState<UnifiedTrackingResult[]>([]);
    const [notFoundItems, setNotFoundItems] = React.useState<NotFoundItem[]>([]);
    const [intlItems, setIntlItems] = React.useState<InternationalItem[]>([]);

    // Queue of domestic non-BD barcodes not found in COD that need SLP Courier CAPTCHA
    const [slpQueue, setSlpQueue] = React.useState<string[]>([]);
    const [captchaImage, setCaptchaImage] = React.useState<string | null>(null);
    const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);
    const [loadingCaptcha, setLoadingCaptcha] = React.useState(false);
    const [submittingSlp, setSubmittingSlp] = React.useState(false);
    const [slpError, setSlpError] = React.useState<string | null>(null);

    const [history, setHistory] = React.useState<HistoryEntry[]>([]);
    const [expandedBarcodes, setExpandedBarcodes] = React.useState<Set<string>>(() => new Set());
    const prevResultBarcodesRef = React.useRef<string[]>([]);
    const autoSubmittedRef = React.useRef(false);

    React.useEffect(() => {
        const nextCodes = results.map((r) => r.barcode);
        const prevCodes = prevResultBarcodesRef.current;
        prevResultBarcodesRef.current = nextCodes;

        if (nextCodes.length === 0) {
            setExpandedBarcodes(new Set());
            return;
        }
        if (nextCodes.length === 1) {
            setExpandedBarcodes(new Set([nextCodes[0]]));
            return;
        }

        const isAppendingToBatch =
            prevCodes.length > 0 && prevCodes.every((c) => nextCodes.includes(c));
        if (isAppendingToBatch) {
            setExpandedBarcodes((prev) => {
                const kept = new Set<string>();
                for (const code of prev) {
                    if (nextCodes.includes(code)) kept.add(code);
                }
                return kept;
            });
        } else {
            setExpandedBarcodes(new Set());
        }
    }, [results]);

    const toggleCardExpanded = React.useCallback((barcode: string) => {
        setExpandedBarcodes((prev) => {
            const next = new Set(prev);
            if (next.has(barcode)) {
                next.delete(barcode);
            } else {
                next.add(barcode);
            }
            return next;
        });
    }, []);

    const allExpanded =
        results.length > 0 && results.every((r) => expandedBarcodes.has(r.barcode));

    const handleToggleAllCards = React.useCallback(() => {
        triggerHaptic("light");
        if (allExpanded) {
            setExpandedBarcodes(new Set());
        } else {
            setExpandedBarcodes(new Set(results.map((r) => r.barcode)));
        }
    }, [allExpanded, results]);

    // Live preview of barcodes parsed from current input
    const liveParsedBarcodes = React.useMemo(() => parseBarcodes(input), [input]);

    // Load recent tracking history from localStorage (and re-normalize COD statuses so
    // previously cached "PENDING DELIVERY" entries immediately reflect accurate step states)
    React.useEffect(() => {
        try {
            const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as HistoryEntry[];
                if (Array.isArray(parsed)) {
                    const normalized = parsed.slice(0, MAX_HISTORY_ITEMS).map((entry) => {
                        if (entry?.result?.service === "cod") {
                            const fixed = normalizeCodTrackingResult(entry.result);
                            return {
                                ...entry,
                                statusLabel: fixed.statusLabel,
                                statusCategory: fixed.statusCategory,
                                result: fixed,
                            };
                        }
                        return entry;
                    });
                    setHistory(normalized);
                    try {
                        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(normalized));
                    } catch {
                        // Ignore storage quota errors
                    }
                }
            }
        } catch {
            // Ignore localStorage parse errors
        }
    }, []);

    const saveToHistory = React.useCallback((items: UnifiedTrackingResult[]) => {
        if (items.length === 0) return;
        setHistory((prev) => {
            const map = new Map<string, HistoryEntry>();
            for (const res of items) {
                map.set(res.barcode, {
                    barcode: res.barcode,
                    service: res.service,
                    statusLabel: res.statusLabel,
                    statusCategory: res.statusCategory,
                    checkedAt: res.checkedAt,
                    result: res,
                });
            }
            for (const old of prev) {
                if (!map.has(old.barcode)) {
                    map.set(old.barcode, old);
                }
            }
            const next = Array.from(map.values()).slice(0, MAX_HISTORY_ITEMS);
            try {
                localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
            } catch {
                // Ignore storage quota errors
            }
            return next;
        });
    }, []);

    const removeHistoryItem = (barcode: string, e: React.MouseEvent) => {
        e.stopPropagation();
        triggerHaptic("light");
        setHistory((prev) => {
            const next = prev.filter((item) => item.barcode !== barcode);
            try {
                localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
            } catch {
                // Ignore
            }
            return next;
        });
    };

    const clearHistory = () => {
        triggerHaptic("light");
        setHistory([]);
        try {
            localStorage.removeItem(HISTORY_STORAGE_KEY);
        } catch {
            // Ignore
        }
    };

    /**
     * Instant 0ms viewing of a saved item from Recent Tracked Items
     * (avoids forcing the user to re-solve the SLP Courier CAPTCHA just to view a recent parcel).
     */
    const openSavedHistoryItem = (entry: HistoryEntry) => {
        triggerHaptic("light");
        setInput(entry.barcode);
        setGlobalError(null);
        setSlpError(null);
        setSlpQueue([]);
        setNotFoundItems([]);
        setIntlItems([]);
        setResults([entry.result]);
        setIsOfflineMode(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const fetchSlpCaptcha = React.useCallback(async () => {
        setLoadingCaptcha(true);
        setSlpError(null);
        try {
            const res = await fetch("/api/track/slp/captcha", { cache: "no-store" });
            const data = (await res.json()) as SlpCaptchaApiResponse;
            if (!res.ok || !data.success || !data.image || !data.token) {
                throw new Error(data.error || "Could not load SLP Courier security code.");
            }
            setCaptchaImage(data.image);
            setCaptchaToken(data.token);
        } catch (err) {
            setCaptchaImage(null);
            setCaptchaToken(null);
            setSlpError(err instanceof Error ? err.message : "Failed to load security code.");
        } finally {
            setLoadingCaptcha(false);
        }
    }, []);

    const runTracking = React.useCallback(
        async (rawInput: string) => {
            const barcodes = parseBarcodes(rawInput);
            setGlobalError(null);
            setSlpError(null);
            setIsOfflineMode(false);

            if (barcodes.length === 0) {
                setGlobalError(
                    "Enter a valid Sri Lanka Post tracking number (e.g., BD070817564LK, NA055922175LK, BF009065544LK)."
                );
                return;
            }

            triggerHaptic("medium");

            // Offline fallback: show cached tracking results from localStorage
            if (typeof navigator !== "undefined" && !navigator.onLine) {
                const cachedResults: UnifiedTrackingResult[] = [];
                const missing: NotFoundItem[] = [];
                for (const code of barcodes) {
                    const hit = history.find((h) => h.barcode === code);
                    if (hit) {
                        cachedResults.push(hit.result);
                    } else {
                        missing.push({
                            barcode: code,
                            reason: "You are offline and this tracking number is not in your saved history.",
                            checkedSlp: false,
                        });
                    }
                }
                setResults(cachedResults);
                setNotFoundItems(missing);
                setIntlItems([]);
                setSlpQueue([]);
                setIsOfflineMode(true);
                return;
            }

            // Partition international (non-LK) vs domestic barcodes
            const international: InternationalItem[] = [];
            const domestic: string[] = [];

            for (const code of barcodes) {
                if (classifyBarcode(code) === "international") {
                    international.push({
                        barcode: code,
                        countryCode: getBarcodeCountrySuffix(code) || "INTL",
                        upuUrl: getUpuTrackingUrl(code),
                    });
                } else {
                    domestic.push(code);
                }
            }

            const savedMap = readHistoryFromStorage();
            const cachedSlpResults: UnifiedTrackingResult[] = [];
            const domesticToQuery: string[] = [];

            for (const code of domestic) {
                const cached = savedMap.get(code) ?? history.find((h) => h.barcode === code);
                if (cached?.result?.service === "slp") {
                    cachedSlpResults.push(cached.result);
                } else {
                    domesticToQuery.push(code);
                }
            }

            setResults(cachedSlpResults);
            setNotFoundItems([]);
            setIntlItems(international);
            setSlpQueue([]);

            if (domesticToQuery.length === 0) {
                if (cachedSlpResults.length > 0) {
                    triggerHaptic("success");
                }
                return;
            }

            // Pre-fetch CAPTCHA in parallel if any remaining barcode is SLP-likely (NA/BF),
            // while still checking COD database FIRST.
            const hasSlpLikely = domesticToQuery.some((b) => classifyBarcode(b) === "slp_likely");
            const captchaPrefetch = hasSlpLikely ? fetchSlpCaptcha() : null;

            setLoadingCod(true);
            try {
                const res = await fetch("/api/track/cod", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ barcodes: domesticToQuery }),
                });

                const data = (await res.json()) as CodBatchApiResponse;
                if (!res.ok || !data.success) {
                    throw new Error(data.error || "Failed to query COD tracking database.");
                }

                const foundCod: UnifiedTrackingResult[] = [];
                const pendingSlp: string[] = [];
                const definitelyNotFound: NotFoundItem[] = [];

                for (const item of data.items) {
                    if (item.found && item.result) {
                        foundCod.push(item.result);
                    } else if (item.eligibleForSlp) {
                        const fallbackCached = savedMap.get(item.barcode)?.result;
                        if (fallbackCached) {
                            foundCod.push(fallbackCached);
                        } else {
                            pendingSlp.push(item.barcode);
                        }
                    } else {
                        definitelyNotFound.push({
                            barcode: item.barcode,
                            reason: "No COD record found for this BD barcode. Verify the number or check again after dispatch.",
                            checkedSlp: false,
                        });
                    }
                }

                const mergedResults = [...cachedSlpResults, ...foundCod];
                setResults(mergedResults);
                setNotFoundItems(definitelyNotFound);
                saveToHistory(foundCod);

                if (mergedResults.length > 0) {
                    triggerHaptic("success");
                }

                if (pendingSlp.length > 0) {
                    setSlpQueue(pendingSlp);
                    if (!captchaPrefetch) {
                        void fetchSlpCaptcha();
                    }
                }
            } catch (err) {
                setGlobalError(
                    err instanceof Error
                        ? err.message
                        : "Unable to connect to Sri Lanka Post tracking server."
                );
            } finally {
                setLoadingCod(false);
            }
        },
        [fetchSlpCaptcha, history, saveToHistory]
    );

    // Auto-run when opened from /track/[barcode] or homepage search bar /track?q=...
    React.useEffect(() => {
        if (initialQuery && !autoSubmittedRef.current) {
            autoSubmittedRef.current = true;
            setInput(initialQuery);
            void runTracking(initialQuery);
        }
    }, [initialQuery, runTracking]);

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        void runTracking(input);
    };

    const handlePasteFromClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text && text.trim()) {
                triggerHaptic("light");
                const cleaned = text.trim().toUpperCase();
                setInput(cleaned);
                if (parseBarcodes(cleaned).length > 0) {
                    void runTracking(cleaned);
                }
            }
        } catch {
            // Clipboard permission denied or unavailable
        }
    };

    const handleSlpSubmit = async (captchaCode: string) => {
        const currentBarcode = slpQueue[0];
        if (!currentBarcode || !captchaToken) return;

        setSubmittingSlp(true);
        setSlpError(null);

        try {
            const res = await fetch("/api/track/slp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    barcode: currentBarcode,
                    captcha: captchaCode,
                    token: captchaToken,
                }),
            });

            const data = (await res.json()) as SlpTrackApiResponse;

            if (data.status === "invalid_captcha") {
                setSlpError(data.error || "Incorrect security code. Please try again.");
                await fetchSlpCaptcha();
                return;
            }

            if (data.status === "error") {
                setSlpError(data.error || "SLP Courier lookup failed. Please try again.");
                return;
            }

            if (data.status === "ok" && data.result) {
                triggerHaptic("success");
                setResults((prev) => [...prev, data.result!]);
                saveToHistory([data.result]);
            } else {
                setNotFoundItems((prev) => [
                    ...prev,
                    {
                        barcode: currentBarcode,
                        reason: "No record found in COD or SLP Courier databases.",
                        checkedSlp: true,
                    },
                ]);
            }

            // Advance queue
            const remaining = slpQueue.slice(1);
            setSlpQueue(remaining);
            if (remaining.length > 0) {
                void fetchSlpCaptcha();
            } else {
                setCaptchaImage(null);
                setCaptchaToken(null);
            }
        } catch (err) {
            setSlpError(
                err instanceof Error ? err.message : "Network error while checking SLP Courier."
            );
        } finally {
            setSubmittingSlp(false);
        }
    };

    const handleSkipSlp = () => {
        const currentBarcode = slpQueue[0];
        if (!currentBarcode) return;
        setNotFoundItems((prev) => [
            ...prev,
            {
                barcode: currentBarcode,
                reason: "Not found in COD database (SLP Courier check skipped).",
                checkedSlp: false,
            },
        ]);
        const remaining = slpQueue.slice(1);
        setSlpQueue(remaining);
        if (remaining.length > 0) {
            void fetchSlpCaptcha();
        }
    };

    const totalTracked = results.length + notFoundItems.length + intlItems.length + slpQueue.length;
    const deliveredCount = results.filter(
        (r) => r.statusCategory === "delivered" || r.statusCategory === "settled"
    ).length;
    const transitCount = results.filter(
        (r) =>
            r.statusCategory === "accepted" ||
            r.statusCategory === "in_transit" ||
            r.statusCategory === "arrived" ||
            r.statusCategory === "out_for_delivery" ||
            r.statusCategory === "pending"
    ).length;

    const sampleCodes = [
        { code: "BD070817564LK", tag: "COD", color: "bg-[#15803D] text-white" },
        { code: "NA055922175LK", tag: "SLP", color: "bg-primary text-primary-foreground" },
        { code: "BF009065544LK", tag: "SLP", color: "bg-primary text-primary-foreground" },
    ];

    return (
        <div className="w-full overflow-x-clip">
            {/* ===== Top Search Section (Compact on Mobile TWA, Full Masthead on Desktop) ===== */}
            <section className="border-b-2 border-foreground bg-card/40 md:paper-grain">
                <div className="container mx-auto max-w-4xl px-3 py-3 md:px-4 md:py-8">
                    {/* Desktop-only Masthead (on mobile, Navbar already displays "Track parcel") */}
                    <div className="hidden md:grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_auto] mb-5">
                        <div className="min-w-0">
                            <p className="label-mono text-primary mb-1.5">
                                {t("liveBadge")}
                            </p>
                            <h1
                                className={cn(
                                    "break-words font-extrabold",
                                    isIndic
                                        ? "text-3xl md:text-4xl leading-snug"
                                        : "display text-4xl md:text-5xl"
                                )}
                            >
                                {t("title")}
                            </h1>
                            <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-2xl leading-relaxed">
                                {t("liveSubtitle")}
                            </p>
                        </div>

                        <div
                            aria-hidden="true"
                            className="relative flex items-center justify-center w-[150px] h-[110px] select-none pointer-events-none shrink-0"
                        >
                            <Postmark
                                code="00100"
                                size="md"
                                boxSize={68}
                                tone="ink"
                                rotate={14}
                                label="COLOMBO GPO"
                                bottomLabel="ශ්‍රී ලංකා · SRI LANKA"
                                date="19 NOV 26"
                                time="AM 09.15"
                                bay="T"
                                className="absolute right-0 top-0 z-0 rounded-full bg-background"
                            />
                            <Postmark
                                code="20000"
                                size="md"
                                boxSize={64}
                                tone="red"
                                rotate={-14}
                                label="KANDY"
                                bottomLabel="ශ්‍රී ලංකා · SRI LANKA"
                                date="19 NOV 26"
                                time="PM 16.25"
                                bay="C"
                                className="absolute left-0 bottom-0 z-0 rounded-full bg-background"
                            />
                            <PillarBox className="relative z-10 w-[68px] h-auto" />
                        </div>
                    </div>

                    {/* Unified Single-Row Search Bar (matches Homepage SearchBar.tsx) */}
                    <form onSubmit={handleFormSubmit} className="space-y-2.5">
                        <label htmlFor="tracking-input" className="sr-only">
                            {t("inputLabel")}
                        </label>

                        <div className="relative flex h-12 sm:h-14 items-stretch overflow-hidden rounded-md border-2 border-foreground bg-card transition-shadow focus-within:shadow-[3px_3px_0_0_hsl(var(--foreground))]">
                            <div className="flex flex-1 items-center gap-2 pl-2.5 sm:pl-3.5 min-w-0">
                                <span
                                    aria-hidden="true"
                                    className="flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full border border-foreground/40 bg-background text-foreground"
                                >
                                    <Barcode className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.4} />
                                </span>

                                <input
                                    id="tracking-input"
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="BD070817564LK, NA055922175LK..."
                                    autoComplete="off"
                                    autoCapitalize="characters"
                                    spellCheck={false}
                                    className="h-full w-full min-w-0 bg-transparent font-mono text-xs sm:text-base font-extrabold tracking-wide text-foreground placeholder:font-mono placeholder:font-semibold placeholder:tracking-normal placeholder:text-muted-foreground/75 focus:outline-none"
                                />
                            </div>

                            {/* Paste / Clear + Camera Scan Trigger */}
                            <div className="flex items-center gap-1 pr-1.5 sm:pr-2">
                                {!input ? (
                                    <button
                                        type="button"
                                        onClick={handlePasteFromClipboard}
                                        title="Paste tracking number from clipboard"
                                        className="tap inline-flex h-8 items-center gap-1 rounded border-[1.5px] border-dashed border-foreground/55 bg-background px-2 font-mono text-[10px] font-bold uppercase text-foreground hover:border-foreground hover:bg-secondary/35 transition-colors"
                                    >
                                        <ClipboardPaste className="h-3 w-3 text-primary" />
                                        <span>Paste</span>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            triggerHaptic("light");
                                            setInput("");
                                            setGlobalError(null);
                                        }}
                                        aria-label="Clear tracking input"
                                        className="tap inline-flex h-7 w-7 items-center justify-center rounded-full border border-foreground/35 bg-muted/60 text-foreground hover:bg-secondary transition-colors"
                                    >
                                        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onPointerDown={() =>
                                        void import("@/lib/tracking/ocr-worker").then((m) =>
                                            m.prewarmOcr("eng")
                                        )
                                    }
                                    onClick={() => {
                                        triggerHaptic("light");
                                        setScannerOpen(true);
                                    }}
                                    data-testid="open-barcode-scanner"
                                    title="Scan barcode, printed slip, or handwritten code with camera"
                                    aria-label="Scan barcode or written code with camera"
                                    className="tap inline-flex h-8 items-center gap-1 rounded border-[1.5px] border-foreground bg-secondary px-2 font-mono text-[10px] font-extrabold uppercase text-secondary-foreground shadow-[0_1px_0_0_hsl(var(--foreground))] hover:opacity-95 transition-opacity"
                                >
                                    <Camera className="h-3.5 w-3.5" strokeWidth={2.4} />
                                    <span className="hidden xs:inline">Scan</span>
                                </button>
                            </div>

                            {/* Docked High-Contrast Submit Button */}
                            <button
                                type="submit"
                                disabled={loadingCod}
                                className="tap inline-flex shrink-0 items-center justify-center gap-1.5 border-l-2 border-foreground bg-primary px-3.5 sm:px-6 font-heading text-xs sm:text-base font-extrabold text-primary-foreground hover:bg-primary/95 disabled:opacity-60"
                            >
                                {loadingCod ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Search className="h-4 w-4" strokeWidth={2.5} />
                                )}
                                <span>{loadingCod ? "Checking..." : "Track"}</span>
                            </button>
                        </div>

                        {/* Live Detected Barcodes or Single-Row Horizontal Sample Chips */}
                        {liveParsedBarcodes.length > 0 ? (
                            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5">
                                <span className="label-mono shrink-0 text-[10px]">
                                    Ready ({liveParsedBarcodes.length}):
                                </span>
                                {liveParsedBarcodes.map((code) => {
                                    const cls = classifyBarcode(code);
                                    const pillColor =
                                        cls === "cod_only"
                                            ? "bg-[#15803D] text-white"
                                            : cls === "international"
                                                ? "bg-[#1D4E9E] text-white"
                                                : "bg-primary text-primary-foreground";
                                    const shortTag =
                                        cls === "cod_only"
                                            ? "COD"
                                            : cls === "international"
                                                ? getBarcodeCountrySuffix(code) || "INTL"
                                                : cls === "slp_likely"
                                                    ? "SLP"
                                                    : "COD→SLP";
                                    return (
                                        <span
                                            key={code}
                                            className="shrink-0 inline-flex items-center gap-1 rounded border-[1.5px] border-dashed border-foreground/75 bg-card px-2 py-0.5 font-mono text-[11px] font-extrabold text-foreground"
                                        >
                                            <span>{code}</span>
                                            <span
                                                className={cn(
                                                    "rounded px-1 py-px font-mono text-[8.5px] font-bold uppercase",
                                                    pillColor
                                                )}
                                            >
                                                {shortTag}
                                            </span>
                                        </span>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5">
                                <span className="label-mono shrink-0 text-[10px]">Try:</span>
                                {sampleCodes.map((s) => (
                                    <button
                                        key={s.code}
                                        type="button"
                                        onClick={() => {
                                            setInput(s.code);
                                            void runTracking(s.code);
                                        }}
                                        className="tap shrink-0 inline-flex items-center gap-1.5 rounded border-[1.5px] border-dashed border-foreground/70 bg-card px-2 py-0.5 font-mono text-[11px] font-bold text-foreground hover:bg-secondary/35 transition-colors"
                                    >
                                        <span>{s.code}</span>
                                        <span
                                            className={cn(
                                                "rounded px-1 py-px text-[8.5px] font-bold uppercase",
                                                s.color
                                            )}
                                        >
                                            {s.tag}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </form>

                    {globalError && (
                        <div
                            role="alert"
                            className="mt-3 flex items-center gap-2 rounded-xl border-2 border-primary bg-primary/10 px-3.5 py-2.5 text-xs font-bold text-primary"
                        >
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>{globalError}</span>
                        </div>
                    )}
                </div>
            </section>

            {/* ===== Main Content Body ===== */}
            <div className="container mx-auto max-w-4xl px-3 py-4 md:px-4 md:py-7 space-y-4 md:space-y-6">
                {/* Bulk Summary Ledger Strip (when 2+ barcodes tracked) */}
                {totalTracked >= 2 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="rounded-xl border-2 border-foreground bg-card px-3 py-2 shadow-[0_2px_0_0_hsl(var(--foreground))]">
                            <span className="label-mono block text-[10px]">Total</span>
                            <span className="font-mono text-xl font-extrabold text-foreground">{totalTracked}</span>
                        </div>
                        <div className="rounded-xl border-2 border-foreground bg-[#15803D]/10 px-3 py-2 shadow-[0_2px_0_0_hsl(var(--foreground))]">
                            <span className="label-mono block text-[10px] text-[#15803D] dark:text-emerald-300">
                                Delivered / Settled
                            </span>
                            <span className="font-mono text-xl font-extrabold text-[#15803D] dark:text-emerald-300">
                                {deliveredCount}
                            </span>
                        </div>
                        <div className="rounded-xl border-2 border-foreground bg-secondary/25 px-3 py-2 shadow-[0_2px_0_0_hsl(var(--foreground))]">
                            <span className="label-mono block text-[10px] text-foreground">
                                In Transit
                            </span>
                            <span className="font-mono text-xl font-extrabold text-foreground">
                                {transitCount}
                            </span>
                        </div>
                        <div className="rounded-xl border-2 border-foreground bg-card px-3 py-2 shadow-[0_2px_0_0_hsl(var(--foreground))]">
                            <span className="label-mono block text-[10px]">
                                Pending / None
                            </span>
                            <span className="font-mono text-xl font-extrabold text-foreground">
                                {slpQueue.length + notFoundItems.length}
                            </span>
                        </div>
                    </div>
                )}

                {/* Loading State */}
                {loadingCod && (
                    <div className="rounded-2xl border-2 border-foreground bg-card p-5 shadow-[3px_3px_0_0_hsl(var(--foreground))] flex items-center justify-center gap-3">
                        <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                        <span className="font-heading text-xs sm:text-sm font-extrabold text-foreground">
                            Checking Sri Lanka Post COD database...
                        </span>
                    </div>
                )}

                {/* Active SLP Courier CAPTCHA Challenge */}
                {slpQueue.length > 0 && (
                    <SlpCaptchaPrompt
                        barcode={slpQueue[0]}
                        remainingCount={slpQueue.length - 1}
                        captchaImage={captchaImage}
                        loadingCaptcha={loadingCaptcha}
                        submitting={submittingSlp}
                        error={slpError}
                        onRefresh={() => void fetchSlpCaptcha()}
                        onSubmit={(code) => void handleSlpSubmit(code)}
                        onSkip={handleSkipSlp}
                    />
                )}

                {/* Tracking Result Cards */}
                {results.length > 0 && (
                    <div className="space-y-3 sm:space-y-4">
                        {results.length > 1 && (
                            <div className="flex items-center justify-between gap-2 rounded-xl border-2 border-foreground bg-muted/45 px-3.5 py-2 print:hidden">
                                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-foreground">
                                    Tracked Parcels ({results.length})
                                </span>
                                <button
                                    type="button"
                                    data-testid="tracking-toggle-all"
                                    aria-expanded={allExpanded}
                                    onClick={handleToggleAllCards}
                                    className="tap inline-flex items-center gap-1.5 rounded-md border-[1.5px] border-foreground bg-card px-2.5 py-1 font-mono text-[11px] font-bold text-foreground shadow-[0_1px_0_0_hsl(var(--foreground))] hover:bg-secondary/40"
                                >
                                    <span>{allExpanded ? "Collapse all" : "Expand all"}</span>
                                    <ChevronDown
                                        className={cn(
                                            "h-3.5 w-3.5 motion-safe:transition-transform motion-safe:duration-200",
                                            allExpanded && "rotate-180"
                                        )}
                                        aria-hidden="true"
                                    />
                                </button>
                            </div>
                        )}
                        {results.map((res) => (
                            <TrackingResultCard
                                key={`${res.service}-${res.barcode}`}
                                result={res}
                                isOfflineCache={isOfflineMode}
                                expanded={expandedBarcodes.has(res.barcode)}
                                onToggleExpand={() => toggleCardExpanded(res.barcode)}
                                onRefreshLive={(code) => void runTracking(code)}
                            />
                        ))}
                    </div>
                )}

                {/* International / UPU Par Avion Cards */}
                {intlItems.length > 0 && (
                    <div className="space-y-3">
                        {intlItems.map((item) => (
                            <div
                                key={item.barcode}
                                className="overflow-hidden rounded-2xl border-2 border-foreground bg-card shadow-[3px_3px_0_0_hsl(var(--foreground))]"
                            >
                                <div className="h-2 w-full par-avion-stripe border-b-2 border-foreground" aria-hidden="true" />
                                <div className="p-3.5 sm:p-5 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Globe className="h-4 w-4 text-[#1D4E9E] dark:text-blue-300" />
                                            <h3 className="font-mono text-base sm:text-lg font-extrabold">{item.barcode}</h3>
                                            <span className="rounded border-[1.5px] border-foreground bg-[#1D4E9E] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
                                                Par Avion · {item.countryCode}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            International articles are tracked on the official UPU Global Track &amp; Trace portal.
                                        </p>
                                    </div>
                                    <a
                                        href={item.upuUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="tap inline-flex items-center gap-1.5 rounded-md border-2 border-foreground bg-[#1D4E9E] px-3.5 py-2 text-xs font-bold text-white shadow-[0_2px_0_0_hsl(var(--foreground))]"
                                    >
                                        <span>UPU Global Track</span>
                                        <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Not Found Cards */}
                {notFoundItems.length > 0 && (
                    <div className="space-y-3">
                        {notFoundItems.map((item) => (
                            <div
                                key={item.barcode}
                                className="rounded-2xl border-2 border-foreground bg-card p-3.5 sm:p-5 shadow-[0_2px_0_0_hsl(var(--foreground))]"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Package className="h-4 w-4 text-primary" />
                                            <h3 className="font-mono text-sm sm:text-base font-extrabold">{item.barcode}</h3>
                                            <span className="rounded border border-foreground bg-primary px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-primary-foreground">
                                                No Record Found
                                            </span>
                                            <span className="font-mono text-[10.5px] font-semibold text-muted-foreground">
                                                {getBarcodePrefixLabel(item.barcode)}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {item.reason}
                                        </p>
                                    </div>
                                    <a
                                        href={getUpuTrackingUrl(item.barcode)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="tap inline-flex items-center gap-1.5 rounded-md border-[1.5px] border-foreground bg-background px-3 py-1.5 text-xs font-bold text-foreground shadow-[0_1px_0_0_hsl(var(--foreground))] hover:bg-secondary/35"
                                    >
                                        <span>Try UPU Global</span>
                                        <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ===== Recent Tracked Items (Tapping opens cached result in 0ms without re-asking CAPTCHA!) ===== */}
                {history.length > 0 && (
                    <section className="rounded-2xl border-2 border-foreground bg-card overflow-hidden shadow-[0_2px_0_0_hsl(var(--foreground))]">
                        <div className="flex items-center justify-between gap-2 border-b-[1.5px] border-foreground bg-muted/60 px-3.5 py-2.5">
                            <h2 className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-foreground">
                                <History className="h-3.5 w-3.5 text-primary" />
                                <span>Recent Tracked Items ({history.length})</span>
                            </h2>
                            <button
                                type="button"
                                onClick={clearHistory}
                                className="tap inline-flex items-center gap-1 rounded border border-foreground/35 bg-card px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-muted-foreground hover:border-foreground hover:text-foreground"
                            >
                                <Trash2 className="h-3 w-3" />
                                <span>Clear</span>
                            </button>
                        </div>

                        <div className="divide-y divide-border">
                            {history.map((item) => {
                                const isCod = item.service === "cod";
                                const isSettled = item.statusCategory === "settled";
                                const isDelivered = item.statusCategory === "delivered";
                                const isReturned = item.statusCategory === "returned";
                                const fmt = formatTrackingTimestamp(item.checkedAt);
                                const routeFrom = item.result.acceptingOfficeQuery || item.result.acceptingOffice;
                                const routeTo = item.result.deliveryOfficeQuery || item.result.deliveryOffice;
                                const activeBarcode = results.length === 1 && results[0].barcode === item.barcode;

                                return (
                                    <div
                                        key={item.barcode}
                                        onClick={() => openSavedHistoryItem(item)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault();
                                                openSavedHistoryItem(item);
                                            }
                                        }}
                                        className={cn(
                                            "tap group flex items-center justify-between gap-2.5 px-3.5 py-3 text-left transition-colors cursor-pointer",
                                            activeBarcode ? "bg-secondary/20" : "hover:bg-muted/50"
                                        )}
                                    >
                                        <div className="min-w-0 flex-1">
                                            {/* Row 1: Dashed Barcode + Service Badge + Route Summary */}
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="rounded border-[1.5px] border-dashed border-foreground/75 bg-background px-2 py-0.5 font-mono text-xs sm:text-sm font-extrabold text-foreground group-hover:border-foreground">
                                                    {item.barcode}
                                                </span>
                                                <span
                                                    className={cn(
                                                        "rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase",
                                                        isCod
                                                            ? "bg-[#15803D] text-white"
                                                            : "bg-primary text-primary-foreground"
                                                    )}
                                                >
                                                    {isCod ? "COD" : "SLP"}
                                                </span>
                                                {(routeFrom || routeTo) && (
                                                    <span className="font-mono text-[10.5px] font-semibold text-muted-foreground truncate">
                                                        · {[routeFrom, routeTo].filter(Boolean).join(" → ")}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Row 2: Crisp Status Badge + Timestamp */}
                                            <div className="mt-1.5 flex items-center gap-2 text-xs">
                                                <span
                                                    className={cn(
                                                        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-heading text-[11px] font-extrabold uppercase",
                                                        isSettled || isDelivered
                                                            ? "bg-[#15803D] text-white"
                                                            : isReturned
                                                                ? "bg-primary text-primary-foreground"
                                                                : "bg-secondary text-secondary-foreground"
                                                    )}
                                                >
                                                    {isSettled ? (
                                                        <Banknote className="h-3 w-3 shrink-0" />
                                                    ) : isDelivered ? (
                                                        <CheckCircle2 className="h-3 w-3 shrink-0" />
                                                    ) : isReturned ? (
                                                        <AlertCircle className="h-3 w-3 shrink-0" />
                                                    ) : (
                                                        <Truck className="h-3 w-3 shrink-0" />
                                                    )}
                                                    <span>{item.statusLabel}</span>
                                                </span>
                                                {fmt && (
                                                    <span className="font-mono text-[10.5px] text-muted-foreground">
                                                        {fmt.dateShort}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={(e) => removeHistoryItem(item.barcode, e)}
                                                aria-label={`Remove ${item.barcode} from history`}
                                                className="tap rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-foreground transition-transform" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* ===== Compact Collapsible Barcode Reference Guide + Quick App Links ===== */}
                <section className="rounded-2xl border-2 border-foreground bg-card overflow-hidden shadow-[0_2px_0_0_hsl(var(--foreground))]">
                    <button
                        type="button"
                        onClick={() => {
                            triggerHaptic("light");
                            setGuideOpen((prev) => !prev);
                        }}
                        aria-expanded={guideOpen}
                        className="tap flex w-full items-center justify-between gap-2 bg-muted/60 px-3.5 py-2.5 text-left"
                    >
                        <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-foreground">
                            <HelpCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span>Supported Barcode Formats (BD, NA, BF, RA, EMS)</span>
                        </span>
                        <ChevronDown
                            className={cn(
                                "h-4 w-4 text-muted-foreground transition-transform duration-150",
                                guideOpen && "rotate-180"
                            )}
                        />
                    </button>

                    {guideOpen && (
                        <div className="border-t-[1.5px] border-foreground p-3 sm:p-4">
                            {/* Compact 2x2 Grid even on mobile */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                                <div className="rounded-xl border-[1.5px] border-foreground bg-background/70 p-2.5">
                                    <div className="flex flex-wrap items-center justify-between gap-1">
                                        <span className="rounded border border-dashed border-foreground bg-card px-1.5 py-0.5 font-mono text-[11px] font-extrabold text-[#15803D] dark:text-emerald-300">
                                            BD...LK
                                        </span>
                                        <span className="rounded bg-[#15803D] px-1 py-px font-mono text-[8.5px] font-bold uppercase text-white">
                                            Instant
                                        </span>
                                    </div>
                                    <p className="mt-1.5 font-heading text-xs font-extrabold text-foreground">
                                        Domestic COD
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                                        Cash-on-Delivery with settlement dates.
                                    </p>
                                </div>

                                <div className="rounded-xl border-[1.5px] border-foreground bg-background/70 p-2.5">
                                    <div className="flex flex-wrap items-center justify-between gap-1">
                                        <span className="rounded border border-dashed border-foreground bg-card px-1.5 py-0.5 font-mono text-[11px] font-extrabold text-primary">
                                            NA / BF...LK
                                        </span>
                                        <span className="rounded bg-secondary px-1 py-px font-mono text-[8.5px] font-bold uppercase text-secondary-foreground">
                                            CAPTCHA
                                        </span>
                                    </div>
                                    <p className="mt-1.5 font-heading text-xs font-extrabold text-foreground">
                                        SLP Courier
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                                        5-step domestic courier delivery log.
                                    </p>
                                </div>

                                <div className="rounded-xl border-[1.5px] border-foreground bg-background/70 p-2.5">
                                    <div className="flex flex-wrap items-center justify-between gap-1">
                                        <span className="rounded border border-dashed border-foreground bg-card px-1.5 py-0.5 font-mono text-[11px] font-extrabold text-foreground">
                                            RA / BG...LK
                                        </span>
                                        <span className="rounded border border-foreground/40 bg-muted px-1 py-px font-mono text-[8.5px] font-bold uppercase text-foreground">
                                            Auto
                                        </span>
                                    </div>
                                    <p className="mt-1.5 font-heading text-xs font-extrabold text-foreground">
                                        Registered / COD
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                                        Checks COD first, then SLP Courier.
                                    </p>
                                </div>

                                <div className="rounded-xl border-[1.5px] border-foreground bg-background/70 p-2.5">
                                    <div className="flex flex-wrap items-center justify-between gap-1">
                                        <span className="rounded border border-dashed border-foreground bg-card px-1.5 py-0.5 font-mono text-[11px] font-extrabold text-[#1D4E9E] dark:text-blue-300">
                                            EE / CP...
                                        </span>
                                        <span className="rounded bg-[#1D4E9E] px-1 py-px font-mono text-[8.5px] font-bold uppercase text-white">
                                            UPU
                                        </span>
                                    </div>
                                    <p className="mt-1.5 font-heading text-xs font-extrabold text-foreground">
                                        International
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                                        Handoff to UPU Global Track &amp; Trace.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Bottom Quick-Switch Row + Clean Disclaimer (no backticks) */}
                    <div className="border-t border-dashed border-foreground/25 p-3 sm:px-4 space-y-2.5">
                        <div className="grid grid-cols-2 gap-2">
                            <Link
                                href="/calculator"
                                className="tap inline-flex items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-foreground bg-background px-2.5 py-2 text-xs font-bold text-foreground shadow-[0_1px_0_0_hsl(var(--foreground))] hover:bg-secondary/35"
                            >
                                <Calculator className="h-3.5 w-3.5 text-primary shrink-0" />
                                <span className="truncate">Postage Rates</span>
                                <ArrowRight className="h-3 w-3 shrink-0" />
                            </Link>
                            <Link
                                href="/browse"
                                className="tap inline-flex items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-foreground bg-background px-2.5 py-2 text-xs font-bold text-foreground shadow-[0_1px_0_0_hsl(var(--foreground))] hover:bg-secondary/35"
                            >
                                <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                                <span className="truncate">Post Offices</span>
                                <ArrowRight className="h-3 w-3 shrink-0" />
                            </Link>
                        </div>
                        <p className="text-[10.5px] text-center text-muted-foreground">
                            Independent utility · Data relayed live from official Sri Lanka Post servers (bepost.lk &amp; slpmail.slpost.gov.lk).
                        </p>
                    </div>
                </section>
            </div>
            <BarcodeScannerSheet
                open={scannerOpen}
                onClose={() => setScannerOpen(false)}
                onApplyBarcodes={(codes) => {
                    const joined = codes.join(", ");
                    setInput(joined);
                    void runTracking(joined);
                }}
            />
        </div>
    );
}
