"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
    FileText,
    PlusCircle,
    Search,
    Edit3,
    Trash2,
    Star,
    ExternalLink,
    Loader2,
    AlertTriangle,
} from "lucide-react";
import { Link } from "@/navigation";
import { Input } from "@/components/ui/input";
import { showNativeToast } from "@/components/shell/NativeToast";
import ConfirmDialog from "./ConfirmDialog";
import { cn } from "@/lib/utils";

export interface NewsSummaryItem {
    id: string;
    slug: string;
    title: string;
    excerpt: string;
    date: string;
    author: string;
    tags: string[];
    readingTime: number;
    published: boolean;
    category: string;
    coverImage: string | null;
    featured: boolean;
}

const CATEGORY_TABS = [
    { id: "ALL", label: "All" },
    { id: "ALERT", label: "Service Alerts" },
    { id: "TARIFF", label: "Tariff Updates" },
    { id: "NEWS", label: "Postal News" },
    { id: "GUIDE", label: "Guides" },
];

const STATUS_TABS = [
    { id: "all", label: "All" },
    { id: "published", label: "Published" },
    { id: "draft", label: "Drafts" },
];

const BADGE_STYLE: Record<string, string> = {
    ALERT: "border-foreground bg-primary text-primary-foreground",
    TARIFF: "border-foreground bg-secondary text-secondary-foreground",
    NEWS: "border-foreground/50 bg-background text-foreground",
    GUIDE: "border-border bg-muted text-foreground",
};

export default function NewsManager({ userRole }: { userRole: string }) {
    const [posts, setPosts] = useState<NewsSummaryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [category, setCategory] = useState("ALL");
    const [status, setStatus] = useState("all");
    const [pendingDelete, setPendingDelete] = useState<NewsSummaryItem | null>(null);
    const [deleting, setDeleting] = useState(false);

    const canDelete = userRole === "ADMIN" || userRole === "SUPER_ADMIN";

    const loadPosts = useCallback(async (q: string, cat: string, stat: string) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ summary: "1" });
            if (cat !== "ALL") params.set("category", cat);
            if (stat !== "all") params.set("status", stat);
            if (q.trim()) params.set("q", q.trim());

            const res = await fetch(`/api/admin/blog?${params.toString()}`, { cache: "no-store" });
            if (res.ok) {
                const data = (await res.json()) as NewsSummaryItem[];
                setPosts(data);
            }
        } catch {
            showNativeToast("Failed to load articles.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            void loadPosts(searchQuery, category, status);
        }, 200);
        return () => clearTimeout(timer);
    }, [searchQuery, category, status, loadPosts]);

    const handleDeleteConfirmed = async () => {
        if (!pendingDelete) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/admin/blog/${pendingDelete.id}`, { method: "DELETE" });
            if (res.ok) {
                setPosts((prev) => prev.filter((p) => p.id !== pendingDelete.id));
                showNativeToast("Dispatch deleted");
                setPendingDelete(null);
            } else {
                const err = (await res.json().catch(() => ({}))) as { error?: string };
                showNativeToast(err.error || "Only Admins can delete updates.");
            }
        } catch {
            showNativeToast("Network error deleting dispatch.");
        } finally {
            setDeleting(false);
        }
    };

    const activeAlert = posts.find((p) => p.published && p.featured && p.category === "ALERT");

    return (
        <div className="space-y-5">
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                    <p className="label-mono">Editorial Desk</p>
                    <h1 className="display text-3xl sm:text-4xl mt-1">News &amp; Article Studio</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Publish breaking postal alerts, tariff circulars, news dispatches &amp; guides.
                    </p>
                </div>

                <Link
                    href="/dashboard/news/new"
                    className="tap inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border-2 border-foreground bg-primary px-4 text-sm font-bold text-primary-foreground shadow-[2px_2px_0_0_hsl(var(--foreground))]"
                >
                    <PlusCircle className="h-4 w-4" aria-hidden="true" />
                    <span>New Update</span>
                </Link>
            </header>

            {activeAlert && (
                <div className="rounded-md border-2 border-foreground bg-primary/10 p-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                        <AlertTriangle className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                        <div className="min-w-0">
                            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                                Active Homepage Breaking Alert
                            </p>
                            <p className="text-sm font-bold text-foreground truncate">{activeAlert.title}</p>
                        </div>
                    </div>
                    <Link
                        href={`/dashboard/news/${activeAlert.id}`}
                        className="tap shrink-0 rounded-md border border-foreground bg-card px-3 py-1.5 text-xs font-bold"
                    >
                        Edit Alert
                    </Link>
                </div>
            )}

            {/* Search & Filters */}
            <div className="rounded-md border-2 border-foreground bg-card p-3.5 sm:p-4 space-y-3">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search headlines, summaries, or URL slugs..."
                        enterKeyHint="search"
                        className="h-12 pl-10 text-base bg-background"
                    />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
                        {CATEGORY_TABS.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setCategory(tab.id)}
                                className={cn(
                                    "tap shrink-0 min-h-[40px] rounded-md border px-3 text-xs font-bold whitespace-nowrap",
                                    category === tab.id
                                        ? "border-foreground bg-foreground text-background"
                                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-1.5">
                        {STATUS_TABS.map((st) => (
                            <button
                                key={st.id}
                                type="button"
                                onClick={() => setStatus(st.id)}
                                className={cn(
                                    "tap shrink-0 min-h-[40px] rounded-md border px-3 text-xs font-bold",
                                    status === st.id
                                        ? "border-foreground bg-secondary text-secondary-foreground"
                                        : "border-border bg-background text-muted-foreground"
                                )}
                            >
                                {st.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center rounded-md border-2 border-foreground bg-card py-14 text-muted-foreground gap-2">
                    <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden="true" />
                    <p className="font-mono text-xs uppercase tracking-wider">Loading newsroom...</p>
                </div>
            ) : posts.length === 0 ? (
                <div className="rounded-md border-2 border-dashed border-foreground/40 bg-card p-10 text-center text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-25" aria-hidden="true" />
                    <p className="font-heading text-lg font-extrabold text-foreground">No dispatches found</p>
                    <p className="text-sm mt-1">Create a new postal update or adjust your filters.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {posts.map((post) => (
                        <article
                            key={post.id}
                            className="rounded-md border-2 border-foreground bg-card overflow-hidden shadow-[3px_3px_0_0_hsl(var(--foreground))] flex flex-col justify-between"
                        >
                            <div>
                                {post.coverImage && (
                                    <div className="relative aspect-video w-full border-b border-border bg-muted">
                                        <Image
                                            src={`${post.coverImage.endsWith("/") ? post.coverImage : `${post.coverImage}/`}-/preview/800x450/-/quality/smart/`}
                                            alt={post.title}
                                            fill
                                            unoptimized
                                            className="object-cover"
                                        />
                                    </div>
                                )}
                                <div className="p-4 space-y-2.5">
                                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span
                                                className={cn(
                                                    "rounded-sm border px-2 py-0.5 font-mono text-[10px] font-bold uppercase",
                                                    BADGE_STYLE[post.category] || BADGE_STYLE.GUIDE
                                                )}
                                            >
                                                {post.category || "GUIDE"}
                                            </span>
                                            {post.featured && (
                                                <span className="inline-flex items-center gap-0.5 font-mono text-[10px] font-bold uppercase text-primary">
                                                    <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                                                    Featured
                                                </span>
                                            )}
                                            {!post.published && (
                                                <span className="rounded-sm border border-border bg-muted px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-muted-foreground">
                                                    Draft
                                                </span>
                                            )}
                                        </div>
                                        <span className="font-mono text-[11px] text-muted-foreground">
                                            {new Date(post.date).toLocaleDateString()} · {post.readingTime} min
                                        </span>
                                    </div>

                                    <h2 className="font-heading text-lg font-extrabold leading-snug line-clamp-2">
                                        {post.title}
                                    </h2>
                                    {post.excerpt && (
                                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                            {post.excerpt}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="border-t border-border bg-muted/25 px-4 py-2.5 flex items-center gap-2">
                                <Link
                                    href={`/dashboard/news/${post.id}`}
                                    className="tap flex-1 min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-md border-2 border-foreground bg-card px-3 text-xs font-extrabold hover:bg-secondary/30"
                                >
                                    <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                                    <span>Edit Studio</span>
                                </Link>
                                <Link
                                    href={`/blog/${post.slug}`}
                                    target="_blank"
                                    aria-label={`Preview ${post.title}`}
                                    className="tap min-h-[42px] min-w-[42px] inline-flex items-center justify-center rounded-md border border-border bg-background text-foreground hover:border-foreground"
                                >
                                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                </Link>
                                {canDelete && (
                                    <button
                                        type="button"
                                        onClick={() => setPendingDelete(post)}
                                        aria-label={`Delete ${post.title}`}
                                        className="tap min-h-[42px] min-w-[42px] inline-flex items-center justify-center rounded-md border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
                                    >
                                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                                    </button>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            )}

            <ConfirmDialog
                open={!!pendingDelete}
                onOpenChange={(open) => !open && setPendingDelete(null)}
                title="Delete Update"
                description={
                    pendingDelete
                        ? `Permanently delete "${pendingDelete.title}"? Visitors following /blog/${pendingDelete.slug} will receive a 404.`
                        : ""
                }
                confirmLabel="Delete Update"
                destructive
                loading={deleting}
                onConfirm={handleDeleteConfirmed}
            />
        </div>
    );
}
