"use client";

import { useState } from "react";
import { Check, X, Star, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";

interface Review {
    id: string;
    rating: number;
    content: string;
    authorName: string;
    createdAt: Date;
    postOffice: {
        name: string;
        postalCode: string;
    };
}

interface ReviewModerationProps {
    initialPendingReviews: number;
    initialPendingReviewItems: Review[];
}

export default function ReviewModeration({ initialPendingReviews, initialPendingReviewItems }: ReviewModerationProps) {
    const [pendingReviews, setPendingReviews] = useState(initialPendingReviews);
    const [reviewItems, setReviewItems] = useState(initialPendingReviewItems);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const router = useRouter();

    const handleAction = async (reviewId: string, action: "APPROVE" | "REJECT") => {
        if (!confirm(`Are you sure you want to ${action.toLowerCase()} this review?`)) return;

        setProcessingId(reviewId);
        try {
            const res = await fetch("/api/admin/reviews", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reviewId, action }),
            });

            if (res.ok) {
                setReviewItems(prev => prev.filter(item => item.id !== reviewId));
                setPendingReviews(prev => prev - 1);
                router.refresh();
            } else {
                const err = await res.json();
                alert(`Error: ${err.error || "Failed to process review."}`);
            }
        } catch (error) {
            console.error("Moderation action failed:", error);
            alert("A network error occurred.");
        } finally {
            setProcessingId(null);
        }
    };

    function StarRating({ rating }: { rating: number }) {
        return (
            <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        className={`w-3.5 h-3.5 ${star <= rating
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/30"
                            }`}
                    />
                ))}
            </div>
        );
    }

    return (
        <Card className="border-border/50 overflow-hidden">
            <CardHeader className="border-b border-border/40 bg-card/80">
                <CardTitle className="text-lg flex items-center gap-2">
                    Review Moderation
                    {pendingReviews > 0 && (
                        <Badge variant="destructive" className="ml-2 rounded-full px-2 h-5 text-xs flex items-center justify-center">
                            {pendingReviews}
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                {pendingReviews === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                        <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-15" />
                        <p className="text-lg font-medium mb-1">All Clear</p>
                        <p className="text-sm">No pending reviews to moderate.</p>
                    </div>
                ) : (
                    <div className="overflow-y-auto overflow-x-hidden max-h-[600px] flex flex-col divide-y divide-border/50">
                        {reviewItems.map((review) => (
                            <div key={review.id} className="p-5 hover:bg-muted/30 transition-colors">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0 space-y-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                                                {review.authorName.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                                                    {review.authorName}
                                                    <Badge variant="outline" className="text-[10px] text-muted-foreground bg-background/50">
                                                        {review.postOffice.name}
                                                    </Badge>
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    {new Date(review.createdAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="pl-11">
                                            <StarRating rating={review.rating} />
                                            <p className="text-sm mt-2 text-foreground/90 leading-relaxed italic">
                                                "{review.content}"
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col gap-2 shrink-0">
                                        <button
                                            className="px-3 py-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 text-xs font-bold"
                                            disabled={processingId === review.id}
                                            onClick={() => handleAction(review.id, "APPROVE")}
                                        >
                                            <Check className="w-4 h-4" /> Approve
                                        </button>
                                        <button
                                            className="px-3 py-2 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 text-xs font-bold"
                                            disabled={processingId === review.id}
                                            onClick={() => handleAction(review.id, "REJECT")}
                                        >
                                            <X className="w-4 h-4" /> Reject
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
