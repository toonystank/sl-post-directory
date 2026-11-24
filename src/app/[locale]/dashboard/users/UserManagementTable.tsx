"use client";

import { useState } from "react";
import { UserPlus, Trash2, KeyRound, ShieldOff, MailCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/shell/Sheet";
import { showNativeToast } from "@/components/shell/NativeToast";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

type Role = "SUPER_ADMIN" | "ADMIN" | "MODERATOR" | "CONTRIBUTOR";

interface UserData {
    id: string;
    name: string;
    email: string;
    role: string;
    twoFactorEnabled?: boolean;
    emailVerified?: Date | null;
}

export default function UserManagementTable({ initialUsers }: { initialUsers: UserData[] }) {
    const [users, setUsers] = useState<UserData[]>(initialUsers);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [newUserName, setNewUserName] = useState("");
    const [newUserEmail, setNewUserEmail] = useState("");
    const [newUserPassword, setNewUserPassword] = useState("");
    const [newUserRole, setNewUserRole] = useState<Role>("MODERATOR");

    const [resetPwUser, setResetPwUser] = useState<UserData | null>(null);
    const [tempPassword, setTempPassword] = useState("");

    const [confirmAction, setConfirmAction] = useState<{
        type: "delete" | "reset2fa" | "verifyEmail";
        user: UserData;
    } | null>(null);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newUserName.trim(),
                    email: newUserEmail.trim(),
                    password: newUserPassword,
                    role: newUserRole,
                }),
            });

            if (res.ok) {
                const data = (await res.json()) as { user: UserData };
                setUsers((prev) => [...prev, data.user]);
                showNativeToast(`Created ${data.user.email}`);
                setNewUserName("");
                setNewUserEmail("");
                setNewUserPassword("");
            } else {
                const err = (await res.json().catch(() => ({}))) as { error?: string };
                setError(err.error || "Failed to create user.");
            }
        } catch {
            setError("Network error occurred.");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateRole = async (userId: string, currentRole: string, newRole: string) => {
        if (currentRole === newRole) return;
        setLoading(true);
        setError("");

        try {
            const res = await fetch(`/api/admin/users/${userId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: newRole }),
            });

            if (res.ok) {
                setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
                showNativeToast("Role updated");
            } else {
                const err = (await res.json().catch(() => ({}))) as { error?: string };
                setError(err.error || "Failed to update role.");
            }
        } catch {
            setError("Network error occurred.");
        } finally {
            setLoading(false);
        }
    };

    const submitResetPassword = async () => {
        if (!resetPwUser || tempPassword.length < 8) {
            setError("Temporary password must be at least 8 characters.");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`/api/admin/users/${resetPwUser.id}/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ newPassword: tempPassword }),
            });
            if (res.ok) {
                showNativeToast(`Password reset for ${resetPwUser.email}`);
                setResetPwUser(null);
                setTempPassword("");
            } else {
                const err = (await res.json().catch(() => ({}))) as { error?: string };
                setError(err.error || "Failed to reset password.");
            }
        } catch {
            setError("Network error occurred.");
        } finally {
            setLoading(false);
        }
    };

    const executeConfirmedAction = async () => {
        if (!confirmAction) return;
        const { type, user } = confirmAction;
        setLoading(true);
        setError("");

        try {
            if (type === "delete") {
                const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
                if (res.ok) {
                    setUsers((prev) => prev.filter((u) => u.id !== user.id));
                    showNativeToast("User deleted");
                    setConfirmAction(null);
                } else {
                    const err = (await res.json().catch(() => ({}))) as { error?: string };
                    setError(err.error || "Failed to delete user.");
                }
            } else if (type === "reset2fa") {
                const res = await fetch(`/api/admin/users/${user.id}/reset-2fa`, { method: "POST" });
                if (res.ok) {
                    setUsers((prev) =>
                        prev.map((u) => (u.id === user.id ? { ...u, twoFactorEnabled: false } : u))
                    );
                    showNativeToast(`2FA disabled for ${user.email}`);
                    setConfirmAction(null);
                } else {
                    const err = (await res.json().catch(() => ({}))) as { error?: string };
                    setError(err.error || "Failed to disable 2FA.");
                }
            } else {
                const res = await fetch(`/api/admin/users/${user.id}/verify-email`, { method: "POST" });
                if (res.ok) {
                    setUsers((prev) =>
                        prev.map((u) => (u.id === user.id ? { ...u, emailVerified: new Date() } : u))
                    );
                    showNativeToast(`Email verified for ${user.email}`);
                    setConfirmAction(null);
                } else {
                    const err = (await res.json().catch(() => ({}))) as { error?: string };
                    setError(err.error || "Failed to verify email.");
                }
            }
        } catch {
            setError("Network error occurred.");
        } finally {
            setLoading(false);
        }
    };

    const generateTempPassword = () => {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#";
        let out = "";
        for (let i = 0; i < 12; i++) {
            out += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setTempPassword(out);
    };

    return (
        <div className="space-y-6">
            {/* Issue New Access Form */}
            <section className="rounded-md border-2 border-foreground bg-card p-4 sm:p-5 space-y-4 shadow-[3px_3px_0_0_hsl(var(--foreground))]">
                <h2 className="font-heading text-lg font-extrabold flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-primary" aria-hidden="true" />
                    <span>Issue New Access</span>
                </h2>

                {error && (
                    <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm font-medium text-destructive">
                        {error}
                    </div>
                )}

                <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                    <div>
                        <label className="label-mono block mb-1.5" htmlFor="new-user-name">
                            Name
                        </label>
                        <Input
                            id="new-user-name"
                            required
                            value={newUserName}
                            onChange={(e) => setNewUserName(e.target.value)}
                            placeholder="Full Name"
                            className="h-11 text-base bg-background"
                        />
                    </div>
                    <div>
                        <label className="label-mono block mb-1.5" htmlFor="new-user-email">
                            Email
                        </label>
                        <Input
                            id="new-user-email"
                            required
                            type="email"
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                            placeholder="admin@lankapost.org"
                            className="h-11 text-base bg-background"
                        />
                    </div>
                    <div>
                        <label className="label-mono block mb-1.5" htmlFor="new-user-pw">
                            Password
                        </label>
                        <Input
                            id="new-user-pw"
                            required
                            type="password"
                            minLength={8}
                            value={newUserPassword}
                            onChange={(e) => setNewUserPassword(e.target.value)}
                            placeholder="Min 8 chars"
                            className="h-11 text-base bg-background"
                        />
                    </div>
                    <div>
                        <label className="label-mono block mb-1.5" htmlFor="new-user-role">
                            Role
                        </label>
                        <Select value={newUserRole} onValueChange={(val) => setNewUserRole(val as Role)}>
                            <SelectTrigger id="new-user-role" className="h-11 w-full bg-background border-input">
                                <SelectValue placeholder="Role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="MODERATOR">Moderator</SelectItem>
                                <SelectItem value="ADMIN">Admin</SelectItem>
                                <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button type="submit" disabled={loading} className="h-11 w-full font-bold">
                        Create User
                    </Button>
                </form>
            </section>

            {/* Users List (Mobile Cards + Desktop Table) */}
            <section className="rounded-md border-2 border-foreground bg-card overflow-hidden">
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="border-b border-border bg-muted/50 text-xs font-mono uppercase text-muted-foreground">
                            <tr>
                                <th className="px-5 py-3.5">User</th>
                                <th className="px-5 py-3.5">Role</th>
                                <th className="px-5 py-3.5">Security</th>
                                <th className="px-5 py-3.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {users.map((u) => (
                                <tr key={u.id} className="hover:bg-muted/30">
                                    <td className="px-5 py-3.5">
                                        <p className="font-bold text-foreground">{u.name}</p>
                                        <p className="text-xs text-muted-foreground">{u.email}</p>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <Select
                                            value={u.role}
                                            onValueChange={(val) => void handleUpdateRole(u.id, u.role, val)}
                                            disabled={loading}
                                        >
                                            <SelectTrigger className="h-10 w-40 bg-background">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="CONTRIBUTOR">Contributor</SelectItem>
                                                <SelectItem value="MODERATOR">Moderator</SelectItem>
                                                <SelectItem value="ADMIN">Admin</SelectItem>
                                                <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </td>
                                    <td className="px-5 py-3.5 font-mono text-xs">
                                        <span>{u.twoFactorEnabled ? "2FA On" : "2FA Off"}</span>
                                        <span> · </span>
                                        <span>{u.emailVerified ? "Verified" : "Unverified"}</span>
                                    </td>
                                    <td className="px-5 py-3.5 text-right">
                                        <div className="inline-flex items-center gap-1.5">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                title="Reset Password"
                                                aria-label={`Reset password for ${u.email}`}
                                                onClick={() => {
                                                    setResetPwUser(u);
                                                    setTempPassword("");
                                                }}
                                                disabled={loading}
                                                className="h-10 w-10 p-0"
                                            >
                                                <KeyRound className="w-4 h-4" aria-hidden="true" />
                                            </Button>
                                            {!u.emailVerified && (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    title="Force Verify Email"
                                                    aria-label={`Force verify ${u.email}`}
                                                    onClick={() => setConfirmAction({ type: "verifyEmail", user: u })}
                                                    disabled={loading}
                                                    className="h-10 w-10 p-0 text-status-open border-status-open/40"
                                                >
                                                    <MailCheck className="w-4 h-4" aria-hidden="true" />
                                                </Button>
                                            )}
                                            {u.twoFactorEnabled && (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    title="Disable 2FA"
                                                    aria-label={`Disable 2FA for ${u.email}`}
                                                    onClick={() => setConfirmAction({ type: "reset2fa", user: u })}
                                                    disabled={loading}
                                                    className="h-10 w-10 p-0 text-status-closing border-status-closing/40"
                                                >
                                                    <ShieldOff className="w-4 h-4" aria-hidden="true" />
                                                </Button>
                                            )}
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                title="Revoke Access"
                                                aria-label={`Delete ${u.email}`}
                                                onClick={() => setConfirmAction({ type: "delete", user: u })}
                                                disabled={loading}
                                                className="h-10 w-10 p-0 text-destructive hover:bg-destructive/10"
                                            >
                                                <Trash2 className="w-4 h-4" aria-hidden="true" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-border">
                    {users.map((u) => (
                        <div key={`mob-${u.id}`} className="p-4 space-y-3">
                            <div>
                                <p className="font-heading text-base font-extrabold">{u.name}</p>
                                <p className="text-xs text-muted-foreground">{u.email}</p>
                                <p className="font-mono text-[11px] text-muted-foreground mt-1">
                                    {u.twoFactorEnabled ? "2FA Active" : "No 2FA"} · {u.emailVerified ? "Verified" : "Unverified"}
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Select
                                    value={u.role}
                                    onValueChange={(val) => void handleUpdateRole(u.id, u.role, val)}
                                    disabled={loading}
                                >
                                    <SelectTrigger className="h-11 flex-1 min-w-[140px] bg-background">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="CONTRIBUTOR">Contributor</SelectItem>
                                        <SelectItem value="MODERATOR">Moderator</SelectItem>
                                        <SelectItem value="ADMIN">Admin</SelectItem>
                                        <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        setResetPwUser(u);
                                        setTempPassword("");
                                    }}
                                    aria-label={`Reset password for ${u.email}`}
                                    className="h-11 w-11 p-0"
                                >
                                    <KeyRound className="w-4 h-4" aria-hidden="true" />
                                </Button>

                                {!u.emailVerified && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setConfirmAction({ type: "verifyEmail", user: u })}
                                        aria-label={`Force verify ${u.email}`}
                                        className="h-11 w-11 p-0 text-status-open border-status-open/40"
                                    >
                                        <MailCheck className="w-4 h-4" aria-hidden="true" />
                                    </Button>
                                )}

                                {u.twoFactorEnabled && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setConfirmAction({ type: "reset2fa", user: u })}
                                        aria-label={`Disable 2FA for ${u.email}`}
                                        className="h-11 w-11 p-0 text-status-closing border-status-closing/40"
                                    >
                                        <ShieldOff className="w-4 h-4" aria-hidden="true" />
                                    </Button>
                                )}

                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setConfirmAction({ type: "delete", user: u })}
                                    aria-label={`Delete ${u.email}`}
                                    className="h-11 w-11 p-0 border border-destructive/30 text-destructive"
                                >
                                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Reset Password Sheet (replaces window.prompt) */}
            <Sheet open={!!resetPwUser} onOpenChange={(open) => !open && setResetPwUser(null)}>
                <SheetContent
                    title="Reset Temporary Password"
                    description={resetPwUser ? `Set a temporary password for ${resetPwUser.email}` : ""}
                    bodyClassName="space-y-4"
                    footer={
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setResetPwUser(null)}
                                className="h-11 border-2 border-foreground"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                disabled={loading || tempPassword.length < 8}
                                onClick={() => void submitResetPassword()}
                                className="h-11 font-bold"
                            >
                                Apply Password
                            </Button>
                        </div>
                    }
                >
                    <div>
                        <label className="label-mono block mb-1.5" htmlFor="reset-temp-pw">
                            Temporary Password (Min. 8 chars)
                        </label>
                        <div className="flex gap-2">
                            <Input
                                id="reset-temp-pw"
                                type="text"
                                value={tempPassword}
                                onChange={(e) => setTempPassword(e.target.value)}
                                placeholder="Enter or generate password"
                                className="h-12 text-base font-mono bg-background"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={generateTempPassword}
                                className="h-12 shrink-0 border-foreground font-bold gap-1.5"
                            >
                                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                                <span>Generate</span>
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            <ConfirmDialog
                open={!!confirmAction}
                onOpenChange={(open) => !open && setConfirmAction(null)}
                title={
                    confirmAction?.type === "delete"
                        ? "Delete User Account"
                        : confirmAction?.type === "reset2fa"
                          ? "Disable Two-Factor Auth"
                          : "Force Verify Email"
                }
                description={
                    confirmAction?.type === "delete"
                        ? `Permanently revoke access and delete ${confirmAction.user.email}?`
                        : confirmAction?.type === "reset2fa"
                          ? `Disable 2FA protection for ${confirmAction.user.email}?`
                          : confirmAction
                            ? `Mark ${confirmAction.user.email} as verified immediately?`
                            : ""
                }
                confirmLabel={
                    confirmAction?.type === "delete"
                        ? "Delete Account"
                        : confirmAction?.type === "reset2fa"
                          ? "Disable 2FA"
                          : "Verify Email"
                }
                destructive={confirmAction?.type === "delete"}
                loading={loading}
                onConfirm={executeConfirmedAction}
            />
        </div>
    );
}
