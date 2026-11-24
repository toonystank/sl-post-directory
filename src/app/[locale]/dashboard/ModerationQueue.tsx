"use client";

import { useState, useMemo } from "react";
import { ShieldCheck, Check, X, Info, ChevronDown, ChevronUp } from "lucide-react";
import { showNativeToast } from "@/components/shell/NativeToast";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { cn } from "@/lib/utils";

export interface ModerationEditItem {
    id: string;
    createdAt: Date | string;
    status: string;
    type: string;
    reason?: string | null;
    changes: string;
    postOfficeId?: string | null;
    requestedById: string;
    postOffice?: {
        name: string;
        postalCode: string;
        fields: Array<{ name: string; value: string }>;
    } | null;
    requestedBy: {
        name: string;
        email: string;
    };
}

interface ModerationQueueProps {
    initialPendingEdits: number;
    initialPendingEditItems: ModerationEditItem[];
    onCountChange?: (newOpenCount: number) => void;
}

type StatusFilter = "ALL" | "PENDING" | "MORE_INFO";

export default function ModerationQueue({
    initialPendingEdits,
    initialPendingEditItems,
    onCountChange,
}: ModerationQueueProps) {
    const [pendingEditItems, setPendingEditItems] = useState<ModerationEditItem[]>(initialPendingEditItems);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [pendingAction, setPendingAction] = useState<{
        item: ModerationEditItem;
        action: "APPROVE" | "REJECT" | "MORE_INFO";
    } | null>(null);
    const [processing, setProcessing] = useState(false);

    const openCount = pendingEditItems.length || (initialPendingEdits === 0 ? 0 : pendingEditItems.length);
    const pendingOnlyCount = useMemo(
        () => pendingEditItems.filter((item) => item.status === "PENDING").length,
        [pendingEditItems]
    );
    const moreInfoCount = useMemo(
        () => pendingEditItems.filter((item) => item.status === "MORE_INFO").length,
        [pendingEditItems]
    );

    const visibleItems = useMemo(() => {
        if (statusFilter === "ALL") return pendingEditItems;
        return pendingEditItems.filter((item) => item.status === statusFilter);
    }, [pendingEditItems, statusFilter]);

    const executeAction = async () => {
        if (!pendingAction) return;
        const { item, action } = pendingAction;
        setProcessing(true);

        try {
            const res = await fetch("/api/admin/moderate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requestId: item.id, action }),
            });

            if (res.ok) {
                if (action === "MORE_INFO") {
                    setPendingEditItems((prev) =>
                        prev.map((row) => (row.id === item.id ? { ...row, status: "MORE_INFO" } : row))
                    );
                    showNativeToast("Marked as More Info Sent");
                } else {
                    setPendingEditItems((prev) => {
                        const next = prev.filter((row) => row.id !== item.id);
                        onCountChange?.(next.length);
                        return next;
                    });
                    showNativeToast(action === "APPROVE" ? "Edit approved & published" : "Edit request rejected");
                }
                setPendingAction(null);
            } else {
                const err = (await res.json().catch(() => ({}))) as { error?: string };
                showNativeToast(err.error || "Failed to process request.");
            }
        } catch {
            showNativeToast("Network error occurred.");
        } finally {
            setProcessing(false);
        }
    };

    const renderChanges = (edit: ModerationEditItem) => {
        const changesJson = edit.changes;
        const type = edit.type || "EDIT";
        const reason = edit.reason;
        const currentOffice: {
            name?: string;
            postalCode?: string;
            fields: Array<{ name: string; value: string }>;
        } = edit.postOffice || { fields: [] };

        if (type === "REMOVAL") {
            return (
                <div className="p-3 bg-destructive/10 text-destructive rounded-md border border-destructive/30 text-sm">
                    <span className="font-bold flex items-center gap-2 mb-1">
                        <ShieldCheck className="w-4 h-4" aria-hidden="true" /> Reason for removal requested:
                    </span>
                    {reason || "No reason provided."}
                </div>
            );
        }

        try {
            const changes = JSON.parse(changesJson || "{}") as {
                name?: string;
                postalCode?: string;
                fields?: Array<{ name: string; value: string }>;
            };

            if (type === "ADD") {
                return (
                    <div className="space-y-2 text-sm">
                        {reason && (
                            <p className="p-2.5 bg-background rounded-md text-muted-foreground border border-border">
                                <strong className="text-foreground">Notes:</strong> {reason}
                            </p>
                        )}
                        <div className="flex items-center gap-3 py-1.5 px-3 bg-status-open/10 border-l-2 border-status-open rounded-r-sm">
                            <span className="font-mono text-xs text-muted-foreground w-24 shrink-0">Name</span>
                            <span className="text-status-open font-semibold">+ {changes.name}</span>
                        </div>
                        <div className="flex items-center gap-3 py-1.5 px-3 bg-status-open/10 border-l-2 border-status-open rounded-r-sm">
                            <span className="font-mono text-xs text-muted-foreground w-24 shrink-0">Postcode</span>
                            <span className="text-status-open font-semibold">+ {changes.postalCode}</span>
                        </div>
                        {changes.fields?.map((f, i) => (
                            <div key={i} className="flex items-center gap-3 py-1.5 px-3 bg-status-open/10 border-l-2 border-status-open rounded-r-sm">
                                <span className="font-mono text-xs text-muted-foreground w-24 shrink-0 truncate">{f.name}</span>
                                <span className="text-status-open font-semibold">+ {f.value}</span>
                            </div>
                        ))}
                    </div>
                );
            }

            const currentFieldMap = new Map(currentOffice.fields.map((f) => [f.name, f.value]));

            return (
                <div className="space-y-2 text-sm">
                    {changes.name && (
                        <div className="flex flex-wrap items-center gap-2 py-1.5 px-3 bg-background border-l-2 border-primary rounded-r-sm">
                            <span className="font-mono text-xs text-muted-foreground w-24 shrink-0">Name</span>
                            <span className="line-through text-destructive font-medium">{currentOffice.name}</span>
                            <span>&rarr;</span>
                            <span className="text-status-open font-semibold">{changes.name}</span>
                        </div>
                    )}
                    {changes.postalCode && (
                        <div className="flex flex-wrap items-center gap-2 py-1.5 px-3 bg-background border-l-2 border-primary rounded-r-sm">
                            <span className="font-mono text-xs text-muted-foreground w-24 shrink-0">Postcode</span>
                            <span className="line-through text-destructive font-medium">{currentOffice.postalCode}</span>
                            <span>&rarr;</span>
                            <span className="text-status-open font-semibold">{changes.postalCode}</span>
                        </div>
                    )}
                    {changes.fields?.map((f, i) => {
                        const currentValue = currentFieldMap.get(f.name);
                        const isNew = currentValue === undefined;
                        const isChanged = !isNew && currentValue !== f.value;
                        return (
                            <div
                                key={i}
                                className={cn(
                                    "flex flex-wrap items-center gap-2 py-1.5 px-3 bg-background border-l-2 rounded-r-sm",
                                    isNew ? "border-status-open" : isChanged ? "border-primary" : "border-border"
                                )}
                            >
                                <span className="font-mono text-xs text-muted-foreground w-24 shrink-0 truncate">{f.name}</span>
                                {isNew ? (
                                    <span className="text-status-open font-semibold">+ {f.value}</span>
                                ) : isChanged ? (
                                    <>
                                        <span className="line-through text-destructive font-medium">{currentValue}</span>
                                        <span>&rarr;</span>
                                        <span className="text-status-open font-semibold">{f.value}</span>
                                    </>
                                ) : (
                                    <span className="text-muted-foreground italic">{f.value}</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            );
        } catch {
            return <p className="text-sm text-muted-foreground italic">Could not parse changes.</p>;
        }
    };

    const actionLabels = {
        APPROVE: {
            title: "Approve Edit Request",
            confirm: "Approve & Publish",
            destructive: false,
            desc: "Apply these changes directly to the public directory and notify the contributor?",
        },
        MORE_INFO: {
            title: "Request More Information",
            confirm: "Request More Info",
            destructive: false,
            desc: "Email the contributor asking for clarification and keep this submission in your More Info queue?",
        },
        REJECT: {
            title: "Reject Edit Request",
            confirm: "Reject Submission",
            destructive: true,
            desc: "Reject this submission without modifying the public directory entry?",
        },
    };

    return (
        <div className="space-y-4">
            {/* Filter Chips */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
                {(
                    [
                        { id: "ALL", label: `All Open (${openCount})` },
                        { id: "PENDING", label: `Pending (${pendingOnlyCount})` },
                        { id: "MORE_INFO", label: `More Info Sent (${moreInfoCount})` },
                    ] as Array<{ id: StatusFilter; label: string }>
                ).map((chip) => (
                    <button
                        key={chip.id}
                        type="button"
                        onClick={() => setStatusFilter(chip.id)}
                        className={cn(
                            "tap shrink-0 min-h-[40px] rounded-md border px-3 text-xs font-bold whitespace-nowrap",
                            statusFilter === chip.id
                                ? "border-foreground bg-foreground text-background"
                                : "border-border bg-card text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {chip.label}
                    </button>
                ))}
            </div>

            {visibleItems.length === 0 ? (
                <div className="rounded-md border-2 border-dashed border-foreground/40 bg-card p-10 text-center text-muted-foreground">
                    <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-25" aria-hidden="true" />
                    <p className="font-heading text-lg font-extrabold text-foreground">All Clear</p>
                    <p className="text-sm mt-1">No edit requests match this filter.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {visibleItems.map((edit) => {
                        let fallbackName = "New Post Office";
                        let fallbackCode = "N/A";
                        try {
                            const parsed = JSON.parse(edit.changes || "{}") as { name?: string; postalCode?: string };
                            if (parsed.name) fallbackName = parsed.name;
                            if (parsed.postalCode) fallbackCode = parsed.postalCode;
                        } catch {
                            // ignore parse
                        }
                        const officeName = edit.postOffice?.name || fallbackName;
                        const postalCode = edit.postOffice?.postalCode || fallbackCode;
                        const isExpanded = expandedId === edit.id;

                        return (
                            <article
                                key={edit.id}
                                className="rounded-md border-2 border-foreground bg-card p-4 space-y-3 shadow-[3px_3px_0_0_hsl(var(--foreground))]"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span
                                                className={cn(
                                                    "font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm border",
                                                    edit.type === "ADD"
                                                        ? "border-foreground bg-secondary text-secondary-foreground"
                                                        : edit.type === "REMOVAL"
                                                          ? "border-destructive bg-destructive text-destructive-foreground"
                                                          : "border-border bg-muted text-foreground"
                                                )}
                                            >
                                                {edit.type || "EDIT"}
                                            </span>
                                            {edit.status === "MORE_INFO" ? (
                                                <span className="font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm border border-status-closing text-status-closing bg-status-closing/10">
                                                    Needs Info
                                                </span>
                                            ) : (
                                                <span className="font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm border border-primary/50 text-primary bg-primary/10">
                                                    Pending
                                                </span>
                                            )}
                                            <span className="font-mono text-xs text-muted-foreground">{postalCode}</span>
                                        </div>
                                        <h3 className="font-heading text-lg font-extrabold mt-1">{officeName}</h3>
                                    </div>
                                    <span className="font-mono text-xs text-muted-foreground shrink-0">
                                        {new Date(edit.createdAt).toLocaleDateString()}
                                    </span>
                                </div>

                                <div className="rounded-md border border-border bg-background px-3 py-2 flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-foreground truncate">{edit.requestedBy.name}</p>
                                        <p className="text-[11px] text-muted-foreground truncate">{edit.requestedBy.email}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setExpandedId(isExpanded ? null : edit.id)}
                                        className="tap inline-flex min-h-[40px] shrink-0 items-center gap-1 text-xs font-bold text-primary hover:underline"
                                    >
                                        {isExpanded ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
                                        <span>{isExpanded ? "Hide Diff" : "View Diff"}</span>
                                    </button>
                                </div>

                                {isExpanded && (
                                    <div className="rounded-md border border-border bg-muted/30 p-3">
                                        <p className="label-mono mb-2">
                                            Proposed {edit.type === "REMOVAL" ? "Removal" : "Changes"}
                                        </p>
                                        {renderChanges(edit)}
                                    </div>
                                )}

                                <div className="grid grid-cols-3 gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setPendingAction({ item: edit, action: "APPROVE" })}
                                        className="tap min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-md border border-status-open bg-status-open/10 px-2 text-xs font-extrabold text-status-open hover:bg-status-open/20"
                                    >
                                        <Check className="h-4 w-4" aria-hidden="true" />
                                        <span>Approve</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPendingAction({ item: edit, action: "MORE_INFO" })}
                                        className="tap min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-md border border-status-closing bg-status-closing/10 px-2 text-xs font-extrabold text-status-closing hover:bg-status-closing/20"
                                    >
                                        <Info className="h-4 w-4" aria-hidden="true" />
                                        <span>More Info</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPendingAction({ item: edit, action: "REJECT" })}
                                        className="tap min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2 text-xs font-extrabold text-destructive hover:bg-destructive/20"
                                    >
                                        <X className="h-4 w-4" aria-hidden="true" />
                                        <span>Reject</span>
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            <ConfirmDialog
                open={!!pendingAction}
                onOpenChange={(open) => !open && setPendingAction(null)}
                title={pendingAction ? actionLabels[pendingAction.action].title : ""}
                description={pendingAction ? actionLabels[pendingAction.action].desc : ""}
                confirmLabel={pendingAction ? actionLabels[pendingAction.action].confirm : "Confirm"}
                destructive={pendingAction ? actionLabels[pendingAction.action].destructive : false}
                loading={processing}
                onConfirm={executeAction}
            />
        </div>
    );
}
