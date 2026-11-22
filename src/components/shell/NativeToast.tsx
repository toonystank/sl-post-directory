"use client";

import * as React from "react";

interface ToastEventDetail {
    message: string;
    durationMs?: number;
}

const TOAST_EVENT = "lpd:toast";

/** Trigger a native-style floating confirmation pill above the mobile bottom tab bar. */
export function showNativeToast(message: string, durationMs?: number): void {
    if (typeof window === "undefined" || !message.trim()) return;
    window.dispatchEvent(
        new CustomEvent<ToastEventDetail>(TOAST_EVENT, {
            detail: { message, durationMs },
        })
    );
}

export default function NativeToast() {
    const [message, setMessage] = React.useState<string | null>(null);
    const timerRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        if (typeof window === "undefined") return;

        const handleToast = (ev: Event) => {
            const customEv = ev as CustomEvent<ToastEventDetail>;
            const nextMessage = customEv.detail?.message?.trim();
            if (!nextMessage) return;

            setMessage(nextMessage);
            if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current);
            }
            const duration = customEv.detail?.durationMs ?? 2200;
            timerRef.current = window.setTimeout(() => {
                setMessage(null);
                timerRef.current = null;
            }, duration);
        };

        window.addEventListener(TOAST_EVENT, handleToast);
        return () => {
            window.removeEventListener(TOAST_EVENT, handleToast);
            if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current);
            }
        };
    }, []);

    if (!message) return null;

    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed inset-x-4 bottom-tabbar mb-3 z-[85] pointer-events-none flex justify-center"
        >
            <div className="rounded-full bg-foreground text-background px-4 py-2 text-xs font-bold shadow-[var(--shadow-elev-2)] animate-in fade-in-0 slide-in-from-bottom-2 duration-150">
                {message}
            </div>
        </div>
    );
}
