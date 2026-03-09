import { prisma } from "@/lib/prisma";
import { ShieldCheck, User, Edit3, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import AdminOfficeManager from "./AdminOfficeManager";

interface ContributorDashboardProps {
    userId: string;
    userName: string;
}

export default async function ContributorDashboard({ userId, userName }: ContributorDashboardProps) {
    const myEdits = await prisma.editRequest.findMany({
        where: { requestedById: userId },
        include: {
            postOffice: { select: { name: true, postalCode: true, fields: true } }
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

            <div className="mb-12">
                <AdminOfficeManager isContributor={true} />
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
                                        <h3 className="text-xl font-bold flex items-center gap-2 mb-2">
                                            {edit.postOffice?.name || (() => { try { return JSON.parse(edit.changes).name || "New Post Office" } catch { return "New Post Office" } })()}
                                            <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider ${edit.type === "ADD" ? "text-blue-500 bg-blue-500/10 border-blue-500/30" :
                                                edit.type === "REMOVAL" ? "text-destructive bg-destructive/10 border-destructive/30" :
                                                    "text-primary bg-primary/10 border-primary/30"
                                                }`}>
                                                {edit.type || "EDIT"}
                                            </Badge>
                                        </h3>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            Postal Code: <span className="font-medium text-foreground">{edit.postOffice?.postalCode || (() => { try { return JSON.parse(edit.changes).postalCode || "N/A" } catch { return "N/A" } })()}</span>
                                        </p>
                                        <div className="bg-background/50 rounded-xl p-4 border border-border/50">
                                            {/* @ts-ignore */}
                                            <RenderChanges edit={edit} />
                                        </div>
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

function RenderChanges({ edit }: { edit: any }) {
    const changesJson = edit.changes;
    const type = edit.type || "EDIT";
    const reason = edit.reason;
    const currentOffice: { name?: string, postalCode?: string, fields: Array<{ name: string, value: string }> } = edit.postOffice || { fields: [] };

    if (type === "REMOVAL") {
        return (
            <div className="space-y-3 text-sm">
                <div className="p-4 bg-destructive/10 text-destructive rounded-xl border border-destructive/20 shadow-sm">
                    <span className="font-bold flex items-center gap-2 mb-1"><ShieldCheck className="w-4 h-4" /> Reason for removal requested:</span>
                    {reason || "No reason provided."}
                </div>
            </div>
        );
    }

    try {
        const changes = JSON.parse(changesJson || "{}");

        if (type === "ADD") {
            return (
                <div className="space-y-3 text-sm">
                    {reason && (
                        <div className="p-3 mb-4 bg-muted/40 rounded-lg text-muted-foreground border border-border/50">
                            <span className="font-bold text-foreground">Submitter notes:</span> {reason}
                        </div>
                    )}
                    <div className="flex items-center gap-3 py-1.5 px-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                        <span className="font-medium text-muted-foreground w-24 shrink-0">Name</span>
                        <span className="text-emerald-500 font-medium">+ {changes.name}</span>
                    </div>
                    <div className="flex items-center gap-3 py-1.5 px-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                        <span className="font-medium text-muted-foreground w-24 shrink-0">Postal Code</span>
                        <span className="text-emerald-500 font-medium">+ {changes.postalCode}</span>
                    </div>
                    {changes.fields && changes.fields.map((f: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 py-1.5 px-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                            <span className="font-medium text-muted-foreground w-24 shrink-0">{f.name}</span>
                            <span className="text-emerald-500 font-medium">+ {f.value}</span>
                        </div>
                    ))}
                </div>
            );
        }

        // EDIT logic
        const currentFieldMap = new Map(currentOffice.fields?.map((f: any) => [f.name, f.value]) || []);

        return (
            <div className="space-y-3 text-sm">
                {/* Basic fields — name & postalCode */}
                {changes.name && (
                    <div className="flex items-center gap-3 py-1.5 px-3 bg-muted/30 rounded-lg">
                        <span className="font-medium text-muted-foreground w-24 shrink-0">Name</span>
                        <span className="line-through text-muted-foreground/60">{currentOffice.name}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-emerald-500 font-medium">{changes.name}</span>
                    </div>
                )}
                {changes.postalCode && (
                    <div className="flex items-center gap-3 py-1.5 px-3 bg-muted/30 rounded-lg">
                        <span className="font-medium text-muted-foreground w-24 shrink-0">Postal Code</span>
                        <span className="line-through text-muted-foreground/60">{currentOffice.postalCode}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-emerald-500 font-medium">{changes.postalCode}</span>
                    </div>
                )}

                {/* Dynamic fields */}
                {changes.fields && changes.fields.length > 0 && (
                    <div className="space-y-1.5">
                        {changes.fields.map((f: { name: string; value: string }, i: number) => {
                            const currentValue = currentFieldMap.get(f.name);
                            const isNew = currentValue === undefined;
                            const isChanged = !isNew && currentValue !== f.value;

                            return (
                                <div key={i} className="flex items-center gap-3 py-1.5 px-3 bg-muted/30 rounded-lg">
                                    <span className="font-medium text-muted-foreground w-24 shrink-0">{f.name}</span>
                                    {isNew ? (
                                        <span className="text-emerald-500 font-medium italic">+ {f.value} (new field)</span>
                                    ) : isChanged ? (
                                        <>
                                            <span className="line-through text-muted-foreground/60">{currentValue}</span>
                                            <span className="text-muted-foreground">→</span>
                                            <span className="text-emerald-500 font-medium">{f.value}</span>
                                        </>
                                    ) : (
                                        <span className="text-muted-foreground/60 italic">No change ({f.value})</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {(!changes.name && !changes.postalCode && (!changes.fields || changes.fields.length === 0)) && (
                    <span className="text-muted-foreground italic">No fields were modified.</span>
                )}
            </div>
        );
    } catch {
        return <p className="text-sm text-muted-foreground italic">Could not parse changes.</p>;
    }
}
