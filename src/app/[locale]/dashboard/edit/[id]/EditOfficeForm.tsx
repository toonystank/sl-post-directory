"use client";

import { useState } from "react";
import { Save, AlertCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/navigation";
import { showNativeToast } from "@/components/shell/NativeToast";
import { cn } from "@/lib/utils";

interface Field {
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
    fields: Field[];
}

const KNOWN_SERVICES = [
    "Foreign parcel unit",
    "postal complex",
    "regional sorting unit",
    "EMS Speed Post",
    "COD Accepting",
    "Registered Post",
];

export default function EditOfficeForm({ office }: { office: Office }) {
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [name, setName] = useState(office.name);
    const [postalCode, setPostalCode] = useState(office.postalCode);
    const [operatingHours, setOperatingHours] = useState(office.operatingHours || "");
    const [rmsc, setRmsc] = useState(office.rmsc || "");
    const [latitude, setLatitude] = useState(typeof office.latitude === "number" ? String(office.latitude) : "");
    const [longitude, setLongitude] = useState(typeof office.longitude === "number" ? String(office.longitude) : "");
    const [services, setServices] = useState<string[]>(office.services || []);
    const [customFields, setCustomFields] = useState<Field[]>(office.fields || []);
    const router = useRouter();

    const toggleService = (tag: string) => {
        setServices((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
    };

    const addFieldRow = () => {
        setCustomFields((prev) => [...prev, { id: `new-${Date.now()}`, name: "", value: "" }]);
    };

    const updateFieldRow = (id: string, key: "name" | "value", val: string) => {
        setCustomFields((prev) => prev.map((f) => (f.id === id ? { ...f, [key]: val } : f)));
    };

    const removeFieldRow = (id: string) => {
        setCustomFields((prev) => prev.filter((f) => f.id !== id));
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setErrorMessage("");

        const parsedLat = latitude.trim() ? Number(latitude.trim()) : null;
        const parsedLng = longitude.trim() ? Number(longitude.trim()) : null;
        if ((latitude.trim() && (parsedLat === null || Number.isNaN(parsedLat))) || (longitude.trim() && (parsedLng === null || Number.isNaN(parsedLng)))) {
            setErrorMessage("Latitude and longitude must be valid numbers.");
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`/api/admin/office/${office.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    postalCode: postalCode.trim(),
                    operatingHours: operatingHours.trim() || null,
                    rmsc: rmsc.trim() || null,
                    latitude: parsedLat,
                    longitude: parsedLng,
                    services,
                    customFields: customFields
                        .map((f) => ({ name: f.name.trim(), value: f.value.trim() }))
                        .filter((f) => f.name && f.value),
                }),
            });

            if (res.ok) {
                showNativeToast("Post office saved");
                router.push("/dashboard/offices");
                router.refresh();
            } else {
                const errData = (await res.json().catch(() => ({}))) as { error?: string };
                setErrorMessage(errData.error || "An error occurred while saving.");
            }
        } catch {
            setErrorMessage("A network error occurred.");
        } finally {
            setLoading(false);
        }
    };

    const allServiceTags = Array.from(new Set([...KNOWN_SERVICES, ...services]));

    return (
        <div className="space-y-6">
            <div className="rounded-md border border-primary/40 bg-primary/5 p-3.5 flex gap-3 text-sm text-foreground">
                <AlertCircle className="w-5 h-5 shrink-0 text-primary mt-0.5" aria-hidden="true" />
                <p>Changes saved here go live immediately in the public directory.</p>
            </div>

            {errorMessage && (
                <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3.5 text-sm font-medium text-destructive">
                    {errorMessage}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="label-mono block mb-1.5" htmlFor="edit-page-name">
                            Office Name
                        </label>
                        <Input
                            id="edit-page-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="h-12 text-base bg-background"
                        />
                    </div>
                    <div>
                        <label className="label-mono block mb-1.5" htmlFor="edit-page-code">
                            Postal Code
                        </label>
                        <Input
                            id="edit-page-code"
                            value={postalCode}
                            onChange={(e) => setPostalCode(e.target.value)}
                            required
                            className="h-12 text-base font-mono bg-background"
                        />
                    </div>
                    <div>
                        <label className="label-mono block mb-1.5" htmlFor="edit-page-hours">
                            Operating Hours
                        </label>
                        <Input
                            id="edit-page-hours"
                            value={operatingHours}
                            onChange={(e) => setOperatingHours(e.target.value)}
                            className="h-12 text-base bg-background"
                        />
                    </div>
                    <div>
                        <label className="label-mono block mb-1.5" htmlFor="edit-page-rmsc">
                            RMSC / TPO Unit
                        </label>
                        <Input
                            id="edit-page-rmsc"
                            value={rmsc}
                            onChange={(e) => setRmsc(e.target.value)}
                            className="h-12 text-base bg-background"
                        />
                    </div>
                    <div>
                        <label className="label-mono block mb-1.5" htmlFor="edit-page-lat">
                            Latitude
                        </label>
                        <Input
                            id="edit-page-lat"
                            type="number"
                            step="any"
                            value={latitude}
                            onChange={(e) => setLatitude(e.target.value)}
                            className="h-12 text-base font-mono bg-background"
                        />
                    </div>
                    <div>
                        <label className="label-mono block mb-1.5" htmlFor="edit-page-lng">
                            Longitude
                        </label>
                        <Input
                            id="edit-page-lng"
                            type="number"
                            step="any"
                            value={longitude}
                            onChange={(e) => setLongitude(e.target.value)}
                            className="h-12 text-base font-mono bg-background"
                        />
                    </div>
                </div>

                <div className="space-y-2 border-t border-border pt-4">
                    <p className="label-mono">Services Offered</p>
                    <div className="flex flex-wrap gap-2">
                        {allServiceTags.map((tag) => {
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
                </div>

                <div className="space-y-3 border-t border-border pt-4">
                    <div className="flex items-center justify-between">
                        <p className="label-mono">Additional Fields</p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addFieldRow}
                            className="h-10 border-foreground font-bold"
                        >
                            <Plus className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                            Add Field
                        </Button>
                    </div>
                    <div className="space-y-2.5">
                        {customFields.map((field) => (
                            <div key={field.id} className="flex flex-col sm:flex-row gap-2">
                                <Input
                                    value={field.name}
                                    onChange={(e) => updateFieldRow(field.id, "name", e.target.value)}
                                    placeholder="Field Name"
                                    className="h-11 text-base sm:w-44 bg-background"
                                />
                                <Input
                                    value={field.value}
                                    onChange={(e) => updateFieldRow(field.id, "value", e.target.value)}
                                    placeholder="Value"
                                    className="h-11 text-base flex-1 bg-background"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => removeFieldRow(field.id)}
                                    aria-label={`Remove ${field.name}`}
                                    className="h-11 sm:w-11 text-destructive hover:bg-destructive/10 border border-destructive/30"
                                >
                                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>

                <Button type="submit" disabled={loading} size="lg" className="w-full h-12 text-base font-bold">
                    <Save className="w-5 h-5 mr-2" aria-hidden="true" />
                    {loading ? "Saving..." : "Save Changes"}
                </Button>
            </form>
        </div>
    );
}
