"use client";

import { useState } from "react";
import { Image as ImageIcon, Trash2, CameraOff, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface PhotoModerationProps {
    photos: Array<{
        id: string;
        url: string;
        caption: string | null;
        createdAt: Date;
        postOfficeId: string;
        postOffice: {
            name: string;
            postalCode: string;
        };
    }>;
}

export default function PhotoModeration({ photos: initialPhotos }: PhotoModerationProps) {
    const [photos, setPhotos] = useState(initialPhotos);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const router = useRouter();

    const handleDelete = async (photoId: string) => {
        if (!confirm("Are you sure you want to permanently delete this photo?")) return;

        setProcessingId(photoId);
        try {
            const res = await fetch(`/api/admin/photos?id=${photoId}`, {
                method: "DELETE",
            });

            if (res.ok) {
                // Remove from local state to immediately update UI
                setPhotos(prev => prev.filter(p => p.id !== photoId));
                // Inform next/navigation to re-fetch the server component state
                router.refresh();
            } else {
                const err = await res.json();
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
                            <div key={photo.id} className="group relative rounded-xl border border-border/50 overflow-hidden bg-background/50 flex flex-col hover:border-primary/40 transition-all shadow-sm hover:shadow-md">
                                <div className="aspect-video relative overflow-hidden bg-muted">
                                    <img 
                                        src={`${photo.url}-/preview/600x400/-/quality/smart/`} 
                                        alt={photo.caption || "Community photo"}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                    <button
                                        className="absolute top-3 right-3 p-2 bg-destructive/90 hover:bg-destructive text-destructive-foreground rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-105 disabled:opacity-50 flex items-center gap-2 text-xs font-medium backdrop-blur-sm"
                                        title="Delete Photo"
                                        disabled={processingId === photo.id}
                                        onClick={() => handleDelete(photo.id)}
                                    >
                                        <Trash2 className="w-4 h-4" /> 
                                        {processingId === photo.id ? "Deleting..." : "Delete"}
                                    </button>
                                </div>
                                <div className="p-4 flex-1 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div>
                                                <Link href={`/office/${photo.postOfficeId}`} target="_blank" className="font-semibold text-sm hover:text-primary transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-sm">
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
                                                "{photo.caption}"
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
        </Card>
    );
}
