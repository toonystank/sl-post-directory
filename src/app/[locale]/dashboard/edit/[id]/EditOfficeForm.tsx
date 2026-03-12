"use client";

import { useState } from "react";
import { Save, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";

interface Field {
    id: string;
    name: string;
    value: string;
}

interface Office {
    id: string;
    name: string;
    postalCode: string;
    fields: Field[];
}

export default function EditOfficeForm({ office }: { office: Office }) {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");
        setError(false);

        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData.entries());

        try {
            const res = await fetch(`/api/admin/office/${office.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (res.ok) {
                setMessage("Post office edited successfully!");
                setTimeout(() => {
                    router.push("/dashboard");
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
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-primary mt-0.5" />
                <p>
                    Warning: You are directly editing the live database entry. These changes will be public immediately upon saving.
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
                        <Input type="text" name="name" defaultValue={office.name} required className="py-5 rounded-xl" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Postal Code</label>
                        <Input type="text" name="postalCode" defaultValue={office.postalCode} required className="py-5 rounded-xl" />
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="font-bold text-lg">Additional Fields</h3>
                    <Separator className="opacity-50" />

                    {office.fields.map(field => (
                        <div key={field.id}>
                            <label className="block text-sm font-medium text-muted-foreground mb-1.5">{field.name}</label>
                            <Input type="text" name={`field_${field.name}`} defaultValue={field.value} className="py-5 rounded-xl" />
                        </div>
                    ))}

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Add New Field</label>
                        <div className="flex gap-3">
                            <Input type="text" name="newFieldName" placeholder="Field name (e.g. Fax)" className="flex-1 py-5 rounded-xl" />
                            <Input type="text" name="newFieldValue" placeholder="Value (Requires name too)" className="flex-1 py-5 rounded-xl" />
                        </div>
                    </div>
                </div>

                <Button type="submit" disabled={loading} size="lg" className="w-full rounded-xl py-5 text-base font-semibold">
                    <Save className="w-5 h-5 mr-2" /> {loading ? "Saving..." : "Save Changes"}
                </Button>
            </form>
        </div>
    );
}
