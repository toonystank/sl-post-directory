"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, AlertCircle, UserPlus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Turnstile } from "@marsidev/react-turnstile";

export default function RegisterPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

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
                // Clear form
                setName("");
                setEmail("");
                setPassword("");
            } else {
                setError(data.error || "An error occurred during registration.");
            }
        } catch (err) {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <Badge variant="secondary" className="mb-4 bg-primary/10 text-primary border-primary/20">
                        <UserPlus className="w-3 h-3 mr-1.5" /> Join the Community
                    </Badge>
                    <h1 className="text-3xl font-extrabold tracking-tight mb-2">Create an Account</h1>
                    <p className="text-muted-foreground">Become a contributor to SL Post Directory</p>
                </div>

                <Card className="shadow-2xl border-border/50 bg-card/50 backdrop-blur-xl">
                    <CardContent className="p-8">
                        {error && (
                            <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-3 text-destructive">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <p className="text-sm font-medium">{error}</p>
                            </div>
                        )}

                        {success && (
                            <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-emerald-500">
                                <UserPlus className="w-5 h-5 flex-shrink-0" />
                                <p className="text-sm font-medium">{success}</p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1.5" htmlFor="name">
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
                                        className="pl-10 py-5 rounded-xl"
                                        placeholder="John Doe"
                                        required
                                        disabled={loading || !!success}
                                    />
                                </div>
                            </div>

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
                                        placeholder="hey@example.com"
                                        required
                                        disabled={loading || !!success}
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
                                className="w-full py-5 rounded-xl mt-4 text-base font-semibold"
                                size="lg"
                            >
                                {loading ? "Creating account..." : "Register"}
                            </Button>
                        </form>

                        <div className="mt-6 text-center text-sm text-muted-foreground">
                            Already have an account?{" "}
                            <Link href="/login" className="text-primary hover:underline font-medium">
                                Sign In
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
