"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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
            type="button"
            onClick={handleCopy}
            className={cn(
                "tap rounded-md border p-1.5 transition-colors",
                copied
                    ? "border-foreground bg-secondary text-secondary-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground"
            )}
            aria-label="Copy to clipboard"
        >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
    );
}
