"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Star, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Review {
    id: string;
    rating: number;
    content: string;
    authorName: string;
    createdAt: string;
}

interface ReviewSectionProps {
    reviews: Review[];
    officeId: string;
}

function StarRating({ rating, interactive, onChange }: { rating: number; interactive?: boolean; onChange?: (r: number) => void }) {
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    disabled={!interactive}
                    onClick={() => onChange?.(star)}
                    className={`${interactive ? "cursor-pointer hover:scale-110 transition-transform" : "cursor-default"}`}
                >
                    <Star
                        className={`w-5 h-5 ${star <= rating
                            ? "fill-secondary text-secondary"
                            : "text-muted-foreground/30"
                            }`}
                    />
                </button>
            ))}
        </div>
    );
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

export default function ReviewSection({ reviews: initialReviews, officeId }: ReviewSectionProps) {
    const t = useTranslations("Reviews");
    const [reviews, setReviews] = useState<Review[]>(initialReviews);
    const [rating, setRating] = useState(0);
    const [authorName, setAuthorName] = useState("");
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (rating === 0) {
            setError(true);
            setMessage(t("selectRatingError"));
            return;
        }

        setLoading(true);
        setMessage("");
        setError(false);

        try {
            const res = await fetch("/api/reviews", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rating, content, authorName, postOfficeId: officeId }),
            });

            if (res.ok) {
                const newReview = await res.json();
                setReviews((prev) => [newReview, ...prev]);
                setRating(0);
                setAuthorName("");
                setContent("");
                setMessage(t("thankYou"));
                setError(false);
            } else {
                const errData = await res.json();
                setError(true);
                setMessage(errData.error || "Failed to submit review.");
            }
        } catch {
            setError(true);
            setMessage("A network error occurred.");
        } finally {
            setLoading(false);
        }
    };

    const avgRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 className="font-heading text-xl font-extrabold [font-stretch:82%] mb-1">{t("title")}</h2>
                    <p className="text-sm text-muted-foreground">
                        {reviews.length > 0
                            ? t("summary", { count: reviews.length, rating: avgRating.toFixed(1) })
                            : t("noReviews")}
                    </p>
                </div>
            </div>

            {/* Existing Reviews */}
            {reviews.length > 0 && (
                <div className="space-y-4">
                    {reviews.map((review) => (
                        <div
                            key={review.id}
                            className="bg-card border border-border rounded-md p-5"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                                        {review.authorName.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold">{review.authorName}</p>
                                        <p className="text-xs font-mono text-muted-foreground">{formatDate(review.createdAt)}</p>
                                    </div>
                                </div>
                                <StarRating rating={review.rating} />
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">{review.content}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Submit Review Form */}
            <div className="bg-card border border-border rounded-md p-6">
                <h3 className="font-heading text-lg font-extrabold [font-stretch:82%] mb-4">{t("writeReview")}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">{t("yourRating")}</label>
                        <StarRating rating={rating} interactive onChange={setRating} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">{t("yourName")}</label>
                        <Input
                            type="text"
                            value={authorName}
                            onChange={(e) => setAuthorName(e.target.value)}
                            placeholder="e.g. Kasun Perera"
                            required
                            minLength={2}
                            maxLength={50}
                            className="rounded-md"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">{t("yourReview")}</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder={t("reviewPlaceholder")}
                            required
                            minLength={10}
                            maxLength={1000}
                            rows={3}
                            className="w-full rounded-md border-[1.5px] border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-foreground focus-visible:ring-[3px] focus-visible:ring-primary/25 resize-none"
                        />
                    </div>
                    {message && (
                        <div className={`p-3 rounded-md text-sm font-medium ${error ? "bg-destructive/10 border border-destructive/30 text-destructive" : "bg-status-open/10 border border-status-open/40 text-status-open"}`}>
                            {message}
                        </div>
                    )}
                    <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                        {loading ? (
                            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("submitting")}</>
                        ) : (
                            <><Send className="w-4 h-4 mr-2" /> {t("submitReview")}</>
                        )}
                    </Button>
                </form>
            </div>
        </div>
    );
}
