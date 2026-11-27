"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { useStaffStation } from "@/context/StaffStationContext";
import { toStaffStation } from "@/lib/staff-station";
import { ensureLocalOfficeIndex } from "@/lib/office-index-client";
import { searchRoutingOffices, type RoutingOfficeNode } from "@/lib/mail-routing";
import { cn } from "@/lib/utils";

interface StaffStationPickerProps {
    compact?: boolean;
    defaultOpen?: boolean;
    onSelected?: () => void;
    className?: string;
}

/**
 * Reusable searchable picker for selecting a postal employee's current Duty Station.
 * Loads the offline compact office index lazily on focus/open so public visitors
 * incur zero extra cost unless they explicitly opt into setting a station.
 */
export default function StaffStationPicker({
    compact = false,
    defaultOpen = false,
    onSelected,
    className,
}: StaffStationPickerProps) {
    const t = useTranslations("Staff");
    const { setStation } = useStaffStation();
    const [query, setQuery] = React.useState("");
    const [open, setOpen] = React.useState(defaultOpen);
    const [loading, setLoading] = React.useState(false);
    const [offices, setOffices] = React.useState<RoutingOfficeNode[]>([]);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const loadIndex = React.useCallback(async () => {
        if (offices.length > 0 || loading) return;
        setLoading(true);
        try {
            const engine = await ensureLocalOfficeIndex();
            if (engine) {
                setOffices(engine.getRoutingNodes());
            }
        } finally {
            setLoading(false);
        }
    }, [offices.length, loading]);

    React.useEffect(() => {
        if (defaultOpen) {
            void loadIndex();
        }
    }, [defaultOpen, loadIndex]);

    React.useEffect(() => {
        const handleOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, []);

    const matches = React.useMemo(
        () => searchRoutingOffices(offices, query, 10),
        [query, offices]
    );

    const handlePick = (node: RoutingOfficeNode) => {
        setStation(toStaffStation(node));
        setQuery("");
        setOpen(false);
        onSelected?.();
    };

    return (
        <div ref={containerRef} className={cn("relative min-w-0", className)}>
            <div className="relative">
                <Search
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                />
                <input
                    type="search"
                    value={query}
                    autoFocus={defaultOpen}
                    onFocus={() => {
                        setOpen(true);
                        void loadIndex();
                    }}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                        if (offices.length === 0) {
                            void loadIndex();
                        }
                    }}
                    placeholder={t("searchStationPlaceholder")}
                    className={cn(
                        "w-full rounded-lg border-2 border-foreground/70 bg-background pl-9 pr-8 text-sm font-medium focus:border-foreground focus:outline-none",
                        compact ? "h-10" : "h-11"
                    )}
                />
                {query && (
                    <button
                        type="button"
                        onClick={() => setQuery("")}
                        aria-label="Clear search"
                        className="tap absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            {open && (query.trim().length > 0 || loading) && (
                <div className="mt-1.5 max-h-60 w-full overflow-y-auto rounded-lg border-2 border-foreground bg-card shadow-md divide-y divide-border">
                    {loading && offices.length === 0 ? (
                        <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>{t("loadingOffices")}</span>
                        </div>
                    ) : matches.length === 0 ? (
                        <p className="px-3 py-3 text-xs text-muted-foreground">{t("noMatch")}</p>
                    ) : (
                        matches.map((o) => (
                            <button
                                key={o.id}
                                type="button"
                                onClick={() => handlePick(o)}
                                className="tap flex w-full items-center justify-between gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-muted"
                            >
                                <span className="flex items-center gap-2 min-w-0">
                                    <MapPin
                                        className="h-3.5 w-3.5 shrink-0 text-primary"
                                        aria-hidden="true"
                                    />
                                    <span className="min-w-0">
                                        <span className="block font-semibold truncate">
                                            {o.name}
                                        </span>
                                        <span className="block text-[11px] text-muted-foreground truncate">
                                            {o.type || "Post Office"}
                                            {o.division ? ` · ${o.division}` : ""}
                                        </span>
                                    </span>
                                </span>
                                <span className="flex items-center gap-1.5 shrink-0 font-mono text-xs">
                                    {o.shortCode && (
                                        <span className="rounded bg-muted px-1.5 py-0.5 font-bold">
                                            {o.shortCode}
                                        </span>
                                    )}
                                    <span className="text-muted-foreground">
                                        {o.postalCode || "—"}
                                    </span>
                                </span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
