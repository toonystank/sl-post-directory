"use client";

import * as React from "react";
import { Loader2, RefreshCw, ShieldCheck, ArrowRight, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";

interface SlpCaptchaPromptProps {
    barcode: string;
    remainingCount?: number;
    captchaImage: string | null;
    loadingCaptcha: boolean;
    submitting: boolean;
    error: string | null;
    onRefresh: () => void;
    onSubmit: (captchaCode: string) => void;
    onSkip?: () => void;
}

export default function SlpCaptchaPrompt({
    barcode,
    remainingCount = 0,
    captchaImage,
    loadingCaptcha,
    submitting,
    error,
    onRefresh,
    onSubmit,
    onSkip,
}: SlpCaptchaPromptProps) {
    const [code, setCode] = React.useState("");
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        setCode("");
        inputRef.current?.focus();
    }, [barcode, captchaImage]);

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = code.trim();
        if (!trimmed || submitting || !captchaImage) return;
        triggerHaptic("medium");
        onSubmit(trimmed);
    };

    return (
        <div
            data-testid="slp-captcha-prompt"
            className="animate-fade-slide-up overflow-hidden rounded-2xl border-2 border-foreground bg-card shadow-[4px_4px_0_0_hsl(var(--foreground))]"
        >
            {/* Pillar-box yellow postal dispatch header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-foreground bg-secondary px-4 py-3 text-secondary-foreground">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                    <span className="font-heading text-sm sm:text-base font-extrabold uppercase tracking-tight">
                        SLP Mail Courier · Security Verification
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="rounded border-[1.5px] border-foreground bg-card px-2.5 py-0.5 font-mono text-xs font-extrabold text-foreground">
                        {barcode}
                    </span>
                    {remainingCount > 0 && (
                        <span className="rounded bg-foreground px-2 py-0.5 font-mono text-[10px] font-bold text-background">
                            +{remainingCount} more
                        </span>
                    )}
                </div>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    <strong className="font-mono text-foreground">{barcode}</strong> was not found in the COD database.
                    Enter the <strong>SLP Mail Courier</strong> validation stamp below to retrieve its domestic event timeline.
                </p>

                {error && (
                    <div
                        role="alert"
                        className="flex items-center gap-2 rounded-xl border-2 border-primary bg-primary/10 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-primary"
                    >
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleFormSubmit} className="space-y-3.5">
                    {/* Step 1: Framed CAPTCHA Stamp + Refresh */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span
                                aria-hidden="true"
                                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] bg-foreground font-mono text-[11px] font-bold text-background"
                            >
                                1
                            </span>
                            <div className="flex h-12 min-w-[155px] items-center justify-center rounded-lg border-2 border-dashed border-foreground bg-white px-4 shadow-2xs">
                                {loadingCaptcha ? (
                                    <Loader2 className="h-5 w-5 animate-spin text-neutral-600" />
                                ) : captchaImage ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                        src={captchaImage}
                                        alt="SLP Courier security code"
                                        className="h-8 w-auto object-contain select-none contrast-125"
                                    />
                                ) : (
                                    <span className="font-mono text-xs text-neutral-500">Unavailable</span>
                                )}
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic("light");
                                onRefresh();
                            }}
                            disabled={loadingCaptcha || submitting}
                            className="tap inline-flex h-12 items-center gap-1.5 rounded-lg border-[1.5px] border-foreground bg-background px-3.5 text-xs font-bold text-foreground shadow-[0_2px_0_0_hsl(var(--foreground))] hover:bg-secondary/35 transition-colors disabled:opacity-50"
                            title="Load a new security code image"
                        >
                            <RefreshCw className={cn("h-3.5 w-3.5", loadingCaptcha && "animate-spin")} />
                            <span>New Code</span>
                        </button>
                    </div>

                    {/* Step 2: Code Input + Submit */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                        <div className="flex flex-1 items-center gap-2">
                            <span
                                aria-hidden="true"
                                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] bg-foreground font-mono text-[11px] font-bold text-background"
                            >
                                2
                            </span>
                            <input
                                ref={inputRef}
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder="Type the validation code above..."
                                autoComplete="off"
                                spellCheck={false}
                                disabled={submitting || loadingCaptcha || !captchaImage}
                                className="h-12 flex-1 rounded-lg border-2 border-foreground bg-background px-3.5 font-mono text-base font-extrabold tracking-widest text-foreground placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground focus:outline-none focus:shadow-[3px_3px_0_0_hsl(var(--foreground))] transition-shadow"
                                required
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="submit"
                                disabled={submitting || loadingCaptcha || !captchaImage || !code.trim()}
                                className="tap inline-flex h-12 flex-1 sm:flex-initial items-center justify-center gap-2 rounded-lg border-2 border-foreground bg-primary px-5 font-heading text-sm font-extrabold text-primary-foreground shadow-[0_2px_0_0_hsl(var(--foreground))] hover:opacity-95 disabled:opacity-50"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Checking SLP...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Verify &amp; Track</span>
                                        <ArrowRight className="h-4 w-4" />
                                    </>
                                )}
                            </button>
                            {onSkip && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        triggerHaptic("light");
                                        onSkip();
                                    }}
                                    disabled={submitting}
                                    className="tap inline-flex h-12 items-center justify-center rounded-lg border-[1.5px] border-foreground/50 bg-background px-3.5 text-xs font-bold text-muted-foreground hover:border-foreground hover:text-foreground"
                                >
                                    Skip
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
