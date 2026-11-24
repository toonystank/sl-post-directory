"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, Edit3, Trash2, Save, Code2, Loader2 } from "lucide-react";
import { Sheet, SheetContent } from "@/components/shell/Sheet";
import { showNativeToast } from "@/components/shell/NativeToast";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import type { SiteVariable } from "@prisma/client";

export default function VariableManager() {
    const [variables, setVariables] = useState<SiteVariable[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showRateBlobs, setShowRateBlobs] = useState(false);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    const [key, setKey] = useState("");
    const [value, setValue] = useState("");
    const [description, setDescription] = useState("");

    const fetchVariables = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/admin/variables", { cache: "no-store" });
            if (res.ok) {
                const data = (await res.json()) as SiteVariable[];
                setVariables(data);
            }
        } catch {
            showNativeToast("Error fetching variables.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchVariables();
    }, []);

    const visibleVariables = useMemo(() => {
        if (showRateBlobs) return variables;
        return variables.filter((v) => !v.key.startsWith("rates_"));
    }, [variables, showRateBlobs]);

    const handleEdit = (v: SiteVariable) => {
        setKey(v.key);
        setValue(v.value);
        setDescription(v.description || "");
        setEditingKey(v.key);
        setIsCreating(false);
    };

    const handleNew = () => {
        setKey("");
        setValue("");
        setDescription("");
        setIsCreating(true);
        setEditingKey(null);
    };

    const handleCloseSheet = () => {
        setIsCreating(false);
        setEditingKey(null);
    };

    const handleSave = async () => {
        if (!key.trim() || !value.trim()) {
            showNativeToast("Key and value are required.");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/admin/variables", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: key.trim(), value, description }),
            });
            if (res.ok) {
                showNativeToast(`Saved {{${key.trim()}}}`);
                handleCloseSheet();
                void fetchVariables();
            } else {
                showNativeToast("Failed to save variable.");
            }
        } catch {
            showNativeToast("Network error saving variable.");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteConfirmed = async () => {
        if (!pendingDeleteKey) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/admin/variables?key=${encodeURIComponent(pendingDeleteKey)}`, {
                method: "DELETE",
            });
            if (res.ok) {
                setVariables((prev) => prev.filter((v) => v.key !== pendingDeleteKey));
                showNativeToast(`Deleted {{${pendingDeleteKey}}}`);
                setPendingDeleteKey(null);
            } else {
                showNativeToast("Failed to delete variable.");
            }
        } catch {
            showNativeToast("Network error deleting variable.");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-5">
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                    <p className="label-mono">Content Tokens</p>
                    <h1 className="display text-3xl sm:text-4xl mt-1">Sitewide Placeholders</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Insert live variables into articles &amp; updates via{" "}
                        <code className="font-mono text-primary font-bold">{"{{key}}"}</code>.
                    </p>
                </div>

                <Button onClick={handleNew} className="h-11 gap-2 font-bold self-start sm:self-auto">
                    <PlusCircle className="w-4 h-4" aria-hidden="true" />
                    <span>Add Variable</span>
                </Button>
            </header>

            <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3.5 py-2.5">
                <span className="text-xs font-medium text-muted-foreground">
                    Showing {visibleVariables.length} variable{visibleVariables.length === 1 ? "" : "s"}
                </span>
                <button
                    type="button"
                    onClick={() => setShowRateBlobs((s) => !s)}
                    className="tap min-h-[38px] rounded-md border border-border bg-background px-3 text-xs font-bold hover:border-foreground"
                >
                    {showRateBlobs ? "Hide rates_* JSON" : "Show rates_* JSON"}
                </button>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center rounded-md border-2 border-foreground bg-card py-14 text-muted-foreground gap-2">
                    <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden="true" />
                    <p className="font-mono text-xs uppercase tracking-wider">Loading variables...</p>
                </div>
            ) : visibleVariables.length === 0 ? (
                <div className="rounded-md border-2 border-dashed border-foreground/40 bg-card p-10 text-center text-muted-foreground">
                    <Code2 className="w-12 h-12 mx-auto mb-3 opacity-25" aria-hidden="true" />
                    <p className="font-heading text-lg font-extrabold text-foreground">No Variables</p>
                    <p className="text-sm mt-1">Create a custom placeholder to get started.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {visibleVariables.map((v) => (
                        <article
                            key={v.key}
                            className="rounded-md border-2 border-foreground bg-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[3px_3px_0_0_hsl(var(--foreground))]"
                        >
                            <div className="min-w-0 space-y-1">
                                <p className="font-mono text-xs sm:text-sm font-bold text-primary">{`{{${v.key}}}`}</p>
                                <p className="text-sm font-semibold text-foreground break-words line-clamp-2">
                                    {v.value}
                                </p>
                                {v.description && (
                                    <p className="text-xs text-muted-foreground">{v.description}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => handleEdit(v)}
                                    className="h-11 border-foreground font-bold gap-1.5 flex-1 sm:flex-none"
                                >
                                    <Edit3 className="h-4 w-4" aria-hidden="true" />
                                    <span>Edit</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    aria-label={`Delete ${v.key}`}
                                    onClick={() => setPendingDeleteKey(v.key)}
                                    className="h-11 w-11 p-0 border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
                                >
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </Button>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            <Sheet open={isCreating || !!editingKey} onOpenChange={(open) => !open && handleCloseSheet()}>
                <SheetContent
                    title={isCreating ? "Add Site Variable" : `Edit {{${editingKey}}}`}
                    description="Referenced inside News Studio articles and circulars"
                    bodyClassName="space-y-4"
                    footer={
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCloseSheet}
                                className="h-11 border-2 border-foreground"
                            >
                                Cancel
                            </Button>
                            <Button type="button" disabled={saving} onClick={() => void handleSave()} className="h-11 font-bold gap-1.5">
                                <Save className="w-4 h-4" aria-hidden="true" />
                                <span>{saving ? "Saving..." : "Save Variable"}</span>
                            </Button>
                        </div>
                    }
                >
                    <div>
                        <label className="label-mono block mb-1.5" htmlFor="var-key">
                            Key (e.g. register_post_price)
                        </label>
                        <Input
                            id="var-key"
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            disabled={!!editingKey}
                            placeholder="register_post_price"
                            className="h-12 text-base font-mono bg-background"
                        />
                    </div>
                    <div>
                        <label className="label-mono block mb-1.5" htmlFor="var-value">
                            Value
                        </label>
                        <textarea
                            id="var-value"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder="Rs. 110"
                            className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-base font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                    </div>
                    <div>
                        <label className="label-mono block mb-1.5" htmlFor="var-desc">
                            Description (Optional)
                        </label>
                        <textarea
                            id="var-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Inland registered post surcharge"
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                    </div>
                </SheetContent>
            </Sheet>

            <ConfirmDialog
                open={!!pendingDeleteKey}
                onOpenChange={(open) => !open && setPendingDeleteKey(null)}
                title="Delete Site Variable"
                description={pendingDeleteKey ? `Delete {{${pendingDeleteKey}}}? Existing articles referencing this tag will display the literal placeholder.` : ""}
                confirmLabel="Delete Variable"
                destructive
                loading={deleting}
                onConfirm={handleDeleteConfirmed}
            />
        </div>
    );
}
