"use client";

import { useState, Fragment } from "react";
import { ShieldCheck, Check, X, Info, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";

interface ModerationQueueProps {
    initialPendingEdits: number;
    initialPendingEditItems: Array<{
        id: string;
        createdAt: Date;
        status: string;
        changes: string;
        postOfficeId: string;
        requestedById: string;
        postOffice: {
            name: string;
            postalCode: string;
            fields: Array<{ name: string; value: string }>;
        };
        requestedBy: {
            name: string;
            email: string;
        };
    }>;
}

export default function ModerationQueue({ initialPendingEdits, initialPendingEditItems }: ModerationQueueProps) {
    const [pendingEdits, setPendingEdits] = useState(initialPendingEdits);
    const [pendingEditItems, setPendingEditItems] = useState(initialPendingEditItems);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const router = useRouter();

    const handleAction = async (requestId: string, action: "APPROVE" | "REJECT" | "MORE_INFO") => {
        let actionWord = action.toLowerCase();
        if (action === "MORE_INFO") actionWord = "request more info for";
        if (!confirm(`Are you sure you want to ${actionWord} this edit request?`)) return;

        setProcessingId(requestId);
        try {
            const res = await fetch("/api/admin/moderate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requestId, action }),
            });

            if (res.ok) {
                // Remove the processed item from the local state
                setPendingEditItems(prev => prev.filter(item => item.id !== requestId));
                setPendingEdits(prev => prev - 1);

                // Instruct the server components to re-fetch their data
                router.refresh();
            } else {
                const err = await res.json();
                alert(`Error: ${err.error || "Failed to process request."}`);
            }
        } catch (error) {
            console.error("Moderation action failed:", error);
            alert("A network error occurred.");
        } finally {
            setProcessingId(null);
        }
    };

    const toggleDetails = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const renderChanges = (changesJson: string, currentOffice: { name: string; postalCode: string; fields: Array<{ name: string; value: string }> }) => {
        try {
            const changes = JSON.parse(changesJson);
            const currentFieldMap = new Map(currentOffice.fields.map(f => [f.name, f.value]));

            return (
                <div className="space-y-3 text-sm">
                    {/* Basic fields — name & postalCode */}
                    {changes.name && (
                        <div className="flex items-center gap-3 py-1.5 px-3 bg-muted/30 rounded-lg">
                            <span className="font-medium text-muted-foreground w-24 shrink-0">Name</span>
                            <span className="line-through text-muted-foreground/60">{currentOffice.name}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-emerald-500 font-medium">{changes.name}</span>
                        </div>
                    )}
                    {changes.postalCode && (
                        <div className="flex items-center gap-3 py-1.5 px-3 bg-muted/30 rounded-lg">
                            <span className="font-medium text-muted-foreground w-24 shrink-0">Postal Code</span>
                            <span className="line-through text-muted-foreground/60">{currentOffice.postalCode}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-emerald-500 font-medium">{changes.postalCode}</span>
                        </div>
                    )}

                    {/* Dynamic fields */}
                    {changes.fields && changes.fields.length > 0 && (
                        <div className="space-y-1.5">
                            {changes.fields.map((f: { name: string; value: string }, i: number) => {
                                const currentValue = currentFieldMap.get(f.name);
                                const isNew = currentValue === undefined;
                                const isChanged = !isNew && currentValue !== f.value;

                                return (
                                    <div key={i} className="flex items-center gap-3 py-1.5 px-3 bg-muted/30 rounded-lg">
                                        <span className="font-medium text-muted-foreground w-24 shrink-0">{f.name}</span>
                                        {isNew ? (
                                            <span className="text-emerald-500 font-medium italic">+ {f.value} (new field)</span>
                                        ) : isChanged ? (
                                            <>
                                                <span className="line-through text-muted-foreground/60">{currentValue}</span>
                                                <span className="text-muted-foreground">→</span>
                                                <span className="text-emerald-500 font-medium">{f.value}</span>
                                            </>
                                        ) : (
                                            <span className="text-muted-foreground/60 italic">No change ({f.value})</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            );
        } catch {
            return <p className="text-sm text-muted-foreground italic">Could not parse changes.</p>;
        }
    };

    return (
        <Card className="border-border/50 overflow-hidden">
            <CardHeader className="border-b border-border/40 bg-card/80">
                <CardTitle className="text-lg">Moderation Queue</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                {pendingEdits === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                        <ShieldCheck className="w-16 h-16 mx-auto mb-4 opacity-15" />
                        <p className="text-lg font-medium mb-1">All Clear</p>
                        <p className="text-sm">No pending edit requests to moderate.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border/50">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Post Office</th>
                                    <th className="px-6 py-4 font-medium">Requested By</th>
                                    <th className="px-6 py-4 font-medium">Status</th>
                                    <th className="px-6 py-4 font-medium">Date</th>
                                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {pendingEditItems.map((edit) => (
                                    <Fragment key={edit.id}>
                                        <tr className="hover:bg-muted/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-foreground">{edit.postOffice.name}</div>
                                                <div className="text-xs text-muted-foreground mt-0.5">{edit.postOffice.postalCode}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                                                        {edit.requestedBy.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-foreground">{edit.requestedBy.name}</div>
                                                        <div className="text-xs text-muted-foreground mt-0.5">{edit.requestedBy.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {edit.status === "MORE_INFO" ? (
                                                    <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-500 bg-amber-500/10">
                                                        Needs Info
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/10">
                                                        Pending
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground">
                                                {new Date(edit.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-50"
                                                        title="Approve"
                                                        disabled={processingId === edit.id}
                                                        onClick={() => handleAction(edit.id, "APPROVE")}
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        className="p-1.5 text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors disabled:opacity-50"
                                                        title="Need More Info"
                                                        disabled={processingId === edit.id}
                                                        onClick={() => handleAction(edit.id, "MORE_INFO")}
                                                    >
                                                        <Info className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                                                        title="Reject"
                                                        disabled={processingId === edit.id}
                                                        onClick={() => handleAction(edit.id, "REJECT")}
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <button
                                                    className="text-[10px] text-muted-foreground mt-1 cursor-pointer hover:underline flex items-center gap-1 ml-auto"
                                                    onClick={() => toggleDetails(edit.id)}
                                                >
                                                    {expandedId === edit.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                    {expandedId === edit.id ? "Hide Details" : "View Details"}
                                                </button>
                                            </td>
                                        </tr>
                                        {expandedId === edit.id && (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-4 bg-muted/20 border-t border-border/30">
                                                    <div className="max-w-2xl">
                                                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Proposed Changes</p>
                                                        {renderChanges(edit.changes, edit.postOffice)}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
