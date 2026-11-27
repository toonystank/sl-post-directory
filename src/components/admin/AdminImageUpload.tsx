"use client";

import React, { useRef, useState, useCallback } from "react";
import Image from "next/image";
import { Upload, X, Loader2, RefreshCw, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isUploadcareImageUrl, normalizeUploadcareImageUrl } from "@/lib/security";

interface AdminImageUploadProps {
    value: string | null;
    onChange: (url: string | null) => void;
    label?: string;
    aspect?: "16:9" | "4:3";
    metadataTag?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_UPLOAD_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export default function AdminImageUpload({
    value,
    onChange,
    label = "Upload Cover Photo",
    aspect = "16:9",
    metadataTag = "news",
}: AdminImageUploadProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [manualUrl, setManualUrl] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const uploadFile = useCallback(
        async (file: File) => {
            if (file.size > MAX_FILE_SIZE) {
                setError("File is too large. Maximum size is 5MB.");
                return;
            }
            if (!ALLOWED_UPLOAD_MIME_TYPES.has(file.type)) {
                setError("Only JPEG, PNG, and WebP images are allowed.");
                return;
            }

            setIsUploading(true);
            setError(null);

            try {
                const signRes = await fetch("/api/uploadcare/sign", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ scope: "admin" }),
                });

                if (!signRes.ok) {
                    const signErr = (await signRes.json().catch(() => ({}))) as { error?: string };
                    throw new Error(signErr.error || "Unable to authorize upload");
                }

                const signData = (await signRes.json()) as {
                    publicKey: string;
                    cdnBase: string;
                    store?: string;
                    signature?: string;
                    expire?: number;
                };

                const formData = new FormData();
                formData.append("UPLOADCARE_PUB_KEY", signData.publicKey);
                formData.append("UPLOADCARE_STORE", signData.store || "1");
                if (signData.signature && signData.expire) {
                    formData.append("signature", signData.signature);
                    formData.append("expire", String(signData.expire));
                }
                formData.append("file", file);
                formData.append("metadata[source]", metadataTag);

                const response = await fetch("https://upload.uploadcare.com/base/", {
                    method: "POST",
                    body: formData,
                });

                if (!response.ok) throw new Error("Upload failed");

                const data = (await response.json()) as { file?: string };
                if (!data.file) throw new Error("Missing file ID");
                const cdnBase = signData.cdnBase.replace(/\/+$/, "");
                const cdnUrl = normalizeUploadcareImageUrl(`${cdnBase}/${data.file}/`);
                onChange(cdnUrl);
            } catch (err) {
                setError(err instanceof Error && err.message ? err.message : "Upload failed. Please try again.");
            } finally {
                setIsUploading(false);
            }
        },
        [metadataTag, onChange]
    );

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) void uploadFile(file);
        },
        [uploadFile]
    );

    const handleManualApply = () => {
        const trimmed = manualUrl.trim();
        if (!trimmed) return;
        if (!isUploadcareImageUrl(trimmed)) {
            setError("Paste a valid Uploadcare image URL (https://ucarecdn.com/<uuid>/ or https://3q5fhu0dw8.ucarecd.net/<uuid>/).");
            return;
        }
        setError(null);
        onChange(normalizeUploadcareImageUrl(trimmed));
        setManualUrl("");
    };

    const previewTransform = aspect === "16:9" ? "-/preview/1200x675/-/quality/smart/" : "-/preview/1000x750/-/quality/smart/";

    return (
        <div className="space-y-2">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadFile(file);
                    e.target.value = "";
                }}
            />

            {value ? (
                <div className="rounded-md border-2 border-foreground bg-card overflow-hidden">
                    <div className={cn("relative w-full bg-muted", aspect === "16:9" ? "aspect-video" : "aspect-[4/3]")}>
                        <Image
                            src={`${value.endsWith("/") ? value : `${value}/`}${previewTransform}`}
                            alt={label}
                            fill
                            unoptimized
                            className="object-cover"
                        />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-3 py-2">
                        <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[200px] sm:max-w-xs">
                            Uploadcare CDN
                        </span>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                disabled={isUploading}
                                onClick={() => fileInputRef.current?.click()}
                                className="tap inline-flex min-h-[44px] items-center gap-1.5 rounded-sm border border-border bg-background px-3 text-xs font-bold hover:border-foreground"
                            >
                                {isUploading ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                ) : (
                                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                                )}
                                <span>Replace</span>
                            </button>
                            <button
                                type="button"
                                disabled={isUploading}
                                onClick={() => onChange(null)}
                                aria-label="Remove image"
                                className="tap inline-flex min-h-[44px] items-center gap-1 rounded-sm border border-destructive/40 bg-destructive/10 px-3 text-xs font-bold text-destructive hover:bg-destructive/20"
                            >
                                <X className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Remove</span>
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-2">
                    <button
                        type="button"
                        onDragOver={(e) => {
                            e.preventDefault();
                            setIsDragging(true);
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className={cn(
                            "tap w-full rounded-md border-2 border-dashed p-5 text-center transition-colors",
                            isDragging
                                ? "border-foreground bg-secondary/20"
                                : "border-border bg-background hover:border-foreground/60"
                        )}
                    >
                        {isUploading ? (
                            <div className="flex flex-col items-center gap-2 py-2">
                                <Loader2 className="h-7 w-7 text-primary animate-spin" aria-hidden="true" />
                                <p className="text-sm font-semibold text-foreground">Uploading to Uploadcare...</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2 py-1">
                                <span className="flex h-10 w-10 items-center justify-center rounded-sm border border-border bg-card text-foreground">
                                    <ImageIcon className="h-5 w-5" aria-hidden="true" />
                                </span>
                                <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                                    <Upload className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                                    {label}
                                </span>
                                <span className="font-mono text-[11px] text-muted-foreground">
                                    JPG / PNG / WebP · max 5MB · auto-optimized {aspect}
                                </span>
                            </div>
                        )}
                    </button>

                    <div className="flex gap-2">
                        <input
                            type="url"
                            value={manualUrl}
                            onChange={(e) => setManualUrl(e.target.value)}
                            placeholder="Or paste https://3q5fhu0dw8.ucarecd.net/<uuid>/"
                            className="h-11 flex-1 rounded-md border border-input bg-background px-3 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        <button
                            type="button"
                            onClick={handleManualApply}
                            className="tap min-h-[44px] rounded-md border border-foreground bg-card px-3 text-xs font-bold hover:bg-muted"
                        >
                            Use URL
                        </button>
                    </div>
                </div>
            )}

            {error && (
                <p role="alert" className="text-xs font-semibold text-destructive">
                    {error}
                </p>
            )}
        </div>
    );
}
