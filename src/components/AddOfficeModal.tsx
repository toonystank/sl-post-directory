"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Plus, Send, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Turnstile } from "@marsidev/react-turnstile";
import { useSession } from "next-auth/react";
import { Link } from "@/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AddOfficeModal({ children }: { children: React.ReactNode }) {
    const t = useTranslations("Suggest");
    const { status } = useSession();
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

        const payload: Record<string, FormDataEntryValue | string | null | undefined> = { ...data, turnstileToken, type: "ADD" };

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
        } catch {
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
                        <Plus className="w-5 h-5 text-primary" /> {t("addOfficeTitle")}
                    </DialogTitle>
                    <DialogDescription>
                        {t("addOfficeDesc")}
                    </DialogDescription>
                </DialogHeader>

                {message && !error ? (
                    <div className="p-8 text-center space-y-4">
                        <div className="w-16 h-16 bg-status-open/10 text-status-open border border-status-open/40 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Send className="w-8 h-8" />
                        </div>
                        <h3 className="font-heading text-xl font-extrabold [font-stretch:82%] text-foreground">{t("successTitle")}</h3>
                        <p className="text-muted-foreground">{message}</p>
                    </div>
                ) : (
                    <div className="space-y-6 mt-4">
                        {error && (
                            <div className="p-4 bg-destructive/10 border border-destructive/30 text-destructive rounded-md text-sm font-medium">
                                {message}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6 pb-4">
                            {status === "unauthenticated" && (
                                <div className="space-y-4 bg-card p-5 rounded-md border border-border">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div>
                                            <h3 className="font-heading font-extrabold text-lg text-primary flex items-center gap-2">
                                                <Lock className="w-5 h-5" /> {t("signUpTitle")}
                                            </h3>
                                            <p className="text-sm text-muted-foreground">{t("signUpSub")}</p>
                                        </div>
                                        <Button variant="outline" size="sm" asChild>
                                            <Link href="/login">{t("alreadyAccount")}</Link>
                                        </Button>
                                    </div>
                                    <Separator />

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-muted-foreground mb-1.5">{t("yourName")}</label>
                                            <Input type="text" name="submitterName" required className="bg-background" placeholder="Kasun Perera" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-muted-foreground mb-1.5">{t("yourEmail")}</label>
                                            <Input type="email" name="submitterEmail" required className="bg-background" placeholder="you@example.com" />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-muted-foreground mb-1.5">{t("createPassword")}</label>
                                            <Input type="password" name="submitterPassword" required className="bg-background" placeholder="••••••••" minLength={8} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <h3 className="font-heading font-extrabold text-lg">{t("basicInfo")}</h3>
                                <Separator />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">{t("officeName")} *</label>
                                        <Input type="text" name="name" required placeholder="e.g. Colombo Main Post Office" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">{t("postalCode")} *</label>
                                        <Input type="text" name="postalCode" required placeholder="e.g. 00100" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">{t("division")}</label>
                                        <Select name="field_Division">
                                            <SelectTrigger className="w-full h-10 bg-card text-sm">
                                                <SelectValue placeholder={t("selectDivision")} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {divisions.map(div => (
                                                    <SelectItem key={div} value={div}>{div}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">{t("type")}</label>
                                        <Select name="field_Type" defaultValue="Post office">
                                            <SelectTrigger className="w-full h-10 bg-card text-sm">
                                                <SelectValue placeholder={t("selectType")} />
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
                                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">{t("deliveryFacility")}</label>
                                        <Select name="field_Delivery" defaultValue="No">
                                            <SelectTrigger className="w-full h-10 bg-card text-sm">
                                                <SelectValue placeholder={t("selectDelivery")} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Yes">{t("yes")}</SelectItem>
                                                <SelectItem value="No">{t("no")}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">{t("notesOptional")}</label>
                                        <Input type="text" name="reason" placeholder="e.g. This is a newly opened sub post office" />
                                    </div>
                                </div>
                            </div>

                            {turnstileSiteKey && (
                                <div className="flex justify-center pt-4 pb-2">
                                    <Turnstile
                                        siteKey={turnstileSiteKey}
                                        onSuccess={(token) => setTurnstileToken(token)}
                                        onExpire={() => setTurnstileToken(null)}
                                        onError={() => {
                                            setTurnstileToken(null);
                                            setError(true);
                                            setMessage("Captcha failed to load. Please check your connection, system clock, or ad-blocker and try again.");
                                        }}
                                    />
                                </div>
                            )}

                            <Button type="submit" disabled={loading} size="lg" className="w-full h-11 text-base">
                                {loading ? t("submitting") : t("submitNewOffice")}
                            </Button>
                        </form>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
