"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { MapPin, PinOff, Route } from "lucide-react";
import { Link } from "@/navigation";
import { Sheet, SheetContent } from "@/components/shell/Sheet";
import { Button } from "@/components/ui/button";
import { useStaffStation } from "@/context/StaffStationContext";
import StaffStationPicker from "@/components/staff/StaffStationPicker";
import { triggerHaptic } from "@/lib/haptics";

interface StaffStationSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * Mobile-first bottom sheet (centered modal on desktop) for viewing, changing,
 * or discarding the active Origin / Duty Station from anywhere in the app.
 */
export default function StaffStationSheet({
    open,
    onOpenChange,
}: StaffStationSheetProps) {
    const t = useTranslations("Staff");
    const { station, clearStation } = useStaffStation();

    const handleDiscard = () => {
        triggerHaptic("light");
        clearStation();
        onOpenChange(false);
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                title={t("originSheetTitle")}
                description={t("originSheetDesc")}
            >
                <div className="space-y-4">
                    {station && (
                        <div className="rounded-xl border-2 border-foreground bg-emerald-500/10 p-3.5 space-y-3">
                            <div className="flex items-start gap-2.5">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-700/40 bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                                    <MapPin className="h-4 w-4" aria-hidden="true" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <p className="font-heading text-base font-extrabold text-foreground truncate">
                                            {station.name}
                                        </p>
                                        {station.shortCode && (
                                            <span className="rounded border border-foreground/30 bg-card px-1.5 py-0.5 font-mono text-[10px] font-bold">
                                                {station.shortCode}
                                            </span>
                                        )}
                                    </div>
                                    <p className="font-mono text-xs text-muted-foreground mt-0.5 truncate">
                                        {station.postalCode || "—"}
                                        {station.division ? ` · ${station.division}` : ""}
                                        {station.rmsc ? ` · ${station.rmsc}` : ""}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <Button asChild size="sm" className="h-10">
                                    <Link href="/routing" onClick={() => onOpenChange(false)}>
                                        <Route className="h-4 w-4 mr-1.5" aria-hidden="true" />
                                        <span className="truncate">{t("openRouting")}</span>
                                    </Link>
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleDiscard}
                                    data-testid="station-sheet-discard-btn"
                                    className="h-10 border-foreground/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                >
                                    <PinOff className="h-4 w-4 mr-1.5" aria-hidden="true" />
                                    <span className="truncate">{t("discardOrigin")}</span>
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="label-mono block text-[10px]">
                            {t("changeOriginLabel")}
                        </label>
                        <StaffStationPicker
                            compact
                            defaultOpen={open}
                            onSelected={() => onOpenChange(false)}
                        />
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
