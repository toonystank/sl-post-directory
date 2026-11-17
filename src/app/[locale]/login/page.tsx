"use client";

import { signIn } from "next-auth/react";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Mail, Lock, AlertCircle, CheckCircle2 } from "lucide-react";
import { Link, useRouter } from "@/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StampLogo from "@/components/brand/StampLogo";

function LoginForm() {
    const t = useTranslations("Auth");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [token, setToken] = useState("");
    const [show2FA, setShow2FA] = useState(false);
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
            const res = await signIn("credentials", {
                email,
                password,
                token: show2FA ? token : "",
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

    return (
        <div className="p-6 md:p-8">
            <div className="mb-6">
                <StampLogo size={36} />
                <h1 className="display text-3xl mt-4">{t("loginTitle")}</h1>
                <p className="text-sm text-muted-foreground mt-1">{t("loginSub")}</p>
            </div>

            {isVerified && !error && (
                <div className="mb-5 p-3.5 rounded-md bg-status-open/10 border border-status-open/40 flex items-center gap-3 text-status-open">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-medium">{t("verifiedMsg")}</p>
                </div>
            )}

            {error && (
                <div className="mb-5 p-3.5 rounded-md bg-destructive/10 border border-destructive/30 flex items-center gap-3 text-destructive">
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
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                                    <Mail className="w-4 h-4" />
                                </div>
                                <Input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10 h-11"
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
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                                    <Lock className="w-4 h-4" />
                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10 h-11"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-11 mt-2 text-base"
                            size="lg"
                        >
                            {loading ? t("signingIn") : t("signIn")}
                        </Button>
                    </>
                ) : (
                    <div className="space-y-4">
                        <div className="border-y border-border py-3">
                            <h2 className="font-heading text-lg font-extrabold [font-stretch:82%]">{t("twoFactorTitle")}</h2>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                {t("twoFactorSub")}
                            </p>
                        </div>
                        <div>
                            <label className="label-mono block mb-1.5" htmlFor="token">
                                {t("authCodeLabel")}
                            </label>
                            <Input
                                id="token"
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                value={token}
                                onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
                                className="h-12 text-center tracking-widest text-xl font-mono"
                                placeholder="000000"
                                required
                                maxLength={6}
                                autoFocus
                            />
                        </div>

                        <div className="flex flex-col gap-2 pt-1">
                            <Button
                                type="submit"
                                disabled={loading || token.length < 6}
                                className="w-full h-11 text-base"
                                size="lg"
                            >
                                {loading ? t("verifying") : t("verifyCode")}
                            </Button>

                            <Button
                                type="button"
                                variant="ghost"
                                disabled={loading}
                                className="w-full text-sm"
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
        <div className="min-h-[calc(100dvh-var(--appbar-h))] md:min-h-[calc(100vh-8rem)] flex items-stretch md:items-center justify-center md:p-6">
            <div className="w-full md:max-w-md flex flex-col rounded-none md:rounded-md md:border-2 border-foreground bg-card overflow-hidden md:shadow-[5px_5px_0_0_hsl(var(--foreground))]">
                <div className="airmail-stripe h-2 shrink-0" aria-hidden="true" />
                <div className="flex-1 flex flex-col justify-center">
                    <Suspense fallback={<div className="p-8 text-center font-mono text-sm text-muted-foreground">{t("loadingForm")}</div>}>
                        <LoginForm />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}
