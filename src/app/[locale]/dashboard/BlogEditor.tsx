"use client";

import { useState, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Save, Check } from "lucide-react";
import type { BlogPost } from "@prisma/client";

// Dynamically import Jodit with ssr: false because it relies on window object
const JoditEditor = dynamic(() => import("jodit-react"), { 
    ssr: false,
    loading: () => <div className="h-[500px] bg-muted/20 animate-pulse rounded-xl border border-border/50 flex items-center justify-center text-muted-foreground">Loading Editor...</div>
});

interface BlogEditorProps {
    post?: BlogPost;
    onSave: () => void;
    onCancel: () => void;
}

export default function BlogEditor({ post, onSave, onCancel }: BlogEditorProps) {
    const editor = useRef(null);
    const [title, setTitle] = useState(post?.title || "");
    const [slug, setSlug] = useState(post?.slug || "");
    const [excerpt, setExcerpt] = useState(post?.excerpt || "");
    const [tags, setTags] = useState(post?.tags?.join(", ") || "");
    const [contentHtml, setContentHtml] = useState(post?.contentHtml || "");
    const [published, setPublished] = useState(post?.published ?? true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const config = useMemo(() => ({
        readonly: false,
        height: 600,
        theme: 'dark',
        placeholder: 'Start writing your article...',
        toolbarSticky: true,
        showCharsCounter: false,
        showWordsCounter: false,
        showXPathInStatusbar: false
    }), []);

    const handleSave = async () => {
        if (!title || !slug || !contentHtml) {
            setError("Title, Slug, and Content are required");
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const endpoint = post ? `/api/admin/blog/${post.id}` : '/api/admin/blog';
            const method = post ? 'PUT' : 'POST';

            const res = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    slug,
                    excerpt,
                    contentHtml,
                    tags: tags.split(",").map(t => t.trim()).filter(Boolean),
                    published
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to save article");
            }

            onSave();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const autoGenerateSlug = (text: string) => {
        if (!post) {
            setSlug(text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" onClick={onCancel} className="gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back to Articles
                </Button>
                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={published} 
                            onChange={e => setPublished(e.target.checked)}
                            className="rounded border-border w-4 h-4 accent-primary"
                        />
                        Published
                    </label>
                    <Button onClick={handleSave} disabled={saving} className="gap-2 rounded-xl">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {post ? "Update Article" : "Publish Article"}
                    </Button>
                </div>
            </div>

            {error && (
                <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-xl border border-destructive/20 font-medium">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Title</label>
                    <Input 
                        value={title} 
                        onChange={e => {
                            setTitle(e.target.value);
                            autoGenerateSlug(e.target.value);
                        }} 
                        placeholder="Article Title" 
                        className="rounded-xl"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">URL Slug</label>
                    <Input 
                        value={slug} 
                        onChange={e => setSlug(e.target.value)} 
                        placeholder="article-url-slug" 
                        className="rounded-xl"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Excerpt</label>
                <textarea 
                    value={excerpt} 
                    onChange={e => setExcerpt(e.target.value)} 
                    placeholder="Brief description for blog cards and SEO..." 
                    className="w-full h-20 px-3 py-2 rounded-xl border border-input bg-transparent text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Tags (comma separated)</label>
                <Input 
                    value={tags} 
                    onChange={e => setTags(e.target.value)} 
                    placeholder="guides, shipping, rates" 
                    className="rounded-xl"
                />
            </div>

            <div className="space-y-2 pt-4">
                <label className="text-sm font-medium text-muted-foreground">Content</label>
                <div className="rounded-xl overflow-hidden border border-border/50 shadow-sm [&_.jodit-container]:!border-0">
                    <JoditEditor
                        ref={editor}
                        value={contentHtml}
                        config={config}
                        onBlur={newContent => setContentHtml(newContent)}
                    />
                </div>
            </div>
            
            <div className="flex justify-end pt-4">
                <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2 rounded-xl">
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                    {post ? "Save Changes" : "Publish Article"}
                </Button>
            </div>
        </div>
    );
}
