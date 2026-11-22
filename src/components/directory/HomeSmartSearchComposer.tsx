"use client";

import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import {
    Camera,
    ClipboardPaste,
    History,
    Loader2,
    PackageSearch,
    Search,
    X,
} from "lucide-react";
import { m, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import NuwaraEliyaPostOffice from "@/components/brand/NuwaraEliyaPostOffice";
import type { RichAutocompleteSuggestion } from "@/lib/office-index";
import { triggerHaptic } from "@/lib/haptics";
import { MAX_BATCH_BARCODES } from "@/lib/tracking/classifier";
import {
    buildCombinedSearchQuery,
    extractTrackingTokensOnDelimiter,
    isCompleteTrackingCode,
    normalizeTrackingToken,
    predictSearchCompletion,
    splitPastedTrackingText,
    type PredictionChip,
} from "@/lib/search-predictor";

const BarcodeScannerSheet = dynamic(
    () => import("@/components/tracking/BarcodeScannerSheet"),
    { ssr: false }
);

interface HomeSmartSearchComposerProps {
    id: string;
    query: string;
    onQueryChange: (val: string, id: string) => void;
    loading: boolean;
    suggestionsLoading: boolean;
    officeSuggestions: RichAutocompleteSuggestion[];
    cyclingExamples: string[];
    exampleIndex: number;
    locale: string;
    isActive: boolean;
    open: boolean;
    listId: string;
    highlight: number;
    submitLabel: string;
    clearLabel: string;
    searchFormRef: React.RefObject<HTMLFormElement | null>;
    searchHistory: string[];
    onSelectHistoryItem: (term: string) => void;
    onRemoveHistoryItem: (term: string) => void;
    smartPreview?: React.ReactNode;
    onSelectOfficeChip?: (chip: { value: string; slug: string; postalCode?: string }) => void;
    onEnterTypeMode: () => void;
    onCollapseTypeMode: () => void;
    onClearAll: () => void;
    onSubmit: () => void;
    onArrowNavigate: (direction: "up" | "down") => void;
    onEscape: () => void;
}

export default function HomeSmartSearchComposer({
    id,
    query,
    onQueryChange,
    loading,
    suggestionsLoading,
    officeSuggestions,
    cyclingExamples,
    exampleIndex,
    locale,
    isActive,
    open,
    listId,
    highlight,
    submitLabel,
    clearLabel,
    searchFormRef,
    searchHistory,
    onSelectHistoryItem,
    onRemoveHistoryItem,
    smartPreview,
    onSelectOfficeChip,
    onEnterTypeMode,
    onCollapseTypeMode,
    onClearAll,
    onSubmit,
    onArrowNavigate,
    onEscape,
}: HomeSmartSearchComposerProps) {
    const [committedCodes, setCommittedCodes] = useState<string[]>([]);
    const [draftText, setDraftText] = useState<string>(query);
    const [scannerOpen, setScannerOpen] = useState(false);
    const [pasteFeedback, setPasteFeedback] = useState<string | null>(null);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const lastSyncedQueryRef = useRef<string>(query);
    const feedbackTimerRef = useRef<number | null>(null);

    // Keep local composer state aligned if parent clears or sets query externally
    useEffect(() => {
        if (query === lastSyncedQueryRef.current) return;
        lastSyncedQueryRef.current = query;
        if (!query) {
            setCommittedCodes([]);
            setDraftText("");
            return;
        }
        setCommittedCodes([]);
        setDraftText(query);
    }, [query]);

    useEffect(() => {
        return () => {
            if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
        };
    }, []);

    const showBriefFeedback = useCallback((msg: string) => {
        setPasteFeedback(msg);
        if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = window.setTimeout(() => {
            setPasteFeedback(null);
        }, 2600);
    }, []);

    const syncStateToParent = useCallback(
        (nextCodes: string[], nextDraft: string) => {
            setCommittedCodes(nextCodes);
            setDraftText(nextDraft);
            const combined = buildCombinedSearchQuery(nextCodes, nextDraft);
            lastSyncedQueryRef.current = combined;
            onQueryChange(combined, id);
        },
        [id, onQueryChange]
    );

    const prediction = useMemo(
        () =>
            predictSearchCompletion({
                draftText,
                committedCodes,
                officeSuggestions,
                locale,
            }),
        [draftText, committedCodes, officeSuggestions, locale]
    );

    const isExpanded = isActive || draftText.length > 0 || committedCodes.length > 0;
    const showCyclingOverlay = !isExpanded && draftText.length === 0 && committedCodes.length === 0;

    const focusInput = useCallback(() => {
        window.requestAnimationFrame(() => {
            const el = textareaRef.current;
            if (!el) return;
            el.focus();
            const len = el.value.length;
            el.setSelectionRange(len, len);
        });
    }, []);

    const commitCurrentDraftToChip = useCallback(() => {
        const trimmed = draftText.trim();
        if (!trimmed || !isCompleteTrackingCode(trimmed)) return false;
        const clean = normalizeTrackingToken(trimmed);
        if (committedCodes.includes(clean)) {
            syncStateToParent(committedCodes, "");
            return true;
        }
        if (committedCodes.length >= MAX_BATCH_BARCODES) {
            showBriefFeedback(`Max ${MAX_BATCH_BARCODES} parcels`);
            return false;
        }
        triggerHaptic("light");
        syncStateToParent([...committedCodes, clean], "");
        focusInput();
        return true;
    }, [committedCodes, draftText, focusInput, showBriefFeedback, syncStateToParent]);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        // Never allow raw linebreaks inside single-enter composer; convert pasted newlines into spaces
        const raw = e.target.value.replace(/\r?\n/g, " ");
        onEnterTypeMode();

        // Attempt delimiter-based tokenization when typing comma, space, or semicolon after a complete tracking code
        const tokenized = extractTrackingTokensOnDelimiter(raw, committedCodes);
        if (tokenized.didCommit) {
            triggerHaptic("light");
            syncStateToParent(tokenized.committed, tokenized.remainingDraft);
            return;
        }

        syncStateToParent(committedCodes, raw);
    };

    const handlePasteEvent = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const pasted = e.clipboardData?.getData("text");
        if (!pasted) return;
        const batch = splitPastedTrackingText(pasted, committedCodes);
        if (batch) {
            e.preventDefault();
            onEnterTypeMode();
            triggerHaptic("light");
            syncStateToParent(batch.committed, batch.remainingDraft);
            if (batch.addedCount > 0) {
                showBriefFeedback(
                    batch.addedCount === 1
                        ? "Pasted 1 code"
                        : `Pasted ${batch.addedCount} codes`
                );
            }
        }
    };

    const handlePasteButtonClick = async () => {
        onEnterTypeMode();
        if (typeof navigator === "undefined" || !navigator.clipboard?.readText) {
            showBriefFeedback("Long-press input to paste");
            focusInput();
            return;
        }
        try {
            const text = await navigator.clipboard.readText();
            const trimmed = text.trim();
            if (!trimmed) {
                showBriefFeedback("Clipboard is empty");
                focusInput();
                return;
            }
            const batch = splitPastedTrackingText(trimmed, committedCodes);
            if (batch) {
                triggerHaptic("light");
                syncStateToParent(batch.committed, batch.remainingDraft);
                showBriefFeedback(
                    batch.addedCount === 1
                        ? "Pasted 1 code"
                        : batch.addedCount > 1
                            ? `Pasted ${batch.addedCount} codes`
                            : "Already added"
                );
            } else {
                const nextDraft = draftText ? `${draftText.trimEnd()} ${trimmed}` : trimmed;
                syncStateToParent(committedCodes, nextDraft);
                showBriefFeedback("Pasted");
            }
            focusInput();
        } catch {
            showBriefFeedback("Long-press input to paste");
            focusInput();
        }
    };

    const handleApplyScannedBarcodes = (barcodes: string[]) => {
        setScannerOpen(false);
        if (barcodes.length === 0) return;

        onEnterTypeMode();
        const nextCodes = [...committedCodes];
        // Also keep any valid code currently in draftText
        if (draftText.trim() && isCompleteTrackingCode(draftText)) {
            const draftClean = normalizeTrackingToken(draftText);
            if (!nextCodes.includes(draftClean) && nextCodes.length < MAX_BATCH_BARCODES) {
                nextCodes.push(draftClean);
            }
        }

        let added = 0;
        for (const raw of barcodes) {
            const clean = normalizeTrackingToken(raw);
            if (clean && !nextCodes.includes(clean) && nextCodes.length < MAX_BATCH_BARCODES) {
                nextCodes.push(clean);
                added++;
            }
        }

        triggerHaptic("success");
        syncStateToParent(nextCodes, "");
        if (added > 0) {
            showBriefFeedback(added === 1 ? "Scanned 1 parcel" : `Scanned ${added} parcels`);
        }
        focusInput();
    };

    const handleRemoveChip = (codeToRemove: string) => {
        triggerHaptic("light");
        const nextCodes = committedCodes.filter((c) => c !== codeToRemove);
        syncStateToParent(nextCodes, draftText);
        focusInput();
    };

    const handleChipClick = (chip: PredictionChip) => {
        triggerHaptic("light");
        onEnterTypeMode();

        if (chip.officeSlug && onSelectOfficeChip) {
            onSelectOfficeChip({
                value: chip.value,
                slug: chip.officeSlug,
                postalCode: chip.meta,
            });
            return;
        }

        if (chip.applyKind === "commit_bulk_slot") {
            commitCurrentDraftToChip();
            return;
        }

        if (chip.applyKind === "add_code") {
            const nextCodes = [...committedCodes];
            if (draftText.trim() && isCompleteTrackingCode(draftText)) {
                const draftClean = normalizeTrackingToken(draftText);
                if (!nextCodes.includes(draftClean) && nextCodes.length < MAX_BATCH_BARCODES) {
                    nextCodes.push(draftClean);
                }
            }
            const cleanValue = normalizeTrackingToken(chip.value);
            if (cleanValue && !nextCodes.includes(cleanValue) && nextCodes.length < MAX_BATCH_BARCODES) {
                nextCodes.push(cleanValue);
            }
            syncStateToParent(nextCodes, "");
            focusInput();
            return;
        }

        if (chip.applyKind === "append_word") {
            const base = draftText.trimEnd();
            const nextDraft = base ? `${base} ${chip.value}` : chip.value;
            syncStateToParent(committedCodes, nextDraft);
            focusInput();
            return;
        }

        // replace_draft
        syncStateToParent(committedCodes, chip.value);
        focusInput();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const el = e.currentTarget;
        const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;

        // Tab or ArrowRight at end accepts inline ghost prediction (or commits bulk chip)
        if (e.key === "Tab" && (prediction.ghostAcceptDraft || (prediction.isBulkHint && isCompleteTrackingCode(draftText)))) {
            e.preventDefault();
            if (prediction.ghostAcceptDraft) {
                triggerHaptic("light");
                syncStateToParent(committedCodes, prediction.ghostAcceptDraft);
                focusInput();
            } else {
                commitCurrentDraftToChip();
            }
            return;
        }

        if (e.key === "ArrowRight" && atEnd && prediction.ghostAcceptDraft) {
            e.preventDefault();
            triggerHaptic("light");
            syncStateToParent(committedCodes, prediction.ghostAcceptDraft);
            focusInput();
            return;
        }

        // Backspace in empty draft removes the last tracking chip
        if (e.key === "Backspace" && draftText.length === 0 && committedCodes.length > 0) {
            e.preventDefault();
            triggerHaptic("light");
            const nextCodes = committedCodes.slice(0, -1);
            syncStateToParent(nextCodes, "");
            return;
        }

        if (open && e.key === "ArrowDown") {
            e.preventDefault();
            onArrowNavigate("down");
            return;
        }

        if (open && e.key === "ArrowUp") {
            e.preventDefault();
            onArrowNavigate("up");
            return;
        }

        if (e.key === "Escape") {
            e.preventDefault();
            onEscape();
            textareaRef.current?.blur();
            return;
        }

        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
        }
    };

    const handleClearOrCollapse = () => {
        triggerHaptic("light");
        if (draftText.length > 0 || committedCodes.length > 0) {
            lastSyncedQueryRef.current = "";
            setCommittedCodes([]);
            setDraftText("");
            onClearAll();
            focusInput();
        } else {
            onCollapseTypeMode();
            textareaRef.current?.blur();
        }
    };

    // Shared exact typography between invisible mirror sizer and real textarea so ghost text aligns to the pixel
    const inputTypographyClass = prediction.isTrackingMode
        ? "font-mono text-[15px] sm:text-[16px] leading-[1.45] font-extrabold uppercase tracking-wider"
        : "font-sans text-[16px] leading-[1.45] font-bold tracking-normal";

    const hasValue = draftText.length > 0 || committedCodes.length > 0;

    return (
        <>
            <form
                ref={searchFormRef}
                role="search"
                data-testid="home-smart-search-form"
                data-expanded={isExpanded ? "true" : "false"}
                onSubmit={(e) => {
                    e.preventDefault();
                    onSubmit();
                }}
                className={cn(
                    "relative overflow-hidden rounded-2xl border md:border-2 bg-card motion-safe:transition-colors motion-safe:duration-200",
                    isExpanded
                        ? "border-foreground/45 md:border-foreground shadow-[var(--shadow-elev-2)] md:shadow-[3px_3px_0_0_hsl(var(--foreground))]"
                        : "border-border md:border-foreground shadow-[var(--shadow-elev-1)] focus-within:border-foreground/45 focus-within:shadow-[var(--shadow-elev-2)] md:focus-within:shadow-[3px_3px_0_0_hsl(var(--foreground))]"
                )}
            >
                {/* Centered Nuwara Eliya Post Office backdrop — static memoized GPU layer */}
                <div
                    className="pointer-events-none absolute inset-0 opacity-95 dark:opacity-85"
                    aria-hidden="true"
                >
                    <NuwaraEliyaPostOffice />
                </div>

                {/* Inner Shell: fixed top input row + CSS grid-rows collapsible bottom tray */}
                <div className="relative z-10 flex flex-col">
                    {/* Top / Main Input Surface (constant min-height to eliminate frame-0 jump) */}
                    <div className="flex items-stretch min-h-[52px] sm:min-h-[58px]">
                        <div
                            onClick={() => {
                                if (document.activeElement !== textareaRef.current) {
                                    textareaRef.current?.focus();
                                } else {
                                    onEnterTypeMode();
                                }
                            }}
                            className={cn(
                                "relative flex flex-1 min-w-0 cursor-text gap-2 pl-2.5 sm:pl-3.5 pr-2",
                                isExpanded ? "items-start py-2.5" : "items-center py-2"
                            )}
                        >
                        {/* Leading Context Icon */}
                        <span
                            className={cn(
                                "flex items-center justify-center shrink-0 rounded-full border border-foreground/40 bg-card/95 text-foreground shadow-2xs transition-colors",
                                isExpanded
                                    ? "mt-0.5 h-7 w-7"
                                    : "h-6 w-6 sm:h-7 sm:w-7",
                                prediction.isTrackingMode && "border-primary bg-primary/10 text-primary"
                            )}
                            aria-hidden="true"
                        >
                            {prediction.isTrackingMode ? (
                                <PackageSearch className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.4} />
                            ) : (
                                <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.5} />
                            )}
                        </span>

                        {/* Flex-Wrap Flow Area: Committed Tracking Chips + Auto-Grow Input + Inline Ghost Overlay */}
                        <div className="relative flex flex-1 flex-wrap items-center gap-1.5 min-w-0">
                            {/* Committed Bulk Tracking Chips */}
                            {committedCodes.map((code) => (
                                <span
                                    key={code}
                                    data-testid={`tracking-chip-${code}`}
                                    className="inline-flex max-w-full items-center gap-1 rounded-md border-[1.5px] border-foreground bg-muted/75 pl-2 pr-1 py-0.5 font-mono text-[13px] sm:text-sm font-extrabold tracking-wider text-foreground shadow-[0_1px_0_0_hsl(var(--foreground))]"
                                >
                                    <span className="truncate">{code}</span>
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveChip(code);
                                        }}
                                        aria-label={`Remove tracking number ${code}`}
                                        className="tap inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-foreground hover:text-background transition-colors"
                                    >
                                        <X className="h-3 w-3" strokeWidth={2.6} />
                                    </button>
                                </span>
                            ))}

                            {/* Synchronized Grid Cell: Invisible Mirror + Inline Ghost Text + Auto-Growing Textarea */}
                            <div
                                className={cn(
                                    "relative inline-grid flex-1 items-center align-middle min-w-0",
                                    committedCodes.length > 0 ? "min-w-[140px]" : "w-full"
                                )}
                            >
                                {/* Smoothly Cycling Placeholder in Resting State */}
                                {showCyclingOverlay && (
                                    <div
                                        aria-hidden="true"
                                        data-testid="cycling-search-placeholder"
                                        className="pointer-events-none col-start-1 row-start-1 flex items-center overflow-hidden pr-1"
                                    >
                                        <AnimatePresence mode="wait" initial={false}>
                                            <m.span
                                                key={exampleIndex}
                                                initial={{ y: 8, opacity: 0 }}
                                                animate={{ y: 0, opacity: 1 }}
                                                exit={{ y: -8, opacity: 0 }}
                                                transition={{
                                                    duration: 0.26,
                                                    ease: [0.16, 1, 0.3, 1],
                                                }}
                                                className={cn(
                                                    "block w-full truncate font-semibold tracking-normal text-foreground drop-shadow-[0_1px_0_hsl(var(--card))]",
                                                    locale === "si" || locale === "ta"
                                                        ? "text-[11px] sm:text-[13px] md:text-[14px]"
                                                        : "text-[12px] sm:text-[13.5px] md:text-[14.5px]"
                                                )}
                                            >
                                                {cyclingExamples[exampleIndex]}
                                            </m.span>
                                        </AnimatePresence>
                                    </div>
                                )}

                                {/* Synchronized Mirror Layer (drives auto-grow height & pixel-accurate inline ghost text) */}
                                <div
                                    aria-hidden="true"
                                    className={cn(
                                        "pointer-events-none select-none col-start-1 row-start-1 whitespace-pre-wrap break-words min-h-[24px]",
                                        inputTypographyClass,
                                        !isExpanded && "max-h-[24px] overflow-hidden"
                                    )}
                                >
                                    {isExpanded && !draftText && committedCodes.length === 0 ? (
                                        <span className="font-sans text-[14px] sm:text-[15px] font-medium normal-case tracking-normal text-muted-foreground/75">
                                            Type office, country + weight, or tracking code...
                                        </span>
                                    ) : (
                                        <>
                                            <span className="invisible">{draftText}</span>
                                            {isExpanded && prediction.ghostSuffix && (
                                                <span
                                                    data-testid={
                                                        prediction.isBulkHint
                                                            ? "search-ghost-bulk-example"
                                                            : "search-ghost-prediction"
                                                    }
                                                    className={cn(
                                                        "text-muted-foreground/65",
                                                        prediction.isBulkHint
                                                            ? "font-mono text-[13.5px] sm:text-[15px] font-bold tracking-wider"
                                                            : "font-semibold"
                                                    )}
                                                >
                                                    {prediction.ghostSuffix}
                                                </span>
                                            )}
                                            {isExpanded &&
                                                prediction.isBulkHint &&
                                                prediction.bulkHintLabel && (
                                                    <span
                                                        data-testid="search-bulk-hint-label"
                                                        className="ml-1.5 inline-block whitespace-nowrap font-sans text-[11px] sm:text-xs font-medium normal-case tracking-normal text-muted-foreground/70"
                                                    >
                                                        {prediction.bulkHintLabel}
                                                    </span>
                                                )}
                                            {isExpanded &&
                                                !prediction.isBulkHint &&
                                                prediction.ghostSuffix &&
                                                prediction.ghostAcceptDraft && (
                                                    <span className="ml-1.5 hidden sm:inline-block rounded border border-border bg-muted/80 px-1 py-px font-mono text-[10px] font-bold uppercase normal-case tracking-normal text-muted-foreground align-middle">
                                                        Tab
                                                    </span>
                                                )}
                                        </>
                                    )}
                                </div>

                                {/* Real Textarea in Exact Same Grid Cell */}
                                <label htmlFor={`search-${id}`} className="sr-only">
                                    {submitLabel}
                                </label>
                                <textarea
                                    id={`search-${id}`}
                                    ref={textareaRef}
                                    rows={1}
                                    value={draftText}
                                    onChange={handleTextChange}
                                    onKeyDown={handleKeyDown}
                                    onPaste={handlePasteEvent}
                                    onFocus={() => onEnterTypeMode()}
                                    inputMode="search"
                                    enterKeyHint={prediction.trackingCount > 0 ? "go" : "search"}
                                    autoComplete="off"
                                    autoCorrect="off"
                                    autoCapitalize={prediction.isTrackingMode ? "characters" : "off"}
                                    spellCheck={false}
                                    aria-label={cyclingExamples[exampleIndex]}
                                    role="combobox"
                                    aria-expanded={open}
                                    aria-controls={listId}
                                    aria-autocomplete="both"
                                    aria-activedescendant={
                                        open && highlight >= 0 ? `${listId}-${highlight}` : undefined
                                    }
                                    className={cn(
                                        "relative z-10 col-start-1 row-start-1 h-full w-full min-w-0 resize-none overflow-hidden bg-transparent p-0 text-foreground outline-none caret-primary",
                                        inputTypographyClass,
                                        !isExpanded && "max-h-[24px]"
                                    )}
                                />
                            </div>
                        </div>

                        {/* Top-Right Clear / Collapse Trigger when Expanded */}
                        {isExpanded && (
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleClearOrCollapse();
                                }}
                                data-testid="search-clear-button"
                                aria-label={hasValue ? clearLabel : "Collapse search bar"}
                                className="tap mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-foreground/40 bg-card text-foreground hover:border-foreground hover:bg-secondary/25 transition-colors"
                            >
                                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                            </button>
                        )}
                    </div>

                    {/* Resting State Right Actions: 1-Tap Camera Scan + Primary Search CTA */}
                    {!isExpanded && (
                        <div className="relative z-10 flex shrink-0 items-center gap-1.5 pr-1.5 md:items-stretch md:gap-0 md:pr-0">
                            <button
                                type="button"
                                onPointerDown={() =>
                                    void import("@/lib/tracking/ocr-worker").then((m) =>
                                        m.prewarmOcr(
                                            locale === "si"
                                                ? "eng+sin"
                                                : locale === "ta"
                                                  ? "eng+tam"
                                                  : "eng"
                                        )
                                    )
                                }
                                onClick={(e) => {
                                    e.stopPropagation();
                                    textareaRef.current?.blur();
                                    triggerHaptic("light");
                                    setScannerOpen(true);
                                }}
                                data-testid="home-search-resting-scan-btn"
                                aria-label="Scan barcode or address"
                                className="tap flex h-9 w-9 md:h-auto md:w-12 items-center justify-center rounded-xl md:rounded-none border border-border md:border-0 md:border-l md:border-border bg-card/95 text-foreground hover:bg-muted transition-colors"
                            >
                                <Camera className="h-4 w-4" strokeWidth={2.3} aria-hidden="true" />
                            </button>
                            <button
                                type="submit"
                                className="tap flex h-9 w-9 md:h-auto md:w-auto md:px-6 items-center justify-center gap-2 rounded-xl md:rounded-none md:border-l-2 md:border-foreground bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                                aria-label={submitLabel}
                            >
                                <Search className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.4} />
                                <span className="hidden md:inline">{submitLabel}</span>
                            </button>
                        </div>
                    )}
                    </div>

                    {/* Expanded Type Mode: Recent History (empty) or Predictive Next-Word Chips + Action Footer */}
                    <div
                        inert={!isExpanded || undefined}
                        aria-hidden={!isExpanded}
                        className={cn(
                            "grid will-change-[grid-template-rows,opacity] motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-[260ms] motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]",
                            isExpanded
                                ? "grid-rows-[1fr] opacity-100"
                                : "grid-rows-[0fr] opacity-0 pointer-events-none"
                        )}
                    >
                        <div className="min-h-0 overflow-hidden">
                            <div
                                className={cn(
                                    "transform-gpu motion-safe:transition-[transform,opacity] motion-safe:duration-[260ms] motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]",
                                    isExpanded ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
                                )}
                            >
                                {/* Recent Search History Chip Strip (only when input is empty and user has searched before) */}
                                {!hasValue && searchHistory.length > 0 && (
                                    <div
                                        data-testid="search-history-chips"
                                        className="flex flex-wrap items-center gap-1.5 border-t border-border/75 bg-muted/20 px-2.5 sm:px-3 py-2"
                                    >
                                        {searchHistory.map((item) => (
                                            <span
                                                key={item}
                                                className="inline-flex min-h-[32px] max-w-full items-center rounded-md border border-foreground/35 bg-card text-xs font-bold text-foreground transition-colors hover:border-foreground hover:bg-muted/70"
                                            >
                                                <button
                                                    type="button"
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => {
                                                        triggerHaptic("light");
                                                        onSelectHistoryItem(item);
                                                    }}
                                                    className="tap inline-flex min-h-[32px] items-center gap-1.5 pl-2.5 pr-1.5 py-1 text-left max-w-[200px] sm:max-w-[240px]"
                                                >
                                                    <History
                                                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                                                        strokeWidth={2.2}
                                                        aria-hidden="true"
                                                    />
                                                    <span className="truncate">{item}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        triggerHaptic("light");
                                                        onRemoveHistoryItem(item);
                                                    }}
                                                    aria-label={`Remove ${item} from search history`}
                                                    className="tap mr-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-foreground hover:text-background transition-colors"
                                                >
                                                    <X className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Predictive Next-Word & Bulk Completion Chip Strip (while typing) */}
                                {hasValue && prediction.chips.length > 0 && (
                                    <div
                                        data-testid="search-prediction-chips"
                                        className="flex flex-wrap items-center gap-1.5 border-t border-border/75 bg-muted/20 px-2.5 sm:px-3 py-2"
                                    >
                                        {prediction.chips.map((chip) => (
                                            <button
                                                key={chip.id}
                                                type="button"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => handleChipClick(chip)}
                                                className={cn(
                                                    "tap inline-flex min-h-[32px] items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-bold transition-colors whitespace-nowrap",
                                                    chip.primary
                                                        ? "border-foreground bg-secondary/30 text-foreground hover:bg-secondary/50"
                                                        : "border-foreground/35 bg-card text-foreground hover:border-foreground hover:bg-muted/70"
                                                )}
                                            >
                                                <span className={cn(chip.applyKind === "add_code" && "font-mono tracking-wide")}>
                                                    {chip.label}
                                                </span>
                                                {chip.meta && (
                                                    <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                                                        {chip.meta}
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Inline Smart Preview (Tracking Card or Postage Rate Preview inside the search bar) */}
                                {hasValue && smartPreview && (
                                    <div
                                        data-testid="search-inline-smart-preview"
                                        className="border-t border-border/75 bg-card/92 px-2.5 sm:px-3 py-2"
                                    >
                                        {smartPreview}
                                    </div>
                                )}

                                {/* Mobile & Desktop Quick Action Footer: Paste, Scan, Live Parcel Counter, Primary CTA */}
                                <div
                                    data-testid="search-expanded-footer"
                                    className="flex items-center justify-between gap-1.5 sm:gap-2 border-t-[1.5px] border-foreground/20 bg-muted/25 px-2 sm:px-3 py-2"
                                >
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            type="button"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => void handlePasteButtonClick()}
                                            data-testid="home-search-paste-btn"
                                            className="tap inline-flex min-h-[38px] items-center gap-1 sm:gap-1.5 rounded-md border-[1.5px] border-foreground bg-card px-2 sm:px-2.5 text-xs font-bold text-foreground hover:bg-secondary/25 transition-colors whitespace-nowrap shrink-0"
                                        >
                                            <ClipboardPaste className="h-3.5 w-3.5 shrink-0" strokeWidth={2.3} />
                                            <span>Paste</span>
                                        </button>

                                        <button
                                            type="button"
                                            onPointerDown={() =>
                                                void import("@/lib/tracking/ocr-worker").then((m) =>
                                                    m.prewarmOcr(
                                                        locale === "si"
                                                            ? "eng+sin"
                                                            : locale === "ta"
                                                              ? "eng+tam"
                                                              : "eng"
                                                    )
                                                )
                                            }
                                            onClick={() => {
                                                textareaRef.current?.blur();
                                                triggerHaptic("light");
                                                setScannerOpen(true);
                                            }}
                                            data-testid="home-search-scan-btn"
                                            className="tap inline-flex min-h-[38px] items-center gap-1 sm:gap-1.5 rounded-md border-[1.5px] border-foreground bg-secondary px-2 sm:px-2.5 text-xs font-extrabold text-secondary-foreground hover:opacity-95 transition-opacity whitespace-nowrap shrink-0"
                                        >
                                            <Camera className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
                                            <span>Scan</span>
                                        </button>
                                    </div>

                                    {/* Live Parcel Counter / Inline Status (clean typography, zero static pill clutter) */}
                                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 ml-auto">
                                        {(loading || suggestionsLoading) && (
                                            <Loader2
                                                className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0"
                                                aria-hidden="true"
                                            />
                                        )}

                                        {pasteFeedback ? (
                                            <span className="font-mono text-[11px] font-bold text-foreground truncate">
                                                {pasteFeedback}
                                            </span>
                                        ) : prediction.trackingCount > 0 ? (
                                            <span
                                                data-testid="live-parcel-count"
                                                className="font-mono text-[11px] sm:text-xs font-extrabold tabular-nums text-foreground whitespace-nowrap"
                                            >
                                                <span>{prediction.trackingCount}</span>
                                                <span className="hidden min-[410px]:inline">
                                                    {prediction.trackingCount === 1 ? " Parcel" : " Parcels"}
                                                </span>
                                                <span> Ready</span>
                                                {prediction.trackingCount >= 10 && (
                                                    <span className="hidden sm:inline text-muted-foreground font-semibold">
                                                        {" "}· max {MAX_BATCH_BARCODES}
                                                    </span>
                                                )}
                                            </span>
                                        ) : null}

                                        <button
                                            type="submit"
                                            data-testid="home-search-submit-btn"
                                            className="tap inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-md border-[1.5px] border-foreground bg-primary px-3 sm:px-4 text-xs sm:text-sm font-bold text-primary-foreground shadow-[0_2px_0_0_hsl(var(--foreground))] hover:bg-primary/90 whitespace-nowrap shrink-0"
                                        >
                                            {prediction.trackingCount > 0 ? (
                                                <>
                                                    <PackageSearch className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" strokeWidth={2.4} />
                                                    <span>
                                                        {prediction.trackingCount === 1
                                                            ? "Track"
                                                            : `Track ${prediction.trackingCount}`}
                                                    </span>
                                                    {prediction.trackingCount > 1 && (
                                                        <span className="hidden sm:inline">Parcels</span>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" strokeWidth={2.4} />
                                                    <span>{submitLabel}</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </form>

            {/* Lazy-Loaded Unified Camera Barcode, Tracking & Address Scanner */}
            {scannerOpen && (
                <BarcodeScannerSheet
                    open={scannerOpen}
                    mode="auto"
                    onClose={() => setScannerOpen(false)}
                    onApplyBarcodes={handleApplyScannedBarcodes}
                    onApplyPlace={(p) => {
                        onEnterTypeMode();
                        syncStateToParent([], p.name);
                        showBriefFeedback(`Found ${p.name}`);
                        focusInput();
                    }}
                />
            )}
        </>
    );
}
