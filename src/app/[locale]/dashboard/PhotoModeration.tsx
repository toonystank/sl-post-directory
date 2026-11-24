"use client";

import { useState } from "react";
import Image from "next/image";
import { Trash2, CameraOff, ExternalLink, Maximize2, Check } from "lucide-react";
import { Link } from "@/navigation";
import { Sheet, SheetContent } from "@/components/shell/Sheet";
import { showNativeToast } from "@/components/shell/NativeToast";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { cn } from "@/lib/utils";

export interface PhotoModerationItem {
    id: string;
    url: string;
    caption: string | null;
    status: string;
    createdAt: Date | string;
    postOfficeId: string;
    postOffice: {
        name: string;
        postalCode: string;
        slug: string;
    };
}

interface PhotoModerationProps {
    photos: PhotoModerationItem[];
    onPendingCountChange?: (newPendingCount: number) => void;
}

function toPreviewSrc(rawUrl: string): string {
    const trimmed = rawUrl.trim();
    const base = trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
    return `${base}-/preview/600x400/-/quality/smart/`;
}

export default function PhotoModeration({ photos: initialPhotos, onPendingCountChange }: PhotoModerationProps) {
    const [photos, setPhotos] = useState(initialPhotos);
    const [filter, setFilter] = useState<"ALL" | "PENDING">("PENDING");
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [selectedPhoto, setSelectedPhoto] = useState<PhotoModerationItem | null>(null);
    const [confirmDeletePhoto, setConfirmDeletePhoto] = useState<PhotoModerationItem | null>(null);
    const [deleting, setDeleting] = useState(false);

    const pendingCount = photos.filter((p) => p.status === "PENDING").length;
    const visiblePhotos = filter === "PENDING" ? photos.filter((p) => p.status === "PENDING") : photos;

    const handleApprove = async (photoId: string) => {
        setProcessingId(photoId);
        try {
            const res = await fetch("/api/admin/photos", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: photoId }),
            });

            if (res.ok) {
                setPhotos((prev) => {
                    const next = prev.map((p) => (p.id === photoId ? { ...p, status: "APPROVED" } : p));
                    onPendingCountChange?.(next.filter((p) => p.status === "PENDING").length);
                    return next;
                });
                setSelectedPhoto((prev) => (prev && prev.id === photoId ? { ...prev, status: "APPROVED" } : prev));
                showNativeToast("Photo approved");
            } else {
                const err = (await res.json().catch(() => ({}))) as { error?: string };
                showNativeToast(err.error || "Failed to approve photo.");
            }
        } catch {
            showNativeToast("Network error approving photo.");
        } finally {
            setProcessingId(null);
        }
    };

    const handleDeleteConfirmed = async () => {
        if (!confirmDeletePhoto) return;
        const targetId = confirmDeletePhoto.id;
        setDeleting(true);
        try {
            const res = await fetch(`/api/admin/photos?id=${targetId}`, {
                method: "DELETE",
            });

            if (res.ok) {
                setPhotos((prev) => {
                    const next = prev.filter((p) => p.id !== targetId);
                    onPendingCountChange?.(next.filter((p) => p.status === "PENDING").length);
                    return next;
                });
                if (selectedPhoto?.id === targetId) setSelectedPhoto(null);
                setConfirmDeletePhoto(null);
                showNativeToast("Photo deleted");
            } else {
                const err = (await res.json().catch(() => ({}))) as { error?: string };
                showNativeToast(err.error || "Failed to delete photo.");
            }
        } catch {
            showNativeToast("Network error deleting photo.");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => setFilter("PENDING")}
                    className={cn(
                        "tap min-h-[40px] rounded-md border px-3 text-xs font-bold",
                        filter === "PENDING"
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-card text-muted-foreground"
                    )}
                >
                    Pending ({pendingCount})
                </button>
                <button
                    type="button"
                    onClick={() => setFilter("ALL")}
                    className={cn(
                        "tap min-h-[40px] rounded-md border px-3 text-xs font-bold",
                        filter === "ALL"
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-card text-muted-foreground"
                    )}
                >
                    Recent All ({photos.length})
                </button>
            </div>

            {visiblePhotos.length === 0 ? (
                <div className="rounded-md border-2 border-dashed border-foreground/40 bg-card p-10 text-center text-muted-foreground">
                    <CameraOff className="w-12 h-12 mx-auto mb-3 opacity-25" aria-hidden="true" />
                    <p className="font-heading text-lg font-extrabold text-foreground">No Photos</p>
                    <p className="text-sm mt-1">
                        {filter === "PENDING" ? "No community photos awaiting review." : "No community photos uploaded yet."}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {visiblePhotos.map((photo) => (
                        <article
                            key={photo.id}
                            className="rounded-md border-2 border-foreground bg-card overflow-hidden shadow-[3px_3px_0_0_hsl(var(--foreground))] flex flex-col"
                        >
                            <button
                                type="button"
                                onClick={() => setSelectedPhoto(photo)}
                                className="relative aspect-video w-full overflow-hidden bg-muted group text-left"
                            >
                                <Image
                                    src={toPreviewSrc(photo.url)}
                                    alt={photo.caption || "Community photo"}
                                    fill
                                    unoptimized
                                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                    className="object-cover"
                                />
                                <span
                                    className={cn(
                                        "absolute top-2.5 right-2.5 rounded-sm border px-2 py-0.5 font-mono text-[10px] font-bold uppercase",
                                        photo.status === "PENDING"
                                            ? "border-foreground bg-secondary text-secondary-foreground"
                                            : "border-status-open bg-card text-status-open"
                                    )}
                                >
                                    {photo.status}
                                </span>
                                <span className="absolute bottom-2.5 right-2.5 rounded-sm bg-black/70 p-1.5 text-white">
                                    <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                                </span>
                            </button>

                            <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                                <div>
                                    <Link
                                        href={`/office/${photo.postOffice.slug}`}
                                        target="_blank"
                                        className="font-heading text-base font-extrabold hover:text-primary inline-flex items-center gap-1"
                                    >
                                        <span>{photo.postOffice.name}</span>
                                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                                    </Link>
                                    <p className="font-mono text-xs text-muted-foreground">
                                        {photo.postOffice.postalCode} · {new Date(photo.createdAt).toLocaleDateString()}
                                    </p>
                                    {photo.caption && (
                                        <p className="text-xs text-foreground/85 mt-2 border-l-2 border-primary/40 pl-2 italic">
                                            &ldquo;{photo.caption}&rdquo;
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    {photo.status === "PENDING" && (
                                        <button
                                            type="button"
                                            disabled={processingId === photo.id}
                                            onClick={() => void handleApprove(photo.id)}
                                            className="tap flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-md border border-status-open bg-status-open/10 px-3 text-xs font-extrabold text-status-open hover:bg-status-open/20 disabled:opacity-50"
                                        >
                                            <Check className="h-4 w-4" aria-hidden="true" />
                                            <span>{processingId === photo.id ? "Approving..." : "Approve"}</span>
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        disabled={processingId === photo.id}
                                        onClick={() => setConfirmDeletePhoto(photo)}
                                        aria-label="Delete photo"
                                        className={cn(
                                            "tap min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 text-xs font-extrabold text-destructive hover:bg-destructive/20",
                                            photo.status !== "PENDING" && "flex-1"
                                        )}
                                    >
                                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                                        <span>Delete</span>
                                    </button>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {/* Photo Preview Bottom Sheet */}
            <Sheet open={!!selectedPhoto} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
                <SheetContent
                    title={selectedPhoto?.postOffice.name || "Community Photo"}
                    description={selectedPhoto ? `${selectedPhoto.postOffice.postalCode} · Uploaded ${new Date(selectedPhoto.createdAt).toLocaleDateString()}` : ""}
                    className="md:w-[680px] md:max-w-[92vw]"
                    footer={
                        selectedPhoto && (
                            <div className="flex flex-col sm:flex-row gap-2">
                                {selectedPhoto.status === "PENDING" && (
                                    <button
                                        type="button"
                                        disabled={processingId === selectedPhoto.id}
                                        onClick={() => void handleApprove(selectedPhoto.id)}
                                        className="tap flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-md border-2 border-foreground bg-status-open text-white px-4 text-sm font-bold disabled:opacity-50"
                                    >
                                        <Check className="h-4 w-4" aria-hidden="true" />
                                        <span>{processingId === selectedPhoto.id ? "Approving..." : "Approve Photo"}</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    disabled={processingId === selectedPhoto.id}
                                    onClick={() => setConfirmDeletePhoto(selectedPhoto)}
                                    className="tap flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-md border-2 border-foreground bg-destructive text-destructive-foreground px-4 text-sm font-bold"
                                >
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                    <span>Delete Photo</span>
                                </button>
                            </div>
                        )
                    }
                >
                    {selectedPhoto && (
                        <div className="space-y-3">
                            <div className="relative w-full aspect-video rounded-md overflow-hidden border border-border bg-black">
                                <Image
                                    src={selectedPhoto.url}
                                    alt={selectedPhoto.caption || "Community photo"}
                                    fill
                                    unoptimized
                                    className="object-contain"
                                />
                            </div>
                            <p className="text-sm text-foreground/90">
                                {selectedPhoto.caption ? `"${selectedPhoto.caption}"` : "No caption provided."}
                            </p>
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            <ConfirmDialog
                open={!!confirmDeletePhoto}
                onOpenChange={(open) => !open && setConfirmDeletePhoto(null)}
                title="Delete Community Photo"
                description="Permanently delete this community photo from the database and Uploadcare storage?"
                confirmLabel="Delete Photo"
                destructive
                loading={deleting}
                onConfirm={handleDeleteConfirmed}
            />
        </div>
    );
}
