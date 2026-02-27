"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy text: ", err);
        }
    };

    return (
        <button
            onClick={handleCopy}
            className={`p-2 rounded-xl transition-all ${copied
                    ? "bg-[var(--success)]/10 text-[var(--success)]"
                    : "bg-[var(--surface-border)] text-[var(--text-muted)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]"
                }`}
            aria-label="Copy to clipboard"
        >
            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
        </button>
    );
}
