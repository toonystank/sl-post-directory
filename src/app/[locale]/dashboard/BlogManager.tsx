"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit3, Trash2, CheckCircle, XCircle, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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

    return (
        <Card className="border-border/50 overflow-hidden">
            <CardHeader className="border-b border-border/40 bg-card/80 flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                        Blog Articles
                    </CardTitle>
                    <CardDescription className="text-sm mt-1">Manage your site's postal guides and articles.</CardDescription>
                </div>
                <Button onClick={() => setIsCreating(true)} className="gap-2 rounded-xl h-10">
                    <PlusCircle className="w-4 h-4" /> New Article
                </Button>
            </CardHeader>
            <CardContent className="p-0">
                {loading ? (
                    <div className="p-16 text-center text-muted-foreground">
                        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                        <p>Loading articles...</p>
                    </div>
                ) : posts.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                        <FileText className="w-16 h-16 mx-auto mb-4 opacity-15" />
                        <p className="text-lg font-medium mb-1">No Articles</p>
                        <p className="text-sm">Create an article to get started.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left relative">
                            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border/50 sticky top-0">
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
                                    <tr key={post.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-6 py-4 font-medium text-foreground">{post.title}</td>
                                        <td className="px-6 py-4 text-muted-foreground">{post.author}</td>
                                        <td className="px-6 py-4 text-muted-foreground font-mono text-xs">{new Date(post.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-center">
                                                {post.published ? (
                                                    <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
                                                        Published
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
                                                        Draft
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => setEditingPost(post)} className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10">
                                                    <Edit3 className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDelete(post.id)} className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>

            <Dialog open={isCreating || !!editingPost} onOpenChange={(open) => {
                if (!open) {
                    setIsCreating(false);
                    setEditingPost(null);
                }
            }}>
                <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-[90vw] lg:max-w-[80vw] max-h-[90vh] overflow-y-auto p-0 border-border/50 bg-card">
                    <div className="p-8">
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-foreground">
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
                </DialogContent>
            </Dialog>
        </Card>
    );
}
