import { prisma } from "@/lib/prisma";
import { ShieldCheck, User, Edit3, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface ContributorDashboardProps {
    userId: string;
    userName: string;
}

export default async function ContributorDashboard({ userId, userName }: ContributorDashboardProps) {
    const myEdits = await prisma.editRequest.findMany({
        where: { requestedById: userId },
        include: {
            postOffice: { select: { name: true, postalCode: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    const pendingEdits = myEdits.filter(edit => edit.status === "PENDING" || edit.status === "MORE_INFO");
    const approvedEdits = myEdits.filter(edit => edit.status === "APPROVED");
    const rejectedEdits = myEdits.filter(edit => edit.status === "REJECTED");

    return (
        <div className="container mx-auto px-4 py-12 max-w-6xl min-h-[calc(100vh-4rem)]">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                            <User className="w-7 h-7" />
                        </div>
                        Contributor Dashboard
                    </h1>
                    <p className="text-muted-foreground mt-2 ml-[52px]">Track your suggested edits and directory contributions.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/profile">
                        <Badge variant="outline" className="w-fit flex items-center gap-2 px-4 py-2 text-sm hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer">
                            <User className="w-4 h-4" />
                            {userName}
                        </Badge>
                    </Link>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <Card className="border-border/50 hover:shadow-lg hover:shadow-primary/5 transition-all">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Contributions</CardTitle>
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <Edit3 className="w-4 h-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-extrabold tracking-tight">{myEdits.length}</div>
                    </CardContent>
                </Card>

                <Card className="border-border/50 hover:shadow-lg hover:shadow-emerald-500/5 transition-all">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Approved Edits</CardTitle>
                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-extrabold tracking-tight">{approvedEdits.length}</div>
                    </CardContent>
                </Card>

                <Card className="border-border/50 hover:shadow-lg hover:shadow-amber-500/5 transition-all">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
                        <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                            <Clock className="w-4 h-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-extrabold tracking-tight">{pendingEdits.length}</div>
                    </CardContent>
                </Card>
            </div>

            <h2 className="text-2xl font-bold tracking-tight mb-6 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-primary" /> Your Contribution History
            </h2>

            <div className="space-y-4">
                {myEdits.length === 0 ? (
                    <div className="p-12 text-center bg-card/50 border border-border/50 rounded-2xl flex flex-col items-center">
                        <Edit3 className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                        <h3 className="text-xl font-bold text-foreground">No contributions yet</h3>
                        <p className="text-muted-foreground mt-2 max-w-sm">When you suggest edits to post offices, they will appear here so you can track their status.</p>
                    </div>
                ) : (
                    myEdits.map((edit) => (
                        <Card key={edit.id} className="border-border/50 hover:border-primary/20 transition-all overflow-hidden bg-card/50">
                            <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="space-y-4 flex-1">
                                    <div className="flex items-center gap-3">
                                        <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                                            {new Date(edit.createdAt).toLocaleDateString()}
                                        </Badge>
                                        <div className="h-4 w-px bg-border/50 hidden md:block"></div>
                                        {edit.status === "APPROVED" && (
                                            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 flex gap-1.5 items-center">
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Approved & Published
                                            </Badge>
                                        )}
                                        {edit.status === "PENDING" && (
                                            <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 px-3 flex gap-1.5 items-center">
                                                <Clock className="w-3.5 h-3.5" /> Pending Review
                                            </Badge>
                                        )}
                                        {edit.status === "MORE_INFO" && (
                                            <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 px-3 flex gap-1.5 items-center">
                                                <AlertCircle className="w-3.5 h-3.5" /> More Info Needed
                                            </Badge>
                                        )}
                                        {edit.status === "REJECTED" && (
                                            <Badge className="bg-destructive/10 text-destructive border-destructive/20 px-3 flex gap-1.5 items-center">
                                                <XCircle className="w-3.5 h-3.5" /> Declined
                                            </Badge>
                                        )}
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-bold flex items-center gap-2">
                                            {edit.postOffice.name}
                                        </h3>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Postal Code: <span className="font-medium text-foreground">{edit.postOffice.postalCode}</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
