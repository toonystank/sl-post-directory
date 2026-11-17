"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/navigation";
import { Home, FolderOpen, Calculator, Package, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import MoreSheet from "./MoreSheet";

const HIDDEN_ON = ["/login", "/register", "/dashboard"];

/**
 * App-style bottom navigation for phones (hidden from md up).
 * Home · Rates · Browse · Track · More
 */
export default function BottomTabBar() {
    const t = useTranslations("App");
    const pathname = usePathname() || "/";
    const [moreOpen, setMoreOpen] = React.useState(false);

    if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

    const tabs = [
        { href: "/", label: t("tabHome"), icon: Home, active: pathname === "/" },
        { href: "/calculator", label: t("tabRates"), icon: Calculator, active: pathname.startsWith("/calculator") },
        { href: "/browse", label: t("tabBrowse"), icon: FolderOpen, active: pathname.startsWith("/browse") || pathname.startsWith("/office") },
        { href: "/track", label: t("tabTrack"), icon: Package, active: pathname.startsWith("/track") },
    ];

    return (
        <>
            <nav
                aria-label={t("mainNav")}
                className="md:hidden fixed inset-x-0 bottom-0 z-[80] border-t-2 border-foreground bg-background pb-safe"
            >
                <ul className="grid h-[var(--tabbar-h)] grid-cols-5">
                    {tabs.map(({ href, label, icon: Icon, active }) => (
                        <li key={href}>
                            <Link
                                href={href}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                    "tap flex h-full flex-col items-center justify-center gap-1 text-[0.68rem] font-semibold",
                                    active ? "text-primary" : "text-muted-foreground"
                                )}
                            >
                                <span
                                    className={cn(
                                        "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                                        active && "bg-secondary text-secondary-foreground"
                                    )}
                                >
                                    <Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={active ? 2.4 : 2} />
                                </span>
                                <span className="leading-none">{label}</span>
                            </Link>
                        </li>
                    ))}
                    <li>
                        <button
                            onClick={() => setMoreOpen(true)}
                            aria-haspopup="dialog"
                            aria-expanded={moreOpen}
                            className={cn(
                                "tap flex h-full w-full flex-col items-center justify-center gap-1 text-[0.68rem] font-semibold",
                                moreOpen ? "text-primary" : "text-muted-foreground"
                            )}
                        >
                            <span className={cn("flex h-7 w-12 items-center justify-center rounded-full", moreOpen && "bg-secondary text-secondary-foreground")}>
                                <Menu className="h-[1.15rem] w-[1.15rem]" />
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
