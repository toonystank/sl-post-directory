"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Save, Plus, Trash2, ChevronDown, ChevronRight, Calculator, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription as DialogDesc } from "@/components/ui/dialog";
import { PostalService, EmsZone, EmsCountry, ExtraFees } from "@/lib/rate-types";
import { DEFAULT_RATE_CONFIG, mergeWithDefaultConfig, type RateConfig } from "@/lib/postage-rates";

export default function PostageRateManager() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [domesticServices, setDomesticServices] = useState<PostalService[]>([]);
    const [emsZones, setEmsZones] = useState<EmsZone[]>([]);
    const [emsCountries, setEmsCountries] = useState<EmsCountry[]>([]);
    const [extraFees, setExtraFees] = useState<ExtraFees>(DEFAULT_RATE_CONFIG.extraFees);

    const [activeTab, setActiveTab] = useState<"domestic" | "ems_zones" | "ems_countries" | "extra">("domestic");
    const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const hasFetchedRef = useRef(false);

    const fetchRates = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/admin/variables");
            if (res.ok) {
                const vars = await res.json();
                const loaded: Partial<RateConfig> = {};
                vars.forEach((v: { key: string; value: string }) => {
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
                hasFetchedRef.current = true;
            }
        } catch (error) {
            console.error("Failed to load rates:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isModalOpen && !hasFetchedRef.current) {
            fetchRates();
        }
    }, [isModalOpen, fetchRates]);

    const handleSave = async (key: string, value: unknown) => {
        setSaving(true);
        try {
            await fetch("/api/admin/variables", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key, value: JSON.stringify(value, null, 2), description: "Managed by Rate Editor" }),
            });
        } catch (error) {
            console.error(error);
            alert("Failed to save rates");
        } finally {
            setSaving(false);
        }
    };

    const handleLoadOfficialDefaults = async () => {
        if (!confirm("Load official Feb 9, 2026 SL Post default rates and save to database?")) return;
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
        } catch (error) {
            console.error(error);
            alert("Failed to save official defaults");
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <Card className="border-border/50 overflow-hidden">
                <CardHeader className="border-b border-border/40 bg-card/80 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            Postal Rates
                        </CardTitle>
                        <CardDescription className="text-sm mt-1">Configure dynamic pricing for all postal services.</CardDescription>
                    </div>
                    <Button onClick={() => setIsModalOpen(true)} className="gap-2 rounded-xl h-10">
                        <Calculator className="w-4 h-4" /> Manage Rates
                    </Button>
                </CardHeader>
            </Card>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-[90vw] lg:max-w-[80vw] max-h-[90vh] overflow-hidden p-0 border-border/50 bg-card flex flex-col">
                    <DialogHeader className="p-6 border-b border-border/40 bg-card/80 flex-shrink-0">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-8">
                            <div>
                                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                    <Calculator className="w-5 h-5 text-primary" />
                                    Postal Rates Manager
                                </DialogTitle>
                                <DialogDesc>Configure dynamic pricing for all postal services.</DialogDesc>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleLoadOfficialDefaults}
                                disabled={saving}
                                className="gap-2 self-start sm:self-auto"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Load 2026 Official Defaults
                            </Button>
                        </div>
                        <div className="flex gap-2 pt-4 overflow-x-auto pb-1 mt-2">
                            <button type="button" onClick={() => setActiveTab("domestic")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "domestic" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>Domestic Services</button>
                            <button type="button" onClick={() => setActiveTab("ems_zones")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "ems_zones" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>EMS Zones</button>
                            <button type="button" onClick={() => setActiveTab("ems_countries")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "ems_countries" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>EMS Countries</button>
                            <button type="button" onClick={() => setActiveTab("extra")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "extra" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>Extra Fees</button>
                        </div>
                    </DialogHeader>

                    <div className="p-6 overflow-y-auto flex-1 bg-muted/10">
                        {loading ? (
                            <div className="text-center py-10 text-muted-foreground animate-pulse">Loading rate configuration...</div>
                        ) : (
                            <>
                                {/* DOMESTIC SERVICES TAB */}
                                {activeTab === "domestic" && (
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-semibold text-lg">Manage Domestic Tiers</h3>
                                            <Button type="button" onClick={() => handleSave("rates_domestic_services", domesticServices)} disabled={saving} size="sm">
                                                {saving ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
                                            </Button>
                                        </div>
                                        {domesticServices.map((service, sIdx) => (
                                            <div key={service.id} className="border border-border/50 rounded-xl overflow-hidden bg-card">
                                                <div
                                                    className="bg-muted/30 p-4 flex justify-between items-center cursor-pointer hover:bg-muted/50 transition-colors"
                                                    onClick={() => setExpandedServiceId(expandedServiceId === service.id ? null : service.id)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {expandedServiceId === service.id ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                                                        <Input
                                                            value={service.name}
                                                            onChange={(e) => {
                                                                const newS = [...domesticServices];
                                                                newS[sIdx] = { ...newS[sIdx], name: e.target.value };
                                                                setDomesticServices(newS);
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="w-64 bg-background h-8 font-medium"
                                                        />
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">{service.tiers.length} Tiers</div>
                                                </div>

                                                {expandedServiceId === service.id && (
                                                    <div className="p-4 bg-background border-t border-border/50">
                                                        <div className="grid grid-cols-2 gap-4 mb-2 text-xs font-semibold uppercase text-muted-foreground px-2">
                                                            <div>Max Weight (grams)</div>
                                                            <div>Price (LKR)</div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            {service.tiers.map((tier, tIdx) => (
                                                                <div key={tIdx} className="flex items-center gap-4">
                                                                    <Input
                                                                        type="number"
                                                                        value={tier.maxWeight}
                                                                        onChange={(e) => {
                                                                            const newS = [...domesticServices];
                                                                            const nextTiers = [...newS[sIdx].tiers];
                                                                            nextTiers[tIdx] = { ...nextTiers[tIdx], maxWeight: Number(e.target.value) };
                                                                            newS[sIdx] = { ...newS[sIdx], tiers: nextTiers };
                                                                            setDomesticServices(newS);
                                                                        }}
                                                                    />
                                                                    <Input
                                                                        type="number"
                                                                        value={tier.price}
                                                                        onChange={(e) => {
                                                                            const newS = [...domesticServices];
                                                                            const nextTiers = [...newS[sIdx].tiers];
                                                                            nextTiers[tIdx] = { ...nextTiers[tIdx], price: Number(e.target.value) };
                                                                            newS[sIdx] = { ...newS[sIdx], tiers: nextTiers };
                                                                            setDomesticServices(newS);
                                                                        }}
                                                                    />
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => {
                                                                            const newS = [...domesticServices];
                                                                            const nextTiers = [...newS[sIdx].tiers];
                                                                            nextTiers.splice(tIdx, 1);
                                                                            newS[sIdx] = { ...newS[sIdx], tiers: nextTiers };
                                                                            setDomesticServices(newS);
                                                                        }}
                                                                        className="text-destructive hover:bg-destructive/10 shrink-0"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="mt-4 w-full border-dashed"
                                                            onClick={() => {
                                                                const newS = [...domesticServices];
                                                                const lastTier = newS[sIdx].tiers[newS[sIdx].tiers.length - 1];
                                                                newS[sIdx] = {
                                                                    ...newS[sIdx],
                                                                    tiers: [
                                                                        ...newS[sIdx].tiers,
                                                                        { maxWeight: (lastTier?.maxWeight || 0) + 100, price: (lastTier?.price || 0) + 10 },
                                                                    ],
                                                                };
                                                                setDomesticServices(newS);
                                                            }}
                                                        >
                                                            <Plus className="w-4 h-4 mr-2" /> Add Tier
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {activeTab === "ems_zones" && (
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-semibold text-lg">Manage EMS Zones</h3>
                                            <Button type="button" onClick={() => handleSave("rates_ems_zones", emsZones)} disabled={saving} size="sm">
                                                {saving ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
                                            </Button>
                                        </div>
                                        {emsZones.map((zone, zIdx) => (
                                            <div key={zone.id} className="border border-border/50 rounded-xl overflow-hidden bg-card">
                                                <div
                                                    className="bg-muted/30 p-4 flex justify-between items-center cursor-pointer hover:bg-muted/50 transition-colors"
                                                    onClick={() => setExpandedServiceId(expandedServiceId === zone.id ? null : zone.id)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {expandedServiceId === zone.id ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                                                        <Input
                                                            value={zone.name}
                                                            onChange={(e) => {
                                                                const newZ = [...emsZones];
                                                                newZ[zIdx] = { ...newZ[zIdx], name: e.target.value };
                                                                setEmsZones(newZ);
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="w-64 bg-background h-8 font-medium"
                                                        />
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">{zone.tiers.length} Tiers</div>
                                                </div>

                                                {expandedServiceId === zone.id && (
                                                    <div className="p-4 bg-background border-t border-border/50">
                                                        <div className="grid grid-cols-2 gap-4 mb-2 text-xs font-semibold uppercase text-muted-foreground px-2">
                                                            <div>Max Weight (grams)</div>
                                                            <div>Price (LKR)</div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            {zone.tiers.map((tier, tIdx) => (
                                                                <div key={tIdx} className="flex items-center gap-4">
                                                                    <Input
                                                                        type="number"
                                                                        value={tier.maxWeight}
                                                                        onChange={(e) => {
                                                                            const newZ = [...emsZones];
                                                                            const nextTiers = [...newZ[zIdx].tiers];
                                                                            nextTiers[tIdx] = { ...nextTiers[tIdx], maxWeight: Number(e.target.value) };
                                                                            newZ[zIdx] = { ...newZ[zIdx], tiers: nextTiers };
                                                                            setEmsZones(newZ);
                                                                        }}
                                                                    />
                                                                    <Input
                                                                        type="number"
                                                                        value={tier.price}
                                                                        onChange={(e) => {
                                                                            const newZ = [...emsZones];
                                                                            const nextTiers = [...newZ[zIdx].tiers];
                                                                            nextTiers[tIdx] = { ...nextTiers[tIdx], price: Number(e.target.value) };
                                                                            newZ[zIdx] = { ...newZ[zIdx], tiers: nextTiers };
                                                                            setEmsZones(newZ);
                                                                        }}
                                                                    />
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => {
                                                                            const newZ = [...emsZones];
                                                                            const nextTiers = [...newZ[zIdx].tiers];
                                                                            nextTiers.splice(tIdx, 1);
                                                                            newZ[zIdx] = { ...newZ[zIdx], tiers: nextTiers };
                                                                            setEmsZones(newZ);
                                                                        }}
                                                                        className="text-destructive hover:bg-destructive/10 shrink-0"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="mt-4 w-full border-dashed"
                                                            onClick={() => {
                                                                const newZ = [...emsZones];
                                                                const lastTier = newZ[zIdx].tiers[newZ[zIdx].tiers.length - 1];
                                                                newZ[zIdx] = {
                                                                    ...newZ[zIdx],
                                                                    tiers: [
                                                                        ...newZ[zIdx].tiers,
                                                                        { maxWeight: (lastTier?.maxWeight || 0) + 100, price: (lastTier?.price || 0) + 10 },
                                                                    ],
                                                                };
                                                                setEmsZones(newZ);
                                                            }}
                                                        >
                                                            <Plus className="w-4 h-4 mr-2" /> Add Tier
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="w-full border-dashed bg-card"
                                            onClick={() => {
                                                setEmsZones([...emsZones, { id: `zone${Date.now()}`, name: "New Zone", tiers: [{ maxWeight: 500, price: 1000 }] }]);
                                            }}
                                        >
                                            <Plus className="w-4 h-4 mr-2" /> Add New Zone
                                        </Button>
                                    </div>
                                )}

                                {activeTab === "ems_countries" && (
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-semibold text-lg">Manage EMS Countries</h3>
                                            <Button type="button" onClick={() => handleSave("rates_ems_countries", emsCountries)} disabled={saving} size="sm">
                                                {saving ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
                                            </Button>
                                        </div>
                                        <div className="grid grid-cols-[100px_1fr_150px_auto] gap-4 mb-2 text-xs font-semibold uppercase text-muted-foreground px-2">
                                            <div>Code (ISO)</div>
                                            <div>Country Name</div>
                                            <div>Zone Mapping</div>
                                            <div></div>
                                        </div>
                                        <div className="space-y-2">
                                            {emsCountries.map((country, cIdx) => (
                                                <div key={cIdx} className="grid grid-cols-[100px_1fr_150px_auto] items-center gap-4 border border-border/50 p-2 rounded-lg bg-card">
                                                    <Input
                                                        value={country.code}
                                                        onChange={(e) => {
                                                            const newC = [...emsCountries];
                                                            newC[cIdx] = { ...newC[cIdx], code: e.target.value.toUpperCase() };
                                                            setEmsCountries(newC);
                                                        }}
                                                        placeholder="e.g. US"
                                                    />
                                                    <Input
                                                        value={country.name}
                                                        onChange={(e) => {
                                                            const newC = [...emsCountries];
                                                            newC[cIdx] = { ...newC[cIdx], name: e.target.value };
                                                            setEmsCountries(newC);
                                                        }}
                                                        placeholder="Country Name"
                                                    />
                                                    <select
                                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                                        value={country.zoneId}
                                                        onChange={(e) => {
                                                            const newC = [...emsCountries];
                                                            newC[cIdx] = { ...newC[cIdx], zoneId: e.target.value };
                                                            setEmsCountries(newC);
                                                        }}
                                                    >
                                                        {emsZones.map((z) => (
                                                            <option key={z.id} value={z.id}>{z.name}</option>
                                                        ))}
                                                    </select>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => {
                                                            const newC = [...emsCountries];
                                                            newC.splice(cIdx, 1);
                                                            setEmsCountries(newC);
                                                        }}
                                                        className="text-destructive hover:bg-destructive/10 shrink-0"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="w-full border-dashed bg-card"
                                            onClick={() => {
                                                setEmsCountries([...emsCountries, { code: "", name: "", zoneId: emsZones[0]?.id || "" }]);
                                            }}
                                        >
                                            <Plus className="w-4 h-4 mr-2" /> Add Country
                                        </Button>
                                    </div>
                                )}

                                {activeTab === "extra" && (
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-semibold text-lg">Manage Extra Fees & Surcharges</h3>
                                            <Button type="button" onClick={() => handleSave("rates_extra_fees", extraFees)} disabled={saving} size="sm">
                                                {saving ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
                                            </Button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-border/50 p-4 rounded-xl bg-card">
                                            <div>
                                                <label htmlFor="fee-registered" className="text-sm font-medium block mb-1.5">
                                                    Registered Post Fee (LKR)
                                                </label>
                                                <Input
                                                    id="fee-registered"
                                                    type="number"
                                                    value={extraFees.registeredPost}
                                                    onChange={(e) => setExtraFees({ ...extraFees, registeredPost: Number(e.target.value) })}
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="fee-foreign-registered" className="text-sm font-medium block mb-1.5">
                                                    Foreign Registered Post Fee (LKR)
                                                </label>
                                                <Input
                                                    id="fee-foreign-registered"
                                                    type="number"
                                                    value={extraFees.foreignRegisteredPost ?? 870}
                                                    onChange={(e) => setExtraFees({ ...extraFees, foreignRegisteredPost: Number(e.target.value) })}
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="fee-ar" className="text-sm font-medium block mb-1.5">
                                                    Acknowledgement Receipt / AR (LKR)
                                                </label>
                                                <Input
                                                    id="fee-ar"
                                                    type="number"
                                                    value={extraFees.arReceipt}
                                                    onChange={(e) => setExtraFees({ ...extraFees, arReceipt: Number(e.target.value) })}
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="fee-cod" className="text-sm font-medium block mb-1.5">
                                                    COD Fixed Service Fee (LKR)
                                                </label>
                                                <Input
                                                    id="fee-cod"
                                                    type="number"
                                                    value={extraFees.cod}
                                                    onChange={(e) => setExtraFees({ ...extraFees, cod: Number(e.target.value) })}
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="fee-vpp" className="text-sm font-medium block mb-1.5">
                                                    VPP Service Fee (LKR)
                                                </label>
                                                <Input
                                                    id="fee-vpp"
                                                    type="number"
                                                    value={extraFees.vpp ?? 50}
                                                    onChange={(e) => setExtraFees({ ...extraFees, vpp: Number(e.target.value) })}
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="fee-postcard" className="text-sm font-medium block mb-1.5">
                                                    Postcard Flat Rate (LKR)
                                                </label>
                                                <Input
                                                    id="fee-postcard"
                                                    type="number"
                                                    value={extraFees.postcard ?? 40}
                                                    onChange={(e) => setExtraFees({ ...extraFees, postcard: Number(e.target.value) })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
