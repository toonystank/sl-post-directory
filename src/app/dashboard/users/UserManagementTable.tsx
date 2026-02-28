"use client";

import { useState } from "react";
import { UserPlus, Shield, ShieldCheck, User, Save, Trash2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";

type Role = "SUPER_ADMIN" | "ADMIN" | "MODERATOR" | "CONTRIBUTOR";

interface UserData {
    id: string;
    name: string;
    email: string;
    role: string;
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
                        <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={newUserRole}
                            onChange={e => setNewUserRole(e.target.value as Role)}
                        >
                            <option value="MODERATOR">Moderator</option>
                            <option value="ADMIN">Admin</option>
                            <option value="SUPER_ADMIN">Super Admin</option>
                        </select>
                    </div>
                    <Button type="submit" disabled={loading} className="w-full md:w-auto h-10">
                        Create
                    </Button>
                </form>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left relative">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border/50">
                        <tr>
                            <th className="px-6 py-4 font-medium">User</th>
                            <th className="px-6 py-4 font-medium">Role Level</th>
                            <th className="px-6 py-4 font-medium text-right">Danger Zone</th>
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
                                    <select
                                        className="text-xs font-medium bg-transparent border-0 focus:ring-0 cursor-pointer hover:bg-muted/50 p-1.5 rounded-md -ml-1.5"
                                        value={u.role}
                                        disabled={loading}
                                        onChange={(e) => handleUpdateRole(u.id, u.role, e.target.value)}
                                    >
                                        <option value="CONTRIBUTOR">Contributor</option>
                                        <option value="MODERATOR">Moderator</option>
                                        <option value="ADMIN">Admin</option>
                                        <option value="SUPER_ADMIN">Super Admin</option>
                                    </select>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                        onClick={() => handleDeleteUser(u.id, u.email)}
                                        disabled={loading}
                                    >
                                        <Trash2 className="w-4 h-4" /> Revoke
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
// End of file
