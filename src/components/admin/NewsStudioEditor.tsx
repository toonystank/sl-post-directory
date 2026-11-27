"use client";

import * as React from "react";
import Image from "next/image";
import {
    ArrowLeft,
    Settings,
    Eye,
    Pencil,
    Send,
    Loader2,
    Star,
    Sparkles,
    ExternalLink,
    Calendar,
    Clock,
    User,
} from "lucide-react";
import { Link, useRouter } from "@/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/shell/Sheet";
import { showNativeToast } from "@/components/shell/NativeToast";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { isSafeExternalHttpUrl } from "@/lib/security";
import { replacePlaceholders } from "@/lib/variables";
import { cn } from "@/lib/utils";
import AdminImageUpload from "./AdminImageUpload";
import TiptapRichEditor, { type SiteVarItem } from "./TiptapRichEditor";

export interface NewsPostDraftData {
    id?: string;
    slug: string;
    title: string;
    excerpt: string;
    contentHtml: string;
    tags: string[];
    published: boolean;
    category: "NEWS" | "ALERT" | "TARIFF" | "GUIDE";
    coverImage: string | null;
    coverCaption: string;
    featured: boolean;
    sourceUrl: string;
    author: string;
}

const TEMPLATES: Array<{
    id: string;
    label: string;
    category: "NEWS" | "ALERT" | "TARIFF" | "GUIDE";
    featured: boolean;
    title: string;
    excerpt: string;
    html: string;
}> = [
    {
        id: "alert",
        label: "Breaking Service Alert",
        category: "ALERT",
        featured: true,
        title: "Service Alert: Counter & Delivery Hours Update",
        excerpt: "Important notice for customers regarding temporary schedule changes and affected delivery zones.",
        html: `<div class="callout-alert" data-callout="alert"><p><strong>Service Advisory:</strong> State clearly which districts, post offices, or services are affected and the effective dates.</p></div><h2>What Customers Should Know</h2><ul><li>Affected offices / services: ...</li><li>Effective period: ...</li><li>Alternative post offices nearby: ...</li></ul><p>Check local opening hours in our Post Office Directory before visiting.</p>`,
    },
    {
        id: "tariff",
        label: "Tariff / Rate Revision",
        category: "TARIFF",
        featured: false,
        title: "Postage Tariff Revision Update",
        excerpt: "Updated domestic and international postal tariff summary following the latest Department of Posts circular.",
        html: `<h2>Updated Postage Schedule</h2><p>Revised rates are now reflected in our Postage Calculator. Summary of key changes:</p><table><thead><tr><th>Service</th><th>Updated Rate</th><th>Notes</th></tr></thead><tbody><tr><td>Registered Post</td><td>{{register_post_price}}</td><td>Inland letters</td></tr><tr><td>SLP Courier</td><td>From Feb 9 Tariff</td><td>Next-day priority</td></tr></tbody></table><h2>Before You Post</h2><p>Attach official receipts cleanly and verify weight slabs before visiting the counter.</p>`,
    },
    {
        id: "news",
        label: "Postal News Update",
        category: "NEWS",
        featured: false,
        title: "New Service Expansion Across Regional Offices",
        excerpt: "Latest developments from the Sri Lanka Post network and community-verified service updates.",
        html: `<h2>Overview</h2><p>Summarize the announcement clearly in two concise paragraphs so mobile readers get the essential facts immediately.</p><h2>Key Highlights</h2><ul><li>New service availability and operating counters</li><li>What documents or barcode numbers to carry</li></ul>`,
    },
    {
        id: "guide",
        label: "How-To Postal Guide",
        category: "GUIDE",
        featured: false,
        title: "How to Send & Track Parcels in Sri Lanka",
        excerpt: "Step-by-step reference covering packaging rules, registration receipts, and online barcode tracking.",
        html: `<h2>Step 1: Prepare & Address Your Item</h2><p>Write the 5-digit postal code clearly on the bottom line.</p><h2>Step 2: Choose Registered or Speed Post</h2><ul><li>Verify fragile/liquids restrictions before sealing</li><li>Keep your counter barcode receipt (<code>EE...LK</code> or <code>RA...LK</code>)</li></ul>`,
    },
];

const CATEGORY_OPTIONS: Array<{ value: "ALERT" | "TARIFF" | "NEWS" | "GUIDE"; label: string }> = [
    { value: "ALERT", label: "Service Alert" },
    { value: "TARIFF", label: "Tariff Update" },
    { value: "NEWS", label: "Postal News" },
    { value: "GUIDE", label: "Guide" },
];

function slugifyTitle(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
}

export default function NewsStudioEditor({
    initialPost,
    defaultAuthor,
}: {
    initialPost: NewsPostDraftData | null;
    defaultAuthor: string;
}) {
    const router = useRouter();
    const isEditing = Boolean(initialPost?.id);
    const draftStorageKey = `lpd_news_draft_${initialPost?.id ?? "new"}`;

    const [mode, setMode] = React.useState<"write" | "preview">("write");
    const [settingsOpen, setSettingsOpen] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [errorMsg, setErrorMsg] = React.useState("");
    const [variables, setVariables] = React.useState<SiteVarItem[]>([]);

    const [title, setTitle] = React.useState(initialPost?.title || "");
    const [slug, setSlug] = React.useState(initialPost?.slug || "");
    const [slugManuallyEdited, setSlugManuallyEdited] = React.useState(Boolean(initialPost?.id));
    const [excerpt, setExcerpt] = React.useState(initialPost?.excerpt || "");
    const [contentHtml, setContentHtml] = React.useState(initialPost?.contentHtml || "");
    const [tagsInput, setTagsInput] = React.useState((initialPost?.tags || []).join(", "));
    const [published, setPublished] = React.useState(initialPost ? initialPost.published : true);
    const [category, setCategory] = React.useState<"NEWS" | "ALERT" | "TARIFF" | "GUIDE">(
        initialPost?.category || "NEWS"
    );
    const [coverImage, setCoverImage] = React.useState<string | null>(initialPost?.coverImage ?? null);
    const [coverCaption, setCoverCaption] = React.useState(initialPost?.coverCaption || "");
    const [featured, setFeatured] = React.useState(initialPost?.featured ?? false);
    const [sourceUrl, setSourceUrl] = React.useState(initialPost?.sourceUrl || "");
    const [author, setAuthor] = React.useState(initialPost?.author || defaultAuthor);

    const [localSavedAt, setLocalSavedAt] = React.useState<string | null>(null);
    const [restorableDraft, setRestorableDraft] = React.useState<NewsPostDraftData | null>(null);

    React.useEffect(() => {
        fetch("/api/admin/variables")
            .then((res) => (res.ok ? res.json() : []))
            .then((rows) => {
                if (Array.isArray(rows)) setVariables(rows);
            })
            .catch(() => {});
    }, []);

    React.useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const raw = window.localStorage.getItem(draftStorageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw) as NewsPostDraftData & { savedAt?: string };
            if (!isEditing && (parsed.title || parsed.contentHtml)) {
                setRestorableDraft(parsed);
            }
        } catch {
            // ignore corrupted storage
        }
    }, [draftStorageKey, isEditing]);

    React.useEffect(() => {
        if (typeof window === "undefined") return;
        if (!title && !contentHtml && !excerpt) return;
        const timer = window.setTimeout(() => {
            try {
                const payload = {
                    title,
                    slug,
                    excerpt,
                    contentHtml,
                    tags: tagsInput
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    published,
                    category,
                    coverImage,
                    coverCaption,
                    featured,
                    sourceUrl,
                    author,
                    savedAt: new Date().toISOString(),
                };
                window.localStorage.setItem(draftStorageKey, JSON.stringify(payload));
                setLocalSavedAt(
                    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                );
            } catch {
                // ignore storage quota
            }
        }, 900);
        return () => window.clearTimeout(timer);
    }, [
        draftStorageKey,
        title,
        slug,
        excerpt,
        contentHtml,
        tagsInput,
        published,
        category,
        coverImage,
        coverCaption,
        featured,
        sourceUrl,
        author,
    ]);

    const handleTitleChange = (val: string) => {
        setTitle(val);
        if (!slugManuallyEdited) {
            setSlug(slugifyTitle(val));
        }
    };

    const applyTemplate = (tpl: (typeof TEMPLATES)[number]) => {
        setCategory(tpl.category);
        setFeatured(tpl.featured);
        if (!title.trim()) handleTitleChange(tpl.title);
        if (!excerpt.trim()) setExcerpt(tpl.excerpt);
        setContentHtml(tpl.html);
        showNativeToast(`Applied ${tpl.label} template`);
    };

    const handleRestoreLocalDraft = () => {
        if (!restorableDraft) return;
        setTitle(restorableDraft.title || "");
        setSlug(restorableDraft.slug || slugifyTitle(restorableDraft.title || ""));
        setExcerpt(restorableDraft.excerpt || "");
        setContentHtml(restorableDraft.contentHtml || "");
        setTagsInput((restorableDraft.tags || []).join(", "));
        setPublished(restorableDraft.published ?? true);
        setCategory(restorableDraft.category || "NEWS");
        setCoverImage(restorableDraft.coverImage ?? null);
        setCoverCaption(restorableDraft.coverCaption || "");
        setFeatured(restorableDraft.featured ?? false);
        setSourceUrl(restorableDraft.sourceUrl || "");
        if (restorableDraft.author) setAuthor(restorableDraft.author);
        setRestorableDraft(null);
        showNativeToast("Local draft restored");
    };

    const variablesMap = React.useMemo(() => {
        const map: Record<string, string> = {};
        for (const v of variables) map[v.key] = v.value;
        return map;
    }, [variables]);

    const readingTimeEstimate = React.useMemo(() => {
        const plain = contentHtml.replace(/<[^>]*>?/gm, "");
        const words = plain.split(/\s+/).filter(Boolean).length;
        return Math.max(1, Math.ceil(words / 200));
    }, [contentHtml]);

    const handleSave = async (targetPublished?: boolean) => {
        const finalPublished = typeof targetPublished === "boolean" ? targetPublished : published;
        const cleanTitle = title.trim();
        const cleanSlug = (slug.trim() || slugifyTitle(cleanTitle)).replace(/^-+|-+$/g, "");

        if (cleanTitle.length < 3 || !cleanSlug || !contentHtml.trim()) {
            setErrorMsg("Headline, URL slug, and body content are required before saving.");
            return;
        }

        setSaving(true);
        setErrorMsg("");

        try {
            const payload = {
                title: cleanTitle,
                slug: cleanSlug,
                excerpt: excerpt.trim(),
                contentHtml,
                tags: tagsInput
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                published: finalPublished,
                category,
                coverImage,
                coverCaption: coverCaption.trim() || null,
                featured,
                sourceUrl: sourceUrl.trim() || null,
                author: author.trim() || defaultAuthor,
            };

            const url = isEditing ? `/api/admin/blog/${initialPost!.id}` : "/api/admin/blog";
            const method = isEditing ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                if (typeof window !== "undefined") {
                    window.localStorage.removeItem(draftStorageKey);
                }
                showNativeToast(finalPublished ? "Update published" : "Draft saved");
                router.push("/dashboard/news");
                router.refresh();
            } else {
                const err = (await res.json().catch(() => ({}))) as { error?: string };
                setErrorMsg(err.error || "Failed to save article.");
            }
        } catch {
            setErrorMsg("Network error saving article.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-5 max-w-4xl mx-auto">
            {/* Sticky Studio Action Bar */}
            <div className="rounded-md border-2 border-foreground bg-card p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2.5 shadow-[3px_3px_0_0_hsl(var(--foreground))]">
                <div className="flex items-center gap-2.5">
                    <Link
                        href="/dashboard/news"
                        className="tap inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-bold hover:border-foreground"
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden sm:inline">News List</span>
                    </Link>
                    <div>
                        <p className="label-mono">
                            {isEditing ? "Editing Dispatch" : "New Dispatch Studio"}
                        </p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                            {localSavedAt ? `Draft saved ${localSavedAt}` : "Autosaves locally"}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Segmented Write | Preview */}
                    <div className="inline-flex rounded-md border border-foreground bg-muted p-0.5">
                        <button
                            type="button"
                            onClick={() => setMode("write")}
                            className={cn(
                                "tap min-h-[40px] rounded-sm px-3 text-xs font-bold inline-flex items-center gap-1.5",
                                mode === "write"
                                    ? "bg-card text-foreground shadow-sm"
                                    : "text-muted-foreground"
                            )}
                        >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Write</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode("preview")}
                            className={cn(
                                "tap min-h-[40px] rounded-sm px-3 text-xs font-bold inline-flex items-center gap-1.5",
                                mode === "preview"
                                    ? "bg-card text-foreground shadow-sm"
                                    : "text-muted-foreground"
                            )}
                        >
                            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Preview</span>
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={() => setSettingsOpen(true)}
                        aria-label="Open Post Settings"
                        className="tap min-h-[42px] inline-flex items-center gap-1.5 rounded-md border border-foreground bg-background px-3 text-xs font-bold hover:bg-muted"
                    >
                        <Settings className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden sm:inline">Settings</span>
                    </button>

                    <Button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleSave(published)}
                        className="h-10 sm:h-11 font-bold gap-1.5 px-4"
                    >
                        {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <Send className="h-4 w-4" aria-hidden="true" />
                        )}
                        <span>{published ? (isEditing ? "Update Live" : "Publish") : "Save Draft"}</span>
                    </Button>
                </div>
            </div>

            {restorableDraft && (
                <div className="rounded-md border-2 border-foreground bg-secondary/25 p-3.5 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs sm:text-sm font-semibold text-foreground">
                        Unsaved local draft found (&ldquo;{restorableDraft.title || "Untitled"}&rdquo;).
                    </p>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                if (typeof window !== "undefined") window.localStorage.removeItem(draftStorageKey);
                                setRestorableDraft(null);
                            }}
                            className="h-10 border-foreground"
                        >
                            Discard
                        </Button>
                        <Button type="button" size="sm" onClick={handleRestoreLocalDraft} className="h-10 font-bold">
                            Restore Draft
                        </Button>
                    </div>
                </div>
            )}

            {errorMsg && (
                <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3.5 text-sm font-medium text-destructive">
                    {errorMsg}
                </div>
            )}

            {mode === "write" ? (
                <div className="space-y-4">
                    {/* Starter Templates (only show for new posts) */}
                    {!isEditing && (
                        <div className="space-y-2">
                            <p className="label-mono flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                                <span>Starter Templates (1-Tap Prefill)</span>
                            </p>
                            <div className="flex gap-2 overflow-x-auto scrollbar-hide snap-carousel pb-1">
                                {TEMPLATES.map((tpl) => (
                                    <button
                                        key={tpl.id}
                                        type="button"
                                        onClick={() => applyTemplate(tpl)}
                                        className="tap shrink-0 min-h-[42px] rounded-md border border-foreground bg-card px-3 text-xs font-bold hover:bg-secondary/35 whitespace-nowrap"
                                    >
                                        + {tpl.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Category & Pin Bar */}
                    <div className="rounded-md border-2 border-foreground bg-card p-4 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-1.5">
                                {CATEGORY_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setCategory(opt.value)}
                                        className={cn(
                                            "tap min-h-[40px] rounded-md border px-3 text-xs font-extrabold",
                                            category === opt.value
                                                ? opt.value === "ALERT"
                                                    ? "border-foreground bg-primary text-primary-foreground"
                                                    : "border-foreground bg-secondary text-secondary-foreground"
                                                : "border-border bg-background text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={() => setFeatured((f) => !f)}
                                aria-pressed={featured}
                                className={cn(
                                    "tap min-h-[40px] inline-flex items-center gap-1.5 rounded-md border px-3 text-xs font-bold",
                                    featured
                                        ? "border-foreground bg-foreground text-background"
                                        : "border-border bg-background text-muted-foreground"
                                )}
                            >
                                <Star className={cn("h-3.5 w-3.5", featured && "fill-secondary text-secondary")} aria-hidden="true" />
                                <span>{featured ? "Pinned Featured" : "Pin as Featured"}</span>
                            </button>
                        </div>

                        <div>
                            <label className="label-mono block mb-1.5" htmlFor="studio-headline">
                                Headline
                            </label>
                            <Input
                                id="studio-headline"
                                value={title}
                                onChange={(e) => handleTitleChange(e.target.value)}
                                placeholder="e.g. Temporary Closure Notice or 2026 EMS Tariff Update"
                                className="h-12 text-lg font-heading font-extrabold bg-background"
                            />
                        </div>

                        <div>
                            <label className="label-mono block mb-1.5" htmlFor="studio-excerpt">
                                Short Summary (Shown on News Feed &amp; Google Search)
                            </label>
                            <textarea
                                id="studio-excerpt"
                                rows={2}
                                value={excerpt}
                                onChange={(e) => setExcerpt(e.target.value)}
                                placeholder="1–2 crisp sentences explaining why this update matters..."
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                        </div>
                    </div>

                    {/* Cover Image & Caption */}
                    <div className="rounded-md border-2 border-foreground bg-card p-4 space-y-3">
                        <p className="label-mono">Hero Cover Photo (Uploadcare CDN)</p>
                        <AdminImageUpload
                            value={coverImage}
                            onChange={setCoverImage}
                            label="Upload 16:9 Cover Photo"
                            aspect="16:9"
                            metadataTag="news-cover"
                        />
                        {coverImage && (
                            <div>
                                <label className="label-mono block mb-1" htmlFor="studio-cover-caption">
                                    Photo Caption / Credit
                                </label>
                                <Input
                                    id="studio-cover-caption"
                                    value={coverCaption}
                                    onChange={(e) => setCoverCaption(e.target.value)}
                                    placeholder="e.g. Colombo General Post Office counter queue notice"
                                    className="h-11 text-base bg-background"
                                />
                            </div>
                        )}
                    </div>

                    {/* Rich Text Editor */}
                    <TiptapRichEditor
                        value={contentHtml}
                        onChange={setContentHtml}
                        variables={variables}
                    />
                </div>
            ) : (
                /* Live Public Reader Preview */
                <article className="rounded-md border-2 border-foreground bg-card p-5 sm:p-8 shadow-[4px_4px_0_0_hsl(var(--foreground))] space-y-6">
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <span
                                className={cn(
                                    "font-mono text-xs font-bold uppercase px-2.5 py-0.5 rounded-sm border",
                                    category === "ALERT"
                                        ? "border-foreground bg-primary text-primary-foreground"
                                        : category === "TARIFF"
                                          ? "border-foreground bg-secondary text-secondary-foreground"
                                          : "border-border bg-muted text-foreground"
                                )}
                            >
                                {CATEGORY_OPTIONS.find((c) => c.value === category)?.label || category}
                            </span>
                            {featured && (
                                <span className="font-mono text-xs font-bold uppercase text-primary flex items-center gap-1">
                                    <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                                    Featured Dispatch
                                </span>
                            )}
                            {!published && (
                                <span className="font-mono text-xs uppercase px-2 py-0.5 border border-border bg-muted text-muted-foreground">
                                    Unpublished Draft
                                </span>
                            )}
                        </div>

                        <h1 className="display text-3xl sm:text-4xl">
                            {title.trim() || "Untitled Postal Dispatch"}
                        </h1>

                        {excerpt.trim() && (
                            <p className="text-base text-muted-foreground leading-relaxed">{excerpt}</p>
                        )}

                        <div className="border-y-2 border-foreground py-2.5 font-mono text-xs text-muted-foreground flex flex-wrap gap-4">
                            <span className="flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5" aria-hidden="true" />
                                {author || defaultAuthor}
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                                {new Date().toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                                {readingTimeEstimate} min read
                            </span>
                        </div>
                    </div>

                    {coverImage && (
                        <figure className="rounded-md border-2 border-foreground overflow-hidden bg-background">
                            <div className="relative aspect-video w-full">
                                <Image
                                    src={`${coverImage.endsWith("/") ? coverImage : `${coverImage}/`}-/preview/1200x675/-/quality/smart/`}
                                    alt={title || "Article cover"}
                                    fill
                                    unoptimized
                                    className="object-cover"
                                />
                            </div>
                            {coverCaption.trim() && (
                                <figcaption className="border-t border-border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
                                    {coverCaption}
                                </figcaption>
                            )}
                        </figure>
                    )}

                    <div
                        className="prose-custom max-w-[68ch] text-base leading-relaxed"
                        dangerouslySetInnerHTML={{
                            __html: sanitizeRichHtml(replacePlaceholders(contentHtml, variablesMap)),
                        }}
                    />

                    {sourceUrl.trim() && isSafeExternalHttpUrl(sourceUrl) && (
                        <div className="rounded-md border border-foreground bg-muted/40 p-4 flex items-center justify-between gap-3">
                            <div>
                                <p className="label-mono">Official Source / Circular</p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">{sourceUrl}</p>
                            </div>
                            <a
                                href={sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="tap shrink-0 inline-flex min-h-[40px] items-center gap-1.5 rounded-md border border-foreground bg-card px-3 text-xs font-bold"
                            >
                                <span>Open Source</span>
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                            </a>
                        </div>
                    )}
                </article>
            )}

            {/* Post Settings Sheet */}
            <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
                <SheetContent
                    title="Dispatch Settings"
                    description="Configure URL slug, tags, publish status & source attribution"
                    bodyClassName="space-y-4"
                    footer={
                        <Button type="button" onClick={() => setSettingsOpen(false)} className="w-full h-11 font-bold">
                            Done
                        </Button>
                    }
                >
                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                        <div>
                            <p className="text-sm font-bold text-foreground">Published State</p>
                            <p className="text-xs text-muted-foreground">
                                Visible on homepage &amp; /blog when enabled
                            </p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={published}
                            onClick={() => setPublished((p) => !p)}
                            className={cn(
                                "tap min-h-[40px] min-w-[76px] rounded-md border px-3 text-xs font-extrabold",
                                published
                                    ? "border-foreground bg-status-open text-white"
                                    : "border-border bg-background text-muted-foreground"
                            )}
                        >
                            {published ? "LIVE" : "DRAFT"}
                        </button>
                    </div>

                    <div>
                        <label className="label-mono block mb-1.5" htmlFor="settings-slug">
                            URL Slug
                        </label>
                        <Input
                            id="settings-slug"
                            value={slug}
                            onChange={(e) => {
                                setSlugManuallyEdited(true);
                                setSlug(e.target.value);
                            }}
                            placeholder="feb-2026-tariff-revision"
                            className="h-11 font-mono text-base bg-background"
                        />
                    </div>

                    <div>
                        <label className="label-mono block mb-1.5" htmlFor="settings-tags">
                            Tags (Comma-separated)
                        </label>
                        <Input
                            id="settings-tags"
                            value={tagsInput}
                            onChange={(e) => setTagsInput(e.target.value)}
                            placeholder="Rates, EMS, Notice"
                            className="h-11 text-base bg-background"
                        />
                    </div>

                    <div>
                        <label className="label-mono block mb-1.5" htmlFor="settings-source">
                            Official Circular / Source URL (Optional, https://)
                        </label>
                        <Input
                            id="settings-source"
                            type="url"
                            value={sourceUrl}
                            onChange={(e) => setSourceUrl(e.target.value)}
                            placeholder="https://slpost.gov.lk/..."
                            className="h-11 text-base bg-background"
                        />
                    </div>

                    <div>
                        <label className="label-mono block mb-1.5" htmlFor="settings-author">
                            Author Byline
                        </label>
                        <Input
                            id="settings-author"
                            value={author}
                            onChange={(e) => setAuthor(e.target.value)}
                            className="h-11 text-base bg-background"
                        />
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
