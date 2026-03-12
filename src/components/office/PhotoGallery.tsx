"use client";

import React, { useState } from "react";
import { ImageIcon, Expand, X } from "lucide-react";

interface Photo {
    url: string;
    caption?: string;
}

interface PhotoGalleryProps {
    photos: Photo[];
    officeName?: string;
}

export default function PhotoGallery({ photos, officeName }: PhotoGalleryProps) {
    const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

    if (!photos || photos.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-border/50 p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                    <ImageIcon className="w-7 h-7 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">No community photos yet.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Be the first to upload a photo!</p>
            </div>
        );
    }

    return (
        <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map((photo, idx) => (
                    <button
                        key={idx}
                        onClick={() => setSelectedPhoto(photo)}
                        className="group relative aspect-square rounded-xl overflow-hidden border border-border/30 hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
                    >
                        <img
                            src={`${photo.url}-/preview/400x400/-/quality/smart/`}
                            alt={photo.caption || `${officeName} photo ${idx + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center p-3">
                            <Expand className="w-5 h-5 text-white" />
                        </div>
                    </button>
                ))}
            </div>

            {/* Lightbox Modal */}
            {selectedPhoto && (
                <div
                    className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setSelectedPhoto(null)}
                >
                    <button
                        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-10"
                        onClick={() => setSelectedPhoto(null)}
                    >
                        <X className="w-8 h-8" />
                    </button>
                    <img
                        src={`${selectedPhoto.url}-/preview/1200x900/-/quality/smart/`}
                        alt={selectedPhoto.caption || "Community photo"}
                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
                        onClick={(e) => e.stopPropagation()}
                    />
                    {selectedPhoto.caption && (
                        <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm text-white/80 bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">
                            {selectedPhoto.caption}
                        </p>
                    )}
                </div>
            )}
        </>
    );
}
