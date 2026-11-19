"use client";

/**
 * Lightweight native-feel haptic feedback helper.
 * Uses Vibration API on Android browsers / TWA without throwing on unsupported platforms (iOS Safari / desktop).
 */
export function triggerHaptic(pattern: "light" | "medium" | "success" = "light"): void {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
        return;
    }
    try {
        if (pattern === "success") {
            navigator.vibrate([10, 30, 14]);
        } else if (pattern === "medium") {
            navigator.vibrate(14);
        } else {
            navigator.vibrate(8);
        }
    } catch {
        // Ignore blocked/unsupported vibration calls
    }
}
