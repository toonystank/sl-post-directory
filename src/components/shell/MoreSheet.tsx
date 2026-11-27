"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSession, signOut } from "next-auth/react";
import { Link } from "@/navigation";
import {
    Sun,
    Moon,
    MonitorSmartphone,
    LogIn,
    LogOut,
    User,
    LayoutDashboard,
    Github,
    Check,
    BookOpen,
    Download,
    RefreshCw,
    CheckCircle2,
    Route,
    Pin,
    PinOff,
} from "lucide-react";
import { Sheet, SheetContent } from "./Sheet";
import { useCurrency } from "@/context/CurrencyContext";
import { useInstantLocale } from "@/context/InstantLocaleContext";
import { usePWA } from "@/context/PWAContext";
import { useStaffStation } from "@/context/StaffStationContext";
import StaffStationPicker from "@/components/staff/StaffStationPicker";
import { CURRENCY_META, type Currency } from "@/lib/currency";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const LOCALES = [
    { code: "en", label: "English", short: "EN" },
    { code: "si", label: "සිංහල", short: "සිං" },
    { code: "ta", label: "தமிழ்", short: "த" },
] as const;

interface MoreSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

function Row({ children, className, ...props }: React.ComponentProps<"button">) {
    return (
        <button
            {...props}
            className={cn(
                "tap flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-[0.95rem] font-medium hover:bg-muted",
                className
            )}
        >
            {children}
        </button>
    );
}

export default function MoreSheet({ open, onOpenChange }: MoreSheetProps) {
    const t = useTranslations("More");
    const tNav = useTranslations("Nav");
    const tInstall = useTranslations("Install");
    const tStaff = useTranslations("Staff");
    const { locale, setLocale } = useInstantLocale();
    const { theme, setTheme } = useTheme();
    const { currency, setCurrency } = useCurrency();
    const { station, hydrated: stationHydrated, mailRoutingEnabled, clearStation } = useStaffStation();
    const [stationOpen, setStationOpen] = React.useState(false);
    const {
        isInstalled,
        isCachingLocalAssets,
        localAssetsCached,
        offlineOfficesCount,
        updateAvailable,
        triggerInstall,
        warmLocalAssets,
        applyUpdate,
    } = usePWA();
    const { data: session } = useSession();
    const user = session?.user as { name?: string | null; role?: string } | undefined;
    const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.role === "MODERATOR";
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    const close = () => onOpenChange(false);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent title={t("title")}>
                {/* App & Offline */}
                <section className="mb-5 rounded-2xl border border-border bg-card p-3.5 shadow-[var(--shadow-elev-1)]">
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                        <h3 className="label-mono">{tInstall("sectionTitle")}</h3>
                        {isInstalled && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-[hsl(var(--status-open))]">
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                {tInstall("installedBadge")}
                            </span>
                        )}
                    </div>

                    <div className="space-y-2.5">
                        {!isInstalled && (
                            <Button
                                type="button"
                                className="w-full justify-center gap-2 rounded-xl"
                                data-testid="more-install-app-btn"
                                onClick={() => {
                                    triggerHaptic("light");
                                    close();
                                    void triggerInstall();
                                }}
                            >
                                <Download className="h-4 w-4" aria-hidden="true" />
                                <span>{tInstall("installApp")}</span>
                            </Button>
                        )}

                        {updateAvailable && (
                            <Button
                                type="button"
                                variant="secondary"
                                className="w-full justify-center gap-2 rounded-xl"
                                onClick={applyUpdate}
                            >
                                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                                <span>{tInstall("updateTitle")} · {tInstall("updateAction")}</span>
                            </Button>
                        )}

                        <div className="flex flex-col gap-2 pt-1 text-xs text-muted-foreground">
                            <div className="min-w-0">
                                <p className="font-medium text-foreground">
                                    {isCachingLocalAssets
                                        ? tInstall("cachingAssets")
                                        : localAssetsCached
                                            ? tInstall("cachedReady")
                                            : tInstall("badge")}
                                </p>
                                {offlineOfficesCount > 0 && (
                                    <p className="text-[11px] text-muted-foreground">
                                        {tInstall("cachedOffices", { count: offlineOfficesCount })}
                                    </p>
                                )}
                            </div>
                            <button
                                type="button"
                                disabled={isCachingLocalAssets}
                                onClick={() => {
                                    triggerHaptic("light");
                                    void warmLocalAssets();
                                }}
                                data-testid="more-sync-offline-btn"
                                className="tap self-start inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
                            >
                                <RefreshCw
                                    className={cn("h-3.5 w-3.5", isCachingLocalAssets && "animate-spin")}
                                    aria-hidden="true"
                                />
                                <span>{isCachingLocalAssets ? tInstall("syncing") : tInstall("syncOffline")}</span>
                            </button>
                        </div>
                    </div>
                </section>

                {/* Preferences (Language · Appearance · Currency) */}
                <section className="mb-5 space-y-3 rounded-2xl border border-border bg-card p-3.5 shadow-[var(--shadow-elev-1)]">
                    <div>
                        <h3 className="label-mono mb-2">{t("language")}</h3>
                        <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
                            {LOCALES.map((l) => {
                                const active = locale === l.code;
                                return (
                                    <button
                                        key={l.code}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                            triggerHaptic("selection");
                                            setLocale(l.code);
                                            close();
                                        }}
                                        className={cn(
                                            "tap flex h-10 flex-col items-center justify-center rounded-lg text-sm font-semibold transition-all",
                                            active
                                                ? "bg-card text-foreground shadow-[var(--shadow-elev-1)]"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                        aria-pressed={active}
                                    >
                                        <span lang={l.code}>{l.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <h3 className="label-mono mb-2">{t("appearance")}</h3>
                        <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
                            {([
                                { value: "light", icon: Sun, label: t("light") },
                                { value: "dark", icon: Moon, label: t("dark") },
                                { value: "system", icon: MonitorSmartphone, label: t("system") },
                            ] as const).map(({ value, icon: Icon, label }) => {
                                const active = mounted && theme === value;
                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => {
                                            triggerHaptic("selection");
                                            setTheme(value);
                                        }}
                                        className={cn(
                                            "tap flex h-11 flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-semibold transition-all",
                                            active
                                                ? "bg-card text-foreground shadow-[var(--shadow-elev-1)]"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                        aria-pressed={active}
                                    >
                                        <Icon className="h-4 w-4" />
                                        <span>{label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <h3 className="label-mono mb-2">{t("currency")}</h3>
                        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
                            {(["LKR", "USD"] as Currency[]).map((code) => {
                                const meta = CURRENCY_META[code];
                                const active = currency === code;
                                return (
                                    <button
                                        key={code}
                                        type="button"
                                        onClick={() => {
                                            triggerHaptic("selection");
                                            setCurrency(code);
                                        }}
                                        className={cn(
                                            "tap flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-bold transition-all",
                                            active
                                                ? "bg-card text-foreground shadow-[var(--shadow-elev-1)]"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                        aria-pressed={active}
                                    >
                                        <span className="font-mono text-base">{meta.symbol}</span>
                                        <span>{code}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* Postal Staff (Optional Duty Station — visible only when Mail Routing Beta is enabled) */}
                {mailRoutingEnabled && (
                    <section className="mb-5 rounded-2xl border border-border bg-card p-3.5 shadow-[var(--shadow-elev-1)] space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <Pin className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
                                <h3 className="label-mono truncate">{tStaff("sectionTitle")}</h3>
                            </div>
                            {!stationHydrated || !station ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        triggerHaptic("light");
                                        setStationOpen((v) => !v);
                                    }}
                                    className="tap rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold hover:bg-muted shrink-0"
                                >
                                    {stationOpen ? tInstall("close") : tStaff("setStation")}
                                </button>
                            ) : (
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            triggerHaptic("light");
                                            setStationOpen((v) => !v);
                                        }}
                                        className="tap rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold hover:bg-muted"
                                    >
                                        {tStaff("changeStation")}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            triggerHaptic("light");
                                            clearStation();
                                            setStationOpen(false);
                                        }}
                                        aria-label={tStaff("clearStation")}
                                        className="tap rounded-lg border border-border bg-background p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                    >
                                        <PinOff className="h-3.5 w-3.5" aria-hidden="true" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {stationHydrated && station ? (
                            <div className="rounded-xl border border-emerald-700/30 bg-emerald-500/10 px-3 py-2 text-xs">
                                <p className="font-bold text-foreground truncate">
                                    {station.name}
                                    {station.shortCode ? ` [${station.shortCode}]` : ""}
                                </p>
                                <p className="font-mono text-[11px] text-muted-foreground truncate mt-0.5">
                                    {station.postalCode || "—"}
                                    {station.division ? ` · ${station.division}` : ""}
                                </p>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground">{tStaff("optionalHint")}</p>
                        )}

                        {stationOpen && (
                            <StaffStationPicker
                                compact
                                defaultOpen
                                onSelected={() => setStationOpen(false)}
                            />
                        )}
                    </section>
                )}

                {/* Account & Quick Links */}
                <section className="mb-5">
                    <h3 className="label-mono mb-2 px-1">{t("account")}</h3>
                    <div className="rounded-2xl border border-border bg-card divide-y divide-border/70 overflow-hidden shadow-[var(--shadow-elev-1)]">
                        {mailRoutingEnabled && (
                            <Link href="/routing" onClick={close} className="tap flex items-center justify-between gap-3 px-3.5 py-3 font-medium hover:bg-muted/60">
                                <span className="flex items-center gap-3">
                                    <Route className="h-5 w-5 text-primary" /> {tNav("routing")}
                                </span>
                                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] font-extrabold uppercase text-amber-900 dark:text-amber-300">
                                    Beta
                                </span>
                            </Link>
                        )}
                        <Link href="/blog" onClick={close} className="tap flex items-center gap-3 px-3.5 py-3 font-medium hover:bg-muted/60">
                            <BookOpen className="h-5 w-5 text-muted-foreground" /> {tNav("blog")}
                        </Link>
                        {session ? (
                            <>
                                <Link href="/dashboard/profile" onClick={close} className="tap flex items-center gap-3 px-3.5 py-3 hover:bg-muted/60">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                                        {user?.name?.charAt(0)?.toUpperCase() || <User className="h-4 w-4" />}
                                    </span>
                                    <span className="font-semibold">{user?.name}</span>
                                </Link>
                                {isAdmin && (
                                    <Link href="/dashboard" onClick={close} className="tap flex items-center gap-3 px-3.5 py-3 font-medium hover:bg-muted/60">
                                        <LayoutDashboard className="h-5 w-5 text-muted-foreground" /> {tNav("dashboard")}
                                    </Link>
                                )}
                                <Row onClick={() => signOut({ callbackUrl: "/" })} className="rounded-none px-3.5 text-primary">
                                    <LogOut className="h-5 w-5" /> {tNav("logout")}
                                </Row>
                            </>
                        ) : (
                            <Link href="/login" onClick={close} className="tap flex items-center gap-3 px-3.5 py-3 font-medium hover:bg-muted/60">
                                <LogIn className="h-5 w-5 text-muted-foreground" /> {t("loginCta")}
                            </Link>
                        )}
                    </div>
                </section>

                {/* About */}
                <section className="overflow-hidden rounded-2xl border border-dashed border-border bg-card p-4 text-sm">
                    <div className="airmail-stripe -mx-4 -mt-4 mb-3 h-1.5" aria-hidden="true" />
                    <p className="font-semibold mb-1">{t("aboutTitle")}</p>
                    <p className="text-muted-foreground leading-relaxed">{t("disclaimer")}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-4">
                        <a
                            href="https://github.com/toonystank/sl-post-directory"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-4"
                        >
                            <Github className="h-4 w-4" /> {t("openSource")}
                        </a>
                        <Link
                            href="/about"
                            onClick={close}
                            className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-4"
                        >
                            {t("about")}
                        </Link>
                        <Link
                            href="/privacy"
                            onClick={close}
                            className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-4"
                        >
                            {t("privacy")}
                        </Link>
                        <Link
                            href="/terms"
                            onClick={close}
                            className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-4"
                        >
                            {t("terms")}
                        </Link>
                    </div>
                </section>
                <p className="mt-4 text-center text-xs text-muted-foreground">
                    <Check className="inline h-3 w-3 mr-1" />
                    Lanka Post Directory · © {new Date().getFullYear()} ToonyStank
                </p>
            </SheetContent>
        </Sheet>
    );
}
