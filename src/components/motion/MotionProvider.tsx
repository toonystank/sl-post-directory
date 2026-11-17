"use client";

import * as React from "react";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";

/**
 * Shared LazyMotion + MotionConfig root.
 * Uses `domAnimation` (~60% smaller bundle than full motion features)
 * and enforces OS `prefers-reduced-motion` automatically.
 */
export default function MotionProvider({ children }: { children: React.ReactNode }) {
    return (
        <LazyMotion features={domAnimation}>
            <MotionConfig reducedMotion="user" transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
                {children}
            </MotionConfig>
        </LazyMotion>
    );
}
