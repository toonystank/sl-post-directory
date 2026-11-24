"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Edit3, Camera, MessageSquare } from "lucide-react";
import ModerationQueue, { type ModerationEditItem } from "@/app/[locale]/dashboard/ModerationQueue";
import PhotoModeration, { type PhotoModerationItem } from "@/app/[locale]/dashboard/PhotoModeration";
import ReviewModeration, { type ReviewModerationItem } from "@/app/[locale]/dashboard/ReviewModeration";
import { cn } from "@/lib/utils";

type QueueTab = "edits" | "photos" | "reviews";

interface QueueClientProps {
    initialEdits: ModerationEditItem[];
    initialPhotos: PhotoModerationItem[];
    initialReviews: ReviewModerationItem[];
}

export default function QueueClient({
    initialEdits,
    initialPhotos,
    initialReviews,
}: QueueClientProps) {
    const searchParams = useSearchParams();
    const rawTab = searchParams.get("tab");
    const defaultTab: QueueTab =
        rawTab === "photos" ? "photos" : rawTab === "reviews" ? "reviews" : "edits";

    const [activeTab, setActiveTab] = useState<QueueTab>(defaultTab);
    const [editsCount, setEditsCount] = useState(initialEdits.length);
    const [pendingPhotosCount, setPendingPhotosCount] = useState(
        initialPhotos.filter((p) => p.status === "PENDING").length
    );
    const [reviewsCount, setReviewsCount] = useState(initialReviews.length);

    return (
        <div className="space-y-5">
            <header>
                <p className="label-mono">Moderation Queue</p>
                <h1 className="display text-3xl sm:text-4xl mt-1">Triage & Submissions</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Review suggested office edits, uploaded community photos, and public reviews.
                </p>
            </header>

            <div className="grid grid-cols-3 gap-2 rounded-md border-2 border-foreground bg-card p-1.5">
                <button
                    type="button"
                    onClick={() => setActiveTab("edits")}
                    className={cn(
                        "tap min-h-[44px] rounded-sm px-2 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5",
                        activeTab === "edits"
                            ? "bg-primary text-primary-foreground shadow-[2px_2px_0_0_hsl(var(--foreground))]"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <Edit3 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Edits ({editsCount})</span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("photos")}
                    className={cn(
                        "tap min-h-[44px] rounded-sm px-2 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5",
                        activeTab === "photos"
                            ? "bg-primary text-primary-foreground shadow-[2px_2px_0_0_hsl(var(--foreground))]"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <Camera className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Photos ({pendingPhotosCount})</span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("reviews")}
                    className={cn(
                        "tap min-h-[44px] rounded-sm px-2 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5",
                        activeTab === "reviews"
                            ? "bg-primary text-primary-foreground shadow-[2px_2px_0_0_hsl(var(--foreground))]"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <MessageSquare className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Reviews ({reviewsCount})</span>
                </button>
            </div>

            {activeTab === "edits" && (
                <ModerationQueue
                    initialPendingEdits={initialEdits.length}
                    initialPendingEditItems={initialEdits}
                    onCountChange={setEditsCount}
                />
            )}

            {activeTab === "photos" && (
                <PhotoModeration
                    photos={initialPhotos}
                    onPendingCountChange={setPendingPhotosCount}
                />
            )}

            {activeTab === "reviews" && (
                <ReviewModeration
                    initialPendingReviews={initialReviews.length}
                    initialPendingReviewItems={initialReviews}
                    onCountChange={setReviewsCount}
                />
            )}
        </div>
    );
}
