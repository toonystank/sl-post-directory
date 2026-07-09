"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, Edit3, Trash2, CheckCircle, Save, X } from "lucide-react";
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
        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-border/50 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold">Sitewide Placeholders</h2>
                    <p className="text-sm text-muted-foreground mt-1">Define dynamic variables to use anywhere via {'{{key}}'}.</p>
                </div>
                {!isCreating && !editingKey && (
                    <Button onClick={handleNew} className="gap-2 rounded-xl">
                        <PlusCircle className="w-4 h-4" /> Add Variable
                    </Button>
                )}
            </div>

            {(isCreating || editingKey) && (
                <div className="p-6 bg-muted/20 border-b border-border/50 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={handleCancel}>Cancel</Button>
                        <Button onClick={handleSave} className="gap-2"><Save className="w-4 h-4"/> Save</Button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="p-8 text-center text-muted-foreground animate-pulse">Loading variables...</div>
            ) : variables.length === 0 && !isCreating ? (
                <div className="p-8 text-center text-muted-foreground">No variables defined yet.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/20 border-b border-border/50">
                            <tr>
                                <th className="px-6 py-4 font-medium">Tag Usage</th>
                                <th className="px-6 py-4 font-medium">Value</th>
                                <th className="px-6 py-4 font-medium">Description</th>
                                <th className="px-6 py-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {variables.map((v) => (
                                <tr key={v.key} className="hover:bg-muted/10 transition-colors">
                                    <td className="px-6 py-4 font-mono text-primary font-medium">{`{{${v.key}}}`}</td>
                                    <td className="px-6 py-4 font-medium">{v.value}</td>
                                    <td className="px-6 py-4 text-muted-foreground">{v.description || "-"}</td>
                                    <td className="px-6 py-4 text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(v)} className="w-8 h-8 rounded-lg text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 mr-2">
                                            <Edit3 className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(v.key)} className="w-8 h-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10">
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
