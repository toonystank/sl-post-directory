"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    return (
        <Button
            variant="outline"
            size="icon"
            className="border-2 border-foreground rounded-full size-8 overflow-hidden relative"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
            <Sun className="h-4 w-4 transition-all duration-300 rotate-0 scale-100 dark:-rotate-180 dark:scale-0" />
            <Moon className="absolute h-4 w-4 transition-all duration-300 rotate-180 scale-0 dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
        </Button>
    );
}
