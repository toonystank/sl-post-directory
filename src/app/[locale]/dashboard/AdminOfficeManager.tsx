"use client";

import { useState, useEffect } from "react";
import { Edit3, Trash2, Search, PlusCircle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Office {
    id: string;
    name: string;
    postalCode: string;
}

export default function AdminOfficeManager({ isContributor = false }: { isContributor?: boolean }) {
    const [offices, setOffices] = useState<Office[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkAction, setBulkAction] = useState<string>("add_service");
    const [bulkService, setBulkService] = useState<string>("Foreign parcel unit");
    const [isBulking, setIsBulking] = useState(false);
    const [isMobileCollapsed, setIsMobileCollapsed] = useState(true);
    const router = useRouter();

    const SERVICE_TAGS = ["Foreign parcel unit", "postal complex", "regional sorting unit"];

    const fetchOffices = async (query: string = "") => {
        setLoading(true);
        try {
            const res = await fetch(`/api/offices?q=${encodeURIComponent(query)}`);
            if (res.ok) {
                const data = await res.json();
                setOffices(data.offices || []);
            }
        } catch (error) {
            console.error("Error fetching offices:", error);
        } finally {
            setLoading(false);
        }
    };

    // Debounced search (also handles initial load since searchQuery starts as "")
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchOffices(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to completely delete the ${name} Post Office? This cannot be undone.`)) {
            return;
        }

        setDeletingId(id);
        try {
            const res = await fetch(`/api/admin/office/${id}`, {
                method: "DELETE",
            });

            if (res.ok) {
                setOffices(offices.filter(o => o.id !== id));
                router.refresh(); // Refresh total count in parent
            } else {
                alert("Failed to delete post office.");
            }
        } catch (error) {
            console.error("Deletion error:", error);
            alert("Network error during deletion.");
        } finally {
            setDeletingId(null);
        }
    };

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === offices.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(offices.map((o) => o.id)));
        }
    };

    const handleBulkAction = async () => {
        if (selectedIds.size === 0) return;
        if (bulkAction === 'delete' && !confirm(`Are you sure you want to delete ${selectedIds.size} post offices?`)) {
            return;
        }

        setIsBulking(true);
        try {
            const res = await fetch('/api/admin/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    officeIds: Array.from(selectedIds),
                    action: bulkAction,
                    serviceQuery: bulkService
                })
            });

            if (res.ok) {
                alert(`Bulk operation successful on ${selectedIds.size} offices.`);
                setSelectedIds(new Set());
                fetchOffices(searchQuery);
                router.refresh();
            } else {
                alert('Bulk operation failed.');
            }
        } catch (error) {
            console.error(error);
            alert('Error during bulk operation.');
        } finally {
            setIsBulking(false);
        }
    };

    return (
        <Card className="border-border/50">
            <CardHeader 
                className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 bg-card/80 cursor-pointer md:cursor-default"
                onClick={(e) => {
                    if ((e.target as HTMLElement).closest('input')) return;
                    if (window.innerWidth < 768) setIsMobileCollapsed(!isMobileCollapsed);
                }}
            >
                <div className="flex items-center justify-between w-full md:w-auto">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            {isContributor ? "Directory Search" : "Directory Management"}
                        </CardTitle>
                        <CardDescription className="text-xs md:text-sm mt-1">
                            {isContributor
                                ? "Search the directory to find post offices and suggest edits."
                                : "Search explicitly to edit or delete any existing directory entry."}
                        </CardDescription>
                    </div>
                    <div className="md:hidden text-muted-foreground ml-4 shrink-0 flex items-center">
                        {isMobileCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                    </div>
                </div>
                <div className="flex w-full md:w-auto items-center gap-3">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name or code..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-10 rounded-xl bg-background w-full"
                        />
                    </div>
                </div>
            </CardHeader>

            <div className={`transition-all ${isMobileCollapsed ? 'hidden md:block' : ''}`}>
            {!isContributor && (
                <div className="bg-muted/20 border-b border-border/40 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <span className="text-sm font-medium text-muted-foreground">
                        {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select items below for bulk actions'}
                    </span>

                    <div className={`flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto transition-opacity ${selectedIds.size > 0 ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                            <select
                                className="text-sm rounded-lg border border-border bg-background px-3 py-2 w-full sm:w-auto"
                                value={bulkAction}
                                onChange={(e) => setBulkAction(e.target.value)}
                            >
                                <option value="add_service">Add Service Tag</option>
                                <option value="remove_service">Remove Service Tag</option>
                                <option value="delete">Delete Offices</option>
                            </select>

                            {(bulkAction === 'add_service' || bulkAction === 'remove_service') && (
                                <select
                                    className="text-sm rounded-lg border border-border bg-background px-3 py-2 w-full sm:w-auto flex-1 sm:flex-none"
                                    value={bulkService}
                                    onChange={(e) => setBulkService(e.target.value)}
                                >
                                    {SERVICE_TAGS.map(tag => (
                                        <option key={tag} value={tag}>{tag}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <Button size="sm" onClick={handleBulkAction} disabled={isBulking} className="w-full sm:w-auto h-9">
                            {isBulking ? 'Applying...' : 'Apply Action'}
                        </Button>
                    </div>
                </div>
            )}

            <CardContent className="p-0">
                {offices.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No post offices found matching "{searchQuery}"</p>
                    </div>
                ) : (
                    <div className="overflow-y-auto overflow-x-hidden max-h-[500px]">
                        {/* Desktop Table View */}
                        <table className="hidden md:table w-full text-sm text-left relative">
                            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border/50 sticky top-0 z-10">
                                <tr>
                                    {!isContributor && (
                                        <th className="px-6 py-4 font-medium w-12">
                                            <input
                                                type="checkbox"
                                                onChange={toggleSelectAll}
                                                checked={offices.length > 0 && selectedIds.size === offices.length}
                                                className="rounded border-border"
                                            />
                                        </th>
                                    )}
                                    <th className="px-6 py-4 font-medium">Post Office</th>
                                    <th className="px-6 py-4 font-medium">Postal Code</th>
                                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {offices.map((office) => (
                                    <tr key={office.id} className={`hover:bg-muted/30 transition-colors ${selectedIds.has(office.id) ? 'bg-primary/5' : ''}`}>
                                        {!isContributor && (
                                            <td className="px-6 py-3 w-12">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(office.id)}
                                                    onChange={() => toggleSelect(office.id)}
                                                    className="rounded border-border text-primary focus:ring-primary"
                                                />
                                            </td>
                                        )}
                                        <td className="px-6 py-3">
                                            <div className="font-medium text-foreground">{office.name}</div>
                                            <div className="text-xs text-muted-foreground mt-0.5 font-mono">{office.id}</div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <Badge variant="outline" className="font-mono">{office.postalCode}</Badge>
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {isContributor ? (
                                                    <Button asChild size="sm" variant="outline" className="h-8 shadow-none gap-1 hover:bg-primary/10 hover:text-primary">
                                                        <Link href={`/suggest/${office.id}`}>
                                                            <Edit3 className="w-3.5 h-3.5" /> Suggest Edit
                                                        </Link>
                                                    </Button>
                                                ) : (
                                                    <>
                                                        <Button asChild size="sm" variant="outline" className="h-8 shadow-none gap-1">
                                                            <Link href={`/dashboard/edit/${office.id}`}>
                                                                <Edit3 className="w-3.5 h-3.5" /> Edit
                                                            </Link>
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-8 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                            onClick={() => handleDelete(office.id, office.name)}
                                                            disabled={deletingId === office.id}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Mobile Card View */}
                        <div className="md:hidden flex flex-col divide-y divide-border/50">
                            {offices.map((office) => (
                                <div key={office.id} className={`p-4 flex flex-col gap-3 hover:bg-muted/30 transition-colors ${selectedIds.has(office.id) ? 'bg-primary/5' : ''}`}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-start gap-3">
                                            {!isContributor && (
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(office.id)}
                                                    onChange={() => toggleSelect(office.id)}
                                                    className="mt-1 rounded border-border text-primary focus:ring-primary shrink-0"
                                                />
                                            )}
                                            <div className="min-w-0">
                                                <div className="font-medium text-foreground truncate">{office.name}</div>
                                                <div className="text-xs text-muted-foreground mt-0.5 font-mono truncate">{office.id}</div>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="font-mono shrink-0">{office.postalCode}</Badge>
                                    </div>
                                    <div className="flex items-center justify-end gap-2 mt-1">
                                        {isContributor ? (
                                            <Button asChild size="sm" variant="outline" className="h-8 shadow-none gap-1 hover:bg-primary/10 hover:text-primary w-full">
                                                <Link href={`/suggest/${office.id}`}>
                                                    <Edit3 className="w-3.5 h-3.5" /> Suggest Edit
                                                </Link>
                                            </Button>
                                        ) : (
                                            <>
                                                <Button asChild size="sm" variant="outline" className="h-8 shadow-none gap-1 flex-1">
                                                    <Link href={`/dashboard/edit/${office.id}`}>
                                                        <Edit3 className="w-3.5 h-3.5" /> Edit
                                                    </Link>
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive border border-destructive/20"
                                                    onClick={() => handleDelete(office.id, office.name)}
                                                    disabled={deletingId === office.id}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
            </div>
        </Card>
    );
}
