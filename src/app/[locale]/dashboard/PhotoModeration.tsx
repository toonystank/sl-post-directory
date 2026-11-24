"use client";

import { useState } from "react";
import Image from "next/image";
import { Image as ImageIcon, Trash2, CameraOff, ExternalLink, Maximize2, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface PhotoModerationItem {
    id: string;
    url: string;
    caption: string | null;
    status: string;
    createdAt: Date;
    postOfficeId: string;
    postOffice: {
        name: string;
        postalCode: string;
        slug: string;
    };
}

interface PhotoModerationProps {
    photos: PhotoModerationItem[];
}

function toPreviewSrc(rawUrl: string): string {
    const trimmed = rawUrl.trim();
    const base = trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
    return `${base}-/preview/600x400/-/quality/smart/`;
}

export default function PhotoModeration({ photos: initialPhotos }: PhotoModerationProps) {
    const [photos, setPhotos] = useState(initialPhotos);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [selectedPhoto, setSelectedPhoto] = useState<PhotoModerationItem | null>(null);
    const router = useRouter();

    const pendingCount = photos.filter((p) => p.status === "PENDING").length;

    const handleApprove = async (photoId: string) => {
        setProcessingId(photoId);
        try {
            const res = await fetch("/api/admin/photos", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: photoId }),
            });

            if (res.ok) {
                setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, status: "APPROVED" } : p)));
                setSelectedPhoto((prev) => (prev && prev.id === photoId ? { ...prev, status: "APPROVED" } : prev));
                router.refresh();
            } else {
                const err = (await res.json().catch(() => ({}))) as { error?: string };
                alert(`Error: ${err.error || "Failed to approve photo."}`);
            }
        } catch (error) {
            console.error("Approval failed:", error);
            alert("A network error occurred.");
        } finally {
            setProcessingId(null);
        }
    };

    const handleDelete = async (photoId: string) => {
        if (!confirm("Are you sure you want to permanently delete this photo?")) return;

        setProcessingId(photoId);
        try {
            const res = await fetch(`/api/admin/photos?id=${photoId}`, {
                method: "DELETE",
            });

            if (res.ok) {
                setPhotos((prev) => prev.filter((p) => p.id !== photoId));
                if (selectedPhoto?.id === photoId) setSelectedPhoto(null);
                router.refresh();
            } else {
                const err = (await res.json().catch(() => ({}))) as { error?: string };
                alert(`Error: ${err.error || "Failed to delete photo."}`);
            }
        } catch (error) {
            console.error("Deletion failed:", error);
            alert("A network error occurred.");
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <Card className="border-border/50 overflow-hidden">
            <CardHeader className="border-b border-border/40 bg-card/80 flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                    Community Photos
                    <Badge variant="secondary" className="ml-2 rounded-full px-2 h-5 text-xs flex items-center justify-center">
                        {photos.length}
                    </Badge>
                    {pendingCount > 0 && (
                        <Badge className="ml-1 rounded-full px-2 h-5 text-xs bg-amber-500 text-white">
                            {pendingCount} Pending
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                {photos.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                        <CameraOff className="w-16 h-16 mx-auto mb-4 opacity-15" />
                        <p className="text-lg font-medium mb-1">No Photos</p>
                        <p className="text-sm">There are no community photos uploaded yet.</p>
                    </div>
                ) : (
                    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[600px] overflow-y-auto">
                        {photos.map((photo) => (
                            <div
                                key={photo.id}
                                className="group relative rounded-xl border border-border/50 overflow-hidden bg-background/50 flex flex-col hover:border-primary/40 transition-all shadow-sm hover:shadow-md cursor-pointer"
                                onClick={() => setSelectedPhoto(photo)}
                            >
                                <div className="aspect-video relative overflow-hidden bg-muted">
                                    <Image
                                        src={toPreviewSrc(photo.url)}
                                        alt={photo.caption || "Community photo"}
                                        fill
                                        unoptimized={true}
                                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                    <div className="absolute top-2.5 right-2.5 z-10">
                                        <Badge
                                            variant={photo.status === "PENDING" ? "default" : "secondary"}
                                            className={
                                                photo.status === "PENDING"
                                                    ? "bg-amber-500 text-white text-[10px]"
                                                    : "text-[10px]"
                                            }
                                        >
                                            {photo.status}
                                        </Badge>
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <div className="p-3 bg-black/50 backdrop-blur-sm rounded-full text-white">
                                            <Maximize2 className="w-6 h-6" />
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 flex-1 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div>
                                                <Link
                                                    href={`/office/${photo.postOffice.slug}`}
                                                    target="_blank"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="font-semibold text-sm hover:text-primary transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-sm"
                                                >
                                                    {photo.postOffice.name}
                                                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                                                </Link>
                                                <div className="text-xs text-muted-foreground font-mono mt-0.5">
                                                    {photo.postOffice.postalCode}
                                                </div>
                                            </div>
                                        </div>
                                        {photo.caption && (
                                            <p className="text-sm text-foreground/80 mt-2 line-clamp-2 italic border-l-2 border-primary/30 pl-2">
                                                &ldquo;{photo.caption}&rdquo;
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground mt-4 font-medium uppercase tracking-wider flex items-center gap-1.5">
                                        <ImageIcon className="w-3.5 h-3.5" />
                                        Uploaded {new Date(photo.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>

            <Dialog open={!!selectedPhoto} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
                <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-[90vw] lg:max-w-[80vw] p-0 overflow-hidden bg-black/95 border-border/50">
                    <DialogHeader className="p-4 absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent flex flex-row items-start justify-between">
                        <div className="text-left text-white drop-shadow-md">
                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                {selectedPhoto?.postOffice.name}
                            </DialogTitle>
                            <DialogDescription className="text-gray-300 mt-1">
                                {selectedPhoto?.postOffice.postalCode} • Uploaded{" "}
                                {selectedPhoto ? new Date(selectedPhoto.createdAt).toLocaleDateString() : ""}
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <div className="relative w-full h-[70vh] flex items-center justify-center">
                        {selectedPhoto && (
                            <Image
                                src={selectedPhoto.url}
                                alt={selectedPhoto.caption || "Community photo"}
                                fill
                                unoptimized={true}
                                className="object-contain"
                            />
                        )}
                    </div>

                    <div className="p-6 bg-card border-t border-border/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex-1">
                            {selectedPhoto?.caption ? (
                                <p className="text-sm text-foreground/90 italic">
                                    &ldquo;{selectedPhoto.caption}&rdquo;
                                </p>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">No caption provided.</p>
                            )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
                            {selectedPhoto?.status === "PENDING" && (
                                <button
                                    type="button"
                                    className="w-full md:w-auto px-6 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-bold"
                                    disabled={processingId === selectedPhoto.id}
                                    onClick={() => handleApprove(selectedPhoto.id)}
                                >
                                    <Check className="w-4 h-4" />
                                    {processingId === selectedPhoto.id ? "Approving..." : "Approve Photo"}
                                </button>
                            )}
                            <button
                                type="button"
                                className="w-full md:w-auto px-6 py-2.5 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-bold shadow-lg shadow-destructive/20"
                                disabled={processingId === selectedPhoto?.id}
                                onClick={() => selectedPhoto && handleDelete(selectedPhoto.id)}
                            >
                                <Trash2 className="w-4 h-4" />
                                {processingId === selectedPhoto?.id ? "Deleting..." : "Delete Photo"}
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
