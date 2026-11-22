"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/navigation";
import { Home, FolderOpen, Calculator, Package, Menu } from "lucide-react";
import { m } from "motion/react";
import { cn } from "@/lib/utils";
import { usePWA } from "@/context/PWAContext";
import { stripLocalePrefix } from "@/lib/locale";
import { ensureLocalOfficeIndex } from "@/lib/office-index-client";
import { triggerHaptic } from "@/lib/haptics";
import MoreSheet from "./MoreSheet";

const HIDDEN_ON = ["/login", "/register", "/dashboard"];
const TRACKING_HISTORY_KEY = "lpd_tracking_history_v1";
const TERMINAL_TRACK_STATUSES = new Set([
    "delivered",
    "settled",
    "returned",
    "not_found",
    "error",
]);

function checkHasActiveTrackedParcel(): boolean {
    if (typeof window === "undefined") return false;
    try {
        const raw = window.localStorage.getItem(TRACKING_HISTORY_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw) as Array<{ statusCategory?: string }>;
        if (!Array.isArray(parsed)) return false;
        return parsed.some(
            (entry) =>
                Boolean(entry?.statusCategory) &&
                !TERMINAL_TRACK_STATUSES.has(String(entry.statusCategory))
        );
    } catch {
        return false;
    }
}

/**
 * App-style bottom navigation for phones (hidden from md up).
 * Home · Rates · Browse · Track · More
 */
export default function BottomTabBar() {
    const t = useTranslations("App");
    const pathname = stripLocalePrefix(usePathname() || "/");
    const router = useRouter();
    const { isOfflineFallbackPage } = usePWA();
    const [moreOpen, setMoreOpen] = React.useState(false);
    const [hasMounted, setHasMounted] = React.useState(false);
    const [hasActiveParcel, setHasActiveParcel] = React.useState(false);

    React.useEffect(() => {
        setHasMounted(true);

        const refreshActiveParcel = () => {
            setHasActiveParcel(checkHasActiveTrackedParcel());
        };
        const handleOpenMore = () => {
            setMoreOpen(true);
        };

        refreshActiveParcel();
        window.addEventListener("lpd:open-more-sheet", handleOpenMore);
        window.addEventListener("storage", refreshActiveParcel);
        window.addEventListener("focus", refreshActiveParcel);

        return () => {
            window.removeEventListener("lpd:open-more-sheet", handleOpenMore);
            window.removeEventListener("storage", refreshActiveParcel);
            window.removeEventListener("focus", refreshActiveParcel);
        };
    }, [pathname]);

    const isOfflineFallback =
        pathname.startsWith("/offline") ||
        isOfflineFallbackPage ||
        (!hasMounted && typeof document !== "undefined" && Boolean(document.getElementById("slpost-offline-fallback")));

    if (!isOfflineFallback && HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

    const tabs = [
        { href: "/", label: t("tabHome"), icon: Home, active: !isOfflineFallback && pathname === "/" },
        { href: "/calculator", label: t("tabRates"), icon: Calculator, active: !isOfflineFallback && (pathname.startsWith("/calculator") || pathname.startsWith("/rates")) },
        { href: "/browse", label: t("tabBrowse"), icon: FolderOpen, active: !isOfflineFallback && (pathname.startsWith("/browse") || pathname.startsWith("/office") || pathname.startsWith("/district")) },
        { href: "/track", label: t("tabTrack"), icon: Package, active: !isOfflineFallback && pathname.startsWith("/track") },
    ];

    const prefetchTab = (href: string) => {
        try {
            router.prefetch(href);
        } catch {
            // Ignore prefetch errors
        }
        if (href === "/browse") {
            void ensureLocalOfficeIndex();
        }
    };

    return (
        <>
            <nav
                data-mobile-tabbar=""
                aria-label={t("mainNav")}
                className="md:hidden fixed inset-x-0 bottom-0 z-[80] border-t border-border/80 bg-background/88 backdrop-blur-xl shadow-[0_-4px_20px_rgba(26,23,20,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.35)] pb-safe select-none transition-transform duration-200 ease-out"
            >
                <ul className="grid h-[var(--tabbar-h)] grid-cols-5">
                    {tabs.map(({ href, label, icon: Icon, active }) => {
                        const isTrackTab = href === "/track";
                        const isExactCurrentRoute = pathname === href && !moreOpen;
                        return (
                            <li key={href}>
                                <Link
                                    href={href}
                                    onClick={(e) => {
                                        triggerHaptic("light");
                                        if (isExactCurrentRoute) {
                                            e.preventDefault();
                                            window.scrollTo({ top: 0, behavior: "smooth" });
                                        }
                                    }}
                                    onTouchStart={() => prefetchTab(href)}
                                    onPointerEnter={() => prefetchTab(href)}
                                    aria-current={active ? "page" : undefined}
                                    className={cn(
                                        "tap flex h-full flex-col items-center justify-center gap-1 text-[0.68rem] font-semibold",
                                        active ? "text-primary" : "text-muted-foreground"
                                    )}
                                >
                                    <span className="relative flex h-7 w-12 items-center justify-center rounded-full">
                                        {active && !moreOpen && (
                                            <m.span
                                                layoutId="mobile-tab-pill"
                                                transition={{ type: "spring", stiffness: 480, damping: 34 }}
                                                className="absolute inset-0 rounded-full bg-secondary"
                                                aria-hidden="true"
                                            />
                                        )}
                                        <Icon
                                            className={cn(
                                                "relative z-10 h-[1.15rem] w-[1.15rem] transition-colors",
                                                active && !moreOpen && "text-secondary-foreground"
                                            )}
                                            strokeWidth={active ? 2.4 : 2}
                                        />
                                        {isTrackTab && hasActiveParcel && (
                                            <span
                                                aria-hidden="true"
                                                className="absolute right-2.5 top-0.5 z-20 h-2 w-2 rounded-full bg-primary ring-2 ring-background"
                                            />
                                        )}
                                    </span>
                                    <span className="leading-none">{label}</span>
                                </Link>
                            </li>
                        );
                    })}
                    <li>
                        <button
                            onClick={() => {
                                triggerHaptic("light");
                                setMoreOpen(true);
                            }}
                            aria-haspopup="dialog"
                            aria-expanded={moreOpen}
                            className={cn(
                                "tap flex h-full w-full flex-col items-center justify-center gap-1 text-[0.68rem] font-semibold",
                                moreOpen ? "text-primary" : "text-muted-foreground"
                            )}
                        >
                            <span className="relative flex h-7 w-12 items-center justify-center rounded-full">
                                {moreOpen && (
                                    <m.span
                                        layoutId="mobile-tab-pill"
                                        transition={{ type: "spring", stiffness: 480, damping: 34 }}
                                        className="absolute inset-0 rounded-full bg-secondary"
                                        aria-hidden="true"
                                    />
                                )}
                                <Menu className={cn("relative z-10 h-[1.15rem] w-[1.15rem]", moreOpen && "text-secondary-foreground")} />
                            </span>
                            <span className="leading-none">{t("tabMore")}</span>
                        </button>
                    </li>
                </ul>
            </nav>
            <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
        </>
    );
}
