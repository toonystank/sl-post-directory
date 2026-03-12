"use client";

import { useState } from "react";
import { ShieldCheck, ShieldAlert, CheckCircle2, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function SecuritySettingsPage() {
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
    const [secret, setSecret] = useState<string | null>(null);
    const [token, setToken] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSetup2FA = async () => {
        setLoading(true);
        setError("");
        setSuccess("");
        try {
            const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
            const data = await res.json();
            if (res.ok) {
                setQrCodeDataUrl(data.qrCode);
                setSecret(data.secret);
            } else {
                setError(data.error || "Failed to initiate 2FA setup");
            }
        } catch (err) {
            setError("Network error. Try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerify2FA = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/auth/2fa/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
            });
            const data = await res.json();

            if (res.ok) {
                setSuccess("Two-Factor Authentication is now enabled on your account.");
                setQrCodeDataUrl(null);
                setSecret(null);
            } else {
                setError(data.error || "Failed to verify code");
            }
        } catch (err) {
            setError("Network error. Try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl min-h-[calc(100vh-4rem)]">
            <div className="mb-10">
                <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                        <ShieldCheck className="w-7 h-7" />
                    </div>
                    Security Settings
                </h1>
                <p className="text-muted-foreground mt-2 ml-[52px]">Manage your account security and two-factor authentication.</p>
            </div>

            <Card className="border-border/50 shadow-xl overflow-hidden bg-card/50">
                <CardHeader className="border-b border-border/50 bg-card/80 px-8 py-6">
                    <div className="flex items-center gap-3">
                        <ShieldAlert className="w-6 h-6 text-primary" />
                        <div>
                            <CardTitle className="text-xl">Two-Factor Authentication (2FA)</CardTitle>
                            <CardDescription>Add an extra layer of security to your admin account.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                    {success ? (
                        <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex flex-col items-center justify-center text-center">
                            <CheckCircle2 className="w-12 h-12 mb-4" />
                            <h3 className="text-xl font-bold mb-2">2FA Enabled Successfully</h3>
                            <p className="text-sm">Your account is now protected with Two-Factor Authentication.</p>
                        </div>
                    ) : (
                        <>
                            {!qrCodeDataUrl ? (
                                <div className="space-y-4">
                                    <p className="text-muted-foreground text-sm">
                                        Protect your account by requiring a 6-digit code from your authenticator app (like Google Authenticator or Authy) every time you log in.
                                    </p>
                                    <Button onClick={handleSetup2FA} disabled={loading} size="lg" className="rounded-xl font-semibold">
                                        {loading ? "Generating..." : "Set Up 2FA"}
                                    </Button>
                                    {error && <p className="text-destructive text-sm font-medium">{error}</p>}
                                </div>
                            ) : (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <Badge className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center p-0">1</Badge>
                                            <h3 className="font-bold">Scan this QR Code</h3>
                                        </div>
                                        <p className="text-sm text-muted-foreground pl-8">
                                            Open your authenticator app and scan the QR code below.
                                        </p>
                                        <div className="pl-8">
                                            <div className="inline-block p-4 bg-white rounded-xl ring-4 ring-primary/10">
                                                <img src={qrCodeDataUrl} alt="2FA QR Code" className="w-48 h-48" />
                                            </div>
                                        </div>
                                        <p className="text-sm text-muted-foreground pl-8">
                                            Or enter this code manually: <span className="font-mono text-foreground font-bold tracking-widest bg-muted px-2 py-1 rounded">{secret}</span>
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <Badge className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center p-0">2</Badge>
                                            <h3 className="font-bold">Verify the Code</h3>
                                        </div>
                                        <p className="text-sm text-muted-foreground pl-8">
                                            Enter the 6-digit code generated by your app to confirm the setup.
                                        </p>
                                        <form onSubmit={handleVerify2FA} className="pl-8 space-y-4 max-w-xs">
                                            <Input
                                                type="text"
                                                placeholder="000000"
                                                value={token}
                                                onChange={(e) => setToken(e.target.value)}
                                                className="py-6 rounded-xl text-center text-2xl tracking-[0.5em] font-mono"
                                                maxLength={6}
                                                required
                                            />
                                            {error && <p className="text-destructive text-sm font-medium">{error}</p>}
                                            <Button type="submit" disabled={loading} className="w-full rounded-xl py-6 font-semibold">
                                                {loading ? "Verifying..." : "Verify & Enable"}
                                            </Button>
                                        </form>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
