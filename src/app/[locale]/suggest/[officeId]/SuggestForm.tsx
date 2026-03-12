"use client";

import { useState } from "react";
import { Info, Send, Lock, Edit3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Turnstile } from "@marsidev/react-turnstile";
import Link from "next/link";
import { useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
    const { data: session, status } = useSession();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const [divisions, setDivisions] = useState<string[]>([]);

    useEffect(() => {
        fetch("/api/offices/options")
            .then(res => res.json())
            .then(data => {
                if (data.divisions) setDivisions(data.divisions);
            })
            .catch(console.error);
    }, []);
    const [formType, setFormType] = useState<"EDIT" | "REMOVAL">("EDIT");
    const router = useRouter();

    const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (status === "unauthenticated" && turnstileSiteKey && !turnstileToken) {
            setError(true);
            setMessage("Please complete the Captcha to verify you are human.");
            return;
        }

        setLoading(true);
        setMessage("");
        setError(false);

        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData.entries());

        // Add token and form type manually
        const payload: Record<string, any> = { ...data, officeId: office.id, turnstileToken, type: formType };

        // Remove empty strings so they become `undefined` and pass Zod's `.optional()` validation
        Object.keys(payload).forEach(key => {
            if (payload[key] === "") {
                delete payload[key];
            }
        });

        try {
            const res = await fetch("/api/suggest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
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

    if (status === "loading") {
        return (
            <div className="p-8 text-center text-muted-foreground">
                Loading form...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex p-1 bg-secondary/20 rounded-xl mb-6 shadow-inner">
                <Button
                    variant={formType === "EDIT" ? "default" : "ghost"}
                    className={`flex-1 rounded-lg ${formType !== "EDIT" ? "hover:bg-background/50" : ""}`}
                    onClick={() => setFormType("EDIT")}
                >
                    <Edit3 className="w-4 h-4 mr-2" /> Suggest Edits
                </Button>
                <Button
                    variant={formType === "REMOVAL" ? "destructive" : "ghost"}
                    className={`flex-1 rounded-lg ${formType !== "REMOVAL" ? "hover:bg-destructive/10 hover:text-destructive" : ""}`}
                    onClick={() => setFormType("REMOVAL")}
                >
                    <Trash2 className="w-4 h-4 mr-2" /> Request Removal
                </Button>
            </div>

            <div className="mb-4 p-4 bg-primary/5 border border-primary/10 rounded-xl flex gap-3 text-sm text-muted-foreground">
                <Info className="w-5 h-5 flex-shrink-0 text-primary mt-0.5" />
                <p>
                    {formType === "EDIT"
                        ? "Please enter your updated information below. All changes are subject to moderation by the admin team before they are published to the public directory."
                        : "Use this form to request the removal of this post office if it is closed or does not exist. Our team will verify before removing it."}
                </p>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-sm font-medium">
                    {message}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
                {status === "unauthenticated" && (
                    <div className="space-y-4 bg-card/80 p-6 rounded-2xl border border-border shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h3 className="font-bold text-lg text-primary flex items-center gap-2">
                                    <Lock className="w-5 h-5" /> Sign up to Contribute
                                </h3>
                                <p className="text-sm text-muted-foreground">Create an account to track your edits.</p>
                            </div>
                            <Button variant="outline" size="sm" asChild>
                                <Link href="/login">Already have an account? Log In</Link>
                            </Button>
                        </div>
                        <Separator className="opacity-50" />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1.5" htmlFor="submitterName">Your Name</label>
                                <Input type="text" id="submitterName" name="submitterName" required className="py-5 rounded-xl bg-background" placeholder="John Doe" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1.5" htmlFor="submitterEmail">Your Email</label>
                                <Input type="email" id="submitterEmail" name="submitterEmail" required className="py-5 rounded-xl bg-background" placeholder="john@example.com" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-muted-foreground mb-1.5" htmlFor="submitterPassword">Create a Password</label>
                                <Input type="password" id="submitterPassword" name="submitterPassword" required className="py-5 rounded-xl bg-background" placeholder="••••••••" minLength={8} />
                            </div>
                        </div>


                    </div>
                )}

                {formType === "EDIT" ? (
                    <>
                        <div className="space-y-4">
                            <h3 className="font-bold text-lg">Basic Information</h3>
                            <Separator className="opacity-50" />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Office Name</label>
                                    <Input type="text" name="name" defaultValue={office.name} className="py-5 rounded-xl" />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Postal Code</label>
                                    <Input type="text" name="postalCode" defaultValue={office.postalCode} className="py-5 rounded-xl" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="font-bold text-lg">Additional Fields</h3>
                            <Separator className="opacity-50" />

                            {(() => {
                                const fieldMap = new Map((office.fields || []).map(f => [f.name, f.value]));
                                const standardFields = ["Division", "Delivery", "Type", "Location", "Short Code"];
                                const extraFields = (office.fields || []).filter(f => !standardFields.includes(f.name));

                                return (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Standard Fields always rendered */}
                                            <div>
                                                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Division</label>
                                                <Select name="field_Division" defaultValue={fieldMap.get("Division")}>
                                                    <SelectTrigger className="w-full py-5 rounded-xl bg-background border-border/50 text-base">
                                                        <SelectValue placeholder="Select Division" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {divisions.map(div => (
                                                            <SelectItem key={div} value={div}>{div}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Type</label>
                                                <Select name="field_Type" defaultValue={fieldMap.get("Type") || "Post office"}>
                                                    <SelectTrigger className="w-full py-5 rounded-xl bg-background border-border/50 text-base">
                                                        <SelectValue placeholder="Select Type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Post office">Post office</SelectItem>
                                                        <SelectItem value="Sub Post office">Sub Post office</SelectItem>
                                                        <SelectItem value="Agency Post office">Agency Post office</SelectItem>
                                                        <SelectItem value="Branch Post office">Branch Post office</SelectItem>
                                                        <SelectItem value="Camp Post office">Camp Post office</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Delivery Facility</label>
                                                <Select name="field_Delivery" defaultValue={fieldMap.get("Delivery") || "No"}>
                                                    <SelectTrigger className="w-full py-5 rounded-xl bg-background border-border/50 text-base">
                                                        <SelectValue placeholder="Select Delivery" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Yes">Yes</SelectItem>
                                                        <SelectItem value="No">No</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Short Code</label>
                                                <Input type="text" name="field_Short Code" defaultValue={fieldMap.get("Short Code") || ""} placeholder="e.g. WP/CO" className="py-5 rounded-xl" />
                                            </div>

                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Location</label>
                                                <Input type="text" name="field_Location" defaultValue={fieldMap.get("Location") || ""} placeholder="Address or Location specifics" className="py-5 rounded-xl" />
                                            </div>
                                        </div>

                                        {/* Render any additional weird fields the DB might have */}
                                        {extraFields.length > 0 && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                                {extraFields.map(field => (
                                                    <div key={field.id}>
                                                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">{field.name}</label>
                                                        <Input type="text" name={`field_${field.name}`} defaultValue={field.value} className="py-5 rounded-xl" />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                );
                            })()}


                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Add New Field</label>
                                <div className="flex gap-3">
                                    <Input type="text" name="newFieldName" placeholder="Field name (e.g. Phone)" className="flex-1 py-5 rounded-xl" />
                                    <Input type="text" name="newFieldValue" placeholder="Value" className="flex-1 py-5 rounded-xl" />
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="space-y-4">
                        <h3 className="font-bold text-lg text-destructive">Removal Details</h3>
                        <Separator className="opacity-50" />
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Why should this be removed?</label>
                            <Input type="text" name="reason" required placeholder="e.g. This post office closed in 2022" className="py-5 rounded-xl" />
                        </div>
                    </div>
                )}

                {turnstileSiteKey && (
                    <div className="flex justify-center pt-4 pb-2">
                        <Turnstile
                            siteKey={turnstileSiteKey}
                            onSuccess={(token) => setTurnstileToken(token)}
                            onExpire={() => setTurnstileToken(null)}
                        />
                    </div>
                )}

                <Button type="submit" disabled={loading} size="lg" className="w-full rounded-xl py-5 text-base font-semibold">
                    <Send className="w-5 h-5 mr-2" /> {loading ? "Submitting..." : "Submit for Review"}
                </Button>
            </form>
        </div>
    );
}
