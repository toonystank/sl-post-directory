import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { ShieldCheck, Edit3, CheckCircle2, XCircle, Clock, AlertCircle, Building2, ArrowRight } from "lucide-react";
import { Link } from "@/navigation";

interface ContributorDashboardProps {
    userId: string;
    userName: string;
}

export default async function ContributorDashboard({ userId, userName }: ContributorDashboardProps) {
    const myEdits = hasDatabaseUrl
        ? await prisma.editRequest.findMany({
              where: { requestedById: userId },
              include: {
                  postOffice: { select: { name: true, postalCode: true, fields: true } },
              },
              orderBy: { createdAt: "desc" },
          })
        : [];

    const pendingEdits = myEdits.filter((edit) => edit.status === "PENDING" || edit.status === "MORE_INFO");
    const approvedEdits = myEdits.filter((edit) => edit.status === "APPROVED");

    return (
        <div className="space-y-6">
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                    <p className="label-mono">Contributor Workspace</p>
                    <h1 className="display text-3xl sm:text-4xl mt-1">
                        {userName}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Track your directory edits and find post offices to update.
                    </p>
                </div>
                <Link
                    href="/dashboard/offices"
                    className="tap inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border-2 border-foreground bg-secondary px-4 text-sm font-extrabold text-secondary-foreground shadow-[2px_2px_0_0_hsl(var(--foreground))]"
                >
                    <Building2 className="h-4 w-4" aria-hidden="true" />
                    <span>Find Office to Edit</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
                <div className="rounded-md border-2 border-foreground bg-card p-3.5 sm:p-4 shadow-[3px_3px_0_0_hsl(var(--foreground))]">
                    <p className="label-mono">Total</p>
                    <p className="display text-2xl sm:text-3xl mt-1">{myEdits.length}</p>
                </div>
                <div className="rounded-md border-2 border-foreground bg-card p-3.5 sm:p-4 shadow-[3px_3px_0_0_hsl(var(--foreground))]">
                    <p className="label-mono">Approved</p>
                    <p className="display text-2xl sm:text-3xl text-status-open mt-1">{approvedEdits.length}</p>
                </div>
                <div className="rounded-md border-2 border-foreground bg-card p-3.5 sm:p-4 shadow-[3px_3px_0_0_hsl(var(--foreground))]">
                    <p className="label-mono">Pending</p>
                    <p className="display text-2xl sm:text-3xl text-primary mt-1">{pendingEdits.length}</p>
                </div>
            </div>

            <section className="space-y-3">
                <h2 className="font-heading text-xl font-extrabold flex items-center gap-2">
                    <Edit3 className="w-5 h-5 text-primary" aria-hidden="true" />
                    <span>Your Contribution History</span>
                </h2>

                {myEdits.length === 0 ? (
                    <div className="p-8 text-center bg-card border-2 border-dashed border-foreground/40 rounded-md flex flex-col items-center">
                        <Edit3 className="w-10 h-10 text-muted-foreground mb-3 opacity-50" aria-hidden="true" />
                        <h3 className="font-heading text-lg font-extrabold text-foreground">No contributions yet</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                            Search the directory and suggest updates for any post office to help keep hours and phone numbers accurate.
                        </p>
                        <Link
                            href="/dashboard/offices"
                            className="tap mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-md border-2 border-foreground bg-primary px-4 text-sm font-bold text-primary-foreground"
                        >
                            <span>Browse Offices</span>
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {myEdits.map((edit) => {
                            let parsedName = "New Post Office";
                            let parsedCode = "N/A";
                            try {
                                const parsed = JSON.parse(edit.changes) as { name?: string; postalCode?: string };
                                if (parsed.name) parsedName = parsed.name;
                                if (parsed.postalCode) parsedCode = parsed.postalCode;
                            } catch {
                                // ignore parse error
                            }

                            return (
                                <article
                                    key={edit.id}
                                    className="rounded-md border-2 border-foreground bg-card p-4 sm:p-5 space-y-3 shadow-[3px_3px_0_0_hsl(var(--foreground))]"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="font-mono text-xs text-muted-foreground">
                                            {new Date(edit.createdAt).toLocaleDateString()}
                                        </span>
                                        {edit.status === "APPROVED" && (
                                            <span className="inline-flex items-center gap-1 rounded-sm border border-status-open/40 bg-status-open/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-status-open">
                                                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Approved
                                            </span>
                                        )}
                                        {edit.status === "PENDING" && (
                                            <span className="inline-flex items-center gap-1 rounded-sm border border-primary/40 bg-primary/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-primary">
                                                <Clock className="w-3.5 h-3.5" aria-hidden="true" /> Pending Review
                                            </span>
                                        )}
                                        {edit.status === "MORE_INFO" && (
                                            <span className="inline-flex items-center gap-1 rounded-sm border border-status-closing/40 bg-status-closing/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-status-closing">
                                                <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" /> More Info Needed
                                            </span>
                                        )}
                                        {edit.status === "REJECTED" && (
                                            <span className="inline-flex items-center gap-1 rounded-sm border border-destructive/40 bg-destructive/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-destructive">
                                                <XCircle className="w-3.5 h-3.5" aria-hidden="true" /> Declined
                                            </span>
                                        )}
                                    </div>

                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="font-heading text-lg font-extrabold">
                                                {edit.postOffice?.name || parsedName}
                                            </h3>
                                            <span className="font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm border border-border bg-muted">
                                                {edit.type || "EDIT"}
                                            </span>
                                        </div>
                                        <p className="font-mono text-xs text-muted-foreground mt-0.5">
                                            Postal Code: {edit.postOffice?.postalCode || parsedCode}
                                        </p>
                                    </div>

                                    <div className="rounded-md border border-border bg-background p-3">
                                        <RenderChanges edit={edit} />
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}

interface RenderableEditItem {
    changes: string;
    type?: string;
    reason?: string | null;
    postOffice?: {
        name?: string;
        postalCode?: string;
        fields: Array<{ name: string; value: string }>;
    } | null;
}

function RenderChanges({ edit }: { edit: RenderableEditItem }) {
    const changesJson = edit.changes;
    const type = edit.type || "EDIT";
    const reason = edit.reason;
    const currentOffice: { name?: string; postalCode?: string; fields: Array<{ name: string; value: string }> } = edit.postOffice || { fields: [] };

    if (type === "REMOVAL") {
        return (
            <div className="p-3 bg-destructive/10 text-destructive rounded-sm border border-destructive/30 text-sm">
                <span className="font-bold flex items-center gap-2 mb-1">
                    <ShieldCheck className="w-4 h-4" aria-hidden="true" /> Removal reason:
                </span>
                {reason || "No reason provided."}
            </div>
        );
    }

    try {
        const changes = JSON.parse(changesJson || "{}") as {
            name?: string;
            postalCode?: string;
            fields?: Array<{ name: string; value: string }>;
        };

        if (type === "ADD") {
            return (
                <div className="space-y-2 text-sm">
                    {reason && (
                        <p className="text-xs text-muted-foreground border-b border-border pb-2">
                            <strong className="text-foreground">Notes:</strong> {reason}
                        </p>
                    )}
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-muted-foreground w-24 shrink-0">Name</span>
                        <span className="text-status-open font-semibold">+ {changes.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-muted-foreground w-24 shrink-0">Postal Code</span>
                        <span className="text-status-open font-semibold">+ {changes.postalCode}</span>
                    </div>
                    {changes.fields?.map((f, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <span className="font-mono text-xs text-muted-foreground w-24 shrink-0 truncate">{f.name}</span>
                            <span className="text-status-open font-semibold">+ {f.value}</span>
                        </div>
                    ))}
                </div>
            );
        }

        const currentFieldMap = new Map(currentOffice.fields?.map((f) => [f.name, f.value]) || []);

        return (
            <div className="space-y-2 text-sm">
                {changes.name && (
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground w-24 shrink-0">Name</span>
                        <span className="line-through text-muted-foreground">{currentOffice.name}</span>
                        <span>&rarr;</span>
                        <span className="text-status-open font-semibold">{changes.name}</span>
                    </div>
                )}
                {changes.postalCode && (
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground w-24 shrink-0">Postcode</span>
                        <span className="line-through text-muted-foreground">{currentOffice.postalCode}</span>
                        <span>&rarr;</span>
                        <span className="text-status-open font-semibold">{changes.postalCode}</span>
                    </div>
                )}
                {changes.fields?.map((f, i) => {
                    const currentValue = currentFieldMap.get(f.name);
                    const isNew = currentValue === undefined;
                    const isChanged = !isNew && currentValue !== f.value;

                    return (
                        <div key={i} className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground w-24 shrink-0 truncate">{f.name}</span>
                            {isNew ? (
                                <span className="text-status-open font-semibold">+ {f.value}</span>
                            ) : isChanged ? (
                                <>
                                    <span className="line-through text-muted-foreground">{currentValue}</span>
                                    <span>&rarr;</span>
                                    <span className="text-status-open font-semibold">{f.value}</span>
                                </>
                            ) : (
                                <span className="text-muted-foreground italic">{f.value}</span>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    } catch {
        return <p className="text-sm text-muted-foreground italic">Could not parse changes.</p>;
    }
}
