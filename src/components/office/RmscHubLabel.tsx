"use client";

import { ArrowRight } from "lucide-react";
import { Link } from "@/navigation";
import { useStaffStation } from "@/context/StaffStationContext";

interface RmscHubLabelProps {
    rmsc: string;
    variant: "detail" | "chain";
}

/**
 * Displays the RMSC/TPO sorting hub on an office page as clean text for public users,
 * and upgrades to a direct Mail Routing Hub (Beta) link only for opted-in users.
 */
export default function RmscHubLabel({ rmsc, variant }: RmscHubLabelProps) {
    const { mailRoutingEnabled } = useStaffStation();

    if (variant === "detail") {
        if (!mailRoutingEnabled) {
            return <span className="font-mono text-sm font-semibold text-foreground">{rmsc}</span>;
        }
        return (
            <Link
                href={`/routing?tab=hubs&hub=${encodeURIComponent(rmsc)}`}
                className="inline-flex items-center gap-1.5 font-mono text-sm font-semibold text-primary hover:underline"
            >
                <span>{rmsc}</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
        );
    }

    if (!mailRoutingEnabled) {
        return (
            <span className="rounded border border-primary/40 bg-primary/10 px-2 py-1 font-mono text-xs font-bold text-primary">
                {rmsc}
            </span>
        );
    }

    return (
        <Link
            href={`/routing?tab=hubs&hub=${encodeURIComponent(rmsc)}`}
            className="rounded border border-primary/40 bg-primary/10 px-2 py-1 font-mono text-xs font-bold text-primary hover:bg-primary/20"
        >
            {rmsc}
        </Link>
    );
}
