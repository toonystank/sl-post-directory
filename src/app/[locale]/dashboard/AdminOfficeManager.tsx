"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
    Edit3,
    Trash2,
    Search,
    AlertCircle,
    PlusCircle,
    Loader2,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    MapPin,
    Clock,
} from "lucide-react";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showNativeToast } from "@/components/shell/NativeToast";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { cn } from "@/lib/utils";
import OfficeEditModal from "./OfficeEditModal";

interface Office {
    id: string;
    slug: string;
    name: string;
    postalCode: string;
    operatingHours: string | null;
    services: string[];
    rmsc: string | null;
    latitude: number | null;
    longitude: number | null;
    _count?: { fields: number };
}

type OfficeFilter = "all" | "missing_gps" | "missing_hours" | "has_services";

const FILTER_OPTIONS: Array<{ id: OfficeFilter; label: string }> = [
    { id: "all", label: "All Offices" },
    { id: "missing_gps", label: "Missing GPS" },
    { id: "missing_hours", label: "Missing Hours" },
    { id: "has_services", label: "Has Services" },
];

const SERVICE_TAGS = ["Foreign parcel unit", "postal complex", "regional sorting unit"];

export default function AdminOfficeManager({
    isContributor = false,
    userRole,
}: {
    isContributor?: boolean;
    userRole?: string;
}) {
    const searchParams = useSearchParams();
    const initialQuery = searchParams.get("q") || "";

    const [offices, setOffices] = useState<Office[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchQuery, setSearchQuery] = useState(initialQuery);
    const [activeFilter, setActiveFilter] = useState<OfficeFilter>("all");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkAction, setBulkAction] = useState<string>("add_service");
    const [bulkService, setBulkService] = useState<string>("Foreign parcel unit");
    const [isBulking, setIsBulking] = useState(false);

    const [editingOfficeId, setEditingOfficeId] = useState<string | null>(null);
    const [pendingDelete, setPendingDelete] = useState<Office | null>(null);
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const resolvedRole = userRole || (isContributor ? "CONTRIBUTOR" : "ADMIN");
    const canDirectEdit = resolvedRole === "ADMIN" || resolvedRole === "SUPER_ADMIN";

    const fetchOffices = useCallback(async (query: string, targetPage: number, filter: OfficeFilter) => {
        setLoading(true);
        setError("");
        try {
            const params = new URLSearchParams({
                q: query.trim(),
                page: String(targetPage),
                limit: "20",
                filter,
            });
            const res = await fetch(`/api/admin/offices?${params.toString()}`, { cache: "no-store" });
            if (!res.ok) {
                setError("Could not load post offices.");
                return;
            }
            const data = (await res.json()) as {
                offices: Office[];
                total: number;
                page: number;
                totalPages: number;
            };
            setOffices(data.offices || []);
            setTotal(data.total || 0);
            setTotalPages(data.totalPages || 1);
        } catch {
            setError("Network error fetching post offices.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        setSearchQuery(initialQuery);
        setPage(1);
    }, [initialQuery]);

    useEffect(() => {
        const timer = setTimeout(() => {
            void fetchOffices(searchQuery, page, activeFilter);
        }, 250);
        return () => clearTimeout(timer);
    }, [searchQuery, page, activeFilter, fetchOffices]);

    const handleDeleteConfirmed = async () => {
        if (!pendingDelete) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/admin/office/${pendingDelete.id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                showNativeToast(`Deleted ${pendingDelete.name}`);
                setPendingDelete(null);
                setSelectedIds((prev) => {
                    const next = new Set(prev);
                    next.delete(pendingDelete.id);
                    return next;
                });
                void fetchOffices(searchQuery, page, activeFilter);
            } else {
                const err = (await res.json().catch(() => ({}))) as { error?: string };
                showNativeToast(err.error || "Failed to delete post office.");
            }
        } catch {
            showNativeToast("Network error during deletion.");
        } finally {
            setDeleting(false);
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (offices.length > 0 && selectedIds.size === offices.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(offices.map((o) => o.id)));
        }
    };

    const executeBulkAction = async () => {
        if (selectedIds.size === 0) return;
        setIsBulking(true);
        try {
            const res = await fetch("/api/admin/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    officeIds: Array.from(selectedIds),
                    action: bulkAction,
                    serviceQuery: bulkService,
                }),
            });

            if (res.ok) {
                showNativeToast(`Updated ${selectedIds.size} office(s)`);
                setSelectedIds(new Set());
                setConfirmBulkDelete(false);
                void fetchOffices(searchQuery, page, activeFilter);
            } else {
                const err = (await res.json().catch(() => ({}))) as { error?: string };
                showNativeToast(err.error || "Bulk operation failed.");
            }
        } catch {
            showNativeToast("Network error during bulk action.");
        } finally {
            setIsBulking(false);
        }
    };

    return (
        <div className="space-y-5">
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                    <p className="label-mono">Directory Management</p>
                    <h1 className="display text-3xl sm:text-4xl mt-1">
                        {canDirectEdit ? "Post Offices" : "Search Directory"}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {total.toLocaleString()} matching office{total === 1 ? "" : "s"}
                    </p>
                </div>

                {canDirectEdit && (
                    <Link
                        href="/dashboard/add"
                        className="tap inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border-2 border-foreground bg-secondary px-4 text-sm font-extrabold text-secondary-foreground shadow-[2px_2px_0_0_hsl(var(--foreground))]"
                    >
                        <PlusCircle className="h-4 w-4" aria-hidden="true" />
                        <span>Add New Office</span>
                    </Link>
                )}
            </header>

            {/* Search & Filter Strip */}
            <div className="rounded-md border-2 border-foreground bg-card p-3.5 sm:p-4 space-y-3">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input
                        type="search"
                        placeholder="Search by office name, postcode, or RMSC..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setPage(1);
                        }}
                        enterKeyHint="search"
                        className="h-12 pl-10 text-base bg-background"
                    />
                </div>

                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
                    {FILTER_OPTIONS.map((opt) => (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                                setActiveFilter(opt.id);
                                setPage(1);
                                setSelectedIds(new Set());
                            }}
                            className={cn(
                                "tap shrink-0 min-h-[40px] rounded-md border px-3 text-xs font-bold whitespace-nowrap",
                                activeFilter === opt.id
                                    ? "border-foreground bg-foreground text-background"
                                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Bulk Toolbar (Admin/Super Admin only when items selected) */}
            {canDirectEdit && selectedIds.size > 0 && (
                <div className="rounded-md border-2 border-foreground bg-secondary/20 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="text-sm font-bold text-foreground">
                        {selectedIds.size} office{selectedIds.size === 1 ? "" : "s"} selected
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            className="h-11 rounded-md border border-foreground bg-card px-3 text-sm font-medium"
                            value={bulkAction}
                            onChange={(e) => setBulkAction(e.target.value)}
                        >
                            <option value="add_service">Add Service Tag</option>
                            <option value="remove_service">Remove Service Tag</option>
                            <option value="delete">Delete Offices</option>
                        </select>

                        {(bulkAction === "add_service" || bulkAction === "remove_service") && (
                            <select
                                className="h-11 rounded-md border border-foreground bg-card px-3 text-sm font-medium"
                                value={bulkService}
                                onChange={(e) => setBulkService(e.target.value)}
                            >
                                {SERVICE_TAGS.map((tag) => (
                                    <option key={tag} value={tag}>
                                        {tag}
                                    </option>
                                ))}
                            </select>
                        )}

                        <Button
                            type="button"
                            disabled={isBulking}
                            variant={bulkAction === "delete" ? "destructive" : "default"}
                            onClick={() => {
                                if (bulkAction === "delete") setConfirmBulkDelete(true);
                                else void executeBulkAction();
                            }}
                            className="h-11 font-bold"
                        >
                            {isBulking ? "Applying..." : "Apply Bulk"}
                        </Button>
                    </div>
                </div>
            )}

            {error && (
                <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3.5 text-sm font-medium text-destructive">
                    {error}
                </div>
            )}

            {/* List / Table Container */}
            <div className="rounded-md border-2 border-foreground bg-card overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-14 text-muted-foreground gap-2">
                        <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden="true" />
                        <p className="font-mono text-xs uppercase tracking-wider">Searching offices...</p>
                    </div>
                ) : offices.length === 0 ? (
                    <div className="p-10 text-center text-muted-foreground">
                        <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-30" aria-hidden="true" />
                        <p className="text-sm font-bold text-foreground">No post offices matched</p>
                        <p className="text-xs mt-1">Try another office name, postcode, or clear the active filter.</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="border-b border-border bg-muted/50 text-xs font-mono uppercase text-muted-foreground">
                                    <tr>
                                        {canDirectEdit && (
                                            <th className="px-4 py-3 w-12">
                                                <input
                                                    type="checkbox"
                                                    aria-label="Select all on page"
                                                    checked={offices.length > 0 && selectedIds.size === offices.length}
                                                    onChange={toggleSelectAll}
                                                    className="h-4 w-4 rounded border-border"
                                                />
                                            </th>
                                        )}
                                        <th className="px-4 py-3">Post Office</th>
                                        <th className="px-4 py-3">Postcode</th>
                                        <th className="px-4 py-3">Metadata</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {offices.map((office) => (
                                        <tr key={office.id} className={cn("hover:bg-muted/30", selectedIds.has(office.id) && "bg-secondary/15")}>
                                            {canDirectEdit && (
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="checkbox"
                                                        aria-label={`Select ${office.name}`}
                                                        checked={selectedIds.has(office.id)}
                                                        onChange={() => toggleSelect(office.id)}
                                                        className="h-4 w-4 rounded border-border"
                                                    />
                                                </td>
                                            )}
                                            <td className="px-4 py-3">
                                                <p className="font-bold text-foreground">{office.name}</p>
                                                <p className="font-mono text-xs text-muted-foreground">
                                                    {office.rmsc || "Standard Post Office"} · {office._count?.fields ?? 0} fields
                                                </p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-block rounded-sm border border-foreground/40 bg-background px-2 py-0.5 font-mono text-xs font-bold">
                                                    {office.postalCode}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
                                                    {office.latitude !== null && office.longitude !== null ? (
                                                        <span className="text-status-open font-semibold">GPS</span>
                                                    ) : (
                                                        <span className="text-muted-foreground">No GPS</span>
                                                    )}
                                                    <span>·</span>
                                                    {office.operatingHours ? (
                                                        <span className="text-status-open font-semibold">Hours</span>
                                                    ) : (
                                                        <span className="text-muted-foreground">No Hours</span>
                                                    )}
                                                    {office.services.length > 0 && (
                                                        <>
                                                            <span>·</span>
                                                            <span className="text-foreground font-semibold">
                                                                {office.services.length} svc
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="inline-flex items-center gap-1.5">
                                                    <Link
                                                        href={`/office/${office.slug}`}
                                                        target="_blank"
                                                        className="tap inline-flex h-10 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-semibold hover:border-foreground"
                                                    >
                                                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                                        <span>View</span>
                                                    </Link>
                                                    {canDirectEdit ? (
                                                        <>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => setEditingOfficeId(office.id)}
                                                                className="h-10 border-foreground font-bold gap-1"
                                                            >
                                                                <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                                                                <span>Edit</span>
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="ghost"
                                                                aria-label={`Delete ${office.name}`}
                                                                onClick={() => setPendingDelete(office)}
                                                                className="h-10 w-10 p-0 text-destructive hover:bg-destructive/10"
                                                            >
                                                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <Link
                                                            href={`/suggest/${office.id}`}
                                                            className="tap inline-flex h-10 items-center gap-1 rounded-md border border-foreground bg-secondary px-3 text-xs font-extrabold text-secondary-foreground"
                                                        >
                                                            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                                                            <span>Suggest Edit</span>
                                                        </Link>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card Feed */}
                        <div className="md:hidden divide-y divide-border">
                            {offices.map((office) => (
                                <div
                                    key={`mob-${office.id}`}
                                    className={cn("p-4 space-y-3", selectedIds.has(office.id) && "bg-secondary/15")}
                                >
                                    <div className="flex items-start justify-between gap-2.5">
                                        <div className="flex items-start gap-2.5 min-w-0">
                                            {canDirectEdit && (
                                                <label className="flex min-h-[44px] min-w-[32px] items-center justify-center shrink-0">
                                                    <input
                                                        type="checkbox"
                                                        aria-label={`Select ${office.name}`}
                                                        checked={selectedIds.has(office.id)}
                                                        onChange={() => toggleSelect(office.id)}
                                                        className="h-5 w-5 rounded border-border"
                                                    />
                                                </label>
                                            )}
                                            <div className="min-w-0">
                                                <h3 className="font-heading text-base font-extrabold text-foreground leading-snug">
                                                    {office.name}
                                                </h3>
                                                <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
                                                    <span className="inline-flex items-center gap-1">
                                                        <MapPin className="h-3 w-3" aria-hidden="true" />
                                                        {office.latitude !== null ? "GPS Set" : "No GPS"}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1">
                                                        <Clock className="h-3 w-3" aria-hidden="true" />
                                                        {office.operatingHours ? "Hours Set" : "No Hours"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <span className="shrink-0 rounded-sm border-2 border-foreground bg-secondary/40 px-2 py-0.5 font-mono text-xs font-extrabold">
                                            {office.postalCode}
                                        </span>
                                    </div>

                                    {office.services.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {office.services.slice(0, 3).map((svc) => (
                                                <span
                                                    key={svc}
                                                    className="rounded-sm border border-border bg-background px-2 py-0.5 font-mono text-[10px] font-semibold"
                                                >
                                                    {svc}
                                                </span>
                                            ))}
                                            {office.services.length > 3 && (
                                                <span className="font-mono text-[10px] text-muted-foreground px-1 py-0.5">
                                                    +{office.services.length - 3} more
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2 pt-1">
                                        {canDirectEdit ? (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingOfficeId(office.id)}
                                                    className="tap flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-md border-2 border-foreground bg-card px-3 text-xs font-extrabold text-foreground"
                                                >
                                                    <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                                                    <span>Edit Office Sheet</span>
                                                </button>
                                                <Link
                                                    href={`/office/${office.slug}`}
                                                    target="_blank"
                                                    aria-label={`View ${office.name} public page`}
                                                    className="tap min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-md border border-border bg-background text-foreground"
                                                >
                                                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                                </Link>
                                                <button
                                                    type="button"
                                                    onClick={() => setPendingDelete(office)}
                                                    aria-label={`Delete ${office.name}`}
                                                    className="tap min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-md border border-destructive/40 bg-destructive/10 text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <Link
                                                    href={`/suggest/${office.id}`}
                                                    className="tap flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-md border-2 border-foreground bg-secondary px-3 text-xs font-extrabold text-secondary-foreground"
                                                >
                                                    <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                                                    <span>Suggest Edit</span>
                                                </Link>
                                                <Link
                                                    href={`/office/${office.slug}`}
                                                    target="_blank"
                                                    className="tap min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-md border border-border bg-background text-foreground"
                                                    aria-label={`Open ${office.name}`}
                                                >
                                                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                                </Link>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Pagination Footer */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={page <= 1 || loading}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="h-11 border-2 border-foreground font-bold gap-1"
                    >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                        <span>Previous</span>
                    </Button>
                    <span className="font-mono text-xs text-muted-foreground">
                        Page {page} of {totalPages}
                    </span>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={page >= totalPages || loading}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        className="h-11 border-2 border-foreground font-bold gap-1"
                    >
                        <span>Next</span>
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                </div>
            )}

            {/* Edit Sheet */}
            <OfficeEditModal
                officeId={editingOfficeId}
                onClose={() => setEditingOfficeId(null)}
                onSaved={() => {
                    setEditingOfficeId(null);
                    void fetchOffices(searchQuery, page, activeFilter);
                }}
            />

            {/* Single Delete Confirmation */}
            <ConfirmDialog
                open={!!pendingDelete}
                onOpenChange={(open) => !open && setPendingDelete(null)}
                title="Delete Post Office"
                description={
                    pendingDelete
                        ? `Permanently delete "${pendingDelete.name}" (${pendingDelete.postalCode})? Controlled offices and contributor edits will lose this link.`
                        : ""
                }
                confirmLabel="Delete Office"
                destructive
                loading={deleting}
                onConfirm={handleDeleteConfirmed}
            />

            {/* Bulk Delete Confirmation */}
            <ConfirmDialog
                open={confirmBulkDelete}
                onOpenChange={setConfirmBulkDelete}
                title="Bulk Delete Offices"
                description={`Permanently delete ${selectedIds.size} selected post office(s)? This cannot be undone.`}
                confirmLabel="Delete Selected"
                destructive
                loading={isBulking}
                onConfirm={executeBulkAction}
            />
        </div>
    );
}
