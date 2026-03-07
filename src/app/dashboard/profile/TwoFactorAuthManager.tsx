"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, ShieldAlert, Loader2, QrCode, Copy, Trash2, Key } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Image from "next/image";

interface TwoFactorAuthManagerProps {
    enabled: boolean;
    backupCodes: string[];
}

export default function TwoFactorAuthManager({ enabled, backupCodes: initialBackupCodes }: TwoFactorAuthManagerProps) {
    const [is2FAEnabled, setIs2FAEnabled] = useState(enabled);
    const [backupCodes, setBackupCodes] = useState<string[]>(initialBackupCodes);

    // Setup state
    const [setupStep, setSetupStep] = useState<"idle" | "qr" | "verify" | "backup">("idle");
    const [qrCodeUrl, setQrCodeUrl] = useState("");
    const [secret, setSecret] = useState("");
    const [newBackupCodes, setNewBackupCodes] = useState<string[]>([]);
    const [tokenInput, setTokenInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Disable state
    const [disablePassword, setDisablePassword] = useState("");
    const [isDisableModalOpen, setIsDisableModalOpen] = useState(false);

    const handleStartSetup = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/user/2fa/setup", { method: "POST" });
            const data = await res.json();

            if (res.ok) {
                setQrCodeUrl(data.qrCodeUrl);
                setSecret(data.secret);
                setNewBackupCodes(data.backupCodes);
                setSetupStep("qr");
            } else {
                setError(data.error || "Failed to start 2FA setup");
            }
        } catch (err) {
            setError("Network error occurred");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifySetup = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/user/2fa/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token: tokenInput,
                    secret: secret,
                    backupCodes: newBackupCodes
                })
            });
            const data = await res.json();

            if (res.ok) {
                setIs2FAEnabled(true);
                setBackupCodes(newBackupCodes);
                setSetupStep("backup");
            } else {
                setError(data.error || "Invalid code");
            }
        } catch (err) {
            setError("Network error occurred");
        } finally {
            setLoading(false);
        }
    };

    const handleDisable2FA = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/user/2fa/disable", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: disablePassword })
            });
            const data = await res.json();

            if (res.ok) {
                setIs2FAEnabled(false);
                setBackupCodes([]);
                setIsDisableModalOpen(false);
                setDisablePassword("");
                setSetupStep("idle");
            } else {
                setError(data.error || "Incorrect password");
            }
        } catch (err) {
            setError("Network error occurred");
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        // Could add a toast here
    };

    if (is2FAEnabled && setupStep !== "backup") {
        return (
            <div className="space-y-6">
                <Alert className="bg-emerald-500/10 border-emerald-500/20 text-emerald-500">
                    <ShieldCheck className="h-4 w-4 stroke-emerald-500" />
                    <AlertTitle>Two-Factor Authentication is Enabled</AlertTitle>
                    <AlertDescription className="text-emerald-500/80">
                        Your account is secured with a secondary authenticator token.
                    </AlertDescription>
                </Alert>

                <div className="bg-muted/30 p-4 border border-border/50 rounded-xl space-y-4">
                    <div className="flex items-center gap-2">
                        <Key className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold">Backup Codes</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        You have <span className="font-bold text-foreground">{backupCodes.length}</span> backup codes remaining.
                        Store these in a secure place. If you lose your device, these codes are the only way to access your account.
                    </p>
                    {backupCodes.length < 5 && (
                        <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-500 mt-2">
                            <ShieldAlert className="h-4 w-4 stroke-amber-500" />
                            <AlertTitle>Low on backup codes</AlertTitle>
                            <AlertDescription className="text-amber-500/80">
                                You are running low on backup codes. You should disable and re-enable 2FA to generate new ones.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>

                <Dialog open={isDisableModalOpen} onOpenChange={setIsDisableModalOpen}>
                    <DialogTrigger asChild>
                        <Button variant="destructive" className="w-full sm:w-auto">
                            <Trash2 className="w-4 h-4 mr-2" /> Disable Two-Factor Auth
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Disable 2FA?</DialogTitle>
                            <DialogDescription>
                                This will significantly reduce your account security. Are you sure you want to proceed?
                            </DialogDescription>
                        </DialogHeader>
                        {error && <div className="text-sm font-medium text-destructive">{error}</div>}
                        <div className="space-y-1.5 py-4">
                            <label className="text-sm font-medium">Verify your password</label>
                            <Input
                                type="password"
                                required
                                value={disablePassword}
                                onChange={(e) => setDisablePassword(e.target.value)}
                                placeholder="Enter your current password"
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDisableModalOpen(false)}>Cancel</Button>
                            <Button variant="destructive" onClick={handleDisable2FA} disabled={loading || !disablePassword}>
                                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Confirm Disable
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        );
    }

    if (setupStep === "idle" || (is2FAEnabled && setupStep === "backup")) {
        return (
            <div className="space-y-6">
                {!is2FAEnabled ? (
                    <>
                        <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-500">
                            <ShieldAlert className="h-4 w-4 stroke-amber-500" />
                            <AlertTitle>Two-Factor Authentication is Disabled</AlertTitle>
                            <AlertDescription className="text-amber-500/80">
                                Enable 2FA to significantly increase the security of your admin account.
                            </AlertDescription>
                        </Alert>
                        <Button onClick={handleStartSetup} disabled={loading} className="w-full sm:w-auto">
                            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <QrCode className="w-4 h-4 mr-2" />}
                            Set Up Two-Factor Auth
                        </Button>
                    </>
                ) : (
                    <div className="space-y-4">
                        <Alert className="bg-emerald-500/10 border-emerald-500/20 text-emerald-500">
                            <ShieldCheck className="h-4 w-4 stroke-emerald-500" />
                            <AlertTitle>Setup Complete!</AlertTitle>
                            <AlertDescription className="text-emerald-500/80">
                                Two-Factor authentication has been successfully enabled on your account.
                            </AlertDescription>
                        </Alert>
                        <div className="bg-muted/30 p-6 border border-border/50 rounded-xl">
                            <h3 className="text-lg font-bold mb-2 text-primary flex items-center gap-2">
                                <Key className="w-5 h-5" /> Save your backup codes
                            </h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                If you lose access to your authenticator app, these codes can be used to log in.
                                <strong className="text-foreground ml-1">Each code can only be used once.</strong> Please copy them somewhere safe right now.
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                                {backupCodes.map((code, i) => (
                                    <div key={i} className="bg-background border border-border/50 p-2 rounded text-center font-mono text-sm tracking-widest font-bold">
                                        {code}
                                    </div>
                                ))}
                            </div>
                            <Button
                                variant="outline"
                                className="w-full border-primary/20 hover:bg-primary/10 hover:text-primary"
                                onClick={() => {
                                    copyToClipboard(backupCodes.join('\n'));
                                    setSetupStep("idle"); // reset view to show standard enabled screen
                                }}
                            >
                                <Copy className="w-4 h-4 mr-2" /> Copy codes and Finish
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Showing setup steps
    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold">Setup Two-Factor Authentication</h3>

            <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="bg-white p-4 rounded-xl">
                    {qrCodeUrl ? (
                        <Image src={qrCodeUrl} alt="2FA QR Code" width={200} height={200} className="rounded" />
                    ) : (
                        <div className="w-[200px] h-[200px] bg-muted animate-pulse rounded" />
                    )}
                </div>

                <div className="space-y-6 flex-1 w-full">
                    <div className="space-y-2">
                        <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Step 1</h4>
                        <p className="text-sm">Scan the QR code with an authenticator app like Google Authenticator, Authy, or 1Password.</p>
                        <p className="text-xs text-muted-foreground mt-1">If you can't scan the QR code, use this manual setup key:</p>
                        <div className="flex items-center gap-2 mt-2">
                            <code className="bg-muted px-2 py-1 rounded text-xs font-mono">{secret}</code>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(secret)}>
                                <Copy className="w-3 h-3" />
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Step 2</h4>
                        <p className="text-sm mb-2">Enter the 6-digit code from your app to verify setup.</p>
                        <div className="flex gap-3">
                            <Input
                                type="text"
                                placeholder="000000"
                                maxLength={6}
                                value={tokenInput}
                                onChange={e => setTokenInput(e.target.value.replace(/\D/g, ''))} // only allow digits
                                className="max-w-[150px] font-mono text-center tracking-widest bg-background"
                            />
                            <Button onClick={handleVerifySetup} disabled={loading || tokenInput.length !== 6}>
                                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Verify
                            </Button>
                        </div>
                        {error && <p className="text-sm text-destructive font-medium mt-1">{error}</p>}
                    </div>

                    <div className="pt-4 border-t border-border/50">
                        <Button variant="ghost" className="text-muted-foreground" onClick={() => setSetupStep("idle")}>
                            Cancel Setup
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
