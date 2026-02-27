import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import { ShieldCheck, User, Edit3, Settings } from "lucide-react";

const prisma = new PrismaClient();

export default async function AdminDashboard() {
    // Static export workaround: assume valid admin session for prototype
    const session = { user: { id: "1", role: "ADMIN", name: "Super Admin" } };

    if (!session || session.user.role !== "ADMIN") {
        redirect("/login");
    }

    // Dashboard Stats
    const [totalOffices, pendingEdits, employeeCount] = await Promise.all([
        prisma.postOffice.count(),
        prisma.editRequest.count({ where: { status: "PENDING" } }),
        prisma.user.count({ where: { role: "EMPLOYEE" } })
    ]);

    return (
        <div className="container mx-auto px-4 py-12 max-w-6xl">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <ShieldCheck className="w-8 h-8 text-[var(--primary)]" />
                        Admin Dashboard
                    </h1>
                    <p className="text-[var(--text-muted)] mt-1">Manage directories, user roles, and moderation queues.</p>
                </div>
                <div className="flex items-center gap-3 bg-[var(--surface)] px-4 py-2 rounded-full border border-[var(--surface-border)]">
                    <User className="w-5 h-5 text-[var(--text-muted)]" />
                    <span className="font-medium text-sm">{session.user.name}</span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div className="glass-panel p-6 rounded-2xl border-l-4 border-[var(--primary)]">
                    <p className="text-[var(--text-muted)] font-medium mb-1">Total Directories</p>
                    <div className="flex items-end justify-between">
                        <h2 className="text-4xl font-bold">{totalOffices}</h2>
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-2xl border-l-4 border-[var(--warning)]">
                    <p className="text-[var(--text-muted)] font-medium mb-1">Pending Edits</p>
                    <div className="flex items-end justify-between">
                        <h2 className="text-4xl font-bold">{pendingEdits}</h2>
                        <Edit3 className="w-6 h-6 text-[var(--warning)] opacity-50" />
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-2xl border-l-4 border-[var(--success)]">
                    <p className="text-[var(--text-muted)] font-medium mb-1">Approved Employees</p>
                    <div className="flex items-end justify-between">
                        <h2 className="text-4xl font-bold">{employeeCount}</h2>
                        <User className="w-6 h-6 text-[var(--success)] opacity-50" />
                    </div>
                </div>
            </div>

            {/* Action Tabs - simplified for prototype */}
            <div className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-2xl overflow-hidden shadow-sm">
                <div className="border-b border-[var(--surface-border)] p-4 bg-[var(--background)]/50">
                    <h2 className="font-semibold text-lg">Moderation Queue</h2>
                </div>
                <div className="p-6">
                    {pendingEdits === 0 ? (
                        <div className="text-center py-12 text-[var(--text-muted)]">
                            <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>No pending edit requests to moderate.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p>Moderation table will render here...</p>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
}
