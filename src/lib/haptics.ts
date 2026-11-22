"use client";

/**
 * Lightweight native-feel haptic feedback helper.
 * Uses Vibration API on Android browsers / TWA without throwing on unsupported platforms (iOS Safari / desktop).
 * Future Play Store / App Store packaging can swap in `@capacitor/haptics` behind this same signature.
 */
export function triggerHaptic(pattern: "light" | "medium" | "success" | "selection" = "light"): void {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
        return;
    }
    try {
        if (pattern === "success") {
            navigator.vibrate([10, 30, 14]);
        } else if (pattern === "medium") {
            navigator.vibrate(14);
        } else if (pattern === "selection") {
            navigator.vibrate(5);
        } else {
            navigator.vibrate(8);
        }
    } catch {
        // Ignore blocked/unsupported vibration calls
    }
}
