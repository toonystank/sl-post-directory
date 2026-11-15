"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Phone, Copy, Check, Navigation, Share2 } from "lucide-react";

interface OfficeActionsProps {
    name: string;
    postalCode: string;
    phone?: string;
    latitude?: number | null;
    longitude?: number | null;
}

export default function OfficeActions({
    name,
    postalCode,
    phone,
    latitude,
    longitude,
}: OfficeActionsProps) {
    const t = useTranslations("Actions");
    const [copiedCode, setCopiedCode] = React.useState(false);
    const [copiedLink, setCopiedLink] = React.useState(false);

    const handleCopyCode = async () => {
        if (!postalCode) return;
        try {
            await navigator.clipboard.writeText(postalCode);
            setCopiedCode(true);
            setTimeout(() => setCopiedCode(false), 2000);
        } catch (err) {
            console.error("Failed to copy postal code:", err);
        }
    };

    const handleShare = async () => {
        const url = typeof window !== "undefined" ? window.location.href : "";
        if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
            try {
                await navigator.share({
                    title: name,
                    text: postalCode ? `${name} — ${postalCode}` : name,
                    url,
                });
                return;
            } catch (err) {
                if ((err as Error)?.name === "AbortError") return;
            }
        }
        try {
            await navigator.clipboard.writeText(url);
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2000);
        } catch (err) {
            console.error("Failed to copy share link:", err);
        }
    };

    const mapsUrl =
        latitude != null && longitude != null
            ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} Post Office Sri Lanka`)}`;

    const badgeClass = "flex h-12 w-12 items-center justify-center rounded-full border-2 border-foreground bg-card";
    const itemClass = "tap flex flex-col items-center gap-1.5 py-1 text-center disabled:opacity-40 disabled:pointer-events-none";

    return (
        <div className="grid grid-cols-4 gap-2 border-b-2 border-foreground py-4">
            {phone ? (
                <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`} className={itemClass}>
                    <span className={badgeClass}>
                        <Phone className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-xs font-semibold">{t("call")}</span>
                </a>
            ) : (
                <button type="button" disabled className={itemClass}>
                    <span className={badgeClass}>
                        <Phone className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-xs font-semibold">{t("call")}</span>
                </button>
            )}

            <button
                type="button"
                onClick={handleCopyCode}
                disabled={!postalCode}
                className={itemClass}
            >
                <span className={copiedCode ? "flex h-12 w-12 items-center justify-center rounded-full border-2 border-foreground bg-secondary text-secondary-foreground" : badgeClass}>
                    {copiedCode ? <Check className="h-5 w-5" aria-hidden="true" /> : <Copy className="h-5 w-5" aria-hidden="true" />}
                </span>
                <span className="text-xs font-semibold">{copiedCode ? t("copied") : t("copy")}</span>
            </button>

            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={itemClass}>
                <span className={badgeClass}>
                    <Navigation className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-xs font-semibold">{t("directions")}</span>
            </a>

            <button type="button" onClick={handleShare} className={itemClass}>
                <span className={copiedLink ? "flex h-12 w-12 items-center justify-center rounded-full border-2 border-foreground bg-secondary text-secondary-foreground" : badgeClass}>
                    {copiedLink ? <Check className="h-5 w-5" aria-hidden="true" /> : <Share2 className="h-5 w-5" aria-hidden="true" />}
                </span>
                <span className="text-xs font-semibold">{copiedLink ? t("linkCopied") : t("share")}</span>
            </button>
        </div>
    );
}
