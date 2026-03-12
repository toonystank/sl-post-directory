import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { ShieldCheck, Clock, CheckCircle2, XCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface SessionUser {
    id?: string;
    name?: string | null;
    email?: string | null;
    role?: string;
}

export default async function ActivityLogPage() {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;

    if (!session || !["ADMIN", "SUPER_ADMIN", "MODERATOR"].includes(user?.role || "")) {
        redirect("/login");
    }

    const logs = await prisma.actionLog.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            user: {
                select: { name: true, email: true }
            }
        },
        take: 100
    });

    return (
        <div className="container mx-auto px-4 py-12 max-w-6xl min-h-[calc(100vh-4rem)]">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <Button variant="ghost" size="sm" asChild className="gap-2 text-muted-foreground hover:text-foreground">
                            <Link href="/dashboard">
                                <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                            </Link>
                        </Button>
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
                        <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl border border-blue-500/20">
                            <Clock className="w-7 h-7" />
                        </div>
                        Moderation Activity Log
                    </h1>
                    <p className="text-muted-foreground mt-2 ml-[52px]">Track recent moderation actions taken by admins and moderators.</p>
                </div>
            </div>

            <Card className="border-border/50 bg-card/50">
                <CardHeader>
                    <CardTitle>Recent Activity (Latest 100)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {logs.length === 0 ? (
                            <div className="p-12 text-center text-muted-foreground italic">
                                No activity logs found.
                            </div>
                        ) : (
                            logs.map(log => {
                                let parsedDetails: any = {};
                                try { parsedDetails = JSON.parse(log.details); } catch (e) { }

                                return (
                                    <div key={log.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-background/50 rounded-xl border border-border/50 gap-4">
                                        <div className="flex space-x-4 items-center">
                                            {log.action === "APPROVED_EDIT" ? (
                                                <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
                                                    <CheckCircle2 className="w-5 h-5" />
                                                </div>
                                            ) : log.action === "REJECTED_EDIT" ? (
                                                <div className="p-2 bg-destructive/10 text-destructive rounded-lg">
                                                    <XCircle className="w-5 h-5" />
                                                </div>
                                            ) : (
                                                <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
                                                    <AlertCircle className="w-5 h-5" />
                                                </div>
                                            )}

                                            <div>
                                                <p className="font-medium text-foreground">
                                                    {log.user.name} <span className="text-muted-foreground font-normal">({log.user.email})</span>
                                                </p>
                                                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                                                    <Badge variant="outline" className="text-[10px] bg-background/50 uppercase">
                                                        {log.action.replace("_", " ")}
                                                    </Badge>
                                                    on <span className="font-medium text-foreground">{parsedDetails.postOfficeName || "Unknown target"}</span>
                                                    {parsedDetails.type && (
                                                        <Badge variant="secondary" className="text-[10px] ml-1">
                                                            {parsedDetails.type}
                                                        </Badge>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-sm font-mono text-muted-foreground shrink-0">
                                            {new Date(log.createdAt).toLocaleString()}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
