"use client";

import { useState, useEffect, useCallback } from "react";
import { Save, Plus, Trash2, ChevronDown, ChevronRight, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showNativeToast } from "@/components/shell/NativeToast";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { PostalService, EmsZone, EmsCountry, ExtraFees } from "@/lib/rate-types";
import { DEFAULT_RATE_CONFIG, mergeWithDefaultConfig, type RateConfig } from "@/lib/postage-rates";
import { cn } from "@/lib/utils";

type RateTab = "domestic" | "ems_zones" | "ems_countries" | "extra";

export default function PostageRateManager() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [domesticServices, setDomesticServices] = useState<PostalService[]>(DEFAULT_RATE_CONFIG.domesticServices);
    const [emsZones, setEmsZones] = useState<EmsZone[]>(DEFAULT_RATE_CONFIG.emsZones);
    const [emsCountries, setEmsCountries] = useState<EmsCountry[]>(DEFAULT_RATE_CONFIG.emsCountries);
    const [extraFees, setExtraFees] = useState<ExtraFees>(DEFAULT_RATE_CONFIG.extraFees);

    const [activeTab, setActiveTab] = useState<RateTab>("domestic");
    const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
    const [countryFilter, setCountryFilter] = useState("");
    const [confirmDefaultsOpen, setConfirmDefaultsOpen] = useState(false);

    const fetchRates = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/admin/variables", { cache: "no-store" });
            if (res.ok) {
                const vars = (await res.json()) as Array<{ key: string; value: string }>;
                const loaded: Partial<RateConfig> = {};
                vars.forEach((v) => {
                    try {
                        if (v.key === "rates_domestic_services") loaded.domesticServices = JSON.parse(v.value);
                        if (v.key === "rates_ems_zones") loaded.emsZones = JSON.parse(v.value);
                        if (v.key === "rates_ems_countries") loaded.emsCountries = JSON.parse(v.value);
                        if (v.key === "rates_extra_fees") loaded.extraFees = JSON.parse(v.value);
                    } catch {
                        // Ignore malformed JSON
                    }
                });
                const merged = mergeWithDefaultConfig(loaded);
                setDomesticServices(merged.domesticServices);
                setEmsZones(merged.emsZones);
                setEmsCountries(merged.emsCountries);
                setExtraFees(merged.extraFees);
            }
        } catch {
            showNativeToast("Failed to load rate config.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchRates();
    }, [fetchRates]);

    const handleSave = async (key: string, value: unknown, label: string) => {
        setSaving(true);
        try {
            const res = await fetch("/api/admin/variables", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    key,
                    value: JSON.stringify(value, null, 2),
                    description: "Managed by Rate Editor",
                }),
            });
            if (res.ok) {
                showNativeToast(`Saved ${label}`);
            } else {
                showNativeToast("Failed to save rate changes.");
            }
        } catch {
            showNativeToast("Network error saving rates.");
        } finally {
            setSaving(false);
        }
    };

    const handleLoadOfficialDefaults = async () => {
        setSaving(true);
        try {
            setDomesticServices(DEFAULT_RATE_CONFIG.domesticServices);
            setEmsZones(DEFAULT_RATE_CONFIG.emsZones);
            setEmsCountries(DEFAULT_RATE_CONFIG.emsCountries);
            setExtraFees(DEFAULT_RATE_CONFIG.extraFees);

            const entries: [string, unknown, string][] = [
                ["rates_domestic_services", DEFAULT_RATE_CONFIG.domesticServices, "Official Feb 9, 2026 Domestic Postal Services"],
                ["rates_ems_zones", DEFAULT_RATE_CONFIG.emsZones, "Official EMS Zones and tiers"],
                ["rates_ems_countries", DEFAULT_RATE_CONFIG.emsCountries, "EMS Countries to Zone mapping"],
                ["rates_extra_fees", DEFAULT_RATE_CONFIG.extraFees, "Official Extra Fees (Reg, AR, COD, VPP, Postcard)"],
            ];

            await Promise.all(
                entries.map(([key, value, description]) =>
                    fetch("/api/admin/variables", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ key, value: JSON.stringify(value, null, 2), description }),
                    })
                )
            );
            setConfirmDefaultsOpen(false);
            showNativeToast("Loaded 2026 official defaults");
        } catch {
            showNativeToast("Failed to load defaults.");
        } finally {
            setSaving(false);
        }
    };

    const filteredCountries = emsCountries
        .map((c, idx) => ({ country: c, originalIdx: idx }))
        .filter(({ country }) => {
            const q = countryFilter.trim().toLowerCase();
            if (!q) return true;
            return country.name.toLowerCase().includes(q) || country.code.toLowerCase().includes(q);
        });

    return (
        <div className="space-y-5">
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                    <p className="label-mono">Tariff Configuration</p>
                    <h1 className="display text-3xl sm:text-4xl mt-1">Postage Rates</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Edit domestic tariff tiers, EMS zones, destination mappings &amp; extra fees.
                    </p>
                </div>

                <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={() => setConfirmDefaultsOpen(true)}
                    className="h-11 border-2 border-foreground font-bold gap-2 self-start sm:self-auto"
                >
                    <RotateCcw className="w-4 h-4" aria-hidden="true" />
                    <span>Load 2026 Defaults</span>
                </Button>
            </header>

            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
                {(
                    [
                        { id: "domestic", label: "Domestic Services" },
                        { id: "ems_zones", label: "EMS Zones" },
                        { id: "ems_countries", label: "EMS Countries" },
                        { id: "extra", label: "Extra Fees" },
                    ] as Array<{ id: RateTab; label: string }>
                ).map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "tap shrink-0 min-h-[44px] rounded-md border-2 px-3.5 text-xs sm:text-sm font-extrabold whitespace-nowrap",
                            activeTab === tab.id
                                ? "border-foreground bg-primary text-primary-foreground shadow-[2px_2px_0_0_hsl(var(--foreground))]"
                                : "border-border bg-card text-foreground hover:border-foreground"
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center rounded-md border-2 border-foreground bg-card py-16 text-muted-foreground gap-2">
                    <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden="true" />
                    <p className="font-mono text-xs uppercase tracking-wider">Loading tariff configuration...</p>
                </div>
            ) : (
                <>
                    {activeTab === "domestic" && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between gap-2">
                                <h2 className="font-heading text-lg font-extrabold">Domestic Tiers</h2>
                                <Button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => void handleSave("rates_domestic_services", domesticServices, "Domestic Rates")}
                                    className="h-11 font-bold gap-2"
                                >
                                    <Save className="h-4 w-4" aria-hidden="true" />
                                    <span>{saving ? "Saving..." : "Save Domestic"}</span>
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {domesticServices.map((service, sIdx) => {
                                    const expanded = expandedServiceId === service.id;
                                    return (
                                        <div key={service.id} className="rounded-md border-2 border-foreground bg-card overflow-hidden">
                                            <div
                                                onClick={() => setExpandedServiceId(expanded ? null : service.id)}
                                                className="flex items-center justify-between gap-3 p-3.5 bg-muted/40 cursor-pointer"
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                    {expanded ? (
                                                        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
                                                    ) : (
                                                        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                                                    )}
                                                    <Input
                                                        value={service.name}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onChange={(e) => {
                                                            const next = [...domesticServices];
                                                            next[sIdx] = { ...next[sIdx], name: e.target.value };
                                                            setDomesticServices(next);
                                                        }}
                                                        className="h-10 text-base font-bold bg-background max-w-xs"
                                                    />
                                                </div>
                                                <span className="font-mono text-xs text-muted-foreground shrink-0">
                                                    {service.tiers.length} tiers
                                                </span>
                                            </div>

                                            {expanded && (
                                                <div className="p-3.5 border-t border-border space-y-2.5 bg-background">
                                                    <div className="grid grid-cols-[1fr_1fr_44px] gap-2 font-mono text-[11px] uppercase text-muted-foreground px-1">
                                                        <span>Max Grams</span>
                                                        <span>Price (LKR)</span>
                                                        <span className="sr-only">Delete</span>
                                                    </div>
                                                    {service.tiers.map((tier, tIdx) => (
                                                        <div key={tIdx} className="grid grid-cols-[1fr_1fr_44px] gap-2 items-center">
                                                            <Input
                                                                type="number"
                                                                value={tier.maxWeight}
                                                                onChange={(e) => {
                                                                    const next = [...domesticServices];
                                                                    const nextTiers = [...next[sIdx].tiers];
                                                                    nextTiers[tIdx] = { ...nextTiers[tIdx], maxWeight: Number(e.target.value) };
                                                                    next[sIdx] = { ...next[sIdx], tiers: nextTiers };
                                                                    setDomesticServices(next);
                                                                }}
                                                                className="h-11 text-base font-mono"
                                                            />
                                                            <Input
                                                                type="number"
                                                                value={tier.price}
                                                                onChange={(e) => {
                                                                    const next = [...domesticServices];
                                                                    const nextTiers = [...next[sIdx].tiers];
                                                                    nextTiers[tIdx] = { ...nextTiers[tIdx], price: Number(e.target.value) };
                                                                    next[sIdx] = { ...next[sIdx], tiers: nextTiers };
                                                                    setDomesticServices(next);
                                                                }}
                                                                className="h-11 text-base font-mono"
                                                            />
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                aria-label="Remove tier"
                                                                onClick={() => {
                                                                    const next = [...domesticServices];
                                                                    const nextTiers = [...next[sIdx].tiers];
                                                                    nextTiers.splice(tIdx, 1);
                                                                    next[sIdx] = { ...next[sIdx], tiers: nextTiers };
                                                                    setDomesticServices(next);
                                                                }}
                                                                className="h-11 w-11 p-0 text-destructive hover:bg-destructive/10"
                                                            >
                                                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={() => {
                                                            const next = [...domesticServices];
                                                            const last = next[sIdx].tiers[next[sIdx].tiers.length - 1];
                                                            next[sIdx] = {
                                                                ...next[sIdx],
                                                                tiers: [
                                                                    ...next[sIdx].tiers,
                                                                    { maxWeight: (last?.maxWeight || 0) + 100, price: (last?.price || 0) + 10 },
                                                                ],
                                                            };
                                                            setDomesticServices(next);
                                                        }}
                                                        className="w-full h-11 border-dashed border-foreground/50 font-bold"
                                                    >
                                                        <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
                                                        Add Tier
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {activeTab === "ems_zones" && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between gap-2">
                                <h2 className="font-heading text-lg font-extrabold">EMS Tariff Zones</h2>
                                <Button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => void handleSave("rates_ems_zones", emsZones, "EMS Zones")}
                                    className="h-11 font-bold gap-2"
                                >
                                    <Save className="h-4 w-4" aria-hidden="true" />
                                    <span>{saving ? "Saving..." : "Save Zones"}</span>
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {emsZones.map((zone, zIdx) => {
                                    const expanded = expandedServiceId === zone.id;
                                    return (
                                        <div key={zone.id} className="rounded-md border-2 border-foreground bg-card overflow-hidden">
                                            <div
                                                onClick={() => setExpandedServiceId(expanded ? null : zone.id)}
                                                className="flex items-center justify-between gap-3 p-3.5 bg-muted/40 cursor-pointer"
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                    {expanded ? (
                                                        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
                                                    ) : (
                                                        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                                                    )}
                                                    <Input
                                                        value={zone.name}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onChange={(e) => {
                                                            const next = [...emsZones];
                                                            next[zIdx] = { ...next[zIdx], name: e.target.value };
                                                            setEmsZones(next);
                                                        }}
                                                        className="h-10 text-base font-bold bg-background max-w-xs"
                                                    />
                                                </div>
                                                <span className="font-mono text-xs text-muted-foreground shrink-0">
                                                    {zone.tiers.length} tiers
                                                </span>
                                            </div>

                                            {expanded && (
                                                <div className="p-3.5 border-t border-border space-y-2.5 bg-background">
                                                    <div className="grid grid-cols-[1fr_1fr_44px] gap-2 font-mono text-[11px] uppercase text-muted-foreground px-1">
                                                        <span>Max Grams</span>
                                                        <span>Price (LKR)</span>
                                                        <span className="sr-only">Delete</span>
                                                    </div>
                                                    {zone.tiers.map((tier, tIdx) => (
                                                        <div key={tIdx} className="grid grid-cols-[1fr_1fr_44px] gap-2 items-center">
                                                            <Input
                                                                type="number"
                                                                value={tier.maxWeight}
                                                                onChange={(e) => {
                                                                    const next = [...emsZones];
                                                                    const nextTiers = [...next[zIdx].tiers];
                                                                    nextTiers[tIdx] = { ...nextTiers[tIdx], maxWeight: Number(e.target.value) };
                                                                    next[zIdx] = { ...next[zIdx], tiers: nextTiers };
                                                                    setEmsZones(next);
                                                                }}
                                                                className="h-11 text-base font-mono"
                                                            />
                                                            <Input
                                                                type="number"
                                                                value={tier.price}
                                                                onChange={(e) => {
                                                                    const next = [...emsZones];
                                                                    const nextTiers = [...next[zIdx].tiers];
                                                                    nextTiers[tIdx] = { ...nextTiers[tIdx], price: Number(e.target.value) };
                                                                    next[zIdx] = { ...next[zIdx], tiers: nextTiers };
                                                                    setEmsZones(next);
                                                                }}
                                                                className="h-11 text-base font-mono"
                                                            />
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                aria-label="Remove tier"
                                                                onClick={() => {
                                                                    const next = [...emsZones];
                                                                    const nextTiers = [...next[zIdx].tiers];
                                                                    nextTiers.splice(tIdx, 1);
                                                                    next[zIdx] = { ...next[zIdx], tiers: nextTiers };
                                                                    setEmsZones(next);
                                                                }}
                                                                className="h-11 w-11 p-0 text-destructive hover:bg-destructive/10"
                                                            >
                                                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={() => {
                                                            const next = [...emsZones];
                                                            const last = next[zIdx].tiers[next[zIdx].tiers.length - 1];
                                                            next[zIdx] = {
                                                                ...next[zIdx],
                                                                tiers: [
                                                                    ...next[zIdx].tiers,
                                                                    { maxWeight: (last?.maxWeight || 0) + 100, price: (last?.price || 0) + 10 },
                                                                ],
                                                            };
                                                            setEmsZones(next);
                                                        }}
                                                        className="w-full h-11 border-dashed border-foreground/50 font-bold"
                                                    >
                                                        <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
                                                        Add Tier
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                        setEmsZones((prev) => [
                                            ...prev,
                                            { id: `zone${Date.now()}`, name: "New Zone", tiers: [{ maxWeight: 500, price: 1000 }] },
                                        ])
                                    }
                                    className="w-full h-11 border-2 border-dashed border-foreground/60 bg-card font-bold"
                                >
                                    <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
                                    Add New Zone
                                </Button>
                            </div>
                        </div>
                    )}

                    {activeTab === "ems_countries" && (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h2 className="font-heading text-lg font-extrabold">
                                    EMS Country Mapping ({emsCountries.length})
                                </h2>
                                <Button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => void handleSave("rates_ems_countries", emsCountries, "EMS Countries")}
                                    className="h-11 font-bold gap-2"
                                >
                                    <Save className="h-4 w-4" aria-hidden="true" />
                                    <span>{saving ? "Saving..." : "Save Countries"}</span>
                                </Button>
                            </div>

                            <Input
                                value={countryFilter}
                                onChange={(e) => setCountryFilter(e.target.value)}
                                placeholder="Filter countries or ISO code..."
                                className="h-12 text-base bg-card border-2 border-foreground"
                            />

                            <div className="space-y-2.5">
                                {filteredCountries.map(({ country, originalIdx }) => (
                                    <div
                                        key={`${originalIdx}-${country.code}`}
                                        className="rounded-md border-2 border-foreground bg-card p-3 flex flex-col sm:flex-row sm:items-center gap-2.5"
                                    >
                                        <div className="flex items-center gap-2 sm:w-28">
                                            <Input
                                                value={country.code}
                                                onChange={(e) => {
                                                    const next = [...emsCountries];
                                                    next[originalIdx] = { ...next[originalIdx], code: e.target.value.toUpperCase() };
                                                    setEmsCountries(next);
                                                }}
                                                placeholder="US"
                                                aria-label="Country ISO Code"
                                                className="h-11 text-base font-mono uppercase"
                                            />
                                        </div>
                                        <Input
                                            value={country.name}
                                            onChange={(e) => {
                                                const next = [...emsCountries];
                                                next[originalIdx] = { ...next[originalIdx], name: e.target.value };
                                                setEmsCountries(next);
                                            }}
                                            placeholder="Country Name"
                                            aria-label="Country Name"
                                            className="h-11 text-base flex-1"
                                        />
                                        <div className="flex items-center gap-2 sm:w-52">
                                            <select
                                                aria-label={`Zone for ${country.name || "country"}`}
                                                value={country.zoneId}
                                                onChange={(e) => {
                                                    const next = [...emsCountries];
                                                    next[originalIdx] = { ...next[originalIdx], zoneId: e.target.value };
                                                    setEmsCountries(next);
                                                }}
                                                className="h-11 flex-1 rounded-md border border-input bg-background px-3 text-sm font-medium"
                                            >
                                                {emsZones.map((z) => (
                                                    <option key={z.id} value={z.id}>
                                                        {z.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                aria-label={`Remove ${country.name}`}
                                                onClick={() => {
                                                    const next = [...emsCountries];
                                                    next.splice(originalIdx, 1);
                                                    setEmsCountries(next);
                                                }}
                                                className="h-11 w-11 p-0 text-destructive hover:bg-destructive/10 shrink-0"
                                            >
                                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                    setEmsCountries((prev) => [
                                        ...prev,
                                        { code: "", name: "", zoneId: emsZones[0]?.id || "" },
                                    ])
                                }
                                className="w-full h-11 border-2 border-dashed border-foreground/60 bg-card font-bold"
                            >
                                <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
                                Add Country
                            </Button>
                        </div>
                    )}

                    {activeTab === "extra" && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between gap-2">
                                <h2 className="font-heading text-lg font-extrabold">Extra Fees &amp; Surcharges</h2>
                                <Button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => void handleSave("rates_extra_fees", extraFees, "Extra Fees")}
                                    className="h-11 font-bold gap-2"
                                >
                                    <Save className="h-4 w-4" aria-hidden="true" />
                                    <span>{saving ? "Saving..." : "Save Fees"}</span>
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-md border-2 border-foreground bg-card p-4 sm:p-5">
                                <div>
                                    <label htmlFor="fee-registered" className="label-mono block mb-1.5">
                                        Registered Post Fee (LKR)
                                    </label>
                                    <Input
                                        id="fee-registered"
                                        type="number"
                                        value={extraFees.registeredPost}
                                        onChange={(e) => setExtraFees({ ...extraFees, registeredPost: Number(e.target.value) })}
                                        className="h-12 text-base font-mono bg-background"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="fee-foreign-registered" className="label-mono block mb-1.5">
                                        Foreign Registered Fee (LKR)
                                    </label>
                                    <Input
                                        id="fee-foreign-registered"
                                        type="number"
                                        value={extraFees.foreignRegisteredPost ?? 870}
                                        onChange={(e) => setExtraFees({ ...extraFees, foreignRegisteredPost: Number(e.target.value) })}
                                        className="h-12 text-base font-mono bg-background"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="fee-ar" className="label-mono block mb-1.5">
                                        Acknowledgement Receipt / AR (LKR)
                                    </label>
                                    <Input
                                        id="fee-ar"
                                        type="number"
                                        value={extraFees.arReceipt}
                                        onChange={(e) => setExtraFees({ ...extraFees, arReceipt: Number(e.target.value) })}
                                        className="h-12 text-base font-mono bg-background"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="fee-cod" className="label-mono block mb-1.5">
                                        COD Fixed Service Fee (LKR)
                                    </label>
                                    <Input
                                        id="fee-cod"
                                        type="number"
                                        value={extraFees.cod}
                                        onChange={(e) => setExtraFees({ ...extraFees, cod: Number(e.target.value) })}
                                        className="h-12 text-base font-mono bg-background"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="fee-vpp" className="label-mono block mb-1.5">
                                        VPP Service Fee (LKR)
                                    </label>
                                    <Input
                                        id="fee-vpp"
                                        type="number"
                                        value={extraFees.vpp ?? 50}
                                        onChange={(e) => setExtraFees({ ...extraFees, vpp: Number(e.target.value) })}
                                        className="h-12 text-base font-mono bg-background"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="fee-postcard" className="label-mono block mb-1.5">
                                        Postcard Flat Rate (LKR)
                                    </label>
                                    <Input
                                        id="fee-postcard"
                                        type="number"
                                        value={extraFees.postcard ?? 40}
                                        onChange={(e) => setExtraFees({ ...extraFees, postcard: Number(e.target.value) })}
                                        className="h-12 text-base font-mono bg-background"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            <ConfirmDialog
                open={confirmDefaultsOpen}
                onOpenChange={setConfirmDefaultsOpen}
                title="Load Official 2026 SL Post Defaults"
                description="Replace current Domestic, EMS, Country Mapping, and Extra Fee settings in the database with the built-in Feb 9, 2026 tariff tables?"
                confirmLabel="Load & Save Defaults"
                loading={saving}
                onConfirm={handleLoadOfficialDefaults}
            />
        </div>
    );
}
