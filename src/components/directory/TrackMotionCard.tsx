"use client";

import * as React from "react";
import { m } from "motion/react";

export default function TrackMotionCard({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <m.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className={className}
        >
            {children}
        </m.div>
    );
}
