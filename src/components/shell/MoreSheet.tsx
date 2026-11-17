"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSession, signOut } from "next-auth/react";
import { Link, usePathname, useRouter } from "@/navigation";
import { Sun, Moon, MonitorSmartphone, LogIn, LogOut, User, LayoutDashboard, Github, Check, BookOpen } from "lucide-react";
import { Sheet, SheetContent } from "./Sheet";
import { useCurrency } from "@/context/CurrencyContext";
import { CURRENCY_META, type Currency } from "@/lib/currency";
import { cn } from "@/lib/utils";

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
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const { theme, setTheme } = useTheme();
    const { currency, setCurrency } = useCurrency();
    const { data: session } = useSession();
    const user = session?.user as { name?: string | null; role?: string } | undefined;
    const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.role === "MODERATOR";
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    const close = () => onOpenChange(false);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent title={t("title")}>
                {/* Language */}
                <section className="mb-5">
                    <h3 className="label-mono mb-2">{t("language")}</h3>
                    <div className="grid grid-cols-3 gap-2">
                        {LOCALES.map((l) => (
                            <button
                                key={l.code}
                                onClick={() => {
                                    router.replace(pathname, { locale: l.code });
                                    close();
                                }}
                                className={cn(
                                    "tap flex h-14 flex-col items-center justify-center rounded-md border-2 text-sm font-semibold",
                                    locale === l.code
                                        ? "border-foreground bg-secondary text-secondary-foreground"
                                        : "border-border hover:border-foreground/40"
                                )}
                                aria-pressed={locale === l.code}
                            >
                                <span lang={l.code}>{l.label}</span>
                            </button>
                        ))}
                    </div>
                </section>

                {/* Currency — only relevant on the Rates tab */}
                {pathname?.startsWith("/calculator") && (
                    <section className="mb-5">
                        <h3 className="label-mono mb-2">{t("currency")}</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {(["LKR", "USD"] as Currency[]).map((code) => {
                                const meta = CURRENCY_META[code];
                                const active = currency === code;
                                return (
                                    <button
                                        key={code}
                                        type="button"
                                        onClick={() => setCurrency(code)}
                                        className={cn(
                                            "tap flex h-12 items-center justify-center gap-2 rounded-md border-2 text-sm font-bold",
                                            active
                                                ? "border-foreground bg-foreground text-background"
                                                : "border-border hover:border-foreground/40"
                                        )}
                                        aria-pressed={active}
                                    >
                                        <span className="font-mono text-base">{meta.symbol}</span>
                                        <span>{code}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Theme */}
                <section className="mb-5">
                    <h3 className="label-mono mb-2">{t("appearance")}</h3>
                    <div className="grid grid-cols-3 gap-2">
                        {([
                            { value: "light", icon: Sun, label: t("light") },
                            { value: "dark", icon: Moon, label: t("dark") },
                            { value: "system", icon: MonitorSmartphone, label: t("system") },
                        ] as const).map(({ value, icon: Icon, label }) => {
                            const active = mounted && theme === value;
                            return (
                                <button
                                    key={value}
                                    onClick={() => setTheme(value)}
                                    className={cn(
                                        "tap flex h-14 flex-col items-center justify-center gap-1 rounded-md border-2 text-xs font-semibold",
                                        active ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground/40"
                                    )}
                                    aria-pressed={active}
                                >
                                    <Icon className="h-4 w-4" />
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* Account & Quick Links */}
                <section className="mb-5">
                    <h3 className="label-mono mb-1">{t("account")}</h3>
                    <div className="-mx-3">
                        <Link href="/blog" onClick={close} className="tap flex items-center gap-3 rounded-md px-3 py-3 font-medium hover:bg-muted">
                            <BookOpen className="h-5 w-5 text-muted-foreground" /> {tNav("blog")}
                        </Link>
                        {session ? (
                            <>
                                <Link href="/dashboard/profile" onClick={close} className="tap flex items-center gap-3 rounded-md px-3 py-3 hover:bg-muted">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                                        {user?.name?.charAt(0)?.toUpperCase() || <User className="h-4 w-4" />}
                                    </span>
                                    <span className="font-semibold">{user?.name}</span>
                                </Link>
                                {isAdmin && (
                                    <Link href="/dashboard" onClick={close} className="tap flex items-center gap-3 rounded-md px-3 py-3 font-medium hover:bg-muted">
                                        <LayoutDashboard className="h-5 w-5 text-muted-foreground" /> {tNav("dashboard")}
                                    </Link>
                                )}
                                <Row onClick={() => signOut({ callbackUrl: "/" })} className="text-primary">
                                    <LogOut className="h-5 w-5" /> {tNav("logout")}
                                </Row>
                            </>
                        ) : (
                            <Link href="/login" onClick={close} className="tap flex items-center gap-3 rounded-md px-3 py-3 font-medium hover:bg-muted">
                                <LogIn className="h-5 w-5 text-muted-foreground" /> {t("loginCta")}
                            </Link>
                        )}
                    </div>
                </section>

                {/* About */}
                <section className="rounded-md border border-dashed border-foreground/30 p-4 text-sm">
                    <div className="airmail-stripe -mx-4 -mt-4 mb-3 h-1.5 rounded-t-md" aria-hidden="true" />
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
                            href="/privacy"
                            onClick={close}
                            className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-4"
                        >
                            {t("privacy")}
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
