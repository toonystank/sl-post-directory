"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Search, CheckCircle2, XCircle } from "lucide-react";
import { Link } from "@/navigation";
import { normalizePostalCode } from "@/lib/site";
import { cn } from "@/lib/utils";

export interface ControlledOfficeItem {
    id: string;
    slug: string;
    name: string;
    postalCode: string;
    shortCode?: string;
    delivery?: string;
    type?: string;
}

export default function ControlledOfficesList({
    offices,
}: {
    offices: ControlledOfficeItem[];
}) {
    const t = useTranslations("Office");
    const [search, setSearch] = React.useState("");
    const [deliveryFilter, setDeliveryFilter] = React.useState<"ALL" | "YES" | "NO">("ALL");

    const showControls = offices.length > 5;
    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return offices.filter((o) => {
            if (deliveryFilter === "YES" && !/^yes|delivery$/i.test(o.delivery || "")) return false;
            if (deliveryFilter === "NO" && !/^no|non/i.test(o.delivery || "")) return false;
            if (!q) return true;
            return (
                o.name.toLowerCase().includes(q) ||
                normalizePostalCode(o.postalCode).includes(q) ||
                (o.shortCode || "").toLowerCase().includes(q)
            );
        });
    }, [offices, search, deliveryFilter]);

    const deliveryCount = offices.filter((o) => /^yes|delivery$/i.test(o.delivery || "")).length;
    const nonDeliveryCount = offices.filter((o) => /^no|non/i.test(o.delivery || "")).length;

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="label-mono">{t("controls", { count: offices.length })}</h3>
                {(deliveryCount > 0 || nonDeliveryCount > 0) && (
                    <span className="font-mono text-[11px] text-muted-foreground">
                        {deliveryCount} {t("deliveryShort")} · {nonDeliveryCount} {t("nonDeliveryShort")}
                    </span>
                )}
            </div>

            {showControls && (
                <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t("filterControlledPlaceholder")}
                            className="h-9 w-full rounded-md border-[1.5px] border-foreground/60 bg-background pl-9 pr-3 text-sm focus:border-foreground focus:outline-none"
                        />
                    </div>
                    <div className="inline-flex rounded-md border-[1.5px] border-foreground/60 bg-background p-0.5 text-xs font-semibold">
                        {(
                            [
                                { key: "ALL", label: t("filterAll") },
                                { key: "YES", label: t("deliveryShort") },
                                { key: "NO", label: t("nonDeliveryShort") },
                            ] as const
                        ).map((opt) => (
                            <button
                                key={opt.key}
                                type="button"
                                onClick={() => setDeliveryFilter(opt.key)}
                                className={cn(
                                    "tap rounded-[4px] px-2.5 py-1 transition-colors",
                                    deliveryFilter === opt.key
                                        ? "bg-foreground text-background"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {filtered.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
                    {t("noControlledMatch")}
                </p>
            ) : (
                <div className="divide-y divide-border rounded-md border-2 border-foreground/40 bg-card overflow-hidden">
                    {filtered.map((sub) => {
                        const code = normalizePostalCode(sub.postalCode);
                        const isDel = /^yes|delivery$/i.test(sub.delivery || "");
                        const isNonDel = /^no|non/i.test(sub.delivery || "");
                        return (
                            <Link
                                key={sub.id}
                                href={`/office/${sub.slug}`}
                                className="tap flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-muted/70 transition-colors"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold truncate">{sub.name}</span>
                                        {sub.shortCode && (
                                            <span className="rounded border border-foreground/30 bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold">
                                                {sub.shortCode}
                                            </span>
                                        )}
                                    </div>
                                    {sub.type && (
                                        <span className="block text-[11px] text-muted-foreground">
                                            {sub.type}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {isDel && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                                            <span className="hidden sm:inline">{t("deliveryShort")}</span>
                                        </span>
                                    )}
                                    {isNonDel && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                                            <XCircle className="h-3 w-3" aria-hidden="true" />
                                            <span className="hidden sm:inline">{t("nonDeliveryShort")}</span>
                                        </span>
                                    )}
                                    <span className="font-mono text-xs font-semibold text-muted-foreground min-w-[3.2rem] text-right">
                                        {code || "—"}
                                    </span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
