import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { ShieldCheck, User, Edit3, Building2, TrendingUp, Check, X, PlusCircle, Users, Clock, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import AdminOfficeManager from "./AdminOfficeManager";
import ModerationQueue from "./ModerationQueue";
import PhotoModeration from "./PhotoModeration";
import AdToggle from "./AdToggle";

interface SessionUser {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
}
import { Badge } from "@/components/ui/badge";
import ContributorDashboard from "./ContributorDashboard";

export default async function AdminDashboard() {
    const session = await getServerSession(authOptions);

    const user = session?.user as SessionUser | undefined;

    if (!session) {
        redirect("/login");
    }

    if (user?.role === "CONTRIBUTOR") {
        return <ContributorDashboard userId={user.id!} userName={user.name!} />;
    }

    if (!["ADMIN", "SUPER_ADMIN", "MODERATOR"].includes(user?.role || "")) {
        redirect("/login");
    }

    // Dashboard Stats
    const [totalOffices, pendingEdits, employeeCount, pendingEditItems, communityPhotos] = await Promise.all([
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
        }),
        prisma.communityPhoto.findMany({
            include: {
                postOffice: { select: { name: true, postalCode: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 100 // Limit to recent 100 for safety
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
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
                    {user?.role === "SUPER_ADMIN" && (
                        <Button asChild variant="outline" className="rounded-xl flex-1 min-w-[140px] sm:flex-none">
                            <Link href="/dashboard/users">
                                <Users className="w-4 h-4 mr-2 shrink-0" /> <span className="truncate">Manage Users</span>
                            </Link>
                        </Button>
                    )}
                    <Button asChild variant="outline" className="rounded-xl flex-1 min-w-[140px] sm:flex-none border-blue-500/20 text-blue-500 hover:bg-blue-500/10 hover:text-blue-500">
                        <Link href="/dashboard/activity">
                            <Clock className="w-4 h-4 mr-2 shrink-0" /> <span className="truncate">Activity Log</span>
                        </Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-xl flex-1 min-w-[140px] sm:flex-none border-amber-500/20 text-amber-500 hover:bg-amber-500/10 hover:text-amber-500">
                        <a href="/api/admin/backup" download>
                            <Download className="w-4 h-4 mr-2 shrink-0" /> <span className="truncate">Backup Data</span>
                        </a>
                    </Button>
                    <Button asChild variant="default" className="rounded-xl flex-1 min-w-[140px] sm:flex-none">
                        <Link href="/dashboard/add">
                            <PlusCircle className="w-4 h-4 mr-2 shrink-0" /> <span className="truncate">Add New Office</span>
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Super Admin: Ad Toggle */}
            {user?.role === "SUPER_ADMIN" && (
                <div className="mb-6">
                    <AdToggle />
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <Card className="border-border/50 hover:shadow-lg hover:shadow-primary/5 transition-all py-4 md:py-6 gap-3 md:gap-6">
                    <CardHeader className="flex flex-row items-center justify-between pb-0 px-5 md:px-6">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Directories</CardTitle>
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <Building2 className="w-4 h-4" />
                        </div>
                    </CardHeader>
                    <CardContent className="px-5 md:px-6">
                        <div className="text-3xl md:text-4xl font-extrabold tracking-tight">{totalOffices.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-secondary" /> All registered offices
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-border/50 hover:shadow-lg hover:shadow-amber-500/5 transition-all py-4 md:py-6 gap-3 md:gap-6">
                    <CardHeader className="flex flex-row items-center justify-between pb-0 px-5 md:px-6">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Pending Edits</CardTitle>
                        <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                            <Edit3 className="w-4 h-4" />
                        </div>
                    </CardHeader>
                    <CardContent className="px-5 md:px-6">
                        <div className="text-3xl md:text-4xl font-extrabold tracking-tight">{pendingEdits}</div>
                        <p className="text-xs text-muted-foreground mt-1">Awaiting moderation</p>
                    </CardContent>
                </Card>

                <Card className="border-border/50 hover:shadow-lg hover:shadow-secondary/5 transition-all py-4 md:py-6 gap-3 md:gap-6">
                    <CardHeader className="flex flex-row items-center justify-between pb-0 px-5 md:px-6">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Approved Contributors</CardTitle>
                        <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                            <User className="w-4 h-4" />
                        </div>
                    </CardHeader>
                    <CardContent className="px-5 md:px-6">
                        <div className="text-3xl md:text-4xl font-extrabold tracking-tight">{employeeCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">Registered contributors</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {/* Active Directory Management */}
                <AdminOfficeManager />

                {/* Moderation Queue */}
                <ModerationQueue initialPendingEdits={pendingEdits} initialPendingEditItems={pendingEditItems} />

                {/* Photo Moderation */}
                <PhotoModeration photos={communityPhotos} />
            </div>
        </div>
    );
}
