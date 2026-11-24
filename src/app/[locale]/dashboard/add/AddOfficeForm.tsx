"use client";

import { useState } from "react";
import { PlusCircle, Info, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/navigation";
import { showNativeToast } from "@/components/shell/NativeToast";
import { cn } from "@/lib/utils";

const KNOWN_SERVICES = [
    "Foreign parcel unit",
    "postal complex",
    "regional sorting unit",
    "EMS Speed Post",
    "COD Accepting",
    "Registered Post",
];

export default function AddOfficeForm() {
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [name, setName] = useState("");
    const [postalCode, setPostalCode] = useState("");
    const [operatingHours, setOperatingHours] = useState("");
    const [rmsc, setRmsc] = useState("");
    const [latitude, setLatitude] = useState("");
    const [longitude, setLongitude] = useState("");
    const [services, setServices] = useState<string[]>([]);
    const [dynamicFields, setDynamicFields] = useState<{ id: number; name: string; value: string }[]>([]);
    const router = useRouter();

    const addField = () => {
        setDynamicFields((prev) => [...prev, { id: Date.now() + prev.length, name: "", value: "" }]);
    };

    const removeField = (id: number) => {
        setDynamicFields((prev) => prev.filter((f) => f.id !== id));
    };

    const updateField = (id: number, key: "name" | "value", val: string) => {
        setDynamicFields((prev) => prev.map((f) => (f.id === id ? { ...f, [key]: val } : f)));
    };

    const toggleService = (tag: string) => {
        setServices((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
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
            const res = await fetch("/api/admin/office", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    postalCode: postalCode.trim(),
                    operatingHours: operatingHours.trim() || null,
                    rmsc: rmsc.trim() || null,
                    latitude: parsedLat,
                    longitude: parsedLng,
                    services,
                    customFields: dynamicFields
                        .map((f) => ({ name: f.name.trim(), value: f.value.trim() }))
                        .filter((f) => f.name && f.value),
                }),
            });

            if (res.ok) {
                const json = (await res.json()) as { office: { slug: string; name: string } };
                showNativeToast(`Created ${json.office.name}`);
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

    return (
        <div className="space-y-6">
            <div className="rounded-md border border-border bg-muted/40 p-3.5 flex gap-3 text-sm text-muted-foreground">
                <Info className="w-5 h-5 shrink-0 text-primary mt-0.5" aria-hidden="true" />
                <p>
                    Enter core office details, operating hours, GPS coordinates, and custom fields like Phone or Division.
                </p>
            </div>

            {errorMessage && (
                <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3.5 text-sm font-medium text-destructive">
                    {errorMessage}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="label-mono block mb-1.5" htmlFor="add-office-name">
                            Office Name
                        </label>
                        <Input
                            id="add-office-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            placeholder="Galle Fort Post Office"
                            className="h-12 text-base bg-background"
                        />
                    </div>

                    <div>
                        <label className="label-mono block mb-1.5" htmlFor="add-office-code">
                            Postal Code
                        </label>
                        <Input
                            id="add-office-code"
                            value={postalCode}
                            onChange={(e) => setPostalCode(e.target.value)}
                            required
                            placeholder="80000"
                            className="h-12 text-base font-mono bg-background"
                        />
                    </div>

                    <div>
                        <label className="label-mono block mb-1.5" htmlFor="add-office-hours">
                            Operating Hours
                        </label>
                        <Input
                            id="add-office-hours"
                            value={operatingHours}
                            onChange={(e) => setOperatingHours(e.target.value)}
                            placeholder="Mon–Fri 08:30–16:30"
                            className="h-12 text-base bg-background"
                        />
                    </div>

                    <div>
                        <label className="label-mono block mb-1.5" htmlFor="add-office-rmsc">
                            RMSC / TPO Unit
                        </label>
                        <Input
                            id="add-office-rmsc"
                            value={rmsc}
                            onChange={(e) => setRmsc(e.target.value)}
                            placeholder="Optional"
                            className="h-12 text-base bg-background"
                        />
                    </div>

                    <div>
                        <label className="label-mono block mb-1.5" htmlFor="add-office-lat">
                            Latitude
                        </label>
                        <Input
                            id="add-office-lat"
                            type="number"
                            step="any"
                            value={latitude}
                            onChange={(e) => setLatitude(e.target.value)}
                            placeholder="6.0329"
                            className="h-12 text-base font-mono bg-background"
                        />
                    </div>

                    <div>
                        <label className="label-mono block mb-1.5" htmlFor="add-office-lng">
                            Longitude
                        </label>
                        <Input
                            id="add-office-lng"
                            type="number"
                            step="any"
                            value={longitude}
                            onChange={(e) => setLongitude(e.target.value)}
                            placeholder="80.2168"
                            className="h-12 text-base font-mono bg-background"
                        />
                    </div>
                </div>

                <div className="space-y-2 border-t border-border pt-4">
                    <p className="label-mono">Services Offered</p>
                    <div className="flex flex-wrap gap-2">
                        {KNOWN_SERVICES.map((tag) => {
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
                            onClick={addField}
                            className="h-10 border-foreground font-bold"
                        >
                            <PlusCircle className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                            Add Field
                        </Button>
                    </div>

                    {dynamicFields.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No additional fields added.</p>
                    ) : (
                        <div className="space-y-2.5">
                            {dynamicFields.map((field) => (
                                <div key={field.id} className="flex flex-col sm:flex-row gap-2">
                                    <Input
                                        type="text"
                                        placeholder="Field name (e.g. Phone)"
                                        value={field.name}
                                        onChange={(e) => updateField(field.id, "name", e.target.value)}
                                        className="h-11 text-base sm:w-44 bg-background"
                                    />
                                    <Input
                                        type="text"
                                        placeholder="Value"
                                        value={field.value}
                                        onChange={(e) => updateField(field.id, "value", e.target.value)}
                                        className="h-11 text-base flex-1 bg-background"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => removeField(field.id)}
                                        aria-label="Remove field"
                                        className="h-11 sm:w-11 text-destructive hover:bg-destructive/10 border border-destructive/30"
                                    >
                                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <Button
                    type="submit"
                    disabled={loading}
                    size="lg"
                    className="w-full h-12 text-base font-bold"
                >
                    <PlusCircle className="w-5 h-5 mr-2" aria-hidden="true" />
                    {loading ? "Creating..." : "Create Post Office"}
                </Button>
            </form>
        </div>
    );
}
