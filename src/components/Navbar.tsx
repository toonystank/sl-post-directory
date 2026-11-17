"use client";

import * as React from "react";
import { Link, usePathname, useRouter } from "@/navigation";
import { useSession, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "./theme-toggle";
import { ArrowLeft, LogOut, User } from "lucide-react";
import { m } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import LanguageSwitcher from "./LanguageSwitcher";
import CurrencySwitcher from "./CurrencySwitcher";
import StampLogo from "./brand/StampLogo";

/**
 * Global header.
 * - md and up: air-mail disclaimer strip + masthead with nav.
 * - mobile: compact native-style app bar (logo on home, back + title elsewhere).
 */
export default function Navbar() {
    const pathname = usePathname() || "/";
    const router = useRouter();
    const { data: session } = useSession();
    const t = useTranslations("Nav");
    const tApp = useTranslations("App");
    const [scrolled, setScrolled] = React.useState(false);

    React.useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 4);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    const user = session?.user as { name?: string | null; role?: string } | undefined;
    const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.role === "MODERATOR";

    const isHome = pathname === "/";
    const isRatesPage = pathname.startsWith("/calculator");
    const isTabRoot = ["/", "/browse", "/calculator", "/track", "/blog"].includes(pathname);

    const mobileTitle =
        pathname.startsWith("/browse") ? tApp("tabBrowse")
        : pathname.startsWith("/calculator") ? tApp("titleRates")
        : pathname.startsWith("/track") ? tApp("titleTrack")
        : pathname === "/blog" ? tApp("titleGuides")
        : pathname.startsWith("/blog/") ? tApp("titleGuide")
        : pathname.startsWith("/office/") ? tApp("titleOffice")
        : pathname.startsWith("/suggest") ? tApp("titleSuggest")
        : pathname.startsWith("/login") ? t("login")
        : pathname.startsWith("/register") ? tApp("titleRegister")
        : pathname.startsWith("/privacy") ? tApp("titlePrivacy")
        : pathname.startsWith("/dashboard") ? t("dashboard")
        : "";

    const navItems = [
        { href: "/", label: t("home"), active: isHome },
        { href: "/calculator", label: t("calculator"), active: pathname.startsWith("/calculator") },
        { href: "/browse", label: t("browse"), active: pathname.startsWith("/browse") || pathname.startsWith("/office") },
        { href: "/track", label: t("track"), active: pathname.startsWith("/track") },
        { href: "/blog", label: t("blog"), active: pathname.startsWith("/blog") },
        ...(isAdmin ? [{ href: "/dashboard", label: t("dashboard"), active: pathname.startsWith("/dashboard") }] : []),
    ];

    const goBack = () => {
        if (typeof window !== "undefined" && window.history.length > 1) window.history.back();
        else router.push("/");
    };

    return (
        <>
            {/* ===== Desktop: disclaimer strip ===== */}
            <div className="hidden md:block border-b border-foreground/10 bg-primary text-primary-foreground">
                <div className="container mx-auto flex h-8 items-center justify-between px-4 text-xs">
                    <span className="font-medium">{tApp("disclaimerShort")}</span>
                    <span className="airmail-stripe h-2 w-24 opacity-90" aria-hidden="true" />
                </div>
            </div>

            <header
                className={cn(
                    "sticky top-0 z-50 w-full bg-background pt-safe transition-colors duration-150 border-b-2",
                    scrolled ? "border-foreground" : "border-transparent"
                )}
            >
                {/* ===== Mobile app bar ===== */}
                <div className="md:hidden flex h-[50px] items-center gap-2 px-3">
                    {isTabRoot && isHome ? (
                        <Link href="/" aria-label={tApp("home")} className="tap">
                            <StampLogo size={32} />
                        </Link>
                    ) : (
                        <>
                            {!isTabRoot && (
                                <button onClick={goBack} aria-label={tApp("back")} className="tap -ml-1 rounded-full p-2 hover:bg-muted">
                                    <ArrowLeft className="h-5 w-5" />
                                </button>
                            )}
                            <span className={cn("font-heading text-lg font-extrabold [font-stretch:82%] truncate", isTabRoot && "pl-1")}>
                                {mobileTitle}
                            </span>
                        </>
                    )}
                    <div className="ml-auto flex items-center gap-1.5">
                        {isRatesPage && <CurrencySwitcher />}
                        <LanguageSwitcher />
                    </div>
                </div>

                {/* ===== Desktop masthead ===== */}
                <div className="hidden md:flex container mx-auto h-16 items-center justify-between px-4">
                    <Link href="/" aria-label={tApp("home")} className="tap">
                        <StampLogo size={38} />
                    </Link>

                    <nav className="flex items-center gap-1 text-[0.95rem] font-semibold">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={item.active ? "page" : undefined}
                                className={cn(
                                    "relative px-3 py-2 transition-colors",
                                    item.active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {item.label}
                                {item.active && (
                                    <m.span
                                        layoutId="desktop-nav-underline"
                                        transition={{ type: "spring", stiffness: 460, damping: 34 }}
                                        className="absolute inset-x-3 -bottom-[13px] h-[3px] bg-primary"
                                    />
                                )}
                            </Link>
                        ))}
                    </nav>

                    <div className="flex items-center gap-2">
                        {isRatesPage && <CurrencySwitcher />}
                        <LanguageSwitcher />
                        <ThemeToggle />
                        {session ? (
                            <div className="flex items-center gap-1">
                                <Link href="/dashboard/profile" className="flex items-center gap-2 rounded-full p-1 pr-3 text-sm hover:bg-muted">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                                        {user?.name?.charAt(0)?.toUpperCase() || <User className="h-3.5 w-3.5" />}
                                    </span>
                                    <span className="hidden lg:inline font-semibold">{user?.name}</span>
                                </Link>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="rounded-full text-muted-foreground hover:text-primary"
                                    onClick={() => signOut({ callbackUrl: "/" })}
                                    aria-label={t("logout")}
                                >
                                    <LogOut className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <Button asChild size="sm" className="rounded-full px-4">
                                <Link href="/login">{t("login")}</Link>
                            </Button>
                        )}
                    </div>
                </div>
            </header>
        </>
    );
}
