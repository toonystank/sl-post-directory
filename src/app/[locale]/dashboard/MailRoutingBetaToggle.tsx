"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Loader2, Route, Users } from "lucide-react";
import { Link } from "@/navigation";
import { showNativeToast } from "@/components/shell/NativeToast";
import { cn } from "@/lib/utils";

export default function MailRoutingBetaToggle() {
    const [betaAvailable, setBetaAvailable] = useState(true);
    const [selfOptInAllowed, setSelfOptInAllowed] = useState(true);
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/admin/settings", { cache: "no-store" })
            .then((res) => res.json())
            .then(
                (data: {
                    mailRoutingBetaAvailable?: boolean;
                    mailRoutingSelfOptIn?: boolean;
                }) => {
                    if (typeof data.mailRoutingBetaAvailable === "boolean") {
                        setBetaAvailable(data.mailRoutingBetaAvailable);
                    }
                    if (typeof data.mailRoutingSelfOptIn === "boolean") {
                        setSelfOptInAllowed(data.mailRoutingSelfOptIn);
                    }
                }
            )
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const updateSetting = async (
        key: "mailRoutingBetaAvailable" | "mailRoutingSelfOptIn",
        nextVal: boolean
    ) => {
        const prevAvailable = betaAvailable;
        const prevSelfOptIn = selfOptInAllowed;
        if (key === "mailRoutingBetaAvailable") setBetaAvailable(nextVal);
        if (key === "mailRoutingSelfOptIn") setSelfOptInAllowed(nextVal);
        setSavingKey(key);

        try {
            const res = await fetch("/api/admin/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [key]: nextVal }),
            });
            if (res.ok) {
                if (key === "mailRoutingBetaAvailable") {
                    showNativeToast(
                        nextVal
                            ? "Mail Routing Beta enabled for opted-in users"
                            : "Mail Routing Beta paused globally"
                    );
                } else {
                    showNativeToast(
                        nextVal
                            ? "Logged-in users can opt in via Profile"
                            : "Beta restricted to Admin-approved users only"
                    );
                }
            } else {
                setBetaAvailable(prevAvailable);
                setSelfOptInAllowed(prevSelfOptIn);
                showNativeToast("Failed to update Mail Routing Beta setting.");
            }
        } catch {
            setBetaAvailable(prevAvailable);
            setSelfOptInAllowed(prevSelfOptIn);
            showNativeToast("Network error updating Beta setting.");
        } finally {
            setSavingKey(null);
        }
    };

    if (loading) {
        return (
            <div className="h-[140px] rounded-md border-2 border-border bg-card p-4 animate-pulse" />
        );
    }

    return (
        <div className="rounded-md border-2 border-foreground bg-card p-4 sm:p-5 space-y-4 shadow-[3px_3px_0_0_hsl(var(--foreground))]">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    <span
                        className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border",
                            betaAvailable
                                ? "border-status-open/40 bg-status-open/10 text-status-open"
                                : "border-border bg-muted text-muted-foreground"
                        )}
                    >
                        <Route className="w-5 h-5" aria-hidden="true" />
                    </span>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-heading text-base font-extrabold">
                                Mail Routing Hub (Beta)
                            </h2>
                            <span className="inline-flex items-center rounded border border-amber-700/50 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-extrabold uppercase text-amber-900 dark:text-amber-300">
                                BETA
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {betaAvailable
                                ? "Available exclusively to logged-in users who enable it (disabled by default)."
                                : "Globally paused — hidden for all users including existing beta testers."}
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => void updateSetting("mailRoutingBetaAvailable", !betaAvailable)}
                    disabled={savingKey !== null}
                    role="switch"
                    aria-checked={betaAvailable}
                    aria-label="Toggle Mail Routing Beta global availability"
                    className={cn(
                        "tap relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 border-foreground transition-colors disabled:opacity-50",
                        betaAvailable ? "bg-status-open" : "bg-muted"
                    )}
                >
                    {savingKey === "mailRoutingBetaAvailable" ? (
                        <span className="mx-auto">
                            <Loader2 className="w-4 h-4 animate-spin text-foreground" aria-hidden="true" />
                        </span>
                    ) : (
                        <span
                            className={cn(
                                "inline-block h-6 w-6 transform rounded-full bg-card border border-foreground transition-transform",
                                betaAvailable ? "translate-x-6" : "translate-x-0.5"
                            )}
                        />
                    )}
                </button>
            </div>

            <div className="border-t border-border pt-3.5 flex items-center justify-between gap-4">
                <div>
                    <p className="text-sm font-bold">Allow Self-Enrollment in User Profile</p>
                    <p className="text-xs text-muted-foreground">
                        {selfOptInAllowed
                            ? "Any logged-in user can toggle Mail Routing Beta in Profile → Beta Features."
                            : "Invite-only: only Super Admins can grant Mail Routing Beta per user."}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => void updateSetting("mailRoutingSelfOptIn", !selfOptInAllowed)}
                    disabled={savingKey !== null}
                    role="switch"
                    aria-checked={selfOptInAllowed}
                    aria-label="Toggle Mail Routing Beta self enrollment"
                    className={cn(
                        "tap relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 border-foreground transition-colors disabled:opacity-50",
                        selfOptInAllowed ? "bg-status-open" : "bg-muted"
                    )}
                >
                    {savingKey === "mailRoutingSelfOptIn" ? (
                        <span className="mx-auto">
                            <Loader2 className="w-4 h-4 animate-spin text-foreground" aria-hidden="true" />
                        </span>
                    ) : (
                        <span
                            className={cn(
                                "inline-block h-6 w-6 transform rounded-full bg-card border border-foreground transition-transform",
                                selfOptInAllowed ? "translate-x-6" : "translate-x-0.5"
                            )}
                        />
                    )}
                </button>
            </div>

            <div className="border-t border-border pt-3 flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Manage access per person in Users &amp; Roles:</span>
                <Link
                    href="/dashboard/users"
                    className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
                >
                    <Users className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Manage Per-User Access</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
            </div>
        </div>
    );
}
