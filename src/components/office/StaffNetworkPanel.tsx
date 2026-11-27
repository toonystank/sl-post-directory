"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
    ArrowRight,
    Check,
    Copy,
    Loader2,
    Pin,
    PinOff,
    Route,
} from "lucide-react";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import { useStaffStation } from "@/context/StaffStationContext";
import {
    buildRoutingHref,
    toRoutingOfficeNode,
    type StaffStation,
} from "@/lib/staff-station";
import { computeMailRoute, type ComputedMailRoute } from "@/lib/mail-routing";
import { ensureLocalOfficeIndex } from "@/lib/office-index-client";

interface StaffNetworkPanelProps {
    office: StaffStation;
}

/**
 * Renders the Mail Route Finder action buttons, optional "Set as My Station" toggle,
 * and (ONLY when the employee has set a different Duty Station) a live compact
 * "Dispatch from <My Station>" routing preview inside the Post Office detail page.
 */
export default function StaffNetworkPanel({ office }: StaffNetworkPanelProps) {
    const t = useTranslations("Office");
    const tStaff = useTranslations("Staff");
    const tRouting = useTranslations("Routing");
    const { station, hydrated, mailRoutingEnabled, setStation, clearStation } = useStaffStation();
    const [route, setRoute] = React.useState<ComputedMailRoute | null>(null);
    const [loadingRoute, setLoadingRoute] = React.useState(false);
    const [copied, setCopied] = React.useState(false);

    const isCurrentStation = mailRoutingEnabled && hydrated && station?.slug === office.slug;
    const hasDifferentStation = Boolean(
        mailRoutingEnabled && hydrated && station && station.slug !== office.slug
    );

    React.useEffect(() => {
        if (!hasDifferentStation || !station) {
            setRoute(null);
            return;
        }
        let active = true;
        setLoadingRoute(true);
        ensureLocalOfficeIndex()
            .then((engine) => {
                if (!active || !engine) return;
                const nodes = engine.getRoutingNodes();
                const originNode =
                    nodes.find((n) => n.slug === station.slug) ?? toRoutingOfficeNode(station);
                const targetNode =
                    nodes.find((n) => n.slug === office.slug) ?? toRoutingOfficeNode(office);
                setRoute(computeMailRoute(originNode, targetNode, nodes));
            })
            .finally(() => {
                if (active) setLoadingRoute(false);
            });
        return () => {
            active = false;
        };
    }, [hasDifferentStation, station, office]);

    const handleToggleStation = () => {
        if (isCurrentStation) {
            clearStation();
        } else {
            setStation(office);
        }
    };

    const handleCopyRoute = async () => {
        if (!route || !station) return;
        const text = [
            `FROM: ${station.name}${station.shortCode ? ` [${station.shortCode}]` : ""} (${station.postalCode || "—"})`,
            `TO: ${route.bagLabel.toOffice}`,
            `POSTCODE: ${route.bagLabel.postalCode} | SHORT CODE: ${route.bagLabel.shortCode}`,
            `RMSC / TPO: ${route.bagLabel.hub}`,
            `CONTROLLING OFFICE: ${route.bagLabel.controllingOffice}`,
            `ROUTE: ${route.steps.map((s) => s.title).join(" -> ")}`,
        ].join("\n");
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            // ignore clipboard errors
        }
    };

    const routingHref = buildRoutingHref(office.slug, hydrated ? station : null);

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="font-heading text-xl font-extrabold [font-stretch:82%]">
                        {t("network")}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">{t("networkLede")}</p>
                </div>
                {mailRoutingEnabled && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <Button
                            type="button"
                            variant={isCurrentStation ? "secondary" : "outline"}
                            size="sm"
                            onClick={handleToggleStation}
                            className={
                                isCurrentStation
                                    ? "border-emerald-700/60 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                                    : undefined
                            }
                        >
                            {isCurrentStation ? (
                                <>
                                    <Check className="h-4 w-4 mr-1.5" aria-hidden="true" />
                                    <span>{tStaff("pinnedStation")}</span>
                                    <PinOff className="h-3.5 w-3.5 ml-1.5 opacity-70" aria-hidden="true" />
                                </>
                            ) : (
                                <>
                                    <Pin className="h-4 w-4 mr-1.5" aria-hidden="true" />
                                    <span>{tStaff("pinAsStation")}</span>
                                </>
                            )}
                        </Button>
                        <Button asChild variant="outline" size="sm">
                            <Link href={routingHref}>
                                <Route className="h-4 w-4 mr-1.5" aria-hidden="true" />
                                <span>{t("openInRouteFinder")}</span>
                                <span className="ml-1.5 rounded bg-amber-500/20 px-1 py-px font-mono text-[9px] font-extrabold uppercase text-amber-900 dark:text-amber-300">
                                    Beta
                                </span>
                            </Link>
                        </Button>
                    </div>
                )}
            </div>

            {hasDifferentStation && station && (
                <div className="rounded-lg border-2 border-primary/50 bg-primary/5 p-3.5 sm:p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                            <Route className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                            <p className="text-xs sm:text-sm font-extrabold text-foreground truncate">
                                {tStaff("dispatchFrom", {
                                    station: `${station.name}${station.shortCode ? ` [${station.shortCode}]` : ""}`,
                                })}
                            </p>
                        </div>
                        {route && (
                            <span className="rounded-full bg-primary/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-primary shrink-0">
                                {route.scopeLabel}
                            </span>
                        )}
                    </div>

                    {loadingRoute && !route ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>{tStaff("loadingOffices")}</span>
                        </div>
                    ) : route ? (
                        <>
                            <p className="text-xs font-mono text-muted-foreground">
                                {tStaff("bagToLabel")}:{" "}
                                <strong className="text-foreground">
                                    {route.bagLabel.toOffice}
                                </strong>{" "}
                                · {route.bagLabel.shortCode} · {route.bagLabel.postalCode}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
                                {route.steps.map((step, i) => (
                                    <React.Fragment key={`${step.role}-${i}`}>
                                        <span className="rounded border border-foreground/30 bg-card px-2 py-0.5">
                                            {step.title}
                                        </span>
                                        {i < route.steps.length - 1 && (
                                            <ArrowRight
                                                className="h-3.5 w-3.5 text-muted-foreground shrink-0"
                                                aria-hidden="true"
                                            />
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCopyRoute}
                                    className="h-8 text-xs"
                                >
                                    {copied ? (
                                        <>
                                            <Check className="h-3.5 w-3.5 mr-1" />
                                            <span>{tRouting("copied")}</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="h-3.5 w-3.5 mr-1" />
                                            <span>{tRouting("copyLabel")}</span>
                                        </>
                                    )}
                                </Button>
                                <Button asChild size="sm" className="h-8 text-xs">
                                    <Link href={routingHref}>
                                        <span>{tStaff("fullRoute")}</span>
                                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                                    </Link>
                                </Button>
                            </div>
                        </>
                    ) : null}
                </div>
            )}
        </div>
    );
}
