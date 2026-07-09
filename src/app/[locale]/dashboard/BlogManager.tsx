"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit3, Trash2, CheckCircle, XCircle } from "lucide-react";
import BlogEditor from "./BlogEditor";
import type { BlogPost } from "@prisma/client";

export default function BlogManager() {
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const fetchPosts = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/admin/blog");
            if (res.ok) {
                const data = await res.json();
                setPosts(data);
            }
        } catch (error) {
            console.error("Error fetching posts:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!editingPost && !isCreating) {
            fetchPosts();
        }
    }, [editingPost, isCreating]);

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this article?")) return;
        
        try {
            const res = await fetch(`/api/admin/blog/${id}`, { method: "DELETE" });
            if (res.ok) {
                setPosts(posts.filter(p => p.id !== id));
            }
        } catch (error) {
            console.error("Error deleting post:", error);
        }
    };

    if (isCreating || editingPost) {
        return (
            <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-sm">
                <h2 className="text-2xl font-bold mb-6">
                    {isCreating ? "Create New Article" : "Edit Article"}
                </h2>
                <BlogEditor 
                    post={editingPost || undefined} 
                    onSave={() => {
                        setIsCreating(false);
                        setEditingPost(null);
                    }} 
                    onCancel={() => {
                        setIsCreating(false);
                        setEditingPost(null);
                    }} 
                />
            </div>
        );
    }

    return (
        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-border/50 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold">Blog Articles</h2>
                    <p className="text-sm text-muted-foreground mt-1">Manage your site's postal guides and articles.</p>
                </div>
                <Button onClick={() => setIsCreating(true)} className="gap-2 rounded-xl">
                    <PlusCircle className="w-4 h-4" /> New Article
                </Button>
            </div>

            {loading ? (
                <div className="p-8 text-center text-muted-foreground animate-pulse">Loading articles...</div>
            ) : posts.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No articles found. Create one to get started!</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/20 border-b border-border/50">
                            <tr>
                                <th className="px-6 py-4 font-medium">Title</th>
                                <th className="px-6 py-4 font-medium">Author</th>
                                <th className="px-6 py-4 font-medium">Date</th>
                                <th className="px-6 py-4 font-medium text-center">Status</th>
                                <th className="px-6 py-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {posts.map((post) => (
                                <tr key={post.id} className="hover:bg-muted/10 transition-colors">
                                    <td className="px-6 py-4 font-medium text-foreground">{post.title}</td>
                                    <td className="px-6 py-4 text-muted-foreground">{post.author}</td>
                                    <td className="px-6 py-4 text-muted-foreground">{new Date(post.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center">
                                            {post.published ? (
                                                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                                                    <CheckCircle className="w-3 h-3" /> Published
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 text-xs font-medium text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full">
                                                    <XCircle className="w-3 h-3" /> Draft
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Button variant="ghost" size="icon" onClick={() => setEditingPost(post)} className="w-8 h-8 rounded-lg text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 mr-2">
                                            <Edit3 className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(post.id)} className="w-8 h-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
