"use client";

import { signIn } from "next-auth/react";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
    Mail,
    Lock,
    AlertCircle,
    CheckCircle2,
    ArrowLeft,
    Eye,
    EyeOff,
    ShieldCheck,
    KeyRound,
} from "lucide-react";
import { Link, useRouter } from "@/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StampLogo from "@/components/brand/StampLogo";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

type TwoFactorMode = "totp" | "backup";

function LoginForm() {
    const t = useTranslations("Auth");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [token, setToken] = useState("");
    const [show2FA, setShow2FA] = useState(false);
    const [twoFactorMode, setTwoFactorMode] = useState<TwoFactorMode>("totp");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();

    const isVerified = searchParams.get("verified") === "true";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const cleanedToken = show2FA
                ? twoFactorMode === "totp"
                    ? token.replace(/\D/g, "")
                    : token.trim()
                : "";

            const res = await signIn("credentials", {
                email: email.trim(),
                password,
                token: cleanedToken,
                redirect: false,
            });

            if (res?.error) {
                if (res.error === "2FA_REQUIRED") {
                    setShow2FA(true);
                    setError("");
                } else {
                    setError(res.error);
                }
            } else {
                router.push("/dashboard");
                router.refresh();
            }
        } catch {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const isTokenReady =
        twoFactorMode === "totp" ? token.length === 6 : token.trim().length >= 6;

    return (
        <div className="p-5 sm:p-8">
            <div className="mb-6">
                <span className="label-mono inline-block rounded-sm border border-border bg-muted px-2 py-0.5 text-foreground">
                    Postal Archive · Access
                </span>
                <h1 className="display text-3xl sm:text-4xl mt-3">{t("loginTitle")}</h1>
                <p className="text-sm text-muted-foreground mt-1.5">{t("loginSub")}</p>
            </div>

            {isVerified && !error && (
                <div className="mb-5 p-3.5 rounded-md bg-status-open/10 border border-status-open/40 flex items-center gap-3 text-status-open">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-medium">{t("verifiedMsg")}</p>
                </div>
            )}

            {error && (
                <div
                    role="alert"
                    className="mb-5 p-3.5 rounded-md bg-destructive/10 border border-destructive/40 flex items-center gap-3 text-destructive"
                >
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                {!show2FA ? (
                    <>
                        <div>
                            <label className="label-mono block mb-1.5" htmlFor="email">
                                {t("emailLabel")}
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                                    <Mail className="w-4 h-4" aria-hidden="true" />
                                </div>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="username"
                                    spellCheck={false}
                                    enterKeyHint="next"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10 h-12 text-base bg-background"
                                    placeholder="you@example.com"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="label-mono block mb-1.5" htmlFor="password">
                                {t("passwordLabel")}
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                                    <Lock className="w-4 h-4" aria-hidden="true" />
                                </div>
                                <Input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    enterKeyHint="done"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10 pr-12 h-12 text-base bg-background"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    aria-pressed={showPassword}
                                    className="tap absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-4 h-4" aria-hidden="true" />
                                    ) : (
                                        <Eye className="w-4 h-4" aria-hidden="true" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 mt-2 text-base font-bold"
                            size="lg"
                        >
                            {loading ? t("signingIn") : t("signIn")}
                        </Button>
                    </>
                ) : (
                    <div className="space-y-4">
                        <div className="rounded-md border border-border bg-muted/50 p-3.5">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />
                                <h2 className="font-heading text-lg font-extrabold [font-stretch:82%]">
                                    {t("twoFactorTitle")}
                                </h2>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                                {twoFactorMode === "totp"
                                    ? t("twoFactorSub")
                                    : "Enter one of your alphanumeric recovery backup codes."}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-muted p-1">
                            <button
                                type="button"
                                onClick={() => {
                                    setTwoFactorMode("totp");
                                    setToken("");
                                    setError("");
                                }}
                                className={cn(
                                    "tap min-h-[44px] rounded-sm px-3 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors",
                                    twoFactorMode === "totp"
                                        ? "bg-card text-foreground border border-foreground shadow-[2px_2px_0_0_hsl(var(--foreground))]"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>6-Digit App</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setTwoFactorMode("backup");
                                    setToken("");
                                    setError("");
                                }}
                                className={cn(
                                    "tap min-h-[44px] rounded-sm px-3 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors",
                                    twoFactorMode === "backup"
                                        ? "bg-card text-foreground border border-foreground shadow-[2px_2px_0_0_hsl(var(--foreground))]"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Backup Code</span>
                            </button>
                        </div>

                        <div>
                            <label className="label-mono block mb-1.5" htmlFor="token">
                                {twoFactorMode === "totp" ? t("authCodeLabel") : "Backup Recovery Code"}
                            </label>
                            {twoFactorMode === "totp" ? (
                                <Input
                                    id="token"
                                    name="token"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    enterKeyHint="done"
                                    value={token}
                                    onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                    className="h-12 text-center tracking-[0.4em] text-xl font-mono bg-background"
                                    placeholder="000000"
                                    required
                                    maxLength={6}
                                    autoFocus
                                />
                            ) : (
                                <Input
                                    id="token"
                                    name="token"
                                    type="text"
                                    inputMode="text"
                                    autoComplete="off"
                                    spellCheck={false}
                                    autoCapitalize="none"
                                    enterKeyHint="done"
                                    value={token}
                                    onChange={(e) => setToken(e.target.value.replace(/\s+/g, ""))}
                                    className="h-12 text-center tracking-wider text-base font-mono bg-background"
                                    placeholder="a1b2c3d4"
                                    required
                                    maxLength={32}
                                    autoFocus
                                />
                            )}
                        </div>

                        <div className="flex flex-col gap-2 pt-1">
                            <Button
                                type="submit"
                                disabled={loading || !isTokenReady}
                                className="w-full h-12 text-base font-bold"
                                size="lg"
                            >
                                {loading ? t("verifying") : t("verifyCode")}
                            </Button>

                            <Button
                                type="button"
                                variant="ghost"
                                disabled={loading}
                                className="w-full h-11 text-sm"
                                onClick={() => {
                                    setShow2FA(false);
                                    setToken("");
                                    setError("");
                                }}
                            >
                                &larr; {t("backToSignIn")}
                            </Button>
                        </div>
                    </div>
                )}
            </form>

            {!show2FA && (
                <div className="mt-6 pt-4 border-t border-border text-center text-sm text-muted-foreground">
                    {t("noAccount")}{" "}
                    <Link href="/register" className="text-primary hover:underline font-semibold">
                        {t("registerLink")}
                    </Link>
                </div>
            )}
        </div>
    );
}

export default function LoginPage() {
    const t = useTranslations("Auth");
    return (
        <div className="min-h-dvh flex flex-col bg-background">
            <header className="border-b-2 border-foreground bg-card pt-safe">
                <div className="container mx-auto flex h-14 items-center justify-between px-4">
                    <Link
                        href="/"
                        className="tap inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        <span>Directory</span>
                    </Link>
                    <StampLogo size={30} />
                    <div className="flex items-center">
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
                <div className="w-full max-w-md flex flex-col rounded-md border-2 border-foreground bg-card overflow-hidden shadow-[4px_4px_0_0_hsl(var(--foreground))]">
                    <div className="airmail-stripe h-2 shrink-0" aria-hidden="true" />
                    <Suspense fallback={<div className="p-8 text-center font-mono text-sm text-muted-foreground">{t("loadingForm")}</div>}>
                        <LoginForm />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}
