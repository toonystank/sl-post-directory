"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Megaphone, Loader2 } from "lucide-react";

export default function AdToggle() {
    const [adsEnabled, setAdsEnabled] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch("/api/admin/settings")
            .then(res => res.json())
            .then(data => setAdsEnabled(data.adsEnabled))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const handleToggle = async () => {
        const newValue = !adsEnabled;
        setAdsEnabled(newValue); // Optimistic update
        setSaving(true);

        try {
            const res = await fetch("/api/admin/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ adsEnabled: newValue }),
            });

            if (!res.ok) {
                setAdsEnabled(!newValue); // Revert on error
            }
        } catch {
            setAdsEnabled(!newValue); // Revert on error
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return null;
    }

    return (
        <Card className="border-border/50 py-4 md:py-6 gap-3 md:gap-6">
            <CardHeader className="flex flex-row items-center justify-between pb-0 px-5 md:px-6">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${adsEnabled ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                        <Megaphone className="w-4 h-4" />
                    </div>
                    <div>
                        <CardTitle className="text-sm font-medium">Advertisements</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {adsEnabled ? "Ads are currently displayed site-wide" : "Ads are currently hidden site-wide"}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleToggle}
                    disabled={saving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                        adsEnabled ? 'bg-green-500' : 'bg-muted-foreground/30'
                    }`}
                    role="switch"
                    aria-checked={adsEnabled}
                    aria-label="Toggle advertisements"
                >
                    {saving ? (
                        <span className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="w-3 h-3 animate-spin text-white" />
                        </span>
                    ) : (
                        <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform ${
                                adsEnabled ? 'translate-x-5' : 'translate-x-0.5'
                            }`}
                        />
                    )}
                </button>
            </CardHeader>
            <CardContent className="px-5 md:px-6 pt-0">
                {/* Empty for clean look, card header has all info */}
            </CardContent>
        </Card>
    );
}
