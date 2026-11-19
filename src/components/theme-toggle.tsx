"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const isDark = mounted && resolvedTheme === "dark";

    const handleToggle = () => {
        const target = resolvedTheme === "dark" ? "light" : "dark";
        const systemScheme =
            typeof window !== "undefined" &&
            window.matchMedia("(prefers-color-scheme: dark)").matches
                ? "dark"
                : "light";
        // If the target scheme matches the current OS preference, revert to "system"
        // so future OS schedule transitions aren't invisibly pinned.
        setTheme(target === systemScheme ? "system" : target);
    };

    return (
        <Button
            type="button"
            variant="outline"
            size="icon"
            data-testid="theme-toggle"
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            title={isDark ? "Switch to light theme" : "Switch to dark theme"}
            className="border-2 border-foreground bg-card hover:bg-secondary/35 rounded-full size-7 sm:size-8 overflow-hidden relative shrink-0 shadow-[0_1px_0_0_hsl(var(--foreground))]"
            onClick={handleToggle}
        >
            <Sun className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-foreground transition-all duration-300 rotate-0 scale-100 dark:-rotate-180 dark:scale-0" />
            <Moon className="absolute h-3.5 w-3.5 sm:h-4 sm:w-4 text-secondary transition-all duration-300 rotate-180 scale-0 dark:rotate-0 dark:scale-100" />
            <span className="sr-only">
                {isDark ? "Switch to light theme" : "Switch to dark theme"}
            </span>
        </Button>
    );
}
