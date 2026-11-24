"use client";

import { useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import PhotoUpload from "@/components/office/PhotoUpload";

export function PhotoUploadClient({ officeId }: { officeId: string }) {
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [statusError, setStatusError] = useState(false);

    const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    const handleUploadComplete = async (url: string) => {
        setStatusMessage(null);
        setStatusError(false);

        if (turnstileSiteKey && !turnstileToken) {
            setStatusError(true);
            setStatusMessage("Please complete the Captcha before uploading a photo.");
            return;
        }

        try {
            const res = await fetch(`/api/offices/${officeId}/photos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url, caption: "", turnstileToken }),
            });

            if (res.ok) {
                setStatusError(false);
                setStatusMessage("Photo submitted! It will appear once approved by a moderator.");
            } else {
                const data = (await res.json().catch(() => ({}))) as { error?: string };
                setStatusError(true);
                setStatusMessage(data.error || "Failed to save photo submission.");
            }
        } catch (error) {
            console.error("Error saving photo:", error);
            setStatusError(true);
            setStatusMessage("Network error while submitting photo.");
        }
    };

    return (
        <div className="space-y-3">
            {turnstileSiteKey && (
                <div className="flex justify-start">
                    <Turnstile
                        siteKey={turnstileSiteKey}
                        onSuccess={(token) => setTurnstileToken(token)}
                        onExpire={() => setTurnstileToken(null)}
                        onError={() => {
                            setStatusError(true);
                            setStatusMessage("Captcha error. Please refresh and try again.");
                        }}
                    />
                </div>
            )}
            <PhotoUpload officeId={officeId} onUploadComplete={handleUploadComplete} />
            {statusMessage && (
                <p
                    className={`text-xs font-medium ${
                        statusError ? "text-destructive" : "text-status-open"
                    }`}
                >
                    {statusMessage}
                </p>
            )}
        </div>
    );
}
