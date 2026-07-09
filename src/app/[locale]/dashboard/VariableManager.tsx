"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, Edit3, Trash2, CheckCircle, Save, X, Code2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { SiteVariable } from "@prisma/client";

export default function VariableManager() {
    const [variables, setVariables] = useState<SiteVariable[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    
    // Form state
    const [key, setKey] = useState("");
    const [value, setValue] = useState("");
    const [description, setDescription] = useState("");

    const fetchVariables = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/admin/variables");
            if (res.ok) {
                const data = await res.json();
                setVariables(data);
            }
        } catch (error) {
            console.error("Error fetching variables:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVariables();
    }, []);

    const handleEdit = (v: SiteVariable) => {
        setKey(v.key);
        setValue(v.value);
        setDescription(v.description || "");
        setEditingKey(v.key);
        setIsCreating(false);
    };

    const handleNew = () => {
        setKey("");
        setValue("");
        setDescription("");
        setIsCreating(true);
        setEditingKey(null);
    };

    const handleCancel = () => {
        setIsCreating(false);
        setEditingKey(null);
    };

    const handleSave = async () => {
        if (!key || !value) return;

        try {
            const res = await fetch("/api/admin/variables", {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value, description })
            });
            if (res.ok) {
                fetchVariables();
                setIsCreating(false);
                setEditingKey(null);
            }
        } catch (error) {
            console.error("Error saving variable:", error);
        }
    };

    const handleDelete = async (deleteKey: string) => {
        if (!confirm(`Are you sure you want to delete {{${deleteKey}}}?`)) return;
        
        try {
            const res = await fetch(`/api/admin/variables?key=${deleteKey}`, { method: "DELETE" });
            if (res.ok) {
                setVariables(variables.filter(v => v.key !== deleteKey));
            }
        } catch (error) {
            console.error("Error deleting variable:", error);
        }
    };

    return (
        <Card className="border-border/50 overflow-hidden">
            <CardHeader className="border-b border-border/40 bg-card/80 flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                        Sitewide Placeholders
                    </CardTitle>
                    <CardDescription className="text-sm mt-1">Define dynamic variables to use anywhere via {'{{key}}'}.</CardDescription>
                </div>
                <Button onClick={handleNew} className="gap-2 rounded-xl h-10">
                    <PlusCircle className="w-4 h-4" /> Add Variable
                </Button>
            </CardHeader>
            <CardContent className="p-0">
                {loading ? (
                    <div className="p-16 text-center text-muted-foreground">
                        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                        <p>Loading variables...</p>
                    </div>
                ) : variables.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                        <Code2 className="w-16 h-16 mx-auto mb-4 opacity-15" />
                        <p className="text-lg font-medium mb-1">No Variables</p>
                        <p className="text-sm">Create a variable to get started.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left relative">
                            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border/50 sticky top-0">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Tag Usage</th>
                                    <th className="px-6 py-4 font-medium">Value</th>
                                    <th className="px-6 py-4 font-medium">Description</th>
                                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {variables.map((v) => (
                                    <tr key={v.key} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-6 py-4 font-mono text-primary font-medium">{`{{${v.key}}}`}</td>
                                        <td className="px-6 py-4 font-medium max-w-xs truncate" title={v.value}>{v.value}</td>
                                        <td className="px-6 py-4 text-muted-foreground">{v.description || "-"}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => handleEdit(v)} className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10">
                                                    <Edit3 className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDelete(v.key)} className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10">
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

            <Dialog open={isCreating || !!editingKey} onOpenChange={(open) => !open && handleCancel()}>
                <DialogContent className="max-w-lg p-0 border-border/50 bg-card">
                    <DialogHeader className="p-6 pb-0">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            {isCreating ? "Add Variable" : "Edit Variable"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="text-sm font-medium text-muted-foreground mb-1 block">Key (e.g. register_price)</label>
                            <Input 
                                value={key} 
                                onChange={e => setKey(e.target.value)} 
                                disabled={!!editingKey} 
                                placeholder="register_price" 
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-muted-foreground mb-1 block">Value</label>
                            <textarea 
                                value={value} 
                                onChange={e => setValue(e.target.value)} 
                                placeholder="50 LKR" 
                                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y whitespace-pre-wrap font-mono"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-muted-foreground mb-1 block">Description (Optional)</label>
                            <textarea 
                                value={description} 
                                onChange={e => setDescription(e.target.value)} 
                                placeholder="Cost for registered mail" 
                                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                            />
                        </div>
                    </div>
                    <DialogFooter className="p-6 pt-0">
                        <div className="flex justify-end gap-2 w-full">
                            <Button variant="ghost" onClick={handleCancel}>Cancel</Button>
                            <Button onClick={handleSave} className="gap-2"><Save className="w-4 h-4"/> Save</Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
