"use client";

import React, { useRef, useState, useEffect, useLayoutEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import {
    Camera,
    ClipboardPaste,
    Loader2,
    PackageSearch,
    Search,
    X,
} from "lucide-react";
import { m, AnimatePresence, useReducedMotion } from "motion/react";

const EXPAND_EASE = [0.22, 1, 0.36, 1] as const;
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
    const contentRef = useRef<HTMLDivElement>(null);
    const [contentHeight, setContentHeight] = useState<number | "auto">("auto");
    const prefersReducedMotion = useReducedMotion();
    const lastSyncedQueryRef = useRef<string>(query);

    // Measure the natural content height so the outer shell can animate between sizes
    useLayoutEffect(() => {
        const el = contentRef.current;
        if (!el || typeof ResizeObserver === "undefined") return;
        setContentHeight(el.offsetHeight);
        const ro = new ResizeObserver((entries) => {
            const entry = entries[0];
            const h = entry?.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight;
            setContentHeight(Math.round(h));
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
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
                    "relative overflow-hidden rounded-lg border-2 border-foreground bg-card transition-[box-shadow,border-color] duration-300",
                    isExpanded
                        ? "shadow-[3px_3px_0_0_hsl(var(--foreground))]"
                        : "focus-within:shadow-[3px_3px_0_0_hsl(var(--foreground))]"
                )}
            >
                {/* Centered Nuwara Eliya Post Office backdrop — veiled so text always stays legible */}
                <div
                    className={cn(
                        "pointer-events-none absolute inset-0 transition-opacity duration-500 ease-out",
                        isExpanded ? "opacity-75 dark:opacity-70" : "opacity-95 dark:opacity-85"
                    )}
                    aria-hidden="true"
                >
                    <NuwaraEliyaPostOffice expanded={isExpanded} />
                </div>

                {/* Animated height shell: smoothly grows/shrinks between resting and Type Mode */}
                <m.div
                    initial={false}
                    animate={{ height: contentHeight }}
                    transition={
                        prefersReducedMotion
                            ? { duration: 0 }
                            : { duration: 0.34, ease: EXPAND_EASE }
                    }
                    className="relative z-10 overflow-hidden"
                >
                {/* Top / Main Input Surface */}
                <div
                    ref={contentRef}
                    className={cn(
                        "relative z-10 flex items-stretch",
                        isExpanded ? "flex-col" : "flex-row min-h-[50px] sm:min-h-[58px]"
                    )}
                >
                    <div
                        onClick={() => {
                            onEnterTypeMode();
                            textareaRef.current?.focus();
                        }}
                        className={cn(
                            "relative flex flex-1 min-w-0 cursor-text",
                            isExpanded
                                ? "items-start gap-2 px-3 pt-3 pb-2.5 min-h-[60px] sm:min-h-[68px]"
                                : "items-center gap-2 pl-2.5 sm:pl-3.5 pr-2 py-2"
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
                            <m.button
                                initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.24, delay: 0.08, ease: EXPAND_EASE }}
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
                            </m.button>
                        )}
                    </div>

                    {/* Resting State Right Submit Button (hides when Expanded because CTA moves to the action footer) */}
                    {!isExpanded && (
                        <m.button
                            initial={prefersReducedMotion ? false : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.25, ease: EXPAND_EASE }}
                            type="submit"
                            className="tap relative z-10 flex w-12 sm:w-14 md:w-auto md:px-6 shrink-0 items-center justify-center gap-2 border-l-2 border-foreground bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                            aria-label={submitLabel}
                        >
                            <Search className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.4} />
                            <span className="hidden md:inline">{submitLabel}</span>
                        </m.button>
                    )}

                    {/* Expanded Type Mode: Predictive Next-Word Chips + Mobile Quick Action Footer */}
                    {isExpanded && (
                        <m.div
                            initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.06, ease: EXPAND_EASE }}
                            className="relative z-10"
                        >
                            {/* Predictive Next-Word & Bulk Completion Chip Strip */}
                            {prediction.chips.length > 0 && (
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

                            {/* Mobile & Desktop Quick Action Footer: Paste, Scan, Live Parcel Counter, Primary CTA */}
                            <div
                                data-testid="search-expanded-footer"
                                className="flex items-center justify-between gap-1.5 sm:gap-2 border-t-[1.5px] border-foreground/20 bg-muted/45 px-2 sm:px-3 py-2"
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
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
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
                        </m.div>
                    )}
                </div>
                </m.div>
            </form>

            {/* Lazy-Loaded Unified Camera Barcode & Receipt OCR Scanner */}
            {scannerOpen && (
                <BarcodeScannerSheet
                    open={scannerOpen}
                    onClose={() => setScannerOpen(false)}
                    onApplyBarcodes={handleApplyScannedBarcodes}
                />
            )}
        </>
    );
}
