"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Mail, Lock, AlertCircle, UserPlus, User, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StampLogo from "@/components/brand/StampLogo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Turnstile } from "@marsidev/react-turnstile";

export default function RegisterPage() {
    const t = useTranslations("Auth");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);

    const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setSuccess("");

        if (turnstileSiteKey && !turnstileToken) {
            setError("Please complete the Captcha to verify you are human.");
            setLoading(false);
            return;
        }

        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim(), email: email.trim(), password, turnstileToken }),
            });

            const data = await res.json();

            if (res.ok) {
                setSuccess(data.message || "Registration successful! Please check your email to verify your account.");
                setName("");
                setEmail("");
                setPassword("");
            } else {
                setError(data.error || "An error occurred during registration.");
            }
        } catch {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

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
                    <div className="p-5 sm:p-8">
                        <div className="mb-6">
                            <span className="label-mono inline-block rounded-sm border border-border bg-muted px-2 py-0.5 text-foreground">
                                Contributor Sign Up
                            </span>
                            <h1 className="display text-3xl sm:text-4xl mt-3">{t("registerTitle")}</h1>
                            <p className="text-sm text-muted-foreground mt-1.5">{t("registerSub")}</p>
                        </div>

                        {error && (
                            <div
                                role="alert"
                                className="mb-5 p-3.5 rounded-md bg-destructive/10 border border-destructive/40 flex items-center gap-3 text-destructive"
                            >
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                <p className="text-sm font-medium">{error}</p>
                            </div>
                        )}

                        {success && (
                            <div
                                role="status"
                                className="mb-5 p-3.5 rounded-md bg-status-open/10 border border-status-open/40 flex items-center gap-3 text-status-open"
                            >
                                <UserPlus className="w-5 h-5 shrink-0" />
                                <p className="text-sm font-medium">{success}</p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="label-mono block mb-1.5" htmlFor="name">
                                    {t("fullNameLabel")}
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                                        <User className="w-4 h-4" aria-hidden="true" />
                                    </div>
                                    <Input
                                        id="name"
                                        name="name"
                                        type="text"
                                        autoComplete="name"
                                        enterKeyHint="next"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="pl-10 h-12 text-base bg-background"
                                        placeholder="Kasun Perera"
                                        required
                                        disabled={loading || !!success}
                                    />
                                </div>
                            </div>

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
                                        disabled={loading || !!success}
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
                                        autoComplete="new-password"
                                        enterKeyHint="done"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-10 pr-12 h-12 text-base bg-background"
                                        placeholder="Min. 8 characters"
                                        required
                                        disabled={loading || !!success}
                                        minLength={8}
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

                            {turnstileSiteKey && (
                                <div className="flex justify-center py-2">
                                    <Turnstile
                                        siteKey={turnstileSiteKey}
                                        onSuccess={(token) => setTurnstileToken(token)}
                                        onExpire={() => setTurnstileToken(null)}
                                        onError={() => setError("Captcha error. Please try again.")}
                                    />
                                </div>
                            )}

                            <Button
                                type="submit"
                                disabled={loading || !!success}
                                className="w-full h-12 mt-2 text-base font-bold"
                                size="lg"
                            >
                                {loading ? t("creatingAccount") : t("registerLink")}
                            </Button>
                        </form>

                        <div className="mt-6 pt-4 border-t border-border text-center text-sm text-muted-foreground">
                            {t("haveAccount")}{" "}
                            <Link href="/login" className="text-primary hover:underline font-semibold">
                                {t("signIn")}
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
