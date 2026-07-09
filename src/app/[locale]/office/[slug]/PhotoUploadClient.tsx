"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import PhotoUpload from "@/components/office/PhotoUpload";

export function PhotoUploadClient({ officeId }: { officeId: string }) {
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);

    const handleUploadComplete = async (url: string) => {
        setIsSaving(true);
        try {
            const res = await fetch(`/api/offices/${officeId}/photos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url, caption: "" })
            });
            
            if (res.ok) {
                // Refresh the page to show the new photo
                router.refresh();
            } else {
                console.error("Failed to save photo record");
                // The upload to uploadcare succeeded, but saving to DB failed.
            }
        } catch (error) {
            console.error("Error saving photo:", error);
        } finally {
            setIsSaving(false);
        }
    };

    return <PhotoUpload officeId={officeId} onUploadComplete={handleUploadComplete} />;
}
