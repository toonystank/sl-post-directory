"use client";

import * as React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Sheet, SheetContent } from "@/components/shell/Sheet";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    loading?: boolean;
    onConfirm: () => void | Promise<void>;
}

export default function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    destructive = false,
    loading = false,
    onConfirm,
}: ConfirmDialogProps) {
    return (
        <Sheet open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
            <SheetContent
                title={title}
                description={description}
                footer={
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={loading}
                            onClick={() => onOpenChange(false)}
                            className="h-11 min-w-[100px] border-2 border-foreground font-semibold"
                        >
                            {cancelLabel}
                        </Button>
                        <Button
                            type="button"
                            variant={destructive ? "destructive" : "default"}
                            disabled={loading}
                            onClick={() => void onConfirm()}
                            className="h-11 min-w-[120px] font-bold"
                        >
                            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
                            {confirmLabel}
                        </Button>
                    </div>
                }
            >
                <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-3.5">
                    {destructive && (
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-destructive/15 text-destructive">
                            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                        </span>
                    )}
                    <p className="text-sm text-foreground/90 leading-relaxed">{description}</p>
                </div>
            </SheetContent>
        </Sheet>
    );
}
