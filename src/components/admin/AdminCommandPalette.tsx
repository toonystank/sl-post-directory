"use client";

import * as React from "react";
import { Search, Building2, FileText, ShieldCheck, Calculator, Code2, Users, Clock, Settings, ArrowRight, UserCheck, PlusCircle } from "lucide-react";
import { Sheet, SheetContent } from "@/components/shell/Sheet";
import { useRouter } from "@/navigation";
import { ensureLocalOfficeIndex } from "@/lib/office-index-client";
import { normalizePostalCode } from "@/lib/site";

interface ShortcutItem {
    href: string;
    label: string;
    hint: string;
    icon: React.ComponentType<{ className?: string }>;
    minRole?: "CONTRIBUTOR" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";
}

const SHORTCUTS: ShortcutItem[] = [
    { href: "/dashboard", label: "Admin Desk", hint: "Overview & priority triage", icon: ShieldCheck, minRole: "MODERATOR" },
    { href: "/dashboard/offices", label: "Offices Directory", hint: "Search, edit & manage post offices", icon: Building2 },
    { href: "/dashboard/add", label: "Add Post Office", hint: "Create new office listing", icon: PlusCircle, minRole: "ADMIN" },
    { href: "/dashboard/queue", label: "Moderation Queue", hint: "Edits, community photos & reviews", icon: ShieldCheck, minRole: "MODERATOR" },
    { href: "/dashboard/news", label: "News & Article Studio", hint: "Postal alerts, tariffs & guides", icon: FileText, minRole: "MODERATOR" },
    { href: "/dashboard/news/new", label: "Write New Dispatch", hint: "Launch rich article & news studio", icon: FileText, minRole: "MODERATOR" },
    { href: "/dashboard/rates", label: "Postage Rates", hint: "Domestic, EMS & extra tariff tables", icon: Calculator, minRole: "ADMIN" },
    { href: "/dashboard/variables", label: "Site Variables", hint: "{{placeholder}} tags for articles", icon: Code2, minRole: "ADMIN" },
    { href: "/dashboard/users", label: "Users & Roles", hint: "Access levels, 2FA & password resets", icon: Users, minRole: "SUPER_ADMIN" },
    { href: "/dashboard/activity", label: "Activity Log", hint: "Audit trail of moderation actions", icon: Clock, minRole: "MODERATOR" },
    { href: "/dashboard/profile", label: "Profile & 2FA Security", hint: "Password & authenticator setup", icon: UserCheck },
    { href: "/dashboard/system", label: "System & Backups", hint: "Sitewide ads & JSON export", icon: Settings, minRole: "SUPER_ADMIN" },
];

const ROLE_WEIGHT: Record<string, number> = {
    CONTRIBUTOR: 1,
    MODERATOR: 2,
    ADMIN: 3,
    SUPER_ADMIN: 4,
};

interface QuickOfficeResult {
    id: string;
    slug: string;
    name: string;
    postalCode: string;
}

export default function AdminCommandPalette({
    open,
    onOpenChange,
    userRole,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userRole: string;
}) {
    const router = useRouter();
    const [query, setQuery] = React.useState("");
    const [officeResults, setOfficeResults] = React.useState<QuickOfficeResult[]>([]);
    const roleLevel = ROLE_WEIGHT[userRole] ?? 1;

    React.useEffect(() => {
        if (!open) {
            setQuery("");
            setOfficeResults([]);
            return;
        }
        void ensureLocalOfficeIndex();
    }, [open]);

    React.useEffect(() => {
        const trimmed = query.trim();
        if (!open || trimmed.length < 2) {
            setOfficeResults([]);
            return;
        }
        let cancelled = false;
        void ensureLocalOfficeIndex().then((engine) => {
            if (cancelled || !engine) return;
            const matches = engine.query({ q: trimmed, limit: 6 }).offices.map((o) => ({
                id: o.id,
                slug: o.slug,
                name: o.name,
                postalCode: normalizePostalCode(o.postalCode),
            }));
            setOfficeResults(matches);
        });
        return () => {
            cancelled = true;
        };
    }, [open, query]);

    const visibleShortcuts = React.useMemo(() => {
        const allowed = SHORTCUTS.filter((s) => !s.minRole || roleLevel >= ROLE_WEIGHT[s.minRole]);
        const qLower = query.trim().toLowerCase();
        if (!qLower) return allowed;
        return allowed.filter(
            (s) => s.label.toLowerCase().includes(qLower) || s.hint.toLowerCase().includes(qLower)
        );
    }, [query, roleLevel]);

    const navigateTo = (href: string) => {
        onOpenChange(false);
        router.push(href);
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                title="Quick Command & Search"
                description="Jump to any admin tool or search 4,000+ post offices"
                bodyClassName="space-y-4 pt-3"
            >
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search screen, office name, or postcode..."
                        autoFocus
                        enterKeyHint="search"
                        className="h-12 w-full rounded-md border-2 border-foreground bg-background pl-10 pr-4 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                </div>

                {officeResults.length > 0 && (
                    <div>
                        <p className="label-mono mb-2">Post Offices (Instant Index)</p>
                        <div className="space-y-1.5">
                            {officeResults.map((office) => (
                                <button
                                    key={office.id}
                                    type="button"
                                    onClick={() =>
                                        navigateTo(
                                            `/dashboard/offices?q=${encodeURIComponent(office.postalCode || office.name)}`
                                        )
                                    }
                                    className="tap flex min-h-[44px] w-full items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-left hover:border-foreground"
                                >
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-foreground truncate">{office.name}</p>
                                        <p className="font-mono text-xs text-muted-foreground">
                                            {office.postalCode || "No code"}
                                        </p>
                                    </div>
                                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div>
                    <p className="label-mono mb-2">Workspace Navigation</p>
                    <div className="space-y-1.5">
                        {visibleShortcuts.map((item) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.href}
                                    type="button"
                                    onClick={() => navigateTo(item.href)}
                                    className="tap flex min-h-[44px] w-full items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-left hover:border-foreground"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border bg-muted text-foreground">
                                            <Icon className="h-4 w-4" aria-hidden="true" />
                                        </span>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-foreground truncate">{item.label}</p>
                                            <p className="text-xs text-muted-foreground truncate">{item.hint}</p>
                                        </div>
                                    </div>
                                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                </button>
                            );
                        })}
                        {visibleShortcuts.length === 0 && officeResults.length === 0 && (
                            <p className="py-6 text-center text-sm text-muted-foreground">
                                No matching admin screens or offices.
                            </p>
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
