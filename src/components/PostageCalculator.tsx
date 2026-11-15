"use client";

import { useState, useEffect, useId, useMemo } from "react";
import { Globe, MapPin, Banknote, Scale, AlertTriangle, Check, Plane, Ship, Info } from "lucide-react";
import Postmark from "@/components/brand/Postmark";
import {
    DEFAULT_RATE_CONFIG,
    calculateAllDomesticServices,
    calculateAllInternationalServices,
    calculateCodPostage,
    calculateInternationalService,
    calculatePostage,
    formatWeightLabel,
    mergeWithDefaultConfig,
    type Destination,
    type InternationalServiceId,
    type InternationalTransport,
    type RateConfig,
} from "@/lib/postage-rates";
import { cn } from "@/lib/utils";

const DOMESTIC_WEIGHT_PRESETS = [30, 100, 250, 500, 1000, 2000, 5000, 10000];
const COD_WEIGHT_PRESETS = [250, 500, 1000, 2000, 5000, 10000, 20000];
const INTL_WEIGHT_PRESETS = [20, 50, 100, 250, 500, 1000, 2000, 5000];
const COD_AMOUNT_PRESETS = [1000, 2500, 5000, 10000, 25000, 50000];

const MODE_OPTIONS: { id: Destination; label: string; icon: typeof MapPin }[] = [
    { id: "domestic", label: "Local", icon: MapPin },
    { id: "cod", label: "COD", icon: Banknote },
    { id: "ems", label: "International", icon: Globe },
];

function sanitizeDigits(value: string): string {
    return value.replace(/[^\d]/g, "");
}

function formatCompactAmount(amount: number): string {
    if (amount >= 1000) {
        const k = amount / 1000;
        return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
    }
    return String(amount);
}

export default function PostageCalculator() {
    const [config, setConfig] = useState<RateConfig>(DEFAULT_RATE_CONFIG);
    const [destination, setDestination] = useState<Destination>("domestic");
    const [serviceId, setServiceId] = useState<string>("letter");
    const [emsCountryCode, setEmsCountryCode] = useState<string>("GB");
    const [intlTransport, setIntlTransport] = useState<InternationalTransport>("air");
    const [intlServiceId, setIntlServiceId] = useState<InternationalServiceId>("air_letter");
    const [intlRegistered, setIntlRegistered] = useState(false);
    const [showCountryWhyNote, setShowCountryWhyNote] = useState(false);
    const [weight, setWeight] = useState<string>("30");
    const [codAmount, setCodAmount] = useState<string>("2500");
    const [registered, setRegistered] = useState(false);
    const [arReceipt, setArReceipt] = useState(false);

    const uid = useId();
    const weightInputId = `${uid}-weight`;
    const codAmountId = `${uid}-cod-amount`;
    const emsCountryId = `${uid}-ems-country`;
    const regCheckboxId = `${uid}-registered`;
    const arCheckboxId = `${uid}-ar-receipt`;
    const intlRegCheckboxId = `${uid}-intl-registered`;

    useEffect(() => {
        let active = true;
        const fetchConfig = async () => {
            try {
                const res = await fetch("/api/admin/variables");
                if (!res.ok || !active) return;
                const vars = await res.json();
                if (!Array.isArray(vars) || !active) return;

                const loaded: Partial<RateConfig> = {};
                for (const v of vars as { key: string; value: string }[]) {
                    try {
                        if (v.key === "rates_domestic_services") loaded.domesticServices = JSON.parse(v.value);
                        if (v.key === "rates_ems_zones") loaded.emsZones = JSON.parse(v.value);
                        if (v.key === "rates_ems_countries") loaded.emsCountries = JSON.parse(v.value);
                        if (v.key === "rates_extra_fees") loaded.extraFees = JSON.parse(v.value);
                    } catch {
                        // Ignore malformed JSON variable and keep defaults
                    }
                }

                const merged = mergeWithDefaultConfig(loaded);
                if (active) {
                    setConfig(merged);
                    setServiceId((prev) =>
                        merged.domesticServices.some((s) => s.id === prev)
                            ? prev
                            : (merged.domesticServices[0]?.id ?? prev)
                    );
                    setEmsCountryCode((prev) =>
                        merged.emsCountries.some((c) => c.code === prev)
                            ? prev
                            : (merged.emsCountries[0]?.code ?? prev)
                    );
                }
            } catch (e) {
                console.error("Failed to load rates config", e);
            }
        };
        fetchConfig();
        return () => {
            active = false;
        };
    }, []);

    const weightGrams = parseInt(weight, 10) || 0;
    const collectAmountNum = parseInt(codAmount, 10) || 0;

    const selectedService = useMemo(
        () => config.domesticServices.find((s) => s.id === serviceId) ?? config.domesticServices[0],
        [config.domesticServices, serviceId]
    );

    const canRegister = Boolean(selectedService?.supportsRegistration);
    const canAr = Boolean(selectedService?.supportsAr);

    const domesticQuotes = useMemo(
        () =>
            calculateAllDomesticServices(config, weightGrams, {
                registered,
                arReceipt,
            }),
        [config, weightGrams, registered, arReceipt]
    );

    const activeDomesticResult = useMemo(
        () =>
            calculatePostage(config, "domestic", selectedService?.id ?? "letter", weightGrams, {
                registered,
                arReceipt,
            }),
        [config, selectedService?.id, weightGrams, registered, arReceipt]
    );

    const codResult = useMemo(
        () => calculateCodPostage(config, weightGrams, collectAmountNum),
        [config, weightGrams, collectAmountNum]
    );

    const sortedEmsCountries = useMemo(
        () => [...config.emsCountries].sort((a, b) => a.name.localeCompare(b.name)),
        [config.emsCountries]
    );

    const activeEmsCountry = useMemo(
        () => config.emsCountries.find((c) => c.code === emsCountryCode) ?? config.emsCountries[0],
        [config.emsCountries, emsCountryCode]
    );

    const activeEmsZone = useMemo(
        () => config.emsZones.find((z) => z.id === activeEmsCountry?.zoneId),
        [config.emsZones, activeEmsCountry]
    );

    const intlQuotes = useMemo(
        () =>
            calculateAllInternationalServices(config, emsCountryCode, weightGrams, {
                registered: intlRegistered,
            }),
        [config, emsCountryCode, weightGrams, intlRegistered]
    );

    const filteredIntlQuotes = useMemo(
        () => intlQuotes.filter((q) => q.service.transport === intlTransport),
        [intlQuotes, intlTransport]
    );

    const activeIntlQuote = useMemo(
        () =>
            intlQuotes.find((q) => q.service.id === intlServiceId) ??
            calculateInternationalService(config, emsCountryCode, intlServiceId, weightGrams, {
                registered: intlRegistered,
            }),
        [intlQuotes, intlServiceId, config, emsCountryCode, weightGrams, intlRegistered]
    );

    const canIntlRegister = Boolean(activeIntlQuote.available && activeIntlQuote.service.supportsRegistration);
    const foreignRegFeeAmount = config.extraFees.foreignRegisteredPost ?? 870;

    const weightPresets =
        destination === "cod"
            ? COD_WEIGHT_PRESETS
            : destination === "ems"
                ? INTL_WEIGHT_PRESETS
                : DOMESTIC_WEIGHT_PRESETS;

    const handleModeChange = (mode: Destination) => {
        setDestination(mode);
        if (weightGrams <= 0) {
            setWeight(mode === "cod" ? "250" : "30");
        }
    };

    const handleIntlTransportChange = (transport: InternationalTransport) => {
        setIntlTransport(transport);
        const currentMatches = activeIntlQuote.service.transport === transport;
        if (!currentMatches) {
            setIntlServiceId(transport === "air" ? "air_letter" : "sea_letter");
        }
    };

    // Derive banner state for the active mode
    const banner = (() => {
        if (destination === "domestic") {
            const title = selectedService?.name ?? "Domestic Mail";
            if (activeDomesticResult.error) {
                return {
                    title,
                    subtitle: activeDomesticResult.error,
                    total: null as number | null,
                    error: activeDomesticResult.error,
                    footerNote: undefined as string | undefined,
                    items: [] as { label: string; value: string }[],
                };
            }
            const items: { label: string; value: string }[] = [
                { label: "Base", value: `Rs. ${activeDomesticResult.baseCost.toLocaleString()}` },
            ];
            if (activeDomesticResult.registrationFee > 0) {
                items.push({ label: "Reg", value: `+Rs. ${activeDomesticResult.registrationFee}` });
            }
            if (activeDomesticResult.arReceiptFee > 0) {
                items.push({ label: "AR", value: `+Rs. ${activeDomesticResult.arReceiptFee}` });
            }
            return {
                title,
                subtitle: activeDomesticResult.tierLabel,
                total: activeDomesticResult.totalCost,
                error: undefined,
                footerNote: undefined,
                items,
            };
        }

        if (destination === "cod") {
            const title = "Cash on Delivery (COD)";
            if (codResult.error) {
                return {
                    title,
                    subtitle: codResult.error,
                    total: null as number | null,
                    error: codResult.error,
                    footerNote: undefined,
                    items: [] as { label: string; value: string }[],
                };
            }
            return {
                title,
                subtitle: `${codResult.tierLabel} · Collect Rs. ${collectAmountNum.toLocaleString()}`,
                total: codResult.totalCost,
                error: undefined,
                footerNote: undefined,
                items: [
                    { label: "Courier", value: `Rs. ${codResult.courierFee.toLocaleString()}` },
                    { label: "MO Fee", value: `Rs. ${codResult.moneyOrderFee.toLocaleString()}` },
                    { label: "COD", value: `Rs. ${codResult.codServiceFee.toLocaleString()}` },
                ],
            };
        }

        const isRegActive = activeIntlQuote.service.supportsRegistration && intlRegistered && activeIntlQuote.available;
        const serviceLabel = isRegActive ? `Registered ${activeIntlQuote.service.shortName}` : activeIntlQuote.service.name;
        const title = activeEmsCountry ? `${serviceLabel} · ${activeEmsCountry.name}` : serviceLabel;

        if (!activeIntlQuote.available) {
            return {
                title,
                subtitle: activeIntlQuote.shortUnavailableTag ?? "Unavailable",
                total: null as number | null,
                error: `${activeIntlQuote.shortUnavailableTag ?? "Unavailable"} for ${activeEmsCountry?.name ?? "country"}`,
                footerNote: activeIntlQuote.unavailableReason,
                items: [] as { label: string; value: string }[],
            };
        }

        if (activeIntlQuote.result.error) {
            return {
                title,
                subtitle: activeIntlQuote.result.error,
                total: null as number | null,
                error: activeIntlQuote.result.error,
                footerNote: undefined,
                items: [] as { label: string; value: string }[],
            };
        }

        const groupLabel = activeEmsCountry?.group ? `Group ${activeEmsCountry.group}` : (activeEmsZone?.name ?? "Intl");
        const subMeta =
            activeIntlQuote.service.id === "ems"
                ? `${activeEmsZone?.name ?? "EMS Zone"} · ${activeIntlQuote.result.tierLabel}`
                : `${groupLabel} · ${activeIntlQuote.result.tierLabel}`;

        const items: { label: string; value: string }[] = [
            { label: "Base", value: `Rs. ${activeIntlQuote.result.baseCost.toLocaleString()}` },
        ];
        if (activeIntlQuote.result.registrationFee > 0) {
            items.push({ label: "Foreign Reg", value: `+Rs. ${activeIntlQuote.result.registrationFee.toLocaleString()}` });
        }

        return {
            title,
            subtitle: subMeta,
            total: activeIntlQuote.result.totalCost,
            error: undefined,
            footerNote: undefined,
            items,
        };
    })();

    return (
        <form
            onSubmit={(e) => e.preventDefault()}
            aria-label="Sri Lanka Post Postage Calculator"
            className="max-w-2xl mx-auto w-full flex flex-col gap-1.5 md:gap-4"
        >
            {/* 1. Segmented Mode Bar (native radios for arrow-key navigation + zero-click scanning) */}
            <fieldset className="contents">
                <legend className="sr-only">Calculator mode</legend>
                <div className="grid grid-cols-3 rounded-md border-2 border-foreground bg-card p-0.5">
                    {MODE_OPTIONS.map(({ id, label, icon: Icon }) => {
                        const inputId = `${uid}-mode-${id}`;
                        const checked = destination === id;
                        return (
                            <div key={id} className="flex">
                                <input
                                    type="radio"
                                    id={inputId}
                                    name="calculatorMode"
                                    value={id}
                                    checked={checked}
                                    onChange={() => handleModeChange(id)}
                                    className="sr-only peer"
                                />
                                <label
                                    htmlFor={inputId}
                                    className={cn(
                                        "tap flex w-full h-8 md:h-9 cursor-pointer items-center justify-center gap-1.5 rounded-[4px] px-2 text-xs md:text-sm font-semibold transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-ring peer-focus-visible:outline-offset-1",
                                        checked
                                            ? "bg-foreground text-background"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Icon className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" aria-hidden="true" />
                                    <span>{label}</span>
                                </label>
                            </div>
                        );
                    })}
                </div>
            </fieldset>

            {/* 2. Pinned Top Live Receipt Banner */}
            <div
                role="status"
                aria-live="polite"
                className="rounded-md border-2 border-foreground bg-card overflow-hidden shadow-[3px_3px_0_0_hsl(var(--foreground))]"
            >
                <div className="airmail-stripe h-1 md:h-1.5" aria-hidden="true" />
                <div className="px-3 py-2 md:px-5 md:py-4">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <p className="font-heading text-sm md:text-base font-extrabold [font-stretch:85%] truncate text-foreground">
                                {banner.title}
                            </p>
                            {banner.error ? (
                                <p className="flex items-center gap-1 font-mono text-[11px] md:text-xs font-medium text-destructive mt-0.5">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                    <span className="truncate">{banner.error}</span>
                                </p>
                            ) : (
                                <p className="font-mono text-[11px] md:text-xs text-muted-foreground truncate mt-0.5">
                                    {banner.subtitle}
                                </p>
                            )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                                <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground leading-none">
                                    Total
                                </span>
                                <span
                                    className={cn(
                                        "font-mono text-2xl md:text-4xl font-semibold tabular-nums leading-tight",
                                        banner.error ? "text-muted-foreground" : "text-primary"
                                    )}
                                >
                                    {banner.total !== null ? `Rs. ${banner.total.toLocaleString()}` : "—"}
                                </span>
                            </div>
                            <Postmark
                                code="LKR"
                                size="sm"
                                tone="red"
                                rotate={-10}
                                className="hidden sm:block"
                            />
                        </div>
                    </div>

                    <div className="border-t border-dashed border-foreground/25 pt-1.5 mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 font-mono text-[11px] md:text-xs">
                        {banner.items.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-muted-foreground">
                                {banner.items.map((item) => (
                                    <span key={item.label}>
                                        {item.label}{" "}
                                        <strong className="text-foreground font-semibold">{item.value}</strong>
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <span className="text-muted-foreground leading-snug">
                                {banner.footerNote ??
                                    (weightGrams <= 0 ? "Enter a valid weight above 0g" : "Adjust weight or choose another service")}
                            </span>
                        )}
                        {destination === "cod" && !codResult.error && (
                            <span className="text-muted-foreground">
                                Net:{" "}
                                <strong className="text-foreground font-semibold">
                                    Rs. {codResult.netRemittance.toLocaleString()}
                                </strong>
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* 3. Weight Input + Single-Row Horizontal Presets */}
            <div>
                <div className="flex items-center justify-between mb-1">
                    <label htmlFor={weightInputId} className="label-mono">
                        Weight (grams)
                    </label>
                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                        {weightGrams > 0 ? `= ${formatWeightLabel(weightGrams)}` : "Enter grams"}
                    </span>
                </div>
                <div className="relative">
                    <Scale
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
                        aria-hidden="true"
                    />
                    <input
                        id={weightInputId}
                        name="weight"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        enterKeyHint="done"
                        autoComplete="off"
                        value={weight}
                        onChange={(e) => setWeight(sanitizeDigits(e.target.value))}
                        placeholder="e.g. 250"
                        className="h-10 md:h-11 w-full rounded-md border-[1.5px] border-input bg-card pl-9 pr-12 font-mono text-base font-medium text-foreground focus-visible:outline-none focus-visible:border-foreground focus-visible:ring-[3px] focus-visible:ring-primary/25"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs font-semibold text-muted-foreground">
                        g
                    </span>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
                    {weightPresets.map((preset) => {
                        const active = weightGrams === preset;
                        return (
                            <button
                                key={preset}
                                type="button"
                                onClick={() => setWeight(String(preset))}
                                aria-pressed={active}
                                className={cn(
                                    "tap shrink-0 rounded-full border px-2.5 py-1 font-mono text-[11px] md:text-xs font-semibold transition-colors",
                                    active
                                        ? "border-foreground bg-foreground text-background"
                                        : "border-border bg-card text-foreground hover:border-foreground/60"
                                )}
                            >
                                {formatWeightLabel(preset)}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 4A. Domestic Mode: 2-Column Live Service Grid + Add-ons */}
            {destination === "domestic" && (
                <>
                    <fieldset className="contents">
                        <legend className="label-mono">Select Service · Live Prices</legend>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 md:gap-2">
                            {domesticQuotes.map(({ service, result }) => {
                                const isSelected = selectedService?.id === service.id;
                                const isOver = Boolean(result.exceedsMaxWeight);
                                return (
                                    <button
                                        key={service.id}
                                        type="button"
                                        onClick={() => setServiceId(service.id)}
                                        aria-pressed={isSelected}
                                        className={cn(
                                            "tap flex flex-col justify-between rounded-md border-[1.5px] px-2.5 py-1.5 md:py-2 text-left transition-colors min-h-[44px]",
                                            isSelected
                                                ? "border-foreground bg-secondary/35 shadow-[0_2px_0_0_hsl(var(--foreground))]"
                                                : isOver
                                                    ? "border-border/70 bg-muted/40 opacity-75 hover:border-foreground/40"
                                                    : "border-border bg-card hover:border-foreground/50"
                                        )}
                                    >
                                        <div className="flex items-center justify-between gap-1 w-full">
                                            <span className="text-xs md:text-sm font-semibold text-foreground truncate">
                                                {service.shortName || service.name}
                                            </span>
                                            {isSelected && (
                                                <Check className="w-3.5 h-3.5 shrink-0 text-foreground" aria-hidden="true" />
                                            )}
                                        </div>
                                        <div className="flex items-baseline justify-between gap-1 w-full mt-0.5">
                                            {isOver && result.maxWeight ? (
                                                <span className="font-mono text-[11px] font-medium text-destructive">
                                                    Max {formatWeightLabel(result.maxWeight)}
                                                </span>
                                            ) : result.error ? (
                                                <span className="font-mono text-[11px] text-muted-foreground">
                                                    —
                                                </span>
                                            ) : (
                                                <span className="font-mono text-xs md:text-sm font-bold text-primary tabular-nums">
                                                    Rs. {result.totalCost.toLocaleString()}
                                                </span>
                                            )}
                                            {service.flatRate && !isOver && (
                                                <span className="font-mono text-[10px] text-muted-foreground">Flat</span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </fieldset>

                    {/* Compact Add-ons Bar */}
                    <div className="grid grid-cols-2 gap-1.5 md:gap-2">
                        <div
                            className={cn(
                                "flex items-center gap-2 rounded-md border-[1.5px] px-2.5 py-2 transition-colors min-h-[42px]",
                                !canRegister
                                    ? "border-border/60 bg-muted/40 opacity-60"
                                    : registered
                                        ? "border-foreground bg-card"
                                        : "border-border bg-card"
                            )}
                        >
                            <input
                                type="checkbox"
                                id={regCheckboxId}
                                name="registered"
                                checked={registered && canRegister}
                                disabled={!canRegister}
                                onChange={(e) => setRegistered(e.target.checked)}
                                className="h-4 w-4 shrink-0 rounded-sm border-foreground accent-primary cursor-pointer disabled:cursor-not-allowed"
                            />
                            <label
                                htmlFor={regCheckboxId}
                                className={cn(
                                    "flex-1 text-xs md:text-sm font-medium leading-tight select-none",
                                    canRegister ? "cursor-pointer text-foreground" : "cursor-not-allowed text-muted-foreground"
                                )}
                            >
                                <span className="block">Registered</span>
                                <span className="block font-mono text-[10px] md:text-[11px] text-muted-foreground">
                                    {canRegister ? `+Rs. ${config.extraFees.registeredPost}` : "N/A for service"}
                                </span>
                            </label>
                        </div>

                        <div
                            className={cn(
                                "flex items-center gap-2 rounded-md border-[1.5px] px-2.5 py-2 transition-colors min-h-[42px]",
                                !canAr
                                    ? "border-border/60 bg-muted/40 opacity-60"
                                    : arReceipt
                                        ? "border-foreground bg-card"
                                        : "border-border bg-card"
                            )}
                        >
                            <input
                                type="checkbox"
                                id={arCheckboxId}
                                name="arReceipt"
                                checked={arReceipt && canAr}
                                disabled={!canAr}
                                onChange={(e) => setArReceipt(e.target.checked)}
                                className="h-4 w-4 shrink-0 rounded-sm border-foreground accent-primary cursor-pointer disabled:cursor-not-allowed"
                            />
                            <label
                                htmlFor={arCheckboxId}
                                className={cn(
                                    "flex-1 text-xs md:text-sm font-medium leading-tight select-none",
                                    canAr ? "cursor-pointer text-foreground" : "cursor-not-allowed text-muted-foreground"
                                )}
                            >
                                <span className="block">AR Receipt</span>
                                <span className="block font-mono text-[10px] md:text-[11px] text-muted-foreground">
                                    {canAr ? `+Rs. ${config.extraFees.arReceipt}` : "N/A for service"}
                                </span>
                            </label>
                        </div>
                    </div>
                </>
            )}

            {/* 4B. COD Mode: Collection Amount + 3-Part Formula Breakdown */}
            {destination === "cod" && (
                <div className="flex flex-col gap-2 md:gap-3">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label htmlFor={codAmountId} className="label-mono">
                                Amount to Collect (LKR)
                            </label>
                            <span className="font-mono text-[11px] text-muted-foreground">
                                Max Rs. 100,000
                            </span>
                        </div>
                        <div className="relative">
                            <span
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs font-semibold text-muted-foreground"
                                aria-hidden="true"
                            >
                                Rs.
                            </span>
                            <input
                                id={codAmountId}
                                name="codAmount"
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                enterKeyHint="done"
                                autoComplete="off"
                                value={codAmount}
                                onChange={(e) => setCodAmount(sanitizeDigits(e.target.value))}
                                placeholder="e.g. 2500"
                                className="h-10 md:h-11 w-full rounded-md border-[1.5px] border-input bg-card pl-10 pr-3 font-mono text-base font-medium text-foreground focus-visible:outline-none focus-visible:border-foreground focus-visible:ring-[3px] focus-visible:ring-primary/25"
                            />
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
                            {COD_AMOUNT_PRESETS.map((amt) => {
                                const active = collectAmountNum === amt;
                                return (
                                    <button
                                        key={amt}
                                        type="button"
                                        onClick={() => setCodAmount(String(amt))}
                                        aria-pressed={active}
                                        className={cn(
                                            "tap shrink-0 rounded-full border px-2.5 py-1 font-mono text-[11px] md:text-xs font-semibold transition-colors",
                                            active
                                                ? "border-foreground bg-foreground text-background"
                                                : "border-border bg-card text-foreground hover:border-foreground/60"
                                        )}
                                    >
                                        Rs. {formatCompactAmount(amt)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 md:gap-2.5">
                        <div className="rounded-md border-[1.5px] border-border bg-card px-2.5 py-2">
                            <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                SLP Courier
                            </span>
                            <span className="block font-mono text-sm md:text-base font-bold text-foreground mt-0.5 tabular-nums">
                                Rs. {codResult.courierFee.toLocaleString()}
                            </span>
                        </div>
                        <div className="rounded-md border-[1.5px] border-border bg-card px-2.5 py-2">
                            <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                PMT MO Fee
                            </span>
                            <span className="block font-mono text-sm md:text-base font-bold text-foreground mt-0.5 tabular-nums">
                                Rs. {codResult.moneyOrderFee.toLocaleString()}
                            </span>
                        </div>
                        <div className="rounded-md border-[1.5px] border-border bg-card px-2.5 py-2">
                            <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                COD Service
                            </span>
                            <span className="block font-mono text-sm md:text-base font-bold text-foreground mt-0.5 tabular-nums">
                                Rs. {codResult.codServiceFee.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    {codResult.subPostOfficeWarning && !codResult.error && (
                        <p className="flex items-start gap-1.5 rounded-md border border-secondary bg-secondary/20 px-2.5 py-1.5 text-[11px] md:text-xs text-foreground">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" aria-hidden="true" />
                            <span>
                                Sub-Post Offices cap Money Orders at Rs. 25,000. Use a Main Post Office for amounts up to Rs. 100,000.
                            </span>
                        </p>
                    )}
                </div>
            )}

            {/* 4C. International Mail Mode (Air Mail, U-Packet, TDS, Air Parcel, EMS, Sea Mail) */}
            {destination === "ems" && (
                <div className="flex flex-col gap-1.5 md:gap-3">
                    <div>
                        <div className="flex items-center justify-between mb-1 gap-2">
                            <label htmlFor={emsCountryId} className="label-mono">
                                Destination Country
                            </label>
                            <button
                                type="button"
                                onClick={() => setShowCountryWhyNote((prev) => !prev)}
                                aria-expanded={showCountryWhyNote}
                                className="inline-flex items-center gap-1 font-mono text-[10px] md:text-[11px] font-semibold text-primary hover:underline"
                            >
                                <Info className="w-3 h-3 shrink-0" aria-hidden="true" />
                                <span>{showCountryWhyNote ? "Hide coverage note" : "Country / service missing? Why"}</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-[1fr_auto] gap-1.5 md:gap-2 items-center">
                            <select
                                id={emsCountryId}
                                name="emsCountry"
                                value={emsCountryCode}
                                onChange={(e) => setEmsCountryCode(e.target.value)}
                                className="h-10 md:h-11 w-full rounded-md border-[1.5px] border-input bg-card px-2.5 md:px-3 text-base font-medium text-foreground focus-visible:outline-none focus-visible:border-foreground focus-visible:ring-[3px] focus-visible:ring-primary/25"
                            >
                                {sortedEmsCountries.map((c) => {
                                    const suffix =
                                        c.suspensionStatus === "suspended"
                                            ? " (Suspended)"
                                            : c.suspensionStatus === "restricted"
                                                ? " (Note)"
                                                : "";
                                    return (
                                        <option key={c.code} value={c.code}>
                                            {c.name}
                                            {suffix}
                                        </option>
                                    );
                                })}
                            </select>

                            <div
                                role="group"
                                aria-label="International transport mode"
                                className="grid grid-cols-2 h-10 md:h-11 rounded-md border-[1.5px] border-foreground bg-card p-0.5 shrink-0"
                            >
                                <button
                                    type="button"
                                    onClick={() => handleIntlTransportChange("air")}
                                    aria-pressed={intlTransport === "air"}
                                    className={cn(
                                        "tap flex items-center justify-center gap-1 rounded-[4px] px-2.5 text-xs md:text-sm font-semibold transition-colors",
                                        intlTransport === "air"
                                            ? "bg-foreground text-background"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Plane className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                    <span>Air</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleIntlTransportChange("sea")}
                                    aria-pressed={intlTransport === "sea"}
                                    className={cn(
                                        "tap flex items-center justify-center gap-1 rounded-[4px] px-2.5 text-xs md:text-sm font-semibold transition-colors",
                                        intlTransport === "sea"
                                            ? "bg-foreground text-background"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Ship className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                    <span>Sea</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {showCountryWhyNote && (
                        <div className="rounded-md border border-foreground/30 bg-muted/40 px-2.5 py-1.5 text-[11px] leading-snug text-foreground space-y-0.5">
                            <p className="font-semibold">Why a country or service may be unavailable:</p>
                            <p className="text-muted-foreground">
                                1) Direct air/sea dispatch required (e.g., Sea Mail suspended for Canada &amp; Maldives; unavailable for landlocked states).{" "}
                                2) U-Packet &amp; TDS require bilateral UPU agreements.{" "}
                                3) 19 EU states restrict commercial parcels €45–€150.{" "}
                                4) Airspace/conflict suspensions apply to Israel, Lebanon, Russia &amp; Ukraine.
                            </p>
                        </div>
                    )}

                    {(activeEmsCountry?.restrictionNote ||
                        (intlTransport === "sea" && activeEmsCountry?.seaMailAvailable === false)) && (
                        <p
                            className={cn(
                                "flex items-start gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] md:text-xs leading-snug",
                                activeEmsCountry?.suspensionStatus === "suspended"
                                    ? "border-destructive/60 bg-destructive/10 text-destructive"
                                    : "border-secondary bg-secondary/20 text-foreground"
                            )}
                        >
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                            <span>
                                {intlTransport === "sea" && activeEmsCountry?.seaMailAvailable === false && activeEmsCountry.seaMailNote
                                    ? activeEmsCountry.seaMailNote
                                    : activeEmsCountry?.restrictionNote}
                            </span>
                        </p>
                    )}

                    <fieldset className="contents">
                        <legend className="label-mono">
                            {intlTransport === "air" ? "Air Mail Services · Live Prices" : "Sea Mail Services · Live Prices"}
                        </legend>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 md:gap-2">
                            {filteredIntlQuotes.map((quote) => {
                                const isSelected = activeIntlQuote.service.id === quote.service.id;
                                const isOver = quote.available && Boolean(quote.result.exceedsMaxWeight);
                                return (
                                    <button
                                        key={quote.service.id}
                                        type="button"
                                        onClick={() => setIntlServiceId(quote.service.id)}
                                        aria-pressed={isSelected}
                                        className={cn(
                                            "tap flex flex-col justify-between rounded-md border-[1.5px] px-2.5 py-1.5 md:py-2 text-left transition-colors min-h-[42px]",
                                            isSelected
                                                ? "border-foreground bg-secondary/35 shadow-[0_2px_0_0_hsl(var(--foreground))]"
                                                : !quote.available || isOver
                                                    ? "border-border/70 bg-muted/40 opacity-75 hover:border-foreground/40"
                                                    : "border-border bg-card hover:border-foreground/50"
                                        )}
                                    >
                                        <div className="flex items-center justify-between gap-1 w-full">
                                            <span className="text-xs md:text-sm font-semibold text-foreground truncate">
                                                {quote.service.shortName}
                                            </span>
                                            {isSelected && (
                                                <Check className="w-3.5 h-3.5 shrink-0 text-foreground" aria-hidden="true" />
                                            )}
                                        </div>
                                        <div className="flex items-baseline justify-between gap-1 w-full mt-0.5">
                                            {!quote.available ? (
                                                <span className="font-mono text-[10px] md:text-[11px] font-medium text-destructive truncate">
                                                    {quote.shortUnavailableTag ?? "Unavailable"}
                                                </span>
                                            ) : isOver && quote.result.maxWeight ? (
                                                <span className="font-mono text-[11px] font-medium text-destructive">
                                                    Max {formatWeightLabel(quote.result.maxWeight)}
                                                </span>
                                            ) : quote.result.error ? (
                                                <span className="font-mono text-[11px] text-muted-foreground">—</span>
                                            ) : (
                                                <span className="font-mono text-xs md:text-sm font-bold text-primary tabular-nums">
                                                    Rs. {quote.result.totalCost.toLocaleString()}
                                                </span>
                                            )}
                                            {quote.available && quote.service.supportsRegistration && intlRegistered && !quote.result.error && (
                                                <span className="font-mono text-[10px] text-muted-foreground">Reg</span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </fieldset>

                    {/* Foreign Registered Mail (+Rs. 870) + Group / Limit Info */}
                    <div className="grid grid-cols-2 gap-1.5 md:gap-2">
                        <div
                            className={cn(
                                "flex items-center gap-2 rounded-md border-[1.5px] px-2.5 py-1.5 transition-colors min-h-[40px]",
                                !canIntlRegister
                                    ? "border-border/60 bg-muted/40 opacity-60"
                                    : "border-border bg-card"
                            )}
                        >
                            <input
                                type="checkbox"
                                id={intlRegCheckboxId}
                                name="intlRegistered"
                                checked={intlRegistered && canIntlRegister}
                                disabled={!canIntlRegister}
                                onChange={(e) => setIntlRegistered(e.target.checked)}
                                className="h-4 w-4 shrink-0 rounded-sm border-foreground accent-primary cursor-pointer disabled:cursor-not-allowed"
                            />
                            <label
                                htmlFor={intlRegCheckboxId}
                                className={cn(
                                    "flex-1 text-xs md:text-sm font-medium leading-tight select-none",
                                    canIntlRegister ? "cursor-pointer text-foreground" : "cursor-not-allowed text-muted-foreground"
                                )}
                            >
                                <span className="block">Registered</span>
                                <span className="block font-mono text-[10px] md:text-[11px] text-muted-foreground">
                                    {canIntlRegister ? `+Rs. ${foreignRegFeeAmount.toLocaleString()}` : "Tracked / N/A"}
                                </span>
                            </label>
                        </div>

                        <div className="rounded-md border-[1.5px] border-border bg-card px-2.5 py-1.5 flex flex-col justify-center min-h-[40px]">
                            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground leading-none">
                                {activeIntlQuote.service.id === "ems" ? "EMS Tariff Zone" : "Country Group"}
                            </span>
                            <span className="font-mono text-xs font-semibold text-foreground mt-0.5 truncate">
                                {activeIntlQuote.service.id === "ems"
                                    ? `${activeEmsZone?.name ?? "Zone"}`
                                    : `Group ${activeEmsCountry?.group ?? "—"} · Max ${formatWeightLabel(activeIntlQuote.service.maxWeight)}`}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* 5. Compact 1-line Mobile Reference Footer */}
            <p className="md:hidden text-center font-mono text-[10px] text-muted-foreground pt-0.5">
                SL Post Tariff · Effective Feb 9, 2026
            </p>
        </form>
    );
}
