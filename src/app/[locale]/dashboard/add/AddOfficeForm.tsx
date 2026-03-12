"use client";

import { useState } from "react";
import { PlusCircle, Info, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";

export default function AddOfficeForm() {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState(false);
    const router = useRouter();

    // Manage dynamic fields visually
    const [dynamicFields, setDynamicFields] = useState<{ id: number, name: string, value: string }[]>([]);

    const addField = () => {
        setDynamicFields([...dynamicFields, { id: Date.now(), name: "", value: "" }]);
    };

    const removeField = (id: number) => {
        setDynamicFields(dynamicFields.filter(f => f.id !== id));
    };

    const updateField = (id: number, key: 'name' | 'value', val: string) => {
        setDynamicFields(dynamicFields.map(f => f.id === id ? { ...f, [key]: val } : f));
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");
        setError(false);

        const formData = new FormData(e.currentTarget);
        const data: Record<string, any> = {
            name: formData.get("name"),
            postalCode: formData.get("postalCode")
        };

        // Append visual dynamic fields into the data structure expected by the API
        dynamicFields.forEach(field => {
            if (field.name.trim() && field.value.trim()) {
                data[`field_${field.name}`] = field.value;
            }
        });

        try {
            const res = await fetch(`/api/admin/office`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (res.ok) {
                const json = await res.json();
                setMessage("Post office added successfully!");
                setTimeout(() => {
                    router.push(`/office/${json.office.id}`);
                    router.refresh();
                }, 1500);
            } else {
                const errData = await res.json();
                setError(true);
                setMessage(errData.error || "An error occurred while saving.");
            }
        } catch (err) {
            setError(true);
            setMessage("A network error occurred.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="mb-4 p-4 bg-primary/5 border border-primary/10 rounded-xl flex gap-3 text-sm text-muted-foreground">
                <Info className="w-5 h-5 flex-shrink-0 text-primary mt-0.5" />
                <p>
                    Enter the details for the new post office. Dynamic fields like "Phone" or "Type" can be added below.
                </p>
            </div>

            {message && (
                <div className={`mb-4 p-4 rounded-xl text-sm font-medium ${error ? 'bg-destructive/10 border border-destructive/20 text-destructive' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'}`}>
                    {message}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-4">
                    <h3 className="font-bold text-lg">Basic Information</h3>
                    <Separator className="opacity-50" />

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Office Name</label>
                        <Input type="text" name="name" required placeholder="Galle Fort Post Office" className="py-5 rounded-xl" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Postal Code</label>
                        <Input type="text" name="postalCode" required placeholder="80000" className="py-5 rounded-xl" />
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-lg">Additional Fields</h3>
                        <Button type="button" variant="outline" size="sm" onClick={addField} className="text-xs">
                            <PlusCircle className="w-3 h-3 mr-1" /> Add Field
                        </Button>
                    </div>
                    <Separator className="opacity-50" />

                    {dynamicFields.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No additional fields added.</p>
                    ) : (
                        <div className="space-y-3">
                            {dynamicFields.map((field) => (
                                <div key={field.id} className="flex gap-3 items-center">
                                    <Input
                                        type="text"
                                        placeholder="Field name (e.g. Phone)"
                                        value={field.name}
                                        onChange={(e) => updateField(field.id, 'name', e.target.value)}
                                        className="flex-1 py-5 rounded-xl"
                                    />
                                    <Input
                                        type="text"
                                        placeholder="Value"
                                        value={field.value}
                                        onChange={(e) => updateField(field.id, 'value', e.target.value)}
                                        className="flex-1 py-5 rounded-xl"
                                    />
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeField(field.id)} className="text-destructive hover:bg-destructive/10">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <Button type="submit" disabled={loading} size="lg" className="w-full rounded-xl py-5 text-base font-semibold">
                    <PlusCircle className="w-5 h-5 mr-2" /> {loading ? "Creating..." : "Create Post Office"}
                </Button>
            </form>
        </div>
    );
}
