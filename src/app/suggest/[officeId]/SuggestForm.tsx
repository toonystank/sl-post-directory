"use client";

import { useState } from "react";
import { Info, Send } from "lucide-react";
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

export default function SuggestForm({ office }: { office: Office }) {
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
            const res = await fetch("/api/suggest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ officeId: office.id, ...data }),
            });

            if (res.ok) {
                setMessage("Your suggested edits have been submitted for review. Thank you!");
                setTimeout(() => {
                    router.push(`/office/${office.id}`);
                    router.refresh();
                }, 3000);
            } else {
                const errData = await res.json();
                setError(true);
                setMessage(errData.error || "An error occurred. Please try again.");
            }
        } catch (err) {
            setError(true);
            setMessage("A network error occurred.");
        } finally {
            setLoading(false);
        }
    };

    if (message && !error) {
        return (
            <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Send className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-foreground">Success!</h3>
                <p className="text-muted-foreground">{message}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="mb-4 p-4 bg-primary/5 border border-primary/10 rounded-xl flex gap-3 text-sm text-muted-foreground">
                <Info className="w-5 h-5 flex-shrink-0 text-primary mt-0.5" />
                <p>
                    Please enter your updated information below. All changes are subject to moderation by the admin team before they are published to the public directory.
                </p>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-sm font-medium">
                    {message}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-4">
                    <h3 className="font-bold text-lg">Your Details</h3>
                    <Separator className="opacity-50" />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1.5" htmlFor="submitterName">Your Name</label>
                            <Input type="text" id="submitterName" name="submitterName" required className="py-5 rounded-xl" placeholder="John Doe" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1.5" htmlFor="submitterEmail">Your Email</label>
                            <Input type="email" id="submitterEmail" name="submitterEmail" required className="py-5 rounded-xl" placeholder="john@example.com" />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="font-bold text-lg">Basic Information</h3>
                    <Separator className="opacity-50" />

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Office Name</label>
                        <Input type="text" name="name" defaultValue={office.name} className="py-5 rounded-xl" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Postal Code</label>
                        <Input type="text" name="postalCode" defaultValue={office.postalCode} className="py-5 rounded-xl" />
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
                            <Input type="text" name="newFieldName" placeholder="Field name (e.g. Phone)" className="flex-1 py-5 rounded-xl" />
                            <Input type="text" name="newFieldValue" placeholder="Value" className="flex-1 py-5 rounded-xl" />
                        </div>
                    </div>
                </div>

                <Button type="submit" disabled={loading} size="lg" className="w-full rounded-xl py-5 text-base font-semibold">
                    <Send className="w-5 h-5 mr-2" /> {loading ? "Submitting..." : "Submit for Review"}
                </Button>
            </form>
        </div>
    );
}
