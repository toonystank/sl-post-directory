"use client";

import { useState, useEffect } from "react";
import { Package, Globe, MapPin, Calculator, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Postmark from "@/components/brand/Postmark";
import { calculatePostage, type Destination, type PostageResult, type RateConfig } from "@/lib/postage-rates";

const FALLBACK_CONFIG: RateConfig = {
    domesticServices: [
        {
            id: "oletter",
            name: "Ordinary Letter",
            tiers: [
                { maxWeight: 20, price: 50 },
                { maxWeight: 50, price: 65 },
                { maxWeight: 100, price: 85 },
                { maxWeight: 250, price: 130 },
                { maxWeight: 500, price: 200 },
                { maxWeight: 1000, price: 320 },
                { maxWeight: 2000, price: 500 },
            ],
        },
        {
            id: "sp",
            name: "SLP Courier",
            tiers: [
                { maxWeight: 250, price: 300 },
                { maxWeight: 500, price: 400 },
                { maxWeight: 1000, price: 500 },
                { maxWeight: 2000, price: 700 },
                { maxWeight: 5000, price: 1200 },
                { maxWeight: 10000, price: 2000 },
            ],
        },
        {
            id: "dparcel",
            name: "Domestic Parcel",
            tiers: [
                { maxWeight: 500, price: 250 },
                { maxWeight: 1000, price: 350 },
                { maxWeight: 2000, price: 500 },
                { maxWeight: 5000, price: 900 },
                { maxWeight: 10000, price: 1600 },
            ],
        },
    ],
    emsZones: [
        { id: "zone_a", name: "Zone A - South Asia", tiers: [{ maxWeight: 250, price: 4200 }, { maxWeight: 500, price: 5400 }, { maxWeight: 1000, price: 7800 }, { maxWeight: 2000, price: 12000 }] },
        { id: "zone_b", name: "Zone B - Middle East & SE Asia", tiers: [{ maxWeight: 250, price: 4800 }, { maxWeight: 500, price: 6200 }, { maxWeight: 1000, price: 9000 }, { maxWeight: 2000, price: 14500 }] },
        { id: "zone_c", name: "Zone C - Europe & UK", tiers: [{ maxWeight: 250, price: 5800 }, { maxWeight: 500, price: 7500 }, { maxWeight: 1000, price: 11200 }, { maxWeight: 2000, price: 18500 }] },
        { id: "zone_d", name: "Zone D - Americas & Oceania", tiers: [{ maxWeight: 250, price: 6500 }, { maxWeight: 500, price: 8500 }, { maxWeight: 1000, price: 12800 }, { maxWeight: 2000, price: 21000 }] },
    ],
    emsCountries: [
        { code: "IN", name: "India", zoneId: "zone_a" },
        { code: "AE", name: "United Arab Emirates", zoneId: "zone_b" },
        { code: "SG", name: "Singapore", zoneId: "zone_b" },
        { code: "GB", name: "United Kingdom", zoneId: "zone_c" },
        { code: "AU", name: "Australia", zoneId: "zone_d" },
        { code: "US", name: "United States", zoneId: "zone_d" },
    ],
    extraFees: { registeredPost: 60, cod: 100 },
};

export default function PostageCalculator() {
    const [config, setConfig] = useState<RateConfig>(FALLBACK_CONFIG);
    const [loading, setLoading] = useState(true);
    const [destination, setDestination] = useState<Destination>("domestic");
    const [serviceId, setServiceId] = useState<string>("oletter");
    const [weight, setWeight] = useState<string>("20");
    const [registered, setRegistered] = useState(false);
    const [cod, setCod] = useState(false);
    const [result, setResult] = useState<PostageResult | null>(null);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await fetch("/api/admin/variables");
                if (res.ok) {
                    const vars = await res.json();
                    const newConfig: RateConfig = { domesticServices: [], emsZones: [], emsCountries: [], extraFees: { registeredPost: 0, cod: 0 } };
                    vars.forEach((v: { key: string; value: string }) => {
                        if (v.key === "rates_domestic_services") newConfig.domesticServices = JSON.parse(v.value);
                        if (v.key === "rates_ems_zones") newConfig.emsZones = JSON.parse(v.value);
                        if (v.key === "rates_ems_countries") newConfig.emsCountries = JSON.parse(v.value);
                        if (v.key === "rates_extra_fees") newConfig.extraFees = JSON.parse(v.value);
                    });
                    if (newConfig.domesticServices.length > 0) {
                        setConfig(newConfig);
                        setServiceId(newConfig.domesticServices[0].id);
                    } else {
                        setConfig(FALLBACK_CONFIG);
                        setServiceId(FALLBACK_CONFIG.domesticServices[0].id);
                    }
                } else {
                    setConfig(FALLBACK_CONFIG);
                    setServiceId(FALLBACK_CONFIG.domesticServices[0].id);
                }
            } catch (e) {
                console.error("Failed to load rates config", e);
                setConfig(FALLBACK_CONFIG);
                setServiceId(FALLBACK_CONFIG.domesticServices[0].id);
            } finally {
                setLoading(false);
            }
        };
        fetchConfig();
    }, []);

    const handleCalculate = () => {
        if (!config) return;
        const w = parseInt(weight) || 0;
        const res = calculatePostage(config, destination, serviceId, w, registered, cod);
        setResult(res);
    };

    const handleDestinationChange = (d: Destination) => {
        setDestination(d);
        if (config) {
            if (d === "domestic" && config.domesticServices.length > 0) {
                setServiceId(config.domesticServices[0].id);
            } else if (d === "ems" && config.emsCountries.length > 0) {
                setServiceId(config.emsCountries[0].code);
            }
        }
        setResult(null);
    };

    if (loading) {
        return <div className="max-w-2xl mx-auto py-10 text-center font-mono text-sm animate-pulse text-muted-foreground">Loading calculator...</div>;
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Destination */}
            <div>
                <span className="label-mono block mb-2.5">Destination</span>
                <div role="radiogroup" aria-label="Destination" className="inline-flex rounded-md border-2 border-foreground p-0.5 bg-card">
                    <button
                        type="button"
                        role="radio"
                        aria-checked={destination === "domestic"}
                        onClick={() => handleDestinationChange("domestic")}
                        className={`tap inline-flex items-center gap-2 rounded-[4px] px-4 py-2 text-sm font-semibold transition-colors ${
                            destination === "domestic"
                                ? "bg-foreground text-background"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <MapPin className="w-4 h-4" />
                        Domestic
                    </button>
                    <button
                        type="button"
                        role="radio"
                        aria-checked={destination === "ems"}
                        onClick={() => handleDestinationChange("ems")}
                        className={`tap inline-flex items-center gap-2 rounded-[4px] px-4 py-2 text-sm font-semibold transition-colors ${
                            destination === "ems"
                                ? "bg-foreground text-background"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <Globe className="w-4 h-4" />
                        EMS (International)
                    </button>
                </div>
            </div>

            {/* Service / Country Selection */}
            <div>
                <label htmlFor={destination === "ems" ? "ems-country" : undefined} className="label-mono block mb-2.5">
                    {destination === "domestic" ? "Postal Service" : "Destination Country"}
                </label>
                {destination === "domestic" ? (
                    <div className="flex flex-wrap gap-2">
                        {config.domesticServices.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => { setServiceId(s.id); setResult(null); }}
                                aria-pressed={serviceId === s.id}
                                className={`tap inline-flex items-center gap-2 rounded-md border-[1.5px] px-3.5 py-2 text-sm font-semibold transition-colors ${
                                    serviceId === s.id
                                        ? "border-foreground bg-secondary text-secondary-foreground shadow-[0_2px_0_0_hsl(var(--foreground))]"
                                        : "border-border bg-card hover:border-foreground/50"
                                }`}
                            >
                                <Package className="w-4 h-4" />
                                {s.name}
                            </button>
                        ))}
                    </div>
                ) : (
                    <select
                        id="ems-country"
                        value={serviceId}
                        onChange={(e) => { setServiceId(e.target.value); setResult(null); }}
                        className="h-11 w-full rounded-md border-[1.5px] border-input bg-card px-3 text-base focus-visible:outline-none focus-visible:border-foreground focus-visible:ring-[3px] focus-visible:ring-primary/25"
                    >
                        {[...config.emsCountries].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                            <option key={c.code} value={c.code}>{c.name}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Weight */}
            <div>
                <label htmlFor="parcel-weight" className="label-mono block mb-2.5">
                    Weight (grams)
                </label>
                <div className="relative">
                    <Scale className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        id="parcel-weight"
                        type="number"
                        value={weight}
                        onChange={(e) => { setWeight(e.target.value); setResult(null); }}
                        min={1}
                        className="h-12 pl-10 font-mono text-lg"
                        placeholder="Enter weight in grams"
                    />
                </div>
            </div>

            {/* Extra Options (Domestic only) */}
            {destination === "domestic" && (
                <div className="flex flex-wrap items-center gap-6">
                    <label htmlFor="registered" className="flex items-center gap-2.5 text-sm font-medium cursor-pointer">
                        <input
                            type="checkbox"
                            id="registered"
                            checked={registered}
                            onChange={(e) => { setRegistered(e.target.checked); setResult(null); }}
                            className="w-4 h-4 rounded-sm border-foreground accent-primary"
                        />
                        <span>Registered mail (+LKR {config.extraFees.registeredPost})</span>
                    </label>
                    <label htmlFor="cod" className="flex items-center gap-2.5 text-sm font-medium cursor-pointer">
                        <input
                            type="checkbox"
                            id="cod"
                            checked={cod}
                            onChange={(e) => { setCod(e.target.checked); setResult(null); }}
                            className="w-4 h-4 rounded-sm border-foreground accent-primary"
                        />
                        <span>Cash on Delivery (COD) (+LKR {config.extraFees.cod})</span>
                    </label>
                </div>
            )}

            {/* Calculate Button */}
            <Button onClick={handleCalculate} size="lg" className="h-12 w-full text-base">
                <Calculator className="w-5 h-5 mr-2" />
                Calculate Postage
            </Button>

            {/* Result — Franking-label Receipt */}
            {result && (
                result.error ? (
                    <div className="rounded-md border-2 border-destructive bg-card p-6 text-center space-y-2">
                        <Package className="w-8 h-8 text-destructive mx-auto" />
                        <p className="text-destructive font-semibold">{result.error}</p>
                    </div>
                ) : (
                    <div className="rounded-md border-2 border-foreground bg-card overflow-hidden shadow-[4px_4px_0_0_hsl(var(--foreground))] animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="airmail-stripe h-1.5" aria-hidden="true" />
                        <div className="p-6">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="label-mono">Total Estimated Cost</p>
                                    <p className="font-mono text-4xl md:text-5xl font-semibold text-primary mt-1">
                                        LKR {result.totalCost.toLocaleString()}
                                    </p>
                                </div>
                                <Postmark code="PAID" size="sm" tone="red" rotate={-10} className="shrink-0" />
                            </div>

                            <div className="border-t-2 border-dashed border-foreground/30 pt-4 mt-4 space-y-2 font-mono text-sm">
                                <div className="flex justify-between items-center gap-4">
                                    <span className="text-muted-foreground">Base postage ({result.tierLabel})</span>
                                    <span className="font-semibold text-foreground">LKR {result.baseCost.toLocaleString()}</span>
                                </div>
                                {result.registrationFee > 0 && (
                                    <div className="flex justify-between items-center gap-4">
                                        <span className="text-muted-foreground">Registration fee</span>
                                        <span className="font-semibold text-foreground">LKR {result.registrationFee.toLocaleString()}</span>
                                    </div>
                                )}
                                {result.codFee > 0 && (
                                    <div className="flex justify-between items-center gap-4">
                                        <span className="text-muted-foreground">COD fee</span>
                                        <span className="font-semibold text-foreground">LKR {result.codFee.toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            )}
        </div>
    );
}
