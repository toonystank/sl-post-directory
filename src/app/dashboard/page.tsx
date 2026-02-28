import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { ShieldCheck, User, Edit3, Building2, TrendingUp, Check, X, PlusCircle, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import AdminOfficeManager from "./AdminOfficeManager";
import ModerationQueue from "./ModerationQueue";

interface SessionUser {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
}
import { Badge } from "@/components/ui/badge";

export default async function AdminDashboard() {
    const session = await getServerSession(authOptions);

    const user = session?.user as SessionUser | undefined;

    if (!session || !["ADMIN", "SUPER_ADMIN", "MODERATOR"].includes(user?.role || "")) {
        redirect("/login");
    }

    // Dashboard Stats
    const [totalOffices, pendingEdits, employeeCount, pendingEditItems] = await Promise.all([
        prisma.postOffice.count(),
        prisma.editRequest.count({ where: { status: { in: ["PENDING", "MORE_INFO"] } } }),
        prisma.user.count({ where: { role: "CONTRIBUTOR" } }),
        prisma.editRequest.findMany({
            where: { status: { in: ["PENDING", "MORE_INFO"] } },
            include: {
                postOffice: { select: { name: true, postalCode: true, fields: { select: { name: true, value: true } } } },
                requestedBy: { select: { name: true, email: true } }
            },
            orderBy: { createdAt: 'desc' }
        })
    ]);

    return (
        <div className="container mx-auto px-4 py-12 max-w-6xl min-h-[calc(100vh-4rem)]">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                            <ShieldCheck className="w-7 h-7" />
                        </div>
                        Admin Dashboard
                    </h1>
                    <p className="text-muted-foreground mt-2 ml-[52px]">Manage directories, user roles, and moderation queues.</p>
                </div>
                <div className="flex items-center gap-3">
                    {user?.role === "SUPER_ADMIN" && (
                        <Button asChild variant="outline" className="rounded-xl hidden sm:flex">
                            <Link href="/dashboard/users">
                                <Users className="w-4 h-4 mr-2" /> Manage Users
                            </Link>
                        </Button>
                    )}
                    <Button asChild variant="default" className="rounded-xl hidden sm:flex">
                        <Link href="/dashboard/add">
                            <PlusCircle className="w-4 h-4 mr-2" /> Add New Office
                        </Link>
                    </Button>
                    <Badge variant="outline" className="w-fit flex items-center gap-2 px-4 py-2 text-sm">
                        <User className="w-4 h-4" />
                        {session.user?.name}
                    </Badge>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <Card className="border-border/50 hover:shadow-lg hover:shadow-primary/5 transition-all">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Directories</CardTitle>
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <Building2 className="w-4 h-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-extrabold tracking-tight">{totalOffices.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-secondary" /> All registered offices
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-border/50 hover:shadow-lg hover:shadow-amber-500/5 transition-all">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Pending Edits</CardTitle>
                        <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                            <Edit3 className="w-4 h-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-extrabold tracking-tight">{pendingEdits}</div>
                        <p className="text-xs text-muted-foreground mt-1">Awaiting moderation</p>
                    </CardContent>
                </Card>

                <Card className="border-border/50 hover:shadow-lg hover:shadow-secondary/5 transition-all">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Approved Contributors</CardTitle>
                        <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                            <User className="w-4 h-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-extrabold tracking-tight">{employeeCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">Registered contributors</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {/* Active Directory Management */}
                <AdminOfficeManager />

                {/* Moderation Queue */}
                <ModerationQueue initialPendingEdits={pendingEdits} initialPendingEditItems={pendingEditItems} />
            </div>
        </div>
    );
}
