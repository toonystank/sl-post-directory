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
            onClick={handleCopy}
            className={cn(
                "p-2 rounded-xl transition-all",
                copied
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
            )}
            aria-label="Copy to clipboard"
        >
            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
        </button>
    );
}
