"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Camera, Upload, X, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PhotoUploadProps {
    officeId: string;
    onUploadComplete?: (url: string) => void;
}

const UPLOADCARE_PUBLIC_KEY = process.env.NEXT_PUBLIC_UPLOADCARE_PUB_KEY || "16423b7c9e1a87e5884e";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function PhotoUpload({ officeId, onUploadComplete }: PhotoUploadProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const uploadFile = useCallback(async (file: File) => {
        if (file.size > MAX_FILE_SIZE) {
            setError("File is too large. Maximum size is 5MB.");
            return;
        }

        if (!file.type.startsWith("image/")) {
            setError("Only image files are allowed.");
            return;
        }

        setIsUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append("UPLOADCARE_PUB_KEY", UPLOADCARE_PUBLIC_KEY);
            formData.append("UPLOADCARE_STORE", "1");
            formData.append("file", file);
            formData.append("metadata[officeId]", officeId);

            const response = await fetch("https://upload.uploadcare.com/base/", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) throw new Error("Upload failed");

            const data = await response.json();
            const cdnUrl = `https://ucarecdn.com/${data.file}/`;
            setUploadedUrl(cdnUrl);
            onUploadComplete?.(cdnUrl);
        } catch {
            setError("Upload failed. Please try again.");
        } finally {
            setIsUploading(false);
        }
    }, [officeId, onUploadComplete]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) uploadFile(file);
    }, [uploadFile]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) uploadFile(file);
    };

    if (uploadedUrl) {
        return (
            <div className="relative rounded-2xl overflow-hidden border border-emerald-500/30 bg-emerald-500/5 p-4">
                <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                    <p className="text-sm text-emerald-400 font-medium">Photo uploaded successfully!</p>
                    <button
                        onClick={() => { setUploadedUrl(null); setError(null); }}
                        className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="relative w-full h-48 mt-3">
                    <Image
                        src={`${uploadedUrl}-/preview/400x300/`}
                        alt="Uploaded"
                        fill
                        className="object-cover rounded-xl"
                    />
                </div>
            </div>
        );
    }

    return (
        <div>
            <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-300 ${
                    isDragging
                        ? "border-primary bg-primary/10 scale-[1.02]"
                        : "border-border/50 hover:border-primary/50 hover:bg-card/50"
                }`}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                />

                {isUploading ? (
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-10 h-10 text-primary animate-spin" />
                        <p className="text-sm text-muted-foreground">Uploading photo...</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                            <Camera className="w-7 h-7" />
                        </div>
                        <div>
                            <p className="text-sm font-medium">Drop a photo or click to upload</p>
                            <p className="text-xs text-muted-foreground mt-1">JPG, PNG up to 5MB</p>
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <p className="text-sm text-destructive mt-2 flex items-center gap-1.5">
                    <X className="w-3.5 h-3.5" /> {error}
                </p>
            )}
        </div>
    );
}
