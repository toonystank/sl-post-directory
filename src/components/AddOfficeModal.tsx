"use client";

import { useState } from "react";
import { Plus, Send, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Turnstile } from "@marsidev/react-turnstile";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AddOfficeModal({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const [divisions, setDivisions] = useState<string[]>([]);

    useEffect(() => {
        if (open) {
            fetch("/api/offices/options")
                .then(res => res.json())
                .then(data => {
                    if (data.divisions) setDivisions(data.divisions);
                })
                .catch(console.error);
        }
    }, [open]);

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

        const payload: Record<string, any> = { ...data, turnstileToken, type: "ADD" };

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
                setMessage("Your request to add a new post office has been submitted for review. Thank you!");
                setTimeout(() => {
                    setOpen(false);
                    setMessage("");
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

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                        <Plus className="w-5 h-5 text-primary" /> Add a New Post Office
                    </DialogTitle>
                    <DialogDescription>
                        Know a post office that isn't listed? Submit its details below. All submissions are verified by moderators.
                    </DialogDescription>
                </DialogHeader>

                {message && !error ? (
                    <div className="p-8 text-center space-y-4">
                        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Send className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-foreground">Success!</h3>
                        <p className="text-muted-foreground">{message}</p>
                    </div>
                ) : (
                    <div className="space-y-6 mt-4">
                        {error && (
                            <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-sm font-medium">
                                {message}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6 pb-4">
                            {status === "unauthenticated" && (
                                <div className="space-y-4 bg-card/80 p-5 rounded-2xl border border-border shadow-sm">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div>
                                            <h3 className="font-bold text-lg text-primary flex items-center gap-2">
                                                <Lock className="w-5 h-5" /> Sign up to Contribute
                                            </h3>
                                            <p className="text-sm text-muted-foreground">Create an account to track your edits.</p>
                                        </div>
                                        <Button variant="outline" size="sm" asChild>
                                            <Link href="/login">Already have an account?</Link>
                                        </Button>
                                    </div>
                                    <Separator className="opacity-50" />

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Your Name</label>
                                            <Input type="text" name="submitterName" required className="py-5 rounded-xl bg-background" placeholder="John Doe" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Your Email</label>
                                            <Input type="email" name="submitterEmail" required className="py-5 rounded-xl bg-background" placeholder="john@example.com" />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Create a Password</label>
                                            <Input type="password" name="submitterPassword" required className="py-5 rounded-xl bg-background" placeholder="••••••••" minLength={8} />
                                        </div>
                                    </div>


                                </div>
                            )}

                            <div className="space-y-4">
                                <h3 className="font-bold">Office Information</h3>
                                <Separator className="opacity-50" />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Office Name *</label>
                                        <Input type="text" name="name" required placeholder="e.g. Colombo Main Post Office" className="py-5 rounded-xl" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Postal Code *</label>
                                        <Input type="text" name="postalCode" required placeholder="e.g. 00100" className="py-5 rounded-xl" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Division</label>
                                        <Select name="field_Division">
                                            <SelectTrigger className="w-full py-5 rounded-xl bg-background text-base">
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
                                        <Select name="field_Type" defaultValue="Post office">
                                            <SelectTrigger className="w-full py-5 rounded-xl bg-background text-base">
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
                                        <Select name="field_Delivery" defaultValue="No">
                                            <SelectTrigger className="w-full py-5 rounded-xl bg-background text-base">
                                                <SelectValue placeholder="Select Delivery" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Yes">Yes</SelectItem>
                                                <SelectItem value="No">No</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Notes or Reason (Optional)</label>
                                        <Input type="text" name="reason" placeholder="e.g. This is a newly opened sub post office" className="py-5 rounded-xl" />
                                    </div>
                                </div>
                            </div>

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
                                {loading ? "Submitting..." : "Submit New Office"}
                            </Button>
                        </form>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
