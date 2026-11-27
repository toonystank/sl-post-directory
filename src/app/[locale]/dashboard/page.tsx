import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { Link } from "@/navigation";
import {
    Building2,
    Edit3,
    FileText,
    PlusCircle,
    ShieldCheck,
    Calculator,
    Camera,
    MessageSquare,
    ArrowRight,
    Clock,
    Star,
} from "lucide-react";
import ContributorDashboard from "./ContributorDashboard";

interface SessionUser {
    id?: string;
    name?: string | null;
    email?: string | null;
    role?: string;
}

const CATEGORY_PILL: Record<string, string> = {
    ALERT: "border-primary bg-primary text-primary-foreground",
    TARIFF: "border-foreground bg-secondary text-secondary-foreground",
    NEWS: "border-foreground/40 bg-card text-foreground",
    GUIDE: "border-border bg-muted text-foreground",
};

export default async function AdminDashboard() {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;

    if (!session || !user?.id || !user?.email || !user?.role) {
        redirect("/login");
    }

    if (user?.role === "CONTRIBUTOR") {
        return <ContributorDashboard userId={user.id!} userName={user.name || "Contributor"} />;
    }

    const role = user?.role || "";
    if (!["ADMIN", "SUPER_ADMIN", "MODERATOR"].includes(role)) {
        redirect("/login");
    }

    const isAdminPlus = role === "ADMIN" || role === "SUPER_ADMIN";

    let totalOffices = 0;
    let pendingEdits = 0;
    let pendingPhotos = 0;
    let pendingReviews = 0;
    let publishedNews = 0;
    let priorityEdits: Array<{
        id: string;
        type: string;
        status: string;
        createdAt: Date;
        changes: string;
        postOffice: { name: string; postalCode: string } | null;
        requestedBy: { name: string };
    }> = [];
    let recentUpdates: Array<{
        id: string;
        slug: string;
        title: string;
        category: string;
        featured: boolean;
        published: boolean;
        date: Date;
        readingTime: number;
    }> = [];

    if (hasDatabaseUrl) {
        const [
            officeCount,
            editsCount,
            photosCount,
            reviewsCount,
            newsCount,
            topEdits,
            topNews,
        ] = await Promise.all([
            prisma.postOffice.count(),
            prisma.editRequest.count({ where: { status: { in: ["PENDING", "MORE_INFO"] } } }),
            prisma.communityPhoto.count({ where: { status: "PENDING" } }),
            prisma.review.count({ where: { status: "PENDING" } }),
            prisma.blogPost.count({ where: { published: true } }),
            prisma.editRequest.findMany({
                where: { status: { in: ["PENDING", "MORE_INFO"] } },
                select: {
                    id: true,
                    type: true,
                    status: true,
                    createdAt: true,
                    changes: true,
                    postOffice: { select: { name: true, postalCode: true } },
                    requestedBy: { select: { name: true } },
                },
                orderBy: { createdAt: "desc" },
                take: 4,
            }),
            prisma.blogPost.findMany({
                select: {
                    id: true,
                    slug: true,
                    title: true,
                    category: true,
                    featured: true,
                    published: true,
                    date: true,
                    readingTime: true,
                },
                orderBy: [{ featured: "desc" }, { date: "desc" }],
                take: 4,
            }),
        ]);

        totalOffices = officeCount;
        pendingEdits = editsCount;
        pendingPhotos = photosCount;
        pendingReviews = reviewsCount;
        publishedNews = newsCount;
        priorityEdits = topEdits;
        recentUpdates = topNews;
    }

    const mediaQueueTotal = pendingPhotos + pendingReviews;

    return (
        <div className="space-y-6">
            {/* Desk Masthead */}
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                    <p className="label-mono">Postal Operations Desk</p>
                    <h1 className="display text-3xl sm:text-4xl mt-1">
                        Welcome back, {user?.name?.split(" ")[0] || "Admin"}
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href="/dashboard/news/new"
                        className="tap inline-flex min-h-[44px] items-center gap-2 rounded-md border-2 border-foreground bg-primary px-4 text-sm font-bold text-primary-foreground shadow-[2px_2px_0_0_hsl(var(--foreground))] hover:bg-primary/95"
                    >
                        <FileText className="h-4 w-4" aria-hidden="true" />
                        <span>Write Update</span>
                    </Link>
                    {isAdminPlus && (
                        <Link
                            href="/dashboard/add"
                            className="tap inline-flex min-h-[44px] items-center gap-2 rounded-md border-2 border-foreground bg-secondary px-4 text-sm font-extrabold text-secondary-foreground shadow-[2px_2px_0_0_hsl(var(--foreground))]"
                        >
                            <PlusCircle className="h-4 w-4" aria-hidden="true" />
                            <span>Add Office</span>
                        </Link>
                    )}
                </div>
            </header>

            {/* 2x2 Mobile KPI Grid -> 4-col Desktop */}
            <section aria-label="Workspace metrics" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <Link
                    href="/dashboard/offices"
                    className="tap rounded-md border-2 border-foreground bg-card p-4 shadow-[3px_3px_0_0_hsl(var(--foreground))] flex flex-col justify-between gap-2"
                >
                    <div className="flex items-center justify-between">
                        <span className="label-mono">Offices</span>
                        <Building2 className="h-4 w-4 text-primary" aria-hidden="true" />
                    </div>
                    <p className="display text-3xl">{totalOffices.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Browse & edit directory</p>
                </Link>

                <Link
                    href="/dashboard/queue"
                    className="tap rounded-md border-2 border-foreground bg-card p-4 shadow-[3px_3px_0_0_hsl(var(--foreground))] flex flex-col justify-between gap-2"
                >
                    <div className="flex items-center justify-between">
                        <span className="label-mono">Pending Edits</span>
                        <Edit3 className="h-4 w-4 text-primary" aria-hidden="true" />
                    </div>
                    <p className="display text-3xl text-primary">{pendingEdits}</p>
                    <p className="text-xs text-muted-foreground">Open triage queue</p>
                </Link>

                <Link
                    href="/dashboard/queue?tab=photos"
                    className="tap rounded-md border-2 border-foreground bg-card p-4 shadow-[3px_3px_0_0_hsl(var(--foreground))] flex flex-col justify-between gap-2"
                >
                    <div className="flex items-center justify-between">
                        <span className="label-mono">Photos & Reviews</span>
                        <div className="flex items-center gap-1 text-muted-foreground">
                            <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                        </div>
                    </div>
                    <p className="display text-3xl">{mediaQueueTotal}</p>
                    <p className="text-xs text-muted-foreground">
                        {pendingPhotos} photos · {pendingReviews} reviews
                    </p>
                </Link>

                <Link
                    href="/dashboard/news"
                    className="tap rounded-md border-2 border-foreground bg-card p-4 shadow-[3px_3px_0_0_hsl(var(--foreground))] flex flex-col justify-between gap-2"
                >
                    <div className="flex items-center justify-between">
                        <span className="label-mono">Published News</span>
                        <FileText className="h-4 w-4 text-status-open" aria-hidden="true" />
                    </div>
                    <p className="display text-3xl">{publishedNews}</p>
                    <p className="text-xs text-muted-foreground">Alerts, tariffs & guides</p>
                </Link>
            </section>

            {/* Quick Action Horizontal Snap Strip */}
            <section aria-label="Quick actions" className="flex gap-2 overflow-x-auto scrollbar-hide snap-carousel pb-1">
                <Link
                    href="/dashboard/offices"
                    className="tap shrink-0 inline-flex min-h-[44px] items-center gap-2 rounded-md border border-foreground bg-card px-3.5 text-xs font-bold hover:bg-muted"
                >
                    <Building2 className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span>Search Offices</span>
                </Link>
                <Link
                    href="/dashboard/queue"
                    className="tap shrink-0 inline-flex min-h-[44px] items-center gap-2 rounded-md border border-foreground bg-card px-3.5 text-xs font-bold hover:bg-muted"
                >
                    <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span>Review Queue ({pendingEdits + mediaQueueTotal})</span>
                </Link>
                <Link
                    href="/dashboard/news"
                    className="tap shrink-0 inline-flex min-h-[44px] items-center gap-2 rounded-md border border-foreground bg-card px-3.5 text-xs font-bold hover:bg-muted"
                >
                    <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span>News Studio</span>
                </Link>
                {isAdminPlus && (
                    <Link
                        href="/dashboard/rates"
                        className="tap shrink-0 inline-flex min-h-[44px] items-center gap-2 rounded-md border border-foreground bg-card px-3.5 text-xs font-bold hover:bg-muted"
                    >
                        <Calculator className="h-4 w-4 text-primary" aria-hidden="true" />
                        <span>Postage Rates</span>
                    </Link>
                )}
                <Link
                    href="/dashboard/activity"
                    className="tap shrink-0 inline-flex min-h-[44px] items-center gap-2 rounded-md border border-foreground bg-card px-3.5 text-xs font-bold hover:bg-muted"
                >
                    <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <span>Activity Log</span>
                </Link>
            </section>

            {/* Priority Triage + Latest Postal Dispatches */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Priority Triage */}
                <section className="rounded-md border-2 border-foreground bg-card overflow-hidden">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <div>
                            <p className="label-mono">Priority Triage</p>
                            <h2 className="font-heading text-lg font-extrabold">Open Edit Submissions</h2>
                        </div>
                        <Link
                            href="/dashboard/queue"
                            className="tap inline-flex min-h-[44px] items-center gap-1 text-xs font-bold text-primary hover:underline"
                        >
                            <span>Open Queue</span>
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                    </div>

                    {priorityEdits.length === 0 ? (
                        <div className="p-8 text-center">
                            <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" aria-hidden="true" />
                            <p className="text-sm font-bold text-foreground">All caught up</p>
                            <p className="text-xs text-muted-foreground mt-1">No pending office edit requests right now.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {priorityEdits.map((item) => {
                                let fallbackName = "New Post Office";
                                let fallbackCode = "";
                                try {
                                    const parsed = JSON.parse(item.changes || "{}") as { name?: string; postalCode?: string };
                                    if (parsed.name) fallbackName = parsed.name;
                                    if (parsed.postalCode) fallbackCode = parsed.postalCode;
                                } catch {
                                    // ignore parse fallback
                                }
                                const officeName = item.postOffice?.name || fallbackName;
                                const postalCode = item.postOffice?.postalCode || fallbackCode;

                                return (
                                    <Link
                                        key={item.id}
                                        href="/dashboard/queue"
                                        className="tap flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm border border-foreground/40 bg-background">
                                                    {item.type}
                                                </span>
                                                {item.status === "MORE_INFO" && (
                                                    <span className="font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm border border-status-closing text-status-closing bg-status-closing/10">
                                                        More Info
                                                    </span>
                                                )}
                                                {postalCode && (
                                                    <span className="font-mono text-[11px] text-muted-foreground">
                                                        {postalCode}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm font-bold text-foreground truncate mt-1">{officeName}</p>
                                            <p className="text-xs text-muted-foreground">
                                                By {item.requestedBy.name} · {new Date(item.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <span className="shrink-0 rounded-md border border-foreground bg-secondary px-3 py-1.5 text-xs font-extrabold text-secondary-foreground">
                                            Review
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Latest Postal Updates */}
                <section className="rounded-md border-2 border-foreground bg-card overflow-hidden">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <div>
                            <p className="label-mono">Newsroom</p>
                            <h2 className="font-heading text-lg font-extrabold">Latest Postal Updates</h2>
                        </div>
                        <Link
                            href="/dashboard/news"
                            className="tap inline-flex min-h-[44px] items-center gap-1 text-xs font-bold text-primary hover:underline"
                        >
                            <span>Manage News</span>
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                    </div>

                    {recentUpdates.length === 0 ? (
                        <div className="p-8 text-center">
                            <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" aria-hidden="true" />
                            <p className="text-sm font-bold text-foreground">No database dispatches yet</p>
                            <p className="text-xs text-muted-foreground mt-1 mb-4">
                                Publish breaking service alerts, tariff updates, or postal guides.
                            </p>
                            <Link
                                href="/dashboard/news/new"
                                className="tap inline-flex min-h-[44px] items-center gap-1.5 rounded-md border-2 border-foreground bg-primary px-4 text-xs font-bold text-primary-foreground"
                            >
                                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                                <span>Write First Update</span>
                            </Link>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {recentUpdates.map((post) => (
                                <Link
                                    key={post.id}
                                    href={`/dashboard/news/${post.id}`}
                                    className="tap flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors"
                                >
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span
                                                className={`font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm border ${CATEGORY_PILL[post.category] || CATEGORY_PILL.GUIDE}`}
                                            >
                                                {post.category}
                                            </span>
                                            {post.featured && (
                                                <span className="inline-flex items-center gap-0.5 font-mono text-[10px] font-bold uppercase text-primary">
                                                    <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                                                    Pinned
                                                </span>
                                            )}
                                            {!post.published && (
                                                <span className="font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm border border-border bg-muted text-muted-foreground">
                                                    Draft
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm font-bold text-foreground truncate mt-1">{post.title}</p>
                                        <p className="font-mono text-[11px] text-muted-foreground">
                                            {new Date(post.date).toLocaleDateString()} · {post.readingTime} min read
                                        </p>
                                    </div>
                                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
