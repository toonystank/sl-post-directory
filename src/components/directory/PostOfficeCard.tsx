"use client";

import React, { useState } from "react";
import { Link } from "@/navigation";
import { ChevronRight, ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PostOffice } from "./types";
import AdBanner from "@/components/ads/AdBanner";
import { getPostOfficeStatus } from "@/lib/holidays";
import Postmark from "@/components/brand/Postmark";
import StatusDot from "@/components/brand/StatusDot";
import { cn } from "@/lib/utils";

interface PostOfficeCardProps {
    office: PostOffice;
    index: number;
}

/** Desktop column template — shared with the header row in DirectoryGrid. */
export const ROW_COLS = "lg:grid-cols-[minmax(0,2.2fr)_6.5rem_minmax(0,1.2fr)_8rem_minmax(0,1.1fr)_1.5rem]";

/** Small perforated postcode tag for the dense desktop table. */
function CodeTag({ code }: { code: string }) {
    return (
        <span className="inline-flex rounded-[3px] border-[1.5px] border-dashed border-foreground/70 px-1.5 py-0.5 font-mono text-[0.8rem] font-semibold tracking-wide">
            {code}
        </span>
    );
}

/**
 * One office in the results list.
 * Mobile: name + type/division, postmark, status, chevron.
 * Desktop (lg): dense table row.
 */
export default function PostOfficeCard({ office, index }: PostOfficeCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const locale = useLocale();
    const t = useTranslations("Status");
    const ts = useTranslations("Search");

    const fieldMap = Object.fromEntries(office.fields.map((f) => [f.name, f.value]));
    const type = fieldMap["Type"];
    const phone = fieldMap["Phone"] || fieldMap["Telephone"];
    const division = fieldMap["Division"];
    const is24Hour = fieldMap["Is24Hour"] === "true";
    const hasCode = Boolean(office.postalCode);

    const status = getPostOfficeStatus(locale, is24Hour);
    const statusLabel = status.status === "holiday" ? t("holiday") : t(status.label);

    const subs = office.controlledOffices ?? [];
    const showAdAfter = index > 0 && index % 12 === 0;

    return (
        <React.Fragment>
            {showAdAfter && (
                <li className="py-2">
                    <AdBanner position="in-feed" />
                </li>
            )}
            <li className="cv-auto border-b border-border">
                <Link
                    href={`/office/${office.slug}`}
                    className={cn(
                        "tap group grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 py-3.5 lg:gap-x-4 lg:py-2.5",
                        ROW_COLS,
                        "hover:bg-muted/60 lg:-mx-2 lg:px-2 rounded-sm"
                    )}
                >
                    {/* Name + meta */}
                    <span className="min-w-0">
                        <span className="block truncate text-[1.02rem] font-semibold leading-snug group-hover:text-primary lg:text-[0.95rem]">
                            {office.name}
                        </span>
                        <span className="mt-0.5 block truncate text-sm text-muted-foreground lg:text-xs">
                            {[type, division].filter(Boolean).join(" · ")}
                            <span className="lg:hidden">{is24Hour ? "" : ""}</span>
                        </span>
                        <span className="mt-1 block lg:hidden">
                            <StatusDot status={status.status} label={statusLabel} />
                        </span>
                    </span>

                    {/* Postcode */}
                    <span className="lg:hidden">
                        {hasCode && <Postmark code={office.postalCode} size="sm" rotate={-8} />}
                    </span>
                    <span className="hidden lg:block">{hasCode && <CodeTag code={office.postalCode} />}</span>

                    {/* Desktop-only columns */}
                    <span className="hidden lg:block truncate text-sm">{division || "—"}</span>
                    <span className="hidden lg:block"><StatusDot status={status.status} label={statusLabel} /></span>
                    <span className="hidden lg:block truncate font-mono text-[0.8rem]">{phone || "—"}</span>

                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
                </Link>

                {subs.length > 0 && (
                    <div className="pb-2 lg:pl-0">
                        <button
                            onClick={() => setIsExpanded((v) => !v)}
                            aria-expanded={isExpanded}
                            className="tap -ml-1 inline-flex items-center gap-1 rounded px-1 py-1 text-xs font-semibold text-muted-foreground hover:text-primary"
                        >
                            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-180")} />
                            {ts("subOffices", { count: subs.length })}
                        </button>
                        {isExpanded && (
                            <ul className="ml-1 mt-1 border-l-2 border-secondary pl-3">
                                {subs.map((sub) => (
                                    <li key={sub.id}>
                                        <Link
                                            href={`/office/${sub.slug}`}
                                            className="tap flex items-center justify-between gap-3 py-2 text-sm hover:text-primary"
                                        >
                                            <span className="truncate">{sub.name}</span>
                                            <span className="font-mono text-xs text-muted-foreground">{sub.postalCode}</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </li>
        </React.Fragment>
    );
}
