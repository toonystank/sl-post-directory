"use client";

import React, { useRef, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Camera, X, CheckCircle, Loader2 } from "lucide-react";

interface PhotoUploadProps {
    officeId: string;
    turnstileToken?: string | null;
    disabled?: boolean;
    onUploadComplete?: (url: string, uploadTicket?: string) => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_UPLOAD_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export default function PhotoUpload({
    officeId,
    turnstileToken,
    disabled = false,
    onUploadComplete,
}: PhotoUploadProps) {
    const t = useTranslations("Photos");
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const uploadFile = useCallback(async (file: File) => {
        if (disabled) {
            setError("Please complete the Captcha before uploading a photo.");
            return;
        }
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
                body: JSON.stringify({
                    scope: "community",
                    officeId,
                    turnstileToken: turnstileToken ?? null,
                }),
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
                uploadTicket?: string;
            };

            const formData = new FormData();
            formData.append("UPLOADCARE_PUB_KEY", signData.publicKey);
            formData.append("UPLOADCARE_STORE", signData.store || "1");
            if (signData.signature && signData.expire) {
                formData.append("signature", signData.signature);
                formData.append("expire", String(signData.expire));
            }
            formData.append("file", file);
            formData.append("metadata[officeId]", officeId);

            const response = await fetch("https://upload.uploadcare.com/base/", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) throw new Error("Upload failed");

            const data = (await response.json()) as { file?: string };
            if (!data.file) throw new Error("Upload failed");
            const cdnBase = signData.cdnBase.replace(/\/+$/, "");
            const cdnUrl = `${cdnBase}/${data.file}/`;
            setUploadedUrl(cdnUrl);
            onUploadComplete?.(cdnUrl, signData.uploadTicket);
        } catch (err) {
            setError(err instanceof Error && err.message ? err.message : "Upload failed. Please try again.");
        } finally {
            setIsUploading(false);
        }
    }, [disabled, officeId, onUploadComplete, turnstileToken]);

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
            <div className="relative rounded-md overflow-hidden border border-status-open/40 bg-status-open/10 p-4">
                <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-status-open shrink-0" />
                    <p className="text-sm text-status-open font-medium">{t("uploadSuccess")}</p>
                    <button
                        onClick={() => { setUploadedUrl(null); setError(null); }}
                        className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="relative w-full h-48 mt-3">
                    <Image
                        src={`${uploadedUrl}-/preview/400x300/-/quality/smart/`}
                        alt="Uploaded"
                        fill
                        className="object-cover rounded-md"
                    />
                </div>
            </div>
        );
    }

    return (
        <div>
            <div
                onDragOver={(e) => { if (!disabled) { e.preventDefault(); setIsDragging(true); } }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => !disabled && fileInputRef.current?.click()}
                className={`relative rounded-md border-2 border-dashed p-8 text-center transition-colors ${
                    disabled
                        ? "border-border bg-muted/40 opacity-60 cursor-not-allowed"
                        : isDragging
                          ? "border-foreground bg-secondary/20 cursor-pointer"
                          : "border-border bg-card hover:border-foreground/50 cursor-pointer"
                }`}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={disabled}
                    className="hidden"
                    onChange={handleFileChange}
                />

                {isUploading ? (
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-10 h-10 text-primary animate-spin" />
                        <p className="text-sm text-muted-foreground">{t("uploading")}</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center text-foreground">
                            <Camera className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium">{t("dropOrClick")}</p>
                            <p className="text-xs text-muted-foreground mt-1">{t("fileLimits")}</p>
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
