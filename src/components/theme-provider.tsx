"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";

function StatusBarThemeSync() {
    const { theme, resolvedTheme } = useTheme();

    React.useEffect(() => {
        const color = resolvedTheme === "dark" ? "#14110E" : "#FBF7EF";
        const schemeContent =
            theme === "dark" ? "dark" : theme === "light" ? "light" : "light dark";

        let schemeMeta = document.querySelector('meta[name="color-scheme"]') as HTMLMetaElement | null;
        if (!schemeMeta) {
            schemeMeta = document.createElement("meta");
            schemeMeta.name = "color-scheme";
            document.head.appendChild(schemeMeta);
        }
        schemeMeta.content = schemeContent;

        const metas = document.querySelectorAll('meta[name="theme-color"]');
        if (metas.length === 0) {
            const meta = document.createElement("meta");
            meta.name = "theme-color";
            meta.content = color;
            document.head.appendChild(meta);
            return;
        }
        metas.forEach((el) => {
            if (!el.getAttribute("media")) {
                el.setAttribute("content", color);
            }
        });
        // Ensure a non-media theme-color meta exists so Android Chrome / TWA respects manual toggle
        const dynamicMeta = document.querySelector('meta[name="theme-color"][data-dynamic="1"]');
        if (dynamicMeta) {
            dynamicMeta.setAttribute("content", color);
        } else {
            const meta = document.createElement("meta");
            meta.name = "theme-color";
            meta.setAttribute("data-dynamic", "1");
            meta.content = color;
            document.head.appendChild(meta);
        }
    }, [theme, resolvedTheme]);

    return null;
}

export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
    return (
        <NextThemesProvider {...props}>
            <StatusBarThemeSync />
            {children}
        </NextThemesProvider>
    );
}
