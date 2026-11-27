"use client";

import * as React from "react";
import { signOut } from "next-auth/react";
import {
    LayoutDashboard,
    Building2,
    ShieldCheck,
    FileText,
    Menu,
    Search,
    Calculator,
    Code2,
    Users,
    Clock,
    UserCheck,
    Settings,
    ExternalLink,
    LogOut,
    PlusCircle,
} from "lucide-react";
import { Link, usePathname } from "@/navigation";
import StampLogo from "@/components/brand/StampLogo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sheet, SheetContent } from "@/components/shell/Sheet";
import { stripLocalePrefix } from "@/lib/locale";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { useInstantLocale, type AppLocale } from "@/context/InstantLocaleContext";
import AdminCommandPalette from "./AdminCommandPalette";

interface AdminShellProps {
    user: {
        name: string;
        email: string;
        role: string;
    };
    queueBadge: number;
    children: React.ReactNode;
}

const ROLE_LABELS: Record<string, string> = {
    SUPER_ADMIN: "Super Admin",
    ADMIN: "Admin",
    MODERATOR: "Moderator",
    CONTRIBUTOR: "Contributor",
};

const ROUTE_TITLES: Array<{ match: (p: string) => boolean; title: string }> = [
    { match: (p) => p === "/dashboard", title: "Desk" },
    { match: (p) => p.startsWith("/dashboard/offices"), title: "Offices" },
    { match: (p) => p.startsWith("/dashboard/add"), title: "Add Office" },
    { match: (p) => p.startsWith("/dashboard/edit"), title: "Edit Office" },
    { match: (p) => p.startsWith("/dashboard/queue"), title: "Queue" },
    { match: (p) => p === "/dashboard/news/new", title: "New Update" },
    { match: (p) => p.startsWith("/dashboard/news/"), title: "Edit Update" },
    { match: (p) => p.startsWith("/dashboard/news"), title: "News Studio" },
    { match: (p) => p.startsWith("/dashboard/rates"), title: "Postage Rates" },
    { match: (p) => p.startsWith("/dashboard/variables"), title: "Variables" },
    { match: (p) => p.startsWith("/dashboard/users"), title: "Users & Roles" },
    { match: (p) => p.startsWith("/dashboard/activity"), title: "Activity Log" },
    { match: (p) => p.startsWith("/dashboard/profile") || p.startsWith("/dashboard/settings"), title: "Profile & Beta" },
    { match: (p) => p.startsWith("/dashboard/system"), title: "System & Features" },
];

export default function AdminShell({ user, queueBadge, children }: AdminShellProps) {
    const pathname = stripLocalePrefix(usePathname() || "/dashboard");
    const [moreOpen, setMoreOpen] = React.useState(false);
    const [paletteOpen, setPaletteOpen] = React.useState(false);
    const { locale, setLocale } = useInstantLocale();

    const isModeratorPlus = ["SUPER_ADMIN", "ADMIN", "MODERATOR"].includes(user.role);
    const isAdminPlus = ["SUPER_ADMIN", "ADMIN"].includes(user.role);
    const isSuperAdmin = user.role === "SUPER_ADMIN";

    React.useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setPaletteOpen((prev) => !prev);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    const currentTitle =
        ROUTE_TITLES.find((r) => r.match(pathname))?.title ||
        (isModeratorPlus ? "Admin Desk" : "Contributor Desk");

    const desktopPrimaryLinks = isModeratorPlus
        ? [
              { href: "/dashboard", label: "Desk Overview", icon: LayoutDashboard, active: pathname === "/dashboard" },
              {
                  href: "/dashboard/offices",
                  label: "Offices",
                  icon: Building2,
                  active: pathname.startsWith("/dashboard/offices") || pathname.startsWith("/dashboard/add") || pathname.startsWith("/dashboard/edit"),
              },
              { href: "/dashboard/queue", label: "Moderation Queue", icon: ShieldCheck, active: pathname.startsWith("/dashboard/queue"), badge: queueBadge },
              { href: "/dashboard/news", label: "News & Articles", icon: FileText, active: pathname.startsWith("/dashboard/news") },
          ]
        : [
              { href: "/dashboard", label: "My Contributions", icon: LayoutDashboard, active: pathname === "/dashboard" },
              { href: "/dashboard/offices", label: "Search Directory", icon: Building2, active: pathname.startsWith("/dashboard/offices") },
              { href: "/dashboard/profile", label: "Profile & Beta", icon: UserCheck, active: pathname.startsWith("/dashboard/profile") },
          ];

    const secondaryLinks = isModeratorPlus
        ? [
              ...(isAdminPlus
                  ? [
                        { href: "/dashboard/rates", label: "Postage Rates", icon: Calculator, active: pathname.startsWith("/dashboard/rates") },
                        { href: "/dashboard/variables", label: "Site Variables", icon: Code2, active: pathname.startsWith("/dashboard/variables") },
                    ]
                  : []),
              ...(isSuperAdmin
                  ? [{ href: "/dashboard/users", label: "Users & Roles", icon: Users, active: pathname.startsWith("/dashboard/users") }]
                  : []),
              { href: "/dashboard/activity", label: "Activity Log", icon: Clock, active: pathname.startsWith("/dashboard/activity") },
              { href: "/dashboard/profile", label: "Profile & Beta", icon: UserCheck, active: pathname.startsWith("/dashboard/profile") },
              ...(isSuperAdmin
                  ? [{ href: "/dashboard/system", label: "System & Features", icon: Settings, active: pathname.startsWith("/dashboard/system") }]
                  : []),
          ]
        : [];

    const mobileTabs = isModeratorPlus
        ? [
              { href: "/dashboard", label: "Desk", icon: LayoutDashboard, active: pathname === "/dashboard" },
              {
                  href: "/dashboard/offices",
                  label: "Offices",
                  icon: Building2,
                  active: pathname.startsWith("/dashboard/offices") || pathname.startsWith("/dashboard/add") || pathname.startsWith("/dashboard/edit"),
              },
              { href: "/dashboard/queue", label: "Queue", icon: ShieldCheck, active: pathname.startsWith("/dashboard/queue"), badge: queueBadge },
              { href: "/dashboard/news", label: "News", icon: FileText, active: pathname.startsWith("/dashboard/news") },
          ]
        : [
              { href: "/dashboard", label: "Edits", icon: LayoutDashboard, active: pathname === "/dashboard" },
              { href: "/dashboard/offices", label: "Offices", icon: Building2, active: pathname.startsWith("/dashboard/offices") },
              { href: "/dashboard/profile", label: "Security", icon: UserCheck, active: pathname.startsWith("/dashboard/profile") },
          ];

    return (
        <div className="min-h-dvh bg-background flex flex-col md:flex-row">
            {/* ===== Desktop Persistent Left Rail ===== */}
            <aside className="hidden md:flex md:w-64 lg:w-68 shrink-0 flex-col border-r-2 border-foreground bg-card sticky top-0 h-dvh">
                <div className="airmail-stripe h-1.5 shrink-0" aria-hidden="true" />
                <div className="flex items-center justify-between gap-2 px-4 py-3.5 border-b border-border">
                    <Link href="/dashboard" className="tap">
                        <StampLogo size={32} />
                    </Link>
                    <ThemeToggle />
                </div>

                <div className="px-4 py-3 border-b border-border">
                    <button
                        type="button"
                        onClick={() => setPaletteOpen(true)}
                        className="tap flex h-10 w-full items-center justify-between gap-2 rounded-md border border-foreground/40 bg-background px-3 text-xs font-medium text-muted-foreground hover:border-foreground hover:text-foreground"
                    >
                        <span className="flex items-center gap-2 truncate">
                            <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>Search office or tool</span>
                        </span>
                        <kbd className="rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                            ⌘K
                        </kbd>
                    </button>
                </div>

                <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
                    <div>
                        <p className="label-mono px-2 mb-2">Workspace</p>
                        <ul className="space-y-1">
                            {desktopPrimaryLinks.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <li key={item.href}>
                                        <Link
                                            href={item.href}
                                            className={cn(
                                                "tap flex min-h-[42px] items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
                                                item.active
                                                    ? "bg-primary text-primary-foreground shadow-[2px_2px_0_0_hsl(var(--foreground))]"
                                                    : "text-foreground/85 hover:bg-muted"
                                            )}
                                        >
                                            <span className="flex items-center gap-2.5 truncate">
                                                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                                                <span className="truncate">{item.label}</span>
                                            </span>
                                            {typeof item.badge === "number" && item.badge > 0 && (
                                                <span
                                                    className={cn(
                                                        "rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none",
                                                        item.active
                                                            ? "bg-secondary text-secondary-foreground"
                                                            : "bg-primary text-primary-foreground"
                                                    )}
                                                >
                                                    {item.badge > 99 ? "99+" : item.badge}
                                                </span>
                                            )}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    {secondaryLinks.length > 0 && (
                        <div>
                            <p className="label-mono px-2 mb-2">Operations</p>
                            <ul className="space-y-1">
                                {secondaryLinks.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <li key={item.href}>
                                            <Link
                                                href={item.href}
                                                className={cn(
                                                    "tap flex min-h-[40px] items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                                    item.active
                                                        ? "bg-foreground text-background font-semibold"
                                                        : "text-foreground/80 hover:bg-muted"
                                                )}
                                            >
                                                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                                                <span className="truncate">{item.label}</span>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}

                    {isAdminPlus && (
                        <div className="px-1 pt-1">
                            <Link
                                href="/dashboard/add"
                                className="tap flex min-h-[42px] w-full items-center justify-center gap-2 rounded-md border-2 border-foreground bg-secondary px-3 py-2 text-xs font-extrabold uppercase tracking-wider text-secondary-foreground shadow-[2px_2px_0_0_hsl(var(--foreground))] hover:bg-secondary/90"
                            >
                                <PlusCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                                <span>Add Office</span>
                            </Link>
                        </div>
                    )}
                </nav>

                <div className="border-t border-border p-3 space-y-2.5 bg-card">
                    <div className="flex items-center justify-between gap-2 px-1">
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">{user.name}</p>
                            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                {ROLE_LABELS[user.role] || user.role}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => signOut({ callbackUrl: "/" })}
                            title="Sign Out"
                            aria-label="Sign Out"
                            className="tap inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-destructive hover:text-destructive"
                        >
                            <LogOut className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </div>
                    <Link
                        href="/"
                        className="tap flex min-h-[38px] items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-semibold text-foreground hover:border-foreground"
                    >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>View Public Site</span>
                    </Link>
                </div>
            </aside>

            {/* ===== Mobile Top Header ===== */}
            <header className="md:hidden sticky top-0 z-40 border-b-2 border-foreground bg-card pt-safe">
                <div className="airmail-stripe h-1 w-full" aria-hidden="true" />
                <div className="flex h-14 items-center justify-between gap-2 px-3.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <Link href="/dashboard" className="tap shrink-0" aria-label="Dashboard Desk">
                            <StampLogo size={28} />
                        </Link>
                        <div className="min-w-0">
                            <p className="font-heading text-base font-extrabold leading-tight truncate">
                                {currentTitle}
                            </p>
                            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground truncate">
                                {ROLE_LABELS[user.role] || user.role}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic("light");
                                setPaletteOpen(true);
                            }}
                            aria-label="Search admin tools and post offices"
                            className="tap inline-flex h-11 w-11 items-center justify-center rounded-md border border-border bg-background text-foreground hover:border-foreground"
                        >
                            <Search className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <div className="flex min-h-[44px] min-w-[44px] items-center justify-center">
                            <ThemeToggle />
                        </div>
                    </div>
                </div>
            </header>

            {/* ===== Main Workspace Content ===== */}
            <div className="flex-1 min-w-0 pb-tabbar md:pb-8">
                <div className="mx-auto w-full max-w-6xl px-3.5 py-4 sm:px-6 md:py-8">
                    {children}
                </div>
            </div>

            {/* ===== Mobile Bottom Tab Bar ===== */}
            <nav
                data-mobile-tabbar=""
                aria-label="Admin Navigation"
                className="md:hidden fixed inset-x-0 bottom-0 z-[80] border-t-2 border-foreground bg-card pb-safe select-none transition-transform duration-200 ease-out"
            >
                <ul className={cn("grid h-[var(--tabbar-h)]", mobileTabs.length === 4 ? "grid-cols-5" : "grid-cols-4")}>
                    {mobileTabs.map((item) => {
                        const Icon = item.icon;
                        const active = item.active && !moreOpen;
                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    onClick={() => triggerHaptic("light")}
                                    aria-current={active ? "page" : undefined}
                                    className={cn(
                                        "tap flex h-full flex-col items-center justify-center gap-1 text-[11px] font-bold",
                                        active ? "text-primary" : "text-muted-foreground"
                                    )}
                                >
                                    <span className="relative flex h-7 w-11 items-center justify-center rounded-full">
                                        {active && (
                                            <span
                                                aria-hidden="true"
                                                className="absolute inset-0 rounded-full bg-secondary"
                                            />
                                        )}
                                        <Icon
                                            className={cn(
                                                "relative z-10 h-[1.15rem] w-[1.15rem]",
                                                active && "text-secondary-foreground"
                                            )}
                                            strokeWidth={active ? 2.4 : 2}
                                            aria-hidden="true"
                                        />
                                        {typeof item.badge === "number" && item.badge > 0 && (
                                            <span className="absolute -right-0.5 -top-0.5 z-20 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] font-bold text-primary-foreground ring-2 ring-card">
                                                {item.badge > 99 ? "99+" : item.badge}
                                            </span>
                                        )}
                                    </span>
                                    <span className="leading-none">{item.label}</span>
                                </Link>
                            </li>
                        );
                    })}
                    <li>
                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic("light");
                                setMoreOpen(true);
                            }}
                            aria-haspopup="dialog"
                            aria-expanded={moreOpen}
                            className={cn(
                                "tap flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-bold",
                                moreOpen ? "text-primary" : "text-muted-foreground"
                            )}
                        >
                            <span className="relative flex h-7 w-11 items-center justify-center rounded-full">
                                {moreOpen && (
                                    <span
                                        aria-hidden="true"
                                        className="absolute inset-0 rounded-full bg-secondary"
                                    />
                                )}
                                <Menu
                                    className={cn(
                                        "relative z-10 h-[1.15rem] w-[1.15rem]",
                                        moreOpen && "text-secondary-foreground"
                                    )}
                                    aria-hidden="true"
                                />
                            </span>
                            <span className="leading-none">More</span>
                        </button>
                    </li>
                </ul>
            </nav>

            {/* ===== Mobile Admin More Sheet ===== */}
            <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
                <SheetContent
                    title="More Tools & Account"
                    description={`${user.name} (${ROLE_LABELS[user.role] || user.role})`}
                    bodyClassName="space-y-5"
                >
                    {secondaryLinks.length > 0 && (
                        <div>
                            <p className="label-mono mb-2">Operations & Settings</p>
                            <div className="grid grid-cols-2 gap-2">
                                {secondaryLinks.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={() => setMoreOpen(false)}
                                            className={cn(
                                                "tap flex min-h-[48px] items-center gap-2.5 rounded-md border p-3 text-sm font-bold",
                                                item.active
                                                    ? "border-foreground bg-secondary text-secondary-foreground"
                                                    : "border-border bg-card text-foreground hover:border-foreground"
                                            )}
                                        >
                                            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                                            <span className="truncate">{item.label}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div>
                        <p className="label-mono mb-2">Language</p>
                        <div className="grid grid-cols-3 gap-2">
                            {(
                                [
                                    { code: "en", label: "English" },
                                    { code: "si", label: "සිංහල" },
                                    { code: "ta", label: "தமிழ்" },
                                ] as Array<{ code: AppLocale; label: string }>
                            ).map((lang) => (
                                <button
                                    key={lang.code}
                                    type="button"
                                    onClick={() => {
                                        triggerHaptic("selection");
                                        setLocale(lang.code);
                                    }}
                                    className={cn(
                                        "tap min-h-[44px] rounded-md border px-2 text-xs font-bold",
                                        locale === lang.code
                                            ? "border-foreground bg-foreground text-background"
                                            : "border-border bg-card text-foreground"
                                    )}
                                >
                                    {lang.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-border">
                        <Link
                            href="/"
                            onClick={() => setMoreOpen(false)}
                            className="tap flex min-h-[46px] w-full items-center justify-center gap-2 rounded-md border border-foreground bg-card px-4 text-sm font-bold text-foreground"
                        >
                            <ExternalLink className="h-4 w-4" aria-hidden="true" />
                            <span>Open Public Directory</span>
                        </Link>
                        <button
                            type="button"
                            onClick={() => signOut({ callbackUrl: "/" })}
                            className="tap flex min-h-[46px] w-full items-center justify-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 text-sm font-bold text-destructive"
                        >
                            <LogOut className="h-4 w-4" aria-hidden="true" />
                            <span>Sign Out ({user.email})</span>
                        </button>
                    </div>
                </SheetContent>
            </Sheet>

            {/* ===== Command & Office Quick Search ===== */}
            <AdminCommandPalette
                open={paletteOpen}
                onOpenChange={setPaletteOpen}
                userRole={user.role}
            />
        </div>
    );
}
