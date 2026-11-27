"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, ShieldAlert, Loader2, QrCode, Copy, Trash2, Key } from "lucide-react";
import { Sheet, SheetContent } from "@/components/shell/Sheet";
import { showNativeToast } from "@/components/shell/NativeToast";
import Image from "next/image";

interface TwoFactorAuthManagerProps {
    enabled: boolean;
    backupCodeCount: number;
}

export default function TwoFactorAuthManager({
    enabled,
    backupCodeCount: initialBackupCodeCount,
}: TwoFactorAuthManagerProps) {
    const [is2FAEnabled, setIs2FAEnabled] = useState(enabled);
    const [backupCodeCount, setBackupCodeCount] = useState<number>(initialBackupCodeCount);

    const [setupStep, setSetupStep] = useState<"idle" | "qr" | "backup">("idle");
    const [qrCodeUrl, setQrCodeUrl] = useState("");
    const [newBackupCodes, setNewBackupCodes] = useState<string[]>([]);
    const [tokenInput, setTokenInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [disablePassword, setDisablePassword] = useState("");
    const [isDisableSheetOpen, setIsDisableSheetOpen] = useState(false);

    const handleStartSetup = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/user/2fa/setup", { method: "POST" });
            const data = (await res.json()) as {
                qrCodeUrl: string;
                backupCodes: string[];
                error?: string;
            };

            if (res.ok) {
                setQrCodeUrl(data.qrCodeUrl);
                setNewBackupCodes(data.backupCodes);
                setSetupStep("qr");
            } else {
                setError(data.error || "Failed to start 2FA setup");
            }
        } catch {
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
                }),
            });
            const data = (await res.json()) as { error?: string };

            if (res.ok) {
                setIs2FAEnabled(true);
                setBackupCodeCount(newBackupCodes.length);
                setSetupStep("backup");
                showNativeToast("2FA enabled");
            } else {
                setError(data.error || "Invalid code");
            }
        } catch {
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
                body: JSON.stringify({ password: disablePassword }),
            });
            const data = (await res.json()) as { error?: string };

            if (res.ok) {
                setIs2FAEnabled(false);
                setBackupCodeCount(0);
                setNewBackupCodes([]);
                setIsDisableSheetOpen(false);
                setDisablePassword("");
                setSetupStep("idle");
                showNativeToast("2FA disabled");
            } else {
                setError(data.error || "Incorrect password");
            }
        } catch {
            setError("Network error occurred");
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string, label: string) => {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
            void navigator.clipboard.writeText(text);
            showNativeToast(label);
        }
    };

    if (is2FAEnabled && setupStep !== "backup") {
        return (
            <div className="space-y-5">
                <div className="rounded-md border border-status-open/40 bg-status-open/10 p-4 flex items-start gap-3 text-status-open">
                    <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                        <p className="text-sm font-extrabold">Two-Factor Authentication is Active</p>
                        <p className="text-xs opacity-90 mt-0.5">
                            Your login is protected with an authenticator app and recovery backup codes.
                        </p>
                    </div>
                </div>

                <div className="rounded-md border border-border bg-muted/40 p-4 space-y-2.5">
                    <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-primary" aria-hidden="true" />
                        <h3 className="font-heading text-base font-extrabold">Recovery Backup Codes</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        You have <strong className="text-foreground">{backupCodeCount}</strong> backup code
                        {backupCodeCount === 1 ? "" : "s"} remaining. Each alphanumeric code works once on the Sign-In 2FA screen.
                    </p>
                    {backupCodeCount < 5 && (
                        <p className="text-xs font-semibold text-status-closing">
                            Running low on recovery codes — disable and re-enable 2FA to generate a fresh batch.
                        </p>
                    )}
                </div>

                <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                        setError("");
                        setIsDisableSheetOpen(true);
                    }}
                    className="h-11 w-full sm:w-auto font-bold"
                >
                    <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" />
                    Disable Two-Factor Auth
                </Button>

                <Sheet open={isDisableSheetOpen} onOpenChange={setIsDisableSheetOpen}>
                    <SheetContent
                        title="Disable Two-Factor Auth"
                        description="Verify your password to remove 2FA protection from this account."
                        bodyClassName="space-y-4"
                        footer={
                            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsDisableSheetOpen(false)}
                                    className="h-11 border-2 border-foreground"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    disabled={loading || !disablePassword}
                                    onClick={() => void handleDisable2FA()}
                                    className="h-11 font-bold"
                                >
                                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
                                    Confirm Disable
                                </Button>
                            </div>
                        }
                    >
                        {error && (
                            <p role="alert" className="text-sm font-medium text-destructive">
                                {error}
                            </p>
                        )}
                        <div>
                            <label className="label-mono block mb-1.5" htmlFor="disable-2fa-pw">
                                Current Password
                            </label>
                            <Input
                                id="disable-2fa-pw"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={disablePassword}
                                onChange={(e) => setDisablePassword(e.target.value)}
                                placeholder="Enter your password"
                                className="h-12 text-base bg-background"
                            />
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        );
    }

    if (setupStep === "idle" || (is2FAEnabled && setupStep === "backup")) {
        return (
            <div className="space-y-5">
                {!is2FAEnabled ? (
                    <>
                        <div className="rounded-md border border-status-closing/40 bg-status-closing/10 p-4 flex items-start gap-3 text-status-closing">
                            <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
                            <div>
                                <p className="text-sm font-extrabold">Two-Factor Auth is Disabled</p>
                                <p className="text-xs opacity-90 mt-0.5">
                                    Enable an authenticator app to protect your admin and directory actions.
                                </p>
                            </div>
                        </div>
                        {error && (
                            <p role="alert" className="text-sm font-medium text-destructive">
                                {error}
                            </p>
                        )}
                        <Button
                            type="button"
                            onClick={() => void handleStartSetup()}
                            disabled={loading}
                            className="h-11 w-full sm:w-auto font-bold"
                        >
                            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> : <QrCode className="w-4 h-4 mr-2" aria-hidden="true" />}
                            Set Up Two-Factor Auth
                        </Button>
                    </>
                ) : (
                    <div className="space-y-4">
                        <div className="rounded-md border border-status-open/40 bg-status-open/10 p-4 text-status-open">
                            <p className="text-sm font-extrabold">2FA Enabled Successfully</p>
                        </div>
                        <div className="rounded-md border-2 border-foreground bg-muted/30 p-4 sm:p-5 space-y-4">
                            <div className="flex items-center gap-2 text-primary">
                                <Key className="w-5 h-5" aria-hidden="true" />
                                <h3 className="font-heading text-lg font-extrabold">Save Your Backup Codes</h3>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Store these recovery codes safely. Each code works once if you lose your authenticator app.
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                {newBackupCodes.map((code, i) => (
                                    <div
                                        key={i}
                                        className="rounded-sm border border-foreground/40 bg-background p-2 text-center font-mono text-xs font-bold tracking-wider"
                                    >
                                        {code}
                                    </div>
                                ))}
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full h-11 border-2 border-foreground font-bold"
                                onClick={() => {
                                    copyToClipboard(newBackupCodes.join("\n"), "Backup codes copied");
                                    setNewBackupCodes([]);
                                    setSetupStep("idle");
                                }}
                            >
                                <Copy className="w-4 h-4 mr-2" aria-hidden="true" />
                                Copy Codes &amp; Finish
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <h3 className="font-heading text-lg font-extrabold">Set Up Two-Factor Auth</h3>
            <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="rounded-md border-2 border-foreground bg-white p-3 shrink-0">
                    {qrCodeUrl ? (
                        <Image src={qrCodeUrl} alt="2FA QR Code" width={180} height={180} className="rounded" />
                    ) : (
                        <div className="w-[180px] h-[180px] bg-muted animate-pulse rounded" />
                    )}
                </div>

                <div className="space-y-5 flex-1 w-full">
                    <div className="space-y-2">
                        <p className="label-mono">Step 1 · Scan QR Code</p>
                        <p className="text-sm text-muted-foreground">
                            Scan this QR code using Google Authenticator, Authy, or 1Password:
                        </p>
                    </div>

                    <div className="space-y-2">
                        <p className="label-mono">Step 2 · Verify 6-Digit Code</p>
                        <div className="flex gap-2">
                            <Input
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                placeholder="000000"
                                maxLength={6}
                                value={tokenInput}
                                onChange={(e) => setTokenInput(e.target.value.replace(/\D/g, ""))}
                                className="h-12 max-w-[160px] font-mono text-lg text-center tracking-widest bg-background"
                            />
                            <Button
                                type="button"
                                onClick={() => void handleVerifySetup()}
                                disabled={loading || tokenInput.length !== 6}
                                className="h-12 font-bold px-5"
                            >
                                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
                                Verify
                            </Button>
                        </div>
                        {error && (
                            <p role="alert" className="text-sm text-destructive font-medium">
                                {error}
                            </p>
                        )}
                    </div>

                    <Button type="button" variant="ghost" onClick={() => setSetupStep("idle")} className="h-10">
                        Cancel Setup
                    </Button>
                </div>
            </div>
        </div>
    );
}
