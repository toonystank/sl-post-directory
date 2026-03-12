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
            className="rounded-full overflow-hidden"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
            <Sun className="h-[1.2rem] w-[1.2rem] transition-all duration-500 ease-in-out rotate-0 scale-100 dark:-rotate-180 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] transition-all duration-500 ease-in-out rotate-180 scale-0 dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
        </Button>
    );
}
