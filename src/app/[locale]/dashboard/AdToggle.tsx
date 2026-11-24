"use client";

import { useEffect, useState } from "react";
import { Megaphone, Loader2 } from "lucide-react";
import { showNativeToast } from "@/components/shell/NativeToast";
import { cn } from "@/lib/utils";

export default function AdToggle() {
    const [adsEnabled, setAdsEnabled] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch("/api/admin/settings", { cache: "no-store" })
            .then((res) => res.json())
            .then((data: { adsEnabled?: boolean }) => {
                if (typeof data.adsEnabled === "boolean") setAdsEnabled(data.adsEnabled);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const handleToggle = async () => {
        const newValue = !adsEnabled;
        setAdsEnabled(newValue);
        setSaving(true);

        try {
            const res = await fetch("/api/admin/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ adsEnabled: newValue }),
            });

            if (res.ok) {
                showNativeToast(newValue ? "Sitewide ads enabled" : "Sitewide ads disabled");
            } else {
                setAdsEnabled(!newValue);
                showNativeToast("Failed to update ad setting.");
            }
        } catch {
            setAdsEnabled(!newValue);
            showNativeToast("Network error updating ads.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="h-[82px] rounded-md border-2 border-border bg-card p-4 animate-pulse flex items-center justify-between">
                <div className="space-y-2">
                    <div className="h-4 w-32 rounded bg-muted" />
                    <div className="h-3 w-48 rounded bg-muted" />
                </div>
                <div className="h-7 w-12 rounded-full bg-muted" />
            </div>
        );
    }

    return (
        <div className="rounded-md border-2 border-foreground bg-card p-4 sm:p-5 flex items-center justify-between gap-4 shadow-[3px_3px_0_0_hsl(var(--foreground))]">
            <div className="flex items-start gap-3">
                <span
                    className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border",
                        adsEnabled
                            ? "border-status-open/40 bg-status-open/10 text-status-open"
                            : "border-border bg-muted text-muted-foreground"
                    )}
                >
                    <Megaphone className="w-5 h-5" aria-hidden="true" />
                </span>
                <div>
                    <h2 className="font-heading text-base font-extrabold">Sitewide Advertisements</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {adsEnabled
                            ? "AdSense & Native AdMob units are currently active."
                            : "All ad placements are hidden across web & native apps."}
                    </p>
                </div>
            </div>

            <button
                type="button"
                onClick={() => void handleToggle()}
                disabled={saving}
                role="switch"
                aria-checked={adsEnabled}
                aria-label="Toggle sitewide advertisements"
                className={cn(
                    "tap relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 border-foreground transition-colors disabled:opacity-50",
                    adsEnabled ? "bg-status-open" : "bg-muted"
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
                            adsEnabled ? "translate-x-6" : "translate-x-0.5"
                        )}
                    />
                )}
            </button>
        </div>
    );
}
