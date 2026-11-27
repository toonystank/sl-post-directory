"use client";

import { useState, useEffect, useRef } from "react";
import { Save, AlertCircle, Loader2, X, Search, Building2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/shell/Sheet";
import { showNativeToast } from "@/components/shell/NativeToast";
import { cn } from "@/lib/utils";

interface CustomFieldItem {
    id: string;
    name: string;
    value: string;
}

interface Office {
    id: string;
    name: string;
    postalCode: string;
    operatingHours: string | null;
    services: string[];
    rmsc: string | null;
    latitude: number | null;
    longitude: number | null;
    fields: CustomFieldItem[];
    controllingOffice?: { id: string; name: string; postalCode: string } | null;
    controlledOffices?: Array<{ id: string; name: string; postalCode: string }>;
}

interface OfficeEditModalProps {
    officeId: string | null;
    onClose: () => void;
    onSaved: () => void;
}

const KNOWN_SERVICES = [
    "Foreign parcel unit",
    "postal complex",
    "regional sorting unit",
    "EMS Speed Post",
    "COD Accepting",
    "Registered Post",
];

type SheetTab = "basics" | "services" | "network" | "fields";

export default function OfficeEditModal({ officeId, onClose, onSaved }: OfficeEditModalProps) {
    const [activeTab, setActiveTab] = useState<SheetTab>("basics");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    // Editable fields state
    const [name, setName] = useState("");
    const [postalCode, setPostalCode] = useState("");
    const [rmsc, setRmsc] = useState("");
    const [operatingHours, setOperatingHours] = useState("");
    const [services, setServices] = useState<string[]>([]);
    const [newServiceInput, setNewServiceInput] = useState("");
    const [latitude, setLatitude] = useState("");
    const [longitude, setLongitude] = useState("");
    const [customFields, setCustomFields] = useState<CustomFieldItem[]>([]);

    // Relational state
    const [controllingOffice, setControllingOffice] = useState<{ id: string; name: string } | null>(null);
    const [controlledOffices, setControlledOffices] = useState<Array<{ id: string; name: string }>>([]);

    // Relation search state
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; postalCode: string }>>([]);
    const [searching, setSearching] = useState(false);
    const [activeSearchTarget, setActiveSearchTarget] = useState<"controlling" | "controlled" | null>(null);
    const searchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!officeId) {
            setErrorMsg("");
            setActiveTab("basics");
            return;
        }
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setErrorMsg("");
            try {
                const res = await fetch(`/api/admin/office/${officeId}`, { cache: "no-store" });
                if (!res.ok) {
                    if (!cancelled) setErrorMsg("Failed to load office data.");
                    return;
                }
                const data = (await res.json()) as { office: Office };
                if (cancelled || !data.office) return;
                const o = data.office;
                setName(o.name || "");
                setPostalCode(o.postalCode || "");
                setRmsc(o.rmsc || "");
                setOperatingHours(o.operatingHours || "");
                setServices(Array.isArray(o.services) ? o.services : []);
                setLatitude(typeof o.latitude === "number" ? String(o.latitude) : "");
                setLongitude(typeof o.longitude === "number" ? String(o.longitude) : "");
                setCustomFields(Array.isArray(o.fields) ? o.fields : []);
                setControllingOffice(o.controllingOffice || null);
                setControlledOffices(Array.isArray(o.controlledOffices) ? o.controlledOffices : []);
            } catch {
                if (!cancelled) setErrorMsg("Network error loading office.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [officeId]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setActiveSearchTarget(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (!searchQuery.trim() || !activeSearchTarget) {
            setSearchResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch(`/api/admin/offices?q=${encodeURIComponent(searchQuery.trim())}&limit=8`);
                if (res.ok) {
                    const data = (await res.json()) as { offices?: Array<{ id: string; name: string; postalCode: string }> };
                    setSearchResults(data.offices || []);
                }
            } finally {
                setSearching(false);
            }
        }, 250);
        return () => clearTimeout(timer);
    }, [searchQuery, activeSearchTarget]);

    const toggleService = (tag: string) => {
        setServices((prev) =>
            prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
        );
    };

    const addCustomService = () => {
        const trimmed = newServiceInput.trim();
        if (!trimmed) return;
        if (!services.includes(trimmed)) {
            setServices((prev) => [...prev, trimmed]);
        }
        setNewServiceInput("");
    };

    const getCustomFieldValue = (fieldName: string) =>
        customFields.find((f) => f.name.toLowerCase() === fieldName.toLowerCase())?.value || "";

    const setCustomFieldValue = (fieldName: string, value: string) => {
        setCustomFields((prev) => {
            const idx = prev.findIndex((f) => f.name.toLowerCase() === fieldName.toLowerCase());
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = { ...next[idx], name: fieldName, value };
                return next;
            }
            return [
                ...prev,
                {
                    id: `quick-${fieldName}-${Date.now()}`,
                    name: fieldName,
                    value,
                },
            ];
        });
    };

    const addCustomFieldRow = () => {
        setCustomFields((prev) => [
            ...prev,
            { id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: "", value: "" },
        ]);
    };

    const updateCustomFieldRow = (id: string, key: "name" | "value", val: string) => {
        setCustomFields((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: val } : row)));
    };

    const removeCustomFieldRow = (id: string) => {
        setCustomFields((prev) => prev.filter((row) => row.id !== id));
    };

    const handleSelectResult = (result: { id: string; name: string }) => {
        if (result.id === officeId) {
            setErrorMsg("An office cannot control itself.");
            return;
        }
        setErrorMsg("");
        if (activeSearchTarget === "controlling") {
            if (controlledOffices.some((c) => c.id === result.id)) {
                setErrorMsg("This office is already listed as a sub-office.");
                return;
            }
            setControllingOffice(result);
        } else if (activeSearchTarget === "controlled") {
            if (controllingOffice?.id === result.id) {
                setErrorMsg("This office is already assigned as the parent controlling office.");
                return;
            }
            if (!controlledOffices.some((c) => c.id === result.id)) {
                setControlledOffices((prev) => [...prev, result]);
            }
        }
        setSearchQuery("");
        setActiveSearchTarget(null);
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!officeId) return;

        const trimmedName = name.trim();
        const trimmedCode = postalCode.trim();
        if (trimmedName.length < 2 || !trimmedCode) {
            setErrorMsg("Office name and postal code are required.");
            setActiveTab("basics");
            return;
        }

        const parsedLat = latitude.trim() ? Number(latitude.trim()) : null;
        const parsedLng = longitude.trim() ? Number(longitude.trim()) : null;
        if ((latitude.trim() && (parsedLat === null || Number.isNaN(parsedLat))) || (longitude.trim() && (parsedLng === null || Number.isNaN(parsedLng)))) {
            setErrorMsg("Latitude and longitude must be valid numbers.");
            setActiveTab("network");
            return;
        }

        setSaving(true);
        setErrorMsg("");

        try {
            const res = await fetch(`/api/admin/office/${officeId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: trimmedName,
                    postalCode: trimmedCode,
                    rmsc: rmsc.trim() || null,
                    operatingHours: operatingHours.trim() || null,
                    services,
                    latitude: parsedLat,
                    longitude: parsedLng,
                    customFields: customFields
                        .map((f) => ({ name: f.name.trim(), value: f.value.trim() }))
                        .filter((f) => f.name && f.value),
                    controllingOfficeId: controllingOffice ? controllingOffice.id : null,
                    controlledOfficesIds: controlledOffices.map((o) => o.id),
                }),
            });

            if (res.ok) {
                showNativeToast(`Saved ${trimmedName}`);
                onSaved();
            } else {
                const errData = (await res.json().catch(() => ({}))) as { error?: string };
                setErrorMsg(errData.error || "Failed to save changes.");
            }
        } catch {
            setErrorMsg("Network error saving office.");
        } finally {
            setSaving(false);
        }
    };

    const allServiceOptions = Array.from(new Set([...KNOWN_SERVICES, ...services]));

    return (
        <Sheet open={!!officeId} onOpenChange={(open) => !open && !saving && onClose()}>
            <SheetContent
                title={loading ? "Loading Office..." : name || "Edit Post Office"}
                description={postalCode ? `Postcode ${postalCode} · Direct Database Editor` : "Edit office listing"}
                className="md:w-[640px] md:max-w-[92vw]"
                bodyClassName="space-y-4 pt-3"
                footer={
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={saving}
                            onClick={onClose}
                            className="h-11 border-2 border-foreground font-semibold"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            disabled={saving || loading}
                            onClick={() => void handleSubmit()}
                            className="h-11 font-bold"
                        >
                            {saving ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />
                            ) : (
                                <Save className="w-4 h-4 mr-2" aria-hidden="true" />
                            )}
                            <span>{saving ? "Saving..." : "Save Changes"}</span>
                        </Button>
                    </div>
                }
            >
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden="true" />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {errorMsg && (
                            <div
                                role="alert"
                                className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm font-medium text-destructive flex items-center gap-2"
                            >
                                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        {/* Sheet Section Tabs */}
                        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
                            {(
                                [
                                    { id: "basics", label: "Basics" },
                                    { id: "services", label: "Services & Hours" },
                                    { id: "network", label: "GPS & Network" },
                                    { id: "fields", label: `Fields (${customFields.length})` },
                                ] as Array<{ id: SheetTab; label: string }>
                            ).map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "tap shrink-0 min-h-[42px] rounded-md border px-3 text-xs font-bold whitespace-nowrap",
                                        activeTab === tab.id
                                            ? "border-foreground bg-secondary text-secondary-foreground shadow-[2px_2px_0_0_hsl(var(--foreground))]"
                                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {activeTab === "basics" && (
                            <div className="space-y-4">
                                <div>
                                    <label className="label-mono block mb-1.5" htmlFor="edit-office-name">
                                        Office Name
                                    </label>
                                    <Input
                                        id="edit-office-name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="h-12 text-base bg-background"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="label-mono block mb-1.5" htmlFor="edit-office-code">
                                            Postal Code
                                        </label>
                                        <Input
                                            id="edit-office-code"
                                            value={postalCode}
                                            onChange={(e) => setPostalCode(e.target.value)}
                                            className="h-12 text-base font-mono bg-background"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="label-mono block mb-1.5" htmlFor="edit-office-rmsc">
                                            RMSC / TPO Sorting Unit
                                        </label>
                                        <Input
                                            id="edit-office-rmsc"
                                            value={rmsc}
                                            onChange={(e) => setRmsc(e.target.value)}
                                            placeholder="e.g. Kandy RMSC"
                                            className="h-12 text-base bg-background"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="label-mono block mb-1.5" htmlFor="edit-office-short-code">
                                            Short Code
                                        </label>
                                        <Input
                                            id="edit-office-short-code"
                                            value={getCustomFieldValue("Short Code")}
                                            onChange={(e) => setCustomFieldValue("Short Code", e.target.value.toUpperCase())}
                                            placeholder="e.g. AW / ATG"
                                            className="h-12 text-base font-mono bg-background"
                                        />
                                    </div>
                                    <div>
                                        <label className="label-mono block mb-1.5" htmlFor="edit-office-delivery">
                                            Delivery Office
                                        </label>
                                        <select
                                            id="edit-office-delivery"
                                            value={getCustomFieldValue("Delivery")}
                                            onChange={(e) => setCustomFieldValue("Delivery", e.target.value)}
                                            className="h-12 w-full rounded-md border border-input bg-background px-3 text-base"
                                        >
                                            <option value="">Unspecified</option>
                                            <option value="Yes">Yes — Delivery Office</option>
                                            <option value="No">No — Non-Delivery</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label-mono block mb-1.5" htmlFor="edit-office-type">
                                            Office Type
                                        </label>
                                        <select
                                            id="edit-office-type"
                                            value={getCustomFieldValue("Type")}
                                            onChange={(e) => setCustomFieldValue("Type", e.target.value)}
                                            className="h-12 w-full rounded-md border border-input bg-background px-3 text-base"
                                        >
                                            <option value="Post Office">Post Office</option>
                                            <option value="Sub Post Office">Sub Post Office</option>
                                            <option value="Agency Post Office">Agency Post Office</option>
                                            <option value="RMSC / Sorting Hub">RMSC / Sorting Hub</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label-mono block mb-1.5" htmlFor="edit-office-grade">
                                            Grade
                                        </label>
                                        <select
                                            id="edit-office-grade"
                                            value={getCustomFieldValue("Grade")}
                                            onChange={(e) => setCustomFieldValue("Grade", e.target.value)}
                                            className="h-12 w-full rounded-md border border-input bg-background px-3 text-base"
                                        >
                                            <option value="">Unspecified</option>
                                            <option value="Supra">Supra</option>
                                            <option value="Special">Special</option>
                                            <option value="Class I">Class I</option>
                                            <option value="Class II">Class II</option>
                                            <option value="Class III">Class III</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="label-mono block mb-1.5" htmlFor="edit-office-phone">
                                        Phone Number(s)
                                    </label>
                                    <Input
                                        id="edit-office-phone"
                                        value={getCustomFieldValue("Phone") || getCustomFieldValue("Telephone")}
                                        onChange={(e) => setCustomFieldValue("Phone", e.target.value)}
                                        placeholder="e.g. 011 232-8301 / 011 232-8302"
                                        className="h-12 text-base font-mono bg-background"
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === "services" && (
                            <div className="space-y-5">
                                <div>
                                    <label className="label-mono block mb-1.5" htmlFor="edit-office-hours">
                                        Operating Hours
                                    </label>
                                    <Input
                                        id="edit-office-hours"
                                        value={operatingHours}
                                        onChange={(e) => setOperatingHours(e.target.value)}
                                        placeholder="e.g. Mon–Fri 08:30–16:30 · Sat 08:30–13:00"
                                        className="h-12 text-base bg-background"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <p className="label-mono">Available Services</p>
                                    <div className="flex flex-wrap gap-2">
                                        {allServiceOptions.map((tag) => {
                                            const active = services.includes(tag);
                                            return (
                                                <button
                                                    key={tag}
                                                    type="button"
                                                    onClick={() => toggleService(tag)}
                                                    className={cn(
                                                        "tap min-h-[40px] rounded-md border px-3 text-xs font-bold",
                                                        active
                                                            ? "border-foreground bg-secondary text-secondary-foreground"
                                                            : "border-border bg-background text-muted-foreground hover:border-foreground"
                                                    )}
                                                >
                                                    {active ? `✓ ${tag}` : tag}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="flex gap-2 pt-2">
                                        <Input
                                            value={newServiceInput}
                                            onChange={(e) => setNewServiceInput(e.target.value)}
                                            placeholder="Add custom service tag..."
                                            className="h-11 text-base bg-background"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={addCustomService}
                                            className="h-11 shrink-0 border-foreground"
                                        >
                                            <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                                            Add
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === "network" && (
                            <div className="space-y-5">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="label-mono block mb-1.5" htmlFor="edit-office-lat">
                                            Latitude
                                        </label>
                                        <Input
                                            id="edit-office-lat"
                                            type="number"
                                            step="any"
                                            value={latitude}
                                            onChange={(e) => setLatitude(e.target.value)}
                                            placeholder="6.9271"
                                            className="h-12 text-base font-mono bg-background"
                                        />
                                    </div>
                                    <div>
                                        <label className="label-mono block mb-1.5" htmlFor="edit-office-lng">
                                            Longitude
                                        </label>
                                        <Input
                                            id="edit-office-lng"
                                            type="number"
                                            step="any"
                                            value={longitude}
                                            onChange={(e) => setLongitude(e.target.value)}
                                            placeholder="79.8612"
                                            className="h-12 text-base font-mono bg-background"
                                        />
                                    </div>
                                </div>

                                <div className="rounded-md border border-border bg-muted/30 p-3.5 space-y-4">
                                    <div>
                                        <p className="label-mono mb-2">Controlling Office (Parent)</p>
                                        {controllingOffice ? (
                                            <div className="flex items-center justify-between p-2.5 bg-card border border-foreground rounded-md">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Building2 className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                                                    <span className="text-sm font-bold truncate">{controllingOffice.name}</span>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setControllingOffice(null)}
                                                    className="h-9 text-destructive hover:bg-destructive/10"
                                                >
                                                    Remove
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="relative" ref={activeSearchTarget === "controlling" ? searchRef : null}>
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                                                    <Input
                                                        placeholder="Search controlling office..."
                                                        value={activeSearchTarget === "controlling" ? searchQuery : ""}
                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                        onFocus={() => {
                                                            setActiveSearchTarget("controlling");
                                                            setSearchQuery("");
                                                        }}
                                                        className="pl-9 h-11 text-base bg-background"
                                                    />
                                                </div>
                                                {activeSearchTarget === "controlling" && searchQuery.trim() && (
                                                    <div className="mt-1 rounded-md border-2 border-foreground bg-card max-h-48 overflow-y-auto divide-y divide-border">
                                                        {searching ? (
                                                            <p className="p-3 text-xs text-muted-foreground">Searching...</p>
                                                        ) : searchResults.length > 0 ? (
                                                            searchResults.map((result) => (
                                                                <button
                                                                    key={result.id}
                                                                    type="button"
                                                                    onClick={() => handleSelectResult(result)}
                                                                    className="tap flex min-h-[44px] w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                                                                >
                                                                    <span className="font-semibold truncate">{result.name}</span>
                                                                    <span className="font-mono text-xs text-muted-foreground shrink-0">
                                                                        {result.postalCode}
                                                                    </span>
                                                                </button>
                                                            ))
                                                        ) : (
                                                            <p className="p-3 text-xs text-muted-foreground">No matching offices.</p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <p className="label-mono mb-2">Controlled Offices (Sub-Offices)</p>
                                        {controlledOffices.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mb-2">
                                                {controlledOffices.map((sub) => (
                                                    <span
                                                        key={sub.id}
                                                        className="inline-flex items-center gap-1 rounded-md border border-foreground bg-card px-2.5 py-1 text-xs font-semibold"
                                                    >
                                                        {sub.name}
                                                        <button
                                                            type="button"
                                                            aria-label={`Remove ${sub.name}`}
                                                            onClick={() =>
                                                                setControlledOffices((prev) => prev.filter((o) => o.id !== sub.id))
                                                            }
                                                            className="ml-1 text-muted-foreground hover:text-destructive"
                                                        >
                                                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <div className="relative" ref={activeSearchTarget === "controlled" ? searchRef : null}>
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                                                <Input
                                                    placeholder="Search sub-office to link..."
                                                    value={activeSearchTarget === "controlled" ? searchQuery : ""}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    onFocus={() => {
                                                        setActiveSearchTarget("controlled");
                                                        setSearchQuery("");
                                                    }}
                                                    className="pl-9 h-11 text-base bg-background"
                                                />
                                            </div>
                                            {activeSearchTarget === "controlled" && searchQuery.trim() && (
                                                <div className="mt-1 rounded-md border-2 border-foreground bg-card max-h-48 overflow-y-auto divide-y divide-border">
                                                    {searching ? (
                                                        <p className="p-3 text-xs text-muted-foreground">Searching...</p>
                                                    ) : searchResults.length > 0 ? (
                                                        searchResults.map((result) => (
                                                            <button
                                                                key={result.id}
                                                                type="button"
                                                                onClick={() => handleSelectResult(result)}
                                                                className="tap flex min-h-[44px] w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                                                            >
                                                                <span className="font-semibold truncate">{result.name}</span>
                                                                <span className="font-mono text-xs text-muted-foreground shrink-0">
                                                                    {result.postalCode}
                                                                </span>
                                                            </button>
                                                        ))
                                                    ) : (
                                                        <p className="p-3 text-xs text-muted-foreground">No matching offices.</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === "fields" && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="label-mono">Custom Fields (Phone, Division, Type, etc.)</p>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={addCustomFieldRow}
                                        className="h-10 border-foreground font-bold"
                                    >
                                        <Plus className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                                        Add Field
                                    </Button>
                                </div>

                                {customFields.length === 0 ? (
                                    <p className="py-6 text-center text-sm text-muted-foreground border border-dashed border-border rounded-md">
                                        No custom fields yet. Tap &ldquo;Add Field&rdquo; to create one.
                                    </p>
                                ) : (
                                    <div className="space-y-2.5">
                                        {customFields.map((field) => (
                                            <div
                                                key={field.id}
                                                className="flex flex-col sm:flex-row gap-2 rounded-md border border-border bg-background p-2.5"
                                            >
                                                <Input
                                                    value={field.name}
                                                    onChange={(e) => updateCustomFieldRow(field.id, "name", e.target.value)}
                                                    placeholder="Field Name (e.g. Phone)"
                                                    className="h-11 text-base sm:w-40"
                                                />
                                                <Input
                                                    value={field.value}
                                                    onChange={(e) => updateCustomFieldRow(field.id, "value", e.target.value)}
                                                    placeholder="Value"
                                                    className="h-11 text-base flex-1"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeCustomFieldRow(field.id)}
                                                    aria-label={`Remove field ${field.name || ""}`}
                                                    className="tap inline-flex h-11 w-full sm:w-11 shrink-0 items-center justify-center rounded-md border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
                                                >
                                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </form>
                )}
            </SheetContent>
        </Sheet>
    );
}
