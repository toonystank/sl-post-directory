"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { AlertTriangle, ArrowRight, Lock, Loader2, Route } from "lucide-react";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import { showNativeToast } from "@/components/shell/NativeToast";
import { cn } from "@/lib/utils";

interface BetaFeaturesManagerProps {
    initialEnabled: boolean;
    betaAvailable: boolean;
    selfOptInAllowed: boolean;
    role: string;
}

export default function BetaFeaturesManager({
    initialEnabled,
    betaAvailable,
    selfOptInAllowed,
    role,
}: BetaFeaturesManagerProps) {
    const { update } = useSession();
    const [enabled, setEnabled] = React.useState(initialEnabled);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState("");

    const isAdminPlus = role === "ADMIN" || role === "SUPER_ADMIN";
    const blockedFromEnabling = !enabled && (!betaAvailable || (!selfOptInAllowed && !isAdminPlus));

    const handleToggle = async () => {
        const nextValue = !enabled;
        if (nextValue && blockedFromEnabling) return;

        setSaving(true);
        setError("");
        setEnabled(nextValue);

        try {
            const res = await fetch("/api/user/beta-features", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mailRoutingBetaEnabled: nextValue }),
            });
            const data = (await res.json().catch(() => ({}))) as {
                mailRoutingBetaEnabled?: boolean;
                error?: string;
            };

            if (!res.ok) {
                setEnabled(!nextValue);
                const msg = data.error || "Failed to update Beta feature preference.";
                setError(msg);
                showNativeToast(msg);
                return;
            }

            const finalVal = Boolean(data.mailRoutingBetaEnabled);
            setEnabled(finalVal);
            await update();
            showNativeToast(
                finalVal
                    ? "Mail Routing Hub (Beta) enabled for your account"
                    : "Mail Routing Hub (Beta) disabled"
            );
        } catch {
            setEnabled(!nextValue);
            setError("Network error updating Beta feature setting.");
            showNativeToast("Network error updating Beta feature setting.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="rounded-md border-2 border-foreground bg-background p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                    <span
                        className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border",
                            enabled && betaAvailable
                                ? "border-emerald-700/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                                : "border-border bg-muted text-muted-foreground"
                        )}
                    >
                        <Route className="w-5 h-5" aria-hidden="true" />
                    </span>
                    <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-heading text-base font-extrabold">
                                Mail Routing &amp; Forwarding Hub
                            </h3>
                            <span className="inline-flex items-center rounded border border-amber-700/50 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-extrabold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                                BETA
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                            Experimental postal employee routing tool: RMSC/TPO sorting hubs, Controlling
                            Office chains, dispatch bag labels, My Duty Station origin selector, and sorting
                            quiz. Hidden from public visitors and disabled by default.
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label="Toggle Mail Routing Hub Beta feature"
                    disabled={saving || blockedFromEnabling}
                    onClick={() => void handleToggle()}
                    className={cn(
                        "tap relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 border-foreground transition-colors disabled:opacity-50",
                        enabled ? "bg-status-open" : "bg-muted"
                    )}
                >
                    {saving ? (
                        <span className="mx-auto">
                            <Loader2 className="w-4 h-4 animate-spin text-foreground" aria-hidden="true" />
                        </span>
                    ) : (
                        <span
                            className={cn(
                                "inline-block h-6 w-6 transform rounded-full bg-card border border-foreground transition-transform",
                                enabled ? "translate-x-6" : "translate-x-0.5"
                            )}
                        />
                    )}
                </button>
            </div>

            {!betaAvailable && (
                <div className="flex items-start gap-2.5 rounded-md border border-amber-700/40 bg-amber-500/10 p-3 text-xs font-medium text-amber-950 dark:text-amber-200">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>
                        Mail Routing Beta is currently paused globally by a Super Admin while known issues are
                        being resolved.
                    </span>
                </div>
            )}

            {betaAvailable && !selfOptInAllowed && !isAdminPlus && !enabled && (
                <div className="flex items-start gap-2.5 rounded-md border border-border bg-muted/50 p-3 text-xs font-medium text-muted-foreground">
                    <Lock className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>
                        Beta self-enrollment is currently invite-only. Ask a Super Admin to enable Mail
                        Routing Beta for your user account.
                    </span>
                </div>
            )}

            {error && (
                <div
                    role="alert"
                    className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs font-medium text-destructive"
                >
                    {error}
                </div>
            )}

            {enabled && betaAvailable && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-700/35 bg-emerald-500/10 px-4 py-3 text-xs sm:text-sm">
                    <span className="font-semibold text-emerald-950 dark:text-emerald-200">
                        Active for your account — the Mail Routing link &amp; Duty Station tools are now
                        unlocked across the app.
                    </span>
                    <Button asChild size="sm" className="h-9 font-bold shrink-0">
                        <Link href="/routing">
                            <span>Open Mail Routing Hub (Beta)</span>
                            <ArrowRight className="h-4 w-4 ml-1.5" aria-hidden="true" />
                        </Link>
                    </Button>
                </div>
            )}
        </div>
    );
}
