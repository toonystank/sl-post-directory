"use client";

import * as React from "react";
import { CheckCircle2, XCircle, AlertCircle, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ActivityLogEntry {
    id: string;
    action: string;
    details: string;
    createdAt: Date | string;
    user: {
        name: string;
        email: string;
    };
}

interface ActivityLogClientProps {
    initialLogs: ActivityLogEntry[];
    initialCursor?: string;
}

type ActionFilter = "ALL" | "EDITS" | "MEDIA" | "SETTINGS";

export default function ActivityLogClient({ initialLogs, initialCursor }: ActivityLogClientProps) {
    const [logs, setLogs] = React.useState<ActivityLogEntry[]>(initialLogs);
    const [cursor, setCursor] = React.useState<string | undefined>(initialCursor);
    const [loadingMore, setLoadingMore] = React.useState(false);
    const [filter, setFilter] = React.useState<ActionFilter>("ALL");

    const filteredLogs = React.useMemo(() => {
        if (filter === "ALL") return logs;
        if (filter === "EDITS") {
            return logs.filter(
                (l) =>
                    l.action.includes("EDIT") ||
                    l.action.includes("MORE_INFO")
            );
        }
        if (filter === "MEDIA") {
            return logs.filter((l) => l.action.includes("PHOTO"));
        }
        return logs.filter((l) => l.action.includes("ADS"));
    }, [logs, filter]);

    const loadOlder = async () => {
        if (!cursor || loadingMore) return;
        setLoadingMore(true);
        try {
            const res = await fetch(`/api/admin/activity?cursor=${encodeURIComponent(cursor)}&limit=30`, {
                cache: "no-store",
            });
            if (res.ok) {
                const data = (await res.json()) as {
                    logs: ActivityLogEntry[];
                    nextCursor?: string;
                };
                setLogs((prev) => [...prev, ...(data.logs || [])]);
                setCursor(data.nextCursor);
            }
        } finally {
            setLoadingMore(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
                {(
                    [
                        { id: "ALL", label: "All Actions" },
                        { id: "EDITS", label: "Directory Edits" },
                        { id: "MEDIA", label: "Photos" },
                        { id: "SETTINGS", label: "System & Ads" },
                    ] as Array<{ id: ActionFilter; label: string }>
                ).map((chip) => (
                    <button
                        key={chip.id}
                        type="button"
                        onClick={() => setFilter(chip.id)}
                        className={cn(
                            "tap shrink-0 min-h-[40px] rounded-md border px-3 text-xs font-bold whitespace-nowrap",
                            filter === chip.id
                                ? "border-foreground bg-foreground text-background"
                                : "border-border bg-card text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {chip.label}
                    </button>
                ))}
            </div>

            {filteredLogs.length === 0 ? (
                <div className="rounded-md border-2 border-dashed border-foreground/40 bg-card p-10 text-center text-muted-foreground">
                    <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" aria-hidden="true" />
                    <p className="text-sm font-bold text-foreground">No activity logs found</p>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {filteredLogs.map((log) => {
                        let parsedDetails: { postOfficeName?: string; type?: string; adsEnabled?: boolean } = {};
                        try {
                            parsedDetails = JSON.parse(log.details) as typeof parsedDetails;
                        } catch {
                            // Ignore malformed JSON
                        }

                        const isApproved = log.action.includes("APPROVED") || log.action === "ADS_ENABLED";
                        const isRejected = log.action.includes("REJECTED") || log.action.includes("DELETED") || log.action === "ADS_DISABLED";

                        const targetLabel =
                            parsedDetails.postOfficeName ||
                            (typeof parsedDetails.adsEnabled === "boolean"
                                ? `Ads ${parsedDetails.adsEnabled ? "Enabled" : "Disabled"}`
                                : "Directory entry");

                        return (
                            <article
                                key={log.id}
                                className="rounded-md border-2 border-foreground bg-card p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                                <div className="flex items-start gap-3 min-w-0">
                                    <span
                                        className={cn(
                                            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border",
                                            isApproved
                                                ? "border-status-open/40 bg-status-open/10 text-status-open"
                                                : isRejected
                                                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                                                  : "border-status-closing/40 bg-status-closing/10 text-status-closing"
                                        )}
                                    >
                                        {isApproved ? (
                                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                        ) : isRejected ? (
                                            <XCircle className="h-4 w-4" aria-hidden="true" />
                                        ) : (
                                            <AlertCircle className="h-4 w-4" aria-hidden="true" />
                                        )}
                                    </span>

                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-foreground truncate">
                                            {log.user.name}{" "}
                                            <span className="font-normal text-xs text-muted-foreground">
                                                ({log.user.email})
                                            </span>
                                        </p>
                                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                            <span className="rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-foreground">
                                                {log.action.replace(/_/g, " ")}
                                            </span>
                                            <span>on</span>
                                            <span className="font-semibold text-foreground">{targetLabel}</span>
                                        </div>
                                    </div>
                                </div>

                                <span className="font-mono text-xs text-muted-foreground shrink-0">
                                    {new Date(log.createdAt).toLocaleString()}
                                </span>
                            </article>
                        );
                    })}
                </div>
            )}

            {cursor && (
                <div className="pt-2 flex justify-center">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={loadingMore}
                        onClick={() => void loadOlder()}
                        className="h-11 border-2 border-foreground font-bold px-6"
                    >
                        {loadingMore && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
                        <span>{loadingMore ? "Loading older logs..." : "Load Older Logs"}</span>
                    </Button>
                </div>
            )}
        </div>
    );
}
