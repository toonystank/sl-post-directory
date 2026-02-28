"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { ThemeToggle } from "./theme-toggle";
import { PackageSearch, LayoutDashboard, Building2, LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

export default function Navbar() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const user = session?.user as { name?: string | null; role?: string } | undefined;
    const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.role === "MODERATOR";

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
                    {isAdmin && (
                        <Link
                            href="/dashboard"
                            className={cn(
                                "transition-colors hover:text-foreground/80 flex items-center gap-2",
                                pathname?.startsWith("/dashboard") ? "text-foreground" : "text-foreground/60"
                            )}
                        >
                            <LayoutDashboard className="w-4 h-4 hidden sm:block" /> Dashboard
                        </Link>
                    )}
                </nav>

                <div className="flex items-center gap-3">
                    <ThemeToggle />
                    {session ? (
                        <div className="flex items-center gap-2">
                            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                                    {user?.name?.charAt(0)?.toUpperCase() || <User className="w-3.5 h-3.5" />}
                                </div>
                                <span className="font-medium text-foreground">{user?.name}</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="rounded-full text-muted-foreground hover:text-destructive"
                                onClick={() => signOut({ callbackUrl: "/" })}
                            >
                                <LogOut className="w-4 h-4" />
                                <span className="hidden sm:inline ml-1.5">Logout</span>
                            </Button>
                        </div>
                    ) : (
                        <Button asChild variant="default" size="sm" className="hidden sm:inline-flex rounded-full">
                            <Link href="/login">Login</Link>
                        </Button>
                    )}
                </div>
            </div>
        </header>
    );
}
