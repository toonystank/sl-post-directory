import { cn } from "@/lib/utils";
import type { PostOfficeStatus } from "@/lib/holidays";

const TONE: Record<PostOfficeStatus, string> = {
    open: "bg-status-open",
    "counter-only": "bg-status-closing",
    closed: "bg-status-closed",
    holiday: "bg-status-holiday",
};

const TEXT: Record<PostOfficeStatus, string> = {
    open: "text-status-open",
    "counter-only": "text-status-closing",
    closed: "text-status-closed",
    holiday: "text-status-holiday",
};

interface StatusDotProps {
    status: PostOfficeStatus;
    label: string;
    className?: string;
    /** "plain" = dot + text, "strip" = full-width bar used on office page */
    variant?: "plain" | "strip";
}

/** Flat open/closed indicator — no glow, colour + text so it isn't colour-only. */
export default function StatusDot({ status, label, className, variant = "plain" }: StatusDotProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap",
                TEXT[status],
                variant === "strip" && "text-sm",
                className
            )}
        >
            <span className={cn("inline-block rounded-full", TONE[status], variant === "strip" ? "w-2.5 h-2.5" : "w-2 h-2")} />
            {label}
        </span>
    );
}
