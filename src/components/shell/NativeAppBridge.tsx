"use client";

import * as React from "react";
import { useTheme } from "next-themes";

const LIGHT_THEME_COLOR = "#FBF7EF";
const DARK_THEME_COLOR = "#14110E";

function isEditableElement(el: Element | null): boolean {
    if (!el || !(el instanceof HTMLElement)) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/**
 * Web/PWA native-feel bridge:
 * - Keeps `<meta name="theme-color">` synchronized with the active Day Post / Night Mail theme.
 * - Tracks mobile soft-keyboard visibility via `visualViewport` to tuck away `[data-mobile-tabbar]` while typing.
 * (Adapter boundary ready for future Capacitor `@capacitor/status-bar` & `@capacitor/keyboard` plugins.)
 */
export default function NativeAppBridge() {
    const { resolvedTheme } = useTheme();
    const baseHeightRef = React.useRef<number>(0);

    React.useEffect(() => {
        if (typeof document === "undefined") return;
        const color = resolvedTheme === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;
        let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-lpd-dynamic="true"]');
        if (!meta) {
            meta = document.createElement("meta");
            meta.name = "theme-color";
            meta.setAttribute("data-lpd-dynamic", "true");
            document.head.appendChild(meta);
        }
        meta.content = color;
    }, [resolvedTheme]);

    React.useEffect(() => {
        if (typeof window === "undefined" || typeof document === "undefined") return;
        const vv = window.visualViewport;
        if (!vv) return;

        baseHeightRef.current = Math.max(window.innerHeight, vv.height);

        const setTabbarKeyboardOpen = (open: boolean) => {
            const tabbar = document.querySelector<HTMLElement>("[data-mobile-tabbar]");
            if (!tabbar) return;
            if (open) {
                if (tabbar.dataset.keyboardOpen !== "true") {
                    tabbar.dataset.keyboardOpen = "true";
                }
            } else if ("keyboardOpen" in tabbar.dataset) {
                delete tabbar.dataset.keyboardOpen;
            }
        };

        const syncKeyboardState = () => {
            if (window.innerWidth >= 768) {
                setTabbarKeyboardOpen(false);
                return;
            }
            const focusedEditable = isEditableElement(document.activeElement);
            if (!focusedEditable) {
                baseHeightRef.current = Math.max(window.innerHeight, vv.height);
                setTabbarKeyboardOpen(false);
                return;
            }
            const baseline = Math.max(window.innerHeight, baseHeightRef.current);
            setTabbarKeyboardOpen(baseline - vv.height > 140);
        };

        const handleOrientationChange = () => {
            window.setTimeout(() => {
                baseHeightRef.current = Math.max(window.innerHeight, vv.height);
                syncKeyboardState();
            }, 120);
        };

        vv.addEventListener("resize", syncKeyboardState);
        document.addEventListener("focusin", syncKeyboardState);
        document.addEventListener("focusout", syncKeyboardState);
        window.addEventListener("orientationchange", handleOrientationChange);

        return () => {
            vv.removeEventListener("resize", syncKeyboardState);
            document.removeEventListener("focusin", syncKeyboardState);
            document.removeEventListener("focusout", syncKeyboardState);
            window.removeEventListener("orientationchange", handleOrientationChange);
            setTabbarKeyboardOpen(false);
        };
    }, []);

    return null;
}
