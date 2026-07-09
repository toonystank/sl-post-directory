"use client";

import { useState, useEffect } from "react";
import { Save, Plus, Trash2, ChevronDown, ChevronRight, Calculator, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription as DialogDesc } from "@/components/ui/dialog";
import { PostalService, EmsZone, EmsCountry, ExtraFees, WeightTier } from "@/lib/rate-types";

export default function PostageRateManager() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // States for JSON config
    const [domesticServices, setDomesticServices] = useState<PostalService[]>([]);
    const [emsZones, setEmsZones] = useState<EmsZone[]>([]);
    const [emsCountries, setEmsCountries] = useState<EmsCountry[]>([]);
    const [extraFees, setExtraFees] = useState<ExtraFees>({ registeredPost: 0, cod: 0 });

    const [activeTab, setActiveTab] = useState<"domestic" | "ems_zones" | "ems_countries" | "extra">("domestic");
    const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        if (isModalOpen && domesticServices.length === 0) {
            fetchRates();
        }
    }, [isModalOpen]);

    const fetchRates = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/admin/variables");
            if (res.ok) {
                const vars = await res.json();
                vars.forEach((v: any) => {
                    if (v.key === "rates_domestic_services") setDomesticServices(JSON.parse(v.value));
                    if (v.key === "rates_ems_zones") setEmsZones(JSON.parse(v.value));
                    if (v.key === "rates_ems_countries") setEmsCountries(JSON.parse(v.value));
                    if (v.key === "rates_extra_fees") setExtraFees(JSON.parse(v.value));
                });
            }
        } catch (error) {
            console.error("Failed to load rates:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (key: string, value: any) => {
        setSaving(true);
        try {
            await fetch("/api/admin/variables", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key, value: JSON.stringify(value, null, 2), description: "Managed by Rate Editor" })
            });
        } catch (error) {
            alert("Failed to save rates");
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
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Calculator className="w-5 h-5 text-primary" />
                            Postal Rates Manager
                        </DialogTitle>
                        <DialogDesc>Configure dynamic pricing for all postal services.</DialogDesc>
                        <div className="flex gap-2 pt-4 overflow-x-auto pb-1 mt-2">
                            <button onClick={() => setActiveTab("domestic")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'domestic' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>Domestic Services</button>
                            <button onClick={() => setActiveTab("ems_zones")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'ems_zones' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>EMS Zones</button>
                            <button onClick={() => setActiveTab("ems_countries")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'ems_countries' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>EMS Countries</button>
                            <button onClick={() => setActiveTab("extra")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'extra' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>Extra Fees</button>
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
                                            <Button onClick={() => handleSave("rates_domestic_services", domesticServices)} disabled={saving} size="sm">
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
                                                                newS[sIdx].name = e.target.value;
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
                                                                            newS[sIdx].tiers[tIdx].maxWeight = Number(e.target.value);
                                                                            setDomesticServices(newS);
                                                                        }}
                                                                    />
                                                                    <Input 
                                                                        type="number" 
                                                                        value={tier.price}
                                                                        onChange={(e) => {
                                                                            const newS = [...domesticServices];
                                                                            newS[sIdx].tiers[tIdx].price = Number(e.target.value);
                                                                            setDomesticServices(newS);
                                                                        }}
                                                                    />
                                                                    <Button variant="ghost" size="icon" onClick={() => {
                                                                        const newS = [...domesticServices];
                                                                        newS[sIdx].tiers.splice(tIdx, 1);
                                                                        setDomesticServices(newS);
                                                                    }} className="text-destructive hover:bg-destructive/10 shrink-0">
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <Button variant="outline" size="sm" className="mt-4 w-full border-dashed" onClick={() => {
                                                            const newS = [...domesticServices];
                                                            const lastTier = newS[sIdx].tiers[newS[sIdx].tiers.length - 1];
                                                            newS[sIdx].tiers.push({ maxWeight: (lastTier?.maxWeight || 0) + 100, price: (lastTier?.price || 0) + 10 });
                                                            setDomesticServices(newS);
                                                        }}>
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
                                            <Button onClick={() => handleSave("rates_ems_zones", emsZones)} disabled={saving} size="sm">
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
                                                                newZ[zIdx].name = e.target.value;
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
                                                                            newZ[zIdx].tiers[tIdx].maxWeight = Number(e.target.value);
                                                                            setEmsZones(newZ);
                                                                        }}
                                                                    />
                                                                    <Input 
                                                                        type="number" 
                                                                        value={tier.price}
                                                                        onChange={(e) => {
                                                                            const newZ = [...emsZones];
                                                                            newZ[zIdx].tiers[tIdx].price = Number(e.target.value);
                                                                            setEmsZones(newZ);
                                                                        }}
                                                                    />
                                                                    <Button variant="ghost" size="icon" onClick={() => {
                                                                        const newZ = [...emsZones];
                                                                        newZ[zIdx].tiers.splice(tIdx, 1);
                                                                        setEmsZones(newZ);
                                                                    }} className="text-destructive hover:bg-destructive/10 shrink-0">
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <Button variant="outline" size="sm" className="mt-4 w-full border-dashed" onClick={() => {
                                                            const newZ = [...emsZones];
                                                            const lastTier = newZ[zIdx].tiers[newZ[zIdx].tiers.length - 1];
                                                            newZ[zIdx].tiers.push({ maxWeight: (lastTier?.maxWeight || 0) + 100, price: (lastTier?.price || 0) + 10 });
                                                            setEmsZones(newZ);
                                                        }}>
                                                            <Plus className="w-4 h-4 mr-2" /> Add Tier
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        <Button variant="outline" className="w-full border-dashed bg-card" onClick={() => {
                                            setEmsZones([...emsZones, { id: `zone${Date.now()}`, name: "New Zone", tiers: [{ maxWeight: 500, price: 1000 }] }]);
                                        }}>
                                            <Plus className="w-4 h-4 mr-2" /> Add New Zone
                                        </Button>
                                    </div>
                                )}

                                {activeTab === "ems_countries" && (
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-semibold text-lg">Manage EMS Countries</h3>
                                            <Button onClick={() => handleSave("rates_ems_countries", emsCountries)} disabled={saving} size="sm">
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
                                                            newC[cIdx].code = e.target.value.toUpperCase();
                                                            setEmsCountries(newC);
                                                        }}
                                                        placeholder="e.g. US"
                                                    />
                                                    <Input 
                                                        value={country.name}
                                                        onChange={(e) => {
                                                            const newC = [...emsCountries];
                                                            newC[cIdx].name = e.target.value;
                                                            setEmsCountries(newC);
                                                        }}
                                                        placeholder="Country Name"
                                                    />
                                                    <select 
                                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                        value={country.zoneId}
                                                        onChange={(e) => {
                                                            const newC = [...emsCountries];
                                                            newC[cIdx].zoneId = e.target.value;
                                                            setEmsCountries(newC);
                                                        }}
                                                    >
                                                        {emsZones.map(z => (
                                                            <option key={z.id} value={z.id}>{z.name}</option>
                                                        ))}
                                                    </select>
                                                    <Button variant="ghost" size="icon" onClick={() => {
                                                        const newC = [...emsCountries];
                                                        newC.splice(cIdx, 1);
                                                        setEmsCountries(newC);
                                                    }} className="text-destructive hover:bg-destructive/10 shrink-0">
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                        <Button variant="outline" className="w-full border-dashed bg-card" onClick={() => {
                                            setEmsCountries([...emsCountries, { code: "", name: "", zoneId: emsZones[0]?.id || "" }]);
                                        }}>
                                            <Plus className="w-4 h-4 mr-2" /> Add Country
                                        </Button>
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
