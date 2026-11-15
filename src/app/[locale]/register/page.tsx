"use client";

import { useState } from "react";
import { Mail, Lock, AlertCircle, UserPlus, User } from "lucide-react";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StampLogo from "@/components/brand/StampLogo";
import { Turnstile } from "@marsidev/react-turnstile";

export default function RegisterPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
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
                body: JSON.stringify({ name, email, password, turnstileToken }),
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
        <div className="min-h-[calc(100dvh-var(--appbar-h))] md:min-h-[calc(100vh-8rem)] flex items-stretch md:items-center justify-center md:p-6">
            <div className="w-full md:max-w-md flex flex-col rounded-none md:rounded-md md:border-2 border-foreground bg-card overflow-hidden md:shadow-[5px_5px_0_0_hsl(var(--foreground))]">
                <div className="airmail-stripe h-2 shrink-0" aria-hidden="true" />
                <div className="flex-1 flex flex-col justify-center p-6 md:p-8">
                    <div className="mb-6">
                        <StampLogo size={36} />
                        <h1 className="display text-3xl mt-4">Create an Account</h1>
                        <p className="text-sm text-muted-foreground mt-1">Become a contributor to Lanka Post Directory</p>
                    </div>

                    {error && (
                        <div className="mb-5 p-3.5 rounded-md bg-destructive/10 border border-destructive/30 flex items-center gap-3 text-destructive">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    {success && (
                        <div className="mb-5 p-3.5 rounded-md bg-status-open/10 border border-status-open/40 flex items-center gap-3 text-status-open">
                            <UserPlus className="w-5 h-5 shrink-0" />
                            <p className="text-sm font-medium">{success}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="label-mono block mb-1.5" htmlFor="name">
                                Full Name
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                                    <User className="w-4 h-4" />
                                </div>
                                <Input
                                    id="name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="pl-10 h-11"
                                    placeholder="Kasun Perera"
                                    required
                                    disabled={loading || !!success}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="label-mono block mb-1.5" htmlFor="email">
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
                                    className="pl-10 h-11"
                                    placeholder="you@example.com"
                                    required
                                    disabled={loading || !!success}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="label-mono block mb-1.5" htmlFor="password">
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
                                    className="pl-10 h-11"
                                    placeholder="••••••••"
                                    required
                                    disabled={loading || !!success}
                                    minLength={8}
                                />
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
                            className="w-full h-11 mt-2 text-base"
                            size="lg"
                        >
                            {loading ? "Creating account..." : "Register"}
                        </Button>
                    </form>

                    <div className="mt-6 pt-4 border-t border-border text-center text-sm text-muted-foreground">
                        Already have an account?{" "}
                        <Link href="/login" className="text-primary hover:underline font-semibold">
                            Sign In
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
