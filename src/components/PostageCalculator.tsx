"use client";

import { useState, useEffect } from "react";
import { Package, Globe, MapPin, Calculator, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { calculatePostage, type Destination, type PostageResult, type RateConfig } from "@/lib/postage-rates";

export default function PostageCalculator() {
    const [config, setConfig] = useState<RateConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [destination, setDestination] = useState<Destination>("domestic");
    const [serviceId, setServiceId] = useState<string>("oletter"); // Domestic Service ID or EMS Country Code
    const [weight, setWeight] = useState<string>("20");
    const [registered, setRegistered] = useState(false);
    const [cod, setCod] = useState(false);
    const [result, setResult] = useState<PostageResult | null>(null);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                // In a real app we might fetch this from a public API endpoint, 
                // but for now we'll simulate fetching it the same way the admin does 
                // or just rely on server-side rendering for the actual public page.
                // Since this component is client-side, we need an API. Let's fetch from the admin API for now (assuming it's public readable, or we create a public route).
                // Let's create a public API route or just use the admin one if no auth check on GET.
                const res = await fetch("/api/admin/variables");
                if (res.ok) {
                    const vars = await res.json();
                    const newConfig: RateConfig = { domesticServices: [], emsZones: [], emsCountries: [], extraFees: { registeredPost: 0, cod: 0 } };
                    vars.forEach((v: any) => {
                        if (v.key === "rates_domestic_services") newConfig.domesticServices = JSON.parse(v.value);
                        if (v.key === "rates_ems_zones") newConfig.emsZones = JSON.parse(v.value);
                        if (v.key === "rates_ems_countries") newConfig.emsCountries = JSON.parse(v.value);
                        if (v.key === "rates_extra_fees") newConfig.extraFees = JSON.parse(v.value);
                    });
                    setConfig(newConfig);
                    // Set default serviceId based on loaded config
                    if (newConfig.domesticServices.length > 0) {
                        setServiceId(newConfig.domesticServices[0].id);
                    }
                }
            } catch (e) {
                console.error("Failed to load rates config", e);
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

    if (loading || !config) {
        return <div className="text-center py-10 animate-pulse text-muted-foreground">Loading calculator...</div>;
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            {/* Destination */}
            <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                    Destination
                </label>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => handleDestinationChange("domestic")}
                        className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200 flex items-center gap-2 ${
                            destination === "domestic"
                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                : "bg-card border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border"
                        }`}
                    >
                        <MapPin className="w-4 h-4" />
                        Domestic
                    </button>
                    <button
                        onClick={() => handleDestinationChange("ems")}
                        className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200 flex items-center gap-2 ${
                            destination === "ems"
                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                : "bg-card border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border"
                        }`}
                    >
                        <Globe className="w-4 h-4" />
                        EMS (International)
                    </button>
                </div>
            </div>

            {/* Service / Country Selection */}
            <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                    {destination === "domestic" ? "Postal Service" : "Destination Country"}
                </label>
                {destination === "domestic" ? (
                    <div className="flex flex-wrap gap-2">
                        {config.domesticServices.map((s) => (
                            <button
                                key={s.id}
                                onClick={() => { setServiceId(s.id); setResult(null); }}
                                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200 flex items-center gap-2 ${
                                    serviceId === s.id
                                        ? "bg-secondary text-secondary-foreground border-secondary shadow-sm"
                                        : "bg-card border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border"
                                }`}
                            >
                                <Package className="w-4 h-4" />
                                {s.name}
                            </button>
                        ))}
                    </div>
                ) : (
                    <select
                        value={serviceId}
                        onChange={(e) => { setServiceId(e.target.value); setResult(null); }}
                        className="flex h-12 w-full items-center justify-between rounded-xl border border-input bg-background px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {config.emsCountries.sort((a,b) => a.name.localeCompare(b.name)).map(c => (
                            <option key={c.code} value={c.code}>{c.name}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Weight */}
            <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                    Weight (grams)
                </label>
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <Scale className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            type="number"
                            value={weight}
                            onChange={(e) => { setWeight(e.target.value); setResult(null); }}
                            min={1}
                            className="pl-10 rounded-xl py-5"
                            placeholder="Enter weight in grams"
                        />
                    </div>
                </div>
            </div>

            {/* Extra Options (Domestic only) */}
            {destination === "domestic" && (
                <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="registered"
                            checked={registered}
                            onChange={(e) => { setRegistered(e.target.checked); setResult(null); }}
                            className="w-5 h-5 rounded border-border accent-primary"
                        />
                        <label htmlFor="registered" className="text-sm font-medium cursor-pointer">
                            Registered mail (+LKR {config.extraFees.registeredPost})
                        </label>
                    </div>
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="cod"
                            checked={cod}
                            onChange={(e) => { setCod(e.target.checked); setResult(null); }}
                            className="w-5 h-5 rounded border-border accent-primary"
                        />
                        <label htmlFor="cod" className="text-sm font-medium cursor-pointer">
                            Cash on Delivery (COD) (+LKR {config.extraFees.cod})
                        </label>
                    </div>
                </div>
            )}

            {/* Calculate Button */}
            <Button onClick={handleCalculate} size="lg" className="w-full rounded-xl py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all">
                <Calculator className="w-5 h-5 mr-2" />
                Calculate Postage
            </Button>

            {/* Result */}
            {result && (
                <Card className={`border-2 ${result.error ? "border-destructive/30 bg-destructive/5" : "border-primary/30 bg-primary/5"} rounded-2xl overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-4`}>
                    <CardContent className="p-8">
                        {result.error ? (
                            <div className="flex flex-col items-center text-center space-y-2">
                                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mb-2">
                                    <Package className="w-6 h-6" />
                                </div>
                                <p className="text-destructive font-medium text-lg">{result.error}</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="text-center">
                                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-2">Total Estimated Cost</p>
                                    <p className="text-5xl font-extrabold tracking-tight text-primary">
                                        <span className="text-2xl mr-1 text-primary/70">LKR</span>{result.totalCost.toLocaleString()}
                                    </p>
                                </div>
                                <div className="pt-6 border-t border-border/50 space-y-3 text-sm">
                                    <div className="flex justify-between items-center p-2 rounded-lg hover:bg-muted/50 transition-colors">
                                        <span className="text-muted-foreground font-medium">Base postage ({result.tierLabel})</span>
                                        <span className="font-semibold text-foreground">LKR {result.baseCost.toLocaleString()}</span>
                                    </div>
                                    {result.registrationFee > 0 && (
                                        <div className="flex justify-between items-center p-2 rounded-lg hover:bg-muted/50 transition-colors">
                                            <span className="text-muted-foreground font-medium">Registration fee</span>
                                            <span className="font-semibold text-foreground">LKR {result.registrationFee.toLocaleString()}</span>
                                        </div>
                                    )}
                                    {result.codFee > 0 && (
                                        <div className="flex justify-between items-center p-2 rounded-lg hover:bg-muted/50 transition-colors">
                                            <span className="text-muted-foreground font-medium">COD fee</span>
                                            <span className="font-semibold text-foreground">LKR {result.codFee.toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
