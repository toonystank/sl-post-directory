"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Loader2 } from "lucide-react";
import { showNativeToast } from "@/components/shell/NativeToast";

export default function ChangePasswordForm() {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (newPassword !== confirmPassword) {
            setError("New passwords do not match.");
            return;
        }

        if (newPassword.length < 8) {
            setError("New password must be at least 8 characters long.");
            return;
        }

        setLoading(true);

        try {
            const res = await fetch("/api/user/password", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword }),
            });

            const data = (await res.json()) as { error?: string };

            if (!res.ok) {
                setError(data.error || "Failed to update password.");
            } else {
                setSuccess("Password updated successfully.");
                showNativeToast("Password updated");
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
            }
        } catch {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div role="alert" className="bg-destructive/10 border border-destructive/40 text-destructive text-sm p-3 rounded-md font-medium">
                    {error}
                </div>
            )}
            {success && (
                <div role="status" className="bg-status-open/10 border border-status-open/40 text-status-open text-sm p-3 rounded-md font-medium">
                    {success}
                </div>
            )}

            <div>
                <label className="label-mono block mb-1.5" htmlFor="current-password">
                    Current Password
                </label>
                <Input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="h-12 text-base bg-background"
                />
            </div>

            <div className="pt-2 border-t border-border">
                <label className="label-mono block mb-1.5" htmlFor="new-password">
                    New Password
                </label>
                <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-12 text-base bg-background"
                />
            </div>

            <div>
                <label className="label-mono block mb-1.5" htmlFor="confirm-password">
                    Confirm New Password
                </label>
                <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-12 text-base bg-background"
                />
            </div>

            <Button type="submit" className="w-full sm:w-auto h-11 font-bold" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> : <Save className="w-4 h-4 mr-2" aria-hidden="true" />}
                Update Password
            </Button>
        </form>
    );
}
