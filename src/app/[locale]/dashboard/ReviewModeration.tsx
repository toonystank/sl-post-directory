"use client";

import { useState } from "react";
import { Check, X, Star, MessageSquare } from "lucide-react";
import { showNativeToast } from "@/components/shell/NativeToast";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

export interface ReviewModerationItem {
    id: string;
    rating: number;
    content: string;
    authorName: string;
    createdAt: Date | string;
    postOffice: {
        name: string;
        postalCode: string;
    };
}

interface ReviewModerationProps {
    initialPendingReviews: number;
    initialPendingReviewItems: ReviewModerationItem[];
    onCountChange?: (newPendingCount: number) => void;
}

function StarRating({ rating }: { rating: number }) {
    return (
        <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
            {[1, 2, 3, 4, 5].map((star) => (
                <Star
                    key={star}
                    className={`w-4 h-4 ${
                        star <= rating ? "fill-secondary text-secondary" : "text-muted-foreground/30"
                    }`}
                    aria-hidden="true"
                />
            ))}
        </div>
    );
}

export default function ReviewModeration({
    initialPendingReviewItems,
    onCountChange,
}: ReviewModerationProps) {
    const [reviewItems, setReviewItems] = useState(initialPendingReviewItems);
    const [pendingAction, setPendingAction] = useState<{
        item: ReviewModerationItem;
        action: "APPROVE" | "REJECT";
    } | null>(null);
    const [processing, setProcessing] = useState(false);

    const executeAction = async () => {
        if (!pendingAction) return;
        setProcessing(true);

        try {
            const res = await fetch("/api/admin/reviews", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reviewId: pendingAction.item.id, action: pendingAction.action }),
            });

            if (res.ok) {
                setReviewItems((prev) => {
                    const next = prev.filter((item) => item.id !== pendingAction.item.id);
                    onCountChange?.(next.length);
                    return next;
                });
                showNativeToast(pendingAction.action === "APPROVE" ? "Review approved" : "Review removed");
                setPendingAction(null);
            } else {
                const err = (await res.json().catch(() => ({}))) as { error?: string };
                showNativeToast(err.error || "Failed to process review.");
            }
        } catch {
            showNativeToast("Network error occurred.");
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="space-y-3">
            {reviewItems.length === 0 ? (
                <div className="rounded-md border-2 border-dashed border-foreground/40 bg-card p-10 text-center text-muted-foreground">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-25" aria-hidden="true" />
                    <p className="font-heading text-lg font-extrabold text-foreground">All Clear</p>
                    <p className="text-sm mt-1">No pending community reviews to moderate.</p>
                </div>
            ) : (
                reviewItems.map((review) => (
                    <article
                        key={review.id}
                        className="rounded-md border-2 border-foreground bg-card p-4 space-y-3 shadow-[3px_3px_0_0_hsl(var(--foreground))]"
                    >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-heading text-base font-extrabold">{review.authorName}</span>
                                    <span className="rounded-sm border border-border bg-muted px-2 py-0.5 font-mono text-[11px] font-semibold">
                                        {review.postOffice.name} ({review.postOffice.postalCode})
                                    </span>
                                </div>
                                <p className="font-mono text-xs text-muted-foreground mt-0.5">
                                    {new Date(review.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                            <StarRating rating={review.rating} />
                        </div>

                        <p className="text-sm text-foreground/90 leading-relaxed border-l-2 border-secondary pl-3">
                            &ldquo;{review.content}&rdquo;
                        </p>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setPendingAction({ item: review, action: "APPROVE" })}
                                className="tap min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-md border border-status-open bg-status-open/10 px-3 text-xs font-extrabold text-status-open hover:bg-status-open/20"
                            >
                                <Check className="h-4 w-4" aria-hidden="true" />
                                <span>Approve Review</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setPendingAction({ item: review, action: "REJECT" })}
                                className="tap min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 text-xs font-extrabold text-destructive hover:bg-destructive/20"
                            >
                                <X className="h-4 w-4" aria-hidden="true" />
                                <span>Delete Review</span>
                            </button>
                        </div>
                    </article>
                ))
            )}

            <ConfirmDialog
                open={!!pendingAction}
                onOpenChange={(open) => !open && setPendingAction(null)}
                title={pendingAction?.action === "APPROVE" ? "Approve Review" : "Reject & Delete Review"}
                description={
                    pendingAction?.action === "APPROVE"
                        ? "Publish this user review on the public post office page?"
                        : "Permanently delete this review?"
                }
                confirmLabel={pendingAction?.action === "APPROVE" ? "Approve" : "Delete"}
                destructive={pendingAction?.action === "REJECT"}
                loading={processing}
                onConfirm={executeAction}
            />
        </div>
    );
}
