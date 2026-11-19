"use client";

import * as React from "react";
import { Link, usePathname, useRouter } from "@/navigation";
import { useSession, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "./theme-toggle";
import { ArrowLeft, Download, LogOut, User } from "lucide-react";
import { m } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import LanguageSwitcher from "./LanguageSwitcher";
import CurrencySwitcher from "./CurrencySwitcher";
import StampLogo from "./brand/StampLogo";
import { usePWA } from "@/context/PWAContext";
import { stripLocalePrefix } from "@/lib/locale";

/**
 * Global header.
 * - md and up: air-mail disclaimer strip + masthead with nav.
 * - mobile: compact native-style app bar (logo on home, back + title elsewhere).
 */
export default function Navbar() {
    const rawPathname = usePathname() || "/";
    const pathname = stripLocalePrefix(rawPathname);
    const router = useRouter();
    const { data: session } = useSession();
    const t = useTranslations("Nav");
    const tApp = useTranslations("App");
    const tInstall = useTranslations("Install");
    const { isInstalled, canNativePrompt, isIOS, triggerInstall, isOfflineFallbackPage } = usePWA();
    const [scrolled, setScrolled] = React.useState(false);
    const [hasMounted, setHasMounted] = React.useState(false);

    React.useEffect(() => {
        setHasMounted(true);
        const onScroll = () => setScrolled(window.scrollY > 4);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    const isOfflineFallback =
        pathname.startsWith("/offline") ||
        isOfflineFallbackPage ||
        (!hasMounted && typeof document !== "undefined" && Boolean(document.getElementById("slpost-offline-fallback")));

    const user = session?.user as { name?: string | null; role?: string } | undefined;
    const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.role === "MODERATOR";

    const isHome = !isOfflineFallback && pathname === "/";
    const isRatesPage = !isOfflineFallback && (pathname.startsWith("/calculator") || pathname.startsWith("/rates"));
    const isTabRoot = !isOfflineFallback && ["/", "/browse", "/calculator", "/track", "/blog"].includes(pathname);

    const mobileTitle =
        isOfflineFallback ? tInstall("offlinePageTitle")
        : pathname.startsWith("/browse") ? tApp("tabBrowse")
        : pathname.startsWith("/calculator") || pathname.startsWith("/rates") ? tApp("titleRates")
        : pathname.startsWith("/district/") ? tApp("tabBrowse")
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
        { href: "/", label: t("home"), active: isHome, soon: false },
        { href: "/calculator", label: t("calculator"), active: !isOfflineFallback && (pathname.startsWith("/calculator") || pathname.startsWith("/rates")), soon: false },
        { href: "/browse", label: t("browse"), active: !isOfflineFallback && (pathname.startsWith("/browse") || pathname.startsWith("/office") || pathname.startsWith("/district")), soon: false },
        { href: "/track", label: t("track"), active: !isOfflineFallback && pathname.startsWith("/track"), soon: false },
        { href: "/blog", label: t("blog"), active: !isOfflineFallback && pathname.startsWith("/blog"), soon: false },
        ...(isAdmin ? [{ href: "/dashboard", label: t("dashboard"), active: !isOfflineFallback && pathname.startsWith("/dashboard"), soon: false }] : []),
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
                        <ThemeToggle />
                    </div>
                </div>

                {/* ===== Desktop masthead ===== */}
                <div className="hidden md:flex container mx-auto h-16 items-center justify-between gap-3 px-4 overflow-x-clip">
                    <Link href="/" aria-label={tApp("home")} className="tap shrink-0">
                        <StampLogo size={36} />
                    </Link>

                    <nav className="flex flex-1 items-center justify-center gap-0.5 xl:gap-1 text-[0.78rem] lg:text-[0.86rem] xl:text-[0.95rem] font-semibold min-w-0 overflow-x-auto scrollbar-hide">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                onPointerEnter={() => {
                                    try {
                                        router.prefetch(item.href);
                                    } catch {
                                        // Ignore prefetch errors
                                    }
                                    if (item.href === "/browse") {
                                        void import("@/lib/office-index-client").then((m) =>
                                            m.ensureLocalOfficeIndex()
                                        );
                                    }
                                }}
                                aria-current={item.active ? "page" : undefined}
                                className={cn(
                                    "relative inline-flex items-center gap-1 px-1.5 lg:px-2.5 xl:px-3 py-2 transition-colors whitespace-nowrap shrink-0",
                                    item.active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <span>{item.label}</span>
                                {item.soon && (
                                    <span className="hidden xl:inline-flex rounded bg-secondary/70 px-1 py-px font-mono text-[9px] font-bold uppercase tracking-tight text-secondary-foreground">
                                        Soon
                                    </span>
                                )}
                                {item.active && (
                                    <m.span
                                        layoutId="desktop-nav-underline"
                                        transition={{ type: "spring", stiffness: 460, damping: 34 }}
                                        className="absolute inset-x-1.5 lg:inset-x-2.5 xl:inset-x-3 -bottom-[13px] h-[3px] bg-primary"
                                    />
                                )}
                            </Link>
                        ))}
                    </nav>

                    <div className="flex items-center gap-1.5 lg:gap-2 shrink-0">
                        {!isInstalled && (canNativePrompt || isIOS) && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => void triggerInstall()}
                                data-testid="navbar-install-btn"
                                className="rounded-full gap-1.5 px-3 whitespace-nowrap shrink-0 border-foreground/40"
                            >
                                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>{tInstall("install")}</span>
                            </Button>
                        )}
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
