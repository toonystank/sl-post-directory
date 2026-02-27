"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";
import { PackageSearch, LayoutDashboard, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

export default function Navbar() {
    const pathname = usePathname();

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 group">
                    <div className="bg-primary/10 p-2 rounded-xl text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <PackageSearch className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-lg tracking-tight hidden sm:inline-block">
                        SL Post <span className="text-primary">Directory</span>
                    </span>
                </Link>

                <nav className="flex items-center gap-6 text-sm font-medium">
                    <Link
                        href="/"
                        className={cn(
                            "transition-colors hover:text-foreground/80 flex items-center gap-2",
                            pathname === "/" ? "text-foreground" : "text-foreground/60"
                        )}
                    >
                        <Building2 className="w-4 h-4 hidden sm:block" /> Directory
                    </Link>
                    <Link
                        href="/dashboard"
                        className={cn(
                            "transition-colors hover:text-foreground/80 flex items-center gap-2",
                            pathname === "/dashboard" ? "text-foreground" : "text-foreground/60"
                        )}
                    >
                        <LayoutDashboard className="w-4 h-4 hidden sm:block" /> Dashboard
                    </Link>
                </nav>

                <div className="flex items-center gap-3">
                    <ThemeToggle />
                    <Button asChild variant="default" size="sm" className="hidden sm:inline-flex rounded-full">
                        <Link href="/login">Employee Login</Link>
                    </Button>
                </div>
            </div>
        </header>
    );
}
