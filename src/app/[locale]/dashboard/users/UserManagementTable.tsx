"use client";

import { useState } from "react";
import { UserPlus, Shield, ShieldCheck, User, Save, Trash2, ShieldAlert, KeyRound, ShieldOff, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";

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
    const [success, setSuccess] = useState("");
    const router = useRouter();

    const [newUserName, setNewUserName] = useState("");
    const [newUserEmail, setNewUserEmail] = useState("");
    const [newUserPassword, setNewUserPassword] = useState("");
    const [newUserRole, setNewUserRole] = useState<Role>("MODERATOR");

    const getRoleBadge = (role: string) => {
        switch (role) {
            case "SUPER_ADMIN":
                return <Badge variant="default" className="bg-destructive hover:bg-destructive"><ShieldAlert className="w-3 h-3 mr-1" /> Super</Badge>;
            case "ADMIN":
                return <Badge variant="default" className="bg-primary hover:bg-primary"><ShieldCheck className="w-3 h-3 mr-1" /> Admin</Badge>;
            case "MODERATOR":
                return <Badge variant="secondary"><Shield className="w-3 h-3 mr-1" /> Mod</Badge>;
            default:
                return <Badge variant="outline"><User className="w-3 h-3 mr-1" /> Contrib</Badge>;
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setSuccess("");

        try {
            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newUserName,
                    email: newUserEmail,
                    password: newUserPassword,
                    role: newUserRole
                })
            });

            if (res.ok) {
                const data = await res.json();
                setUsers([...users, data.user]);
                setSuccess(`Successfully created user ${data.user.email}`);
                setNewUserName("");
                setNewUserEmail("");
                setNewUserPassword("");
                router.refresh();
            } else {
                const err = await res.json();
                setError(err.error || "Failed to create user");
            }
        } catch (err) {
            setError("Network error occurred");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateRole = async (userId: string, currentRole: string, newRole: string) => {
        if (currentRole === newRole) return;
        setLoading(true);
        setError("");
        setSuccess("");

        try {
            const res = await fetch(`/api/admin/users/${userId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: newRole })
            });

            if (res.ok) {
                setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
                setSuccess("Role updated successfully.");
            } else {
                const err = await res.json();
                setError(err.error || "Failed to update role");
            }
        } catch (err) {
            setError("Network error occurred");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (userId: string, email: string) => {
        if (!confirm(`Are you absolutely sure you want to delete ${email}?`)) return;
        setLoading(true);
        setError("");
        setSuccess("");

        try {
            const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });

            if (res.ok) {
                setUsers(users.filter(u => u.id !== userId));
                setSuccess("User deleted.");
            } else {
                const err = await res.json();
                setError(err.error || "Failed to delete user");
            }
        } catch (err) {
            setError("Network error occurred");
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (userId: string, email: string) => {
        const newPassword = window.prompt(`Enter new temporary password for ${email} (min 8 chars):`);
        if (!newPassword || newPassword.length < 8) {
            if (newPassword) setError("Password must be at least 8 characters.");
            return;
        }
        setLoading(true); setError(""); setSuccess("");
        try {
            const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ newPassword })
            });
            if (res.ok) {
                setSuccess(`Password for ${email} has been reset.`);
            } else {
                const err = await res.json(); setError(err.error || "Failed to reset password");
            }
        } catch (err) { setError("Network error occurred"); } finally { setLoading(false); }
    };

    const handleReset2FA = async (userId: string, email: string) => {
        if (!confirm(`Are you sure you want to disable 2FA for ${email}?`)) return;
        setLoading(true); setError(""); setSuccess("");
        try {
            const res = await fetch(`/api/admin/users/${userId}/reset-2fa`, { method: "POST" });
            if (res.ok) {
                setUsers(users.map(u => u.id === userId ? { ...u, twoFactorEnabled: false } : u));
                setSuccess(`2FA has been disabled for ${email}.`);
            } else {
                const err = await res.json(); setError(err.error || "Failed to disable 2FA");
            }
        } catch (err) { setError("Network error occurred"); } finally { setLoading(false); }
    };

    const handleVerifyEmail = async (userId: string, email: string) => {
        if (!confirm(`Are you sure you want to forcefully verify the email for ${email}?`)) return;
        setLoading(true); setError(""); setSuccess("");
        try {
            const res = await fetch(`/api/admin/users/${userId}/verify-email`, { method: "POST" });
            if (res.ok) {
                setUsers(users.map(u => u.id === userId ? { ...u, emailVerified: new Date() } : u));
                setSuccess(`Email verified for ${email}.`);
            } else {
                const err = await res.json(); setError(err.error || "Failed to verify email");
            }
        } catch (err) { setError("Network error occurred"); } finally { setLoading(false); }
    };

    return (
        <div>
            {/* Create User Form Header */}
            <div className="bg-muted/30 p-6 border-b border-border/50">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                    <UserPlus className="w-4 h-4" /> Issue New Access
                </h3>

                {error && <div className="mb-4 text-xs font-semibold text-destructive bg-destructive/10 p-3 rounded-xl border border-destructive/20">{error}</div>}
                {success && <div className="mb-4 text-xs font-semibold text-emerald-500 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">{success}</div>}

                <form onSubmit={handleCreateUser} className="flex flex-col md:flex-row gap-3 items-end">
                    <div className="flex-1 w-full relative">
                        <label className="text-xs font-medium mb-1.5 block">Name</label>
                        <Input required value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Full Name" className="bg-background" />
                    </div>
                    <div className="flex-1 w-full">
                        <label className="text-xs font-medium mb-1.5 block">Email</label>
                        <Input required type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="admin@slpost.directory" className="bg-background" />
                    </div>
                    <div className="flex-1 w-full">
                        <label className="text-xs font-medium mb-1.5 block">Password</label>
                        <Input required type="password" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} placeholder="Secure Pw" className="bg-background" />
                    </div>
                    <div className="w-full md:w-40">
                        <label className="text-xs font-medium mb-1.5 block">Role</label>
                        <Select value={newUserRole} onValueChange={(val) => setNewUserRole(val as Role)}>
                            <SelectTrigger className="h-10 w-full bg-background border-input">
                                <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="MODERATOR">Moderator</SelectItem>
                                <SelectItem value="ADMIN">Admin</SelectItem>
                                <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button type="submit" disabled={loading} className="w-full md:w-auto h-10">
                        Create
                    </Button>
                </form>
            </div>

            {/* Users Table */}
            <div className="overflow-y-auto overflow-x-hidden max-h-[600px]">
                {/* Desktop Table */}
                <table className="hidden md:table w-full text-sm text-left relative">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border/50 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-4 font-medium">User</th>
                            <th className="px-6 py-4 font-medium">Role Level</th>
                            <th className="px-6 py-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {users.map((u) => (
                            <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-medium text-foreground">{u.name}</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">{u.email}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <Select
                                        value={u.role}
                                        onValueChange={(val) => handleUpdateRole(u.id, u.role, val)}
                                        disabled={loading}
                                    >
                                        <SelectTrigger className="h-8 text-xs font-medium bg-transparent border-0 shadow-none focus:ring-0 cursor-pointer hover:bg-muted/50 w-fit p-1.5 px-2 rounded-md -ml-2 text-foreground data-[state=open]:bg-muted/50">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="CONTRIBUTOR" className="text-xs">Contributor</SelectItem>
                                            <SelectItem value="MODERATOR" className="text-xs">Moderator</SelectItem>
                                            <SelectItem value="ADMIN" className="text-xs">Admin</SelectItem>
                                            <SelectItem value="SUPER_ADMIN" className="text-xs">Super Admin</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button
                                            title="Reset Password"
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 p-0 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                            onClick={() => handleResetPassword(u.id, u.email)}
                                            disabled={loading}
                                        >
                                            <KeyRound className="w-4 h-4" />
                                        </Button>

                                        {!u.emailVerified && (
                                            <Button
                                                title="Force Verify Email"
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 w-8 p-0 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-600"
                                                onClick={() => handleVerifyEmail(u.id, u.email)}
                                                disabled={loading}
                                            >
                                                <MailCheck className="w-4 h-4" />
                                            </Button>
                                        )}

                                        {u.twoFactorEnabled && (
                                            <Button
                                                title="Disable 2FA"
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 w-8 p-0 text-amber-500 hover:bg-amber-500/10 hover:text-amber-600"
                                                onClick={() => handleReset2FA(u.id, u.email)}
                                                disabled={loading}
                                            >
                                                <ShieldOff className="w-4 h-4" />
                                            </Button>
                                        )}

                                        <Button
                                            title="Revoke Access"
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 p-0 ml-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                            onClick={() => handleDeleteUser(u.id, u.email)}
                                            disabled={loading}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Mobile Cards */}
                <div className="md:hidden flex flex-col divide-y divide-border/50">
                    {users.map((u) => (
                        <div key={`mob-${u.id}`} className="p-4 flex flex-col gap-3 hover:bg-muted/30 transition-colors">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                                        {u.name.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-medium text-foreground truncate">{u.name}</div>
                                        <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex flex-wrap items-center justify-between gap-3 mt-1">
                                <Select
                                    value={u.role}
                                    onValueChange={(val) => handleUpdateRole(u.id, u.role, val)}
                                    disabled={loading}
                                >
                                    <SelectTrigger className="h-8 text-xs font-medium bg-muted/40 border-border/50 shadow-none focus:ring-0 cursor-pointer hover:bg-muted/70 w-auto px-3 rounded-lg text-foreground data-[state=open]:bg-muted/70 flex-1 max-w-[160px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="CONTRIBUTOR" className="text-xs">Contributor</SelectItem>
                                        <SelectItem value="MODERATOR" className="text-xs">Moderator</SelectItem>
                                        <SelectItem value="ADMIN" className="text-xs">Admin</SelectItem>
                                        <SelectItem value="SUPER_ADMIN" className="text-xs">Super Admin</SelectItem>
                                    </SelectContent>
                                </Select>

                                <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                        title="Reset Password"
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0 text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-lg border border-transparent hover:border-primary/20"
                                        onClick={() => handleResetPassword(u.id, u.email)}
                                        disabled={loading}
                                    >
                                        <KeyRound className="w-4 h-4" />
                                    </Button>

                                    {!u.emailVerified && (
                                        <Button
                                            title="Force Verify Email"
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 p-0 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-600 rounded-lg border border-transparent hover:border-emerald-500/20"
                                            onClick={() => handleVerifyEmail(u.id, u.email)}
                                            disabled={loading}
                                        >
                                            <MailCheck className="w-4 h-4" />
                                        </Button>
                                    )}

                                    {u.twoFactorEnabled && (
                                        <Button
                                            title="Disable 2FA"
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 p-0 text-amber-500 hover:bg-amber-500/10 hover:text-amber-600 rounded-lg border border-transparent hover:border-amber-500/20"
                                            onClick={() => handleReset2FA(u.id, u.email)}
                                            disabled={loading}
                                        >
                                            <ShieldOff className="w-4 h-4" />
                                        </Button>
                                    )}

                                    <Button
                                        title="Revoke Access"
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-lg border border-transparent hover:border-destructive/20 ml-1"
                                        onClick={() => handleDeleteUser(u.id, u.email)}
                                        disabled={loading}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
// End of file
