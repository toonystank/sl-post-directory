"use client";

import { signIn } from "next-auth/react";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, AlertCircle, LogIn, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

function LoginForm() {
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
                    setError(""); // Clear previous errors
                } else {
                    setError(res.error);
                }
            } else {
                router.push("/dashboard");
                router.refresh();
            }
        } catch (err) {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <CardContent className="p-8">
            {isVerified && !error && (
                <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-emerald-500">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm font-medium">Your email has been verified! You can now sign in.</p>
                </div>
            )}

            {error && (
                <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-3 text-destructive">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                {!show2FA ? (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1.5" htmlFor="email">
                                Email Address
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
                                    className="pl-10 py-5 rounded-xl"
                                    placeholder="admin@slpost.directory"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1.5" htmlFor="password">
                                Password
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
                                    className="pl-10 py-5 rounded-xl"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full py-5 rounded-xl mt-4 text-base font-semibold"
                            size="lg"
                        >
                            {loading ? "Signing in..." : "Sign In"}
                        </Button>
                    </>
                ) : (
                    <div className="space-y-4">
                        <div className="text-center mb-2">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                                <Lock className="w-6 h-6 text-primary" />
                            </div>
                            <h2 className="text-lg font-semibold">Two-Factor Authentication</h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                Enter the 6-digit code from your authenticator app
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1.5" htmlFor="token">
                                Authentication Code
                            </label>
                            <Input
                                id="token"
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                value={token}
                                onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
                                className="py-5 rounded-xl text-center tracking-widest text-xl font-mono"
                                placeholder="000000"
                                required
                                maxLength={6}
                                autoFocus
                            />
                        </div>

                        <div className="flex flex-col gap-2 mt-4">
                            <Button
                                type="submit"
                                disabled={loading || token.length < 6}
                                className="w-full py-5 rounded-xl text-base font-semibold"
                                size="lg"
                            >
                                {loading ? "Verifying..." : "Verify Code"}
                            </Button>

                            <Button
                                type="button"
                                variant="ghost"
                                disabled={loading}
                                className="w-full rounded-xl text-sm"
                                onClick={() => {
                                    setShow2FA(false);
                                    setToken("");
                                    setError("");
                                }}
                            >
                                ← Back to Sign In
                            </Button>
                        </div>
                    </div>
                )}
            </form>

            {!show2FA && (
                <div className="mt-6 text-center text-sm text-muted-foreground">
                    Don't have an account?{" "}
                    <Link href="/register" className="text-primary hover:underline font-medium">
                        Register
                    </Link>
                </div>
            )}
        </CardContent>
    );
}

export default function LoginPage() {
    return (
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <Badge variant="secondary" className="mb-4 bg-secondary/10 text-secondary border-secondary/20">
                        <LogIn className="w-3 h-3 mr-1.5" /> Secure Access
                    </Badge>
                    <h1 className="text-3xl font-extrabold tracking-tight mb-2">Welcome Back</h1>
                    <p className="text-muted-foreground">Sign in to the dashboard</p>
                </div>

                <Card className="shadow-2xl border-border/50 bg-card/50 backdrop-blur-xl">
                    <Suspense fallback={<CardContent className="p-8"><p className="text-center text-muted-foreground">Loading form...</p></CardContent>}>
                        <LoginForm />
                    </Suspense>
                </Card>
            </div>
        </div>
    );
}
