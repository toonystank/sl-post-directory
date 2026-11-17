"use client";

import { useState, useEffect, useId, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { m, AnimatePresence } from "motion/react";
import {
    Mail,
    Banknote,
    Scale,
    AlertTriangle,
    Check,
    Plane,
    Ship,
    Info,
    Minus,
    Plus,
    ChevronDown,
} from "lucide-react";
import Postmark from "@/components/brand/Postmark";
import CountryFlag from "@/components/brand/CountryFlag";
import { useCurrency } from "@/context/CurrencyContext";
import { CURRENCY_META, Currency, formatCurrencyAmount, splitCurrencyPrice } from "@/lib/currency";
import { MODE_COLORS, getServiceColor, serviceStyle } from "@/lib/service-colors";
import {
    getLocalizedCountryName,
    getLocalizedZoneName,
    getServiceTagline,
    stepCodAmount,
    stepWeight,
} from "@/lib/calculator-ui";
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
const COD_WEIGHT_PRESETS = [250, 500, 1000, 2000, 5000, 10000, 20000, 40000];
const INTL_WEIGHT_PRESETS = [20, 50, 100, 250, 500, 1000, 2000, 5000];
const COD_AMOUNT_PRESETS = [1000, 2500, 5000, 10000, 25000, 50000];

let cachedRateConfig: RateConfig | null = null;
let cachedRateConfigTimestamp = 0;
const RATE_CACHE_TTL_MS = 10 * 60_000;

/** Index of the cheapest valid quote (only when 2+ are valid), else -1. */
function cheapestIndex(prices: (number | null)[]): number {
    let best = -1;
    let valid = 0;
    prices.forEach((p, i) => {
        if (p === null || p <= 0) return;
        valid++;
        if (best === -1 || p < (prices[best] as number)) best = i;
    });
    return valid > 1 ? best : -1;
}

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

/** Numbered step badge ("1", "2", "3") for clear visual flow */
function StepBadge({ step }: { step: number }) {
    return (
        <span
            aria-hidden="true"
            className="inline-flex h-4 w-4 md:h-5 md:w-5 shrink-0 items-center justify-center rounded-[4px] bg-foreground font-mono text-[10px] md:text-[11px] font-bold text-background"
        >
            {step}
        </span>
    );
}

/**
 * Colour-coded service tile:
 * - Full-width service title on top row so names like "Printed Matter" or Sinhala/Tamil titles never get cut off.
 * - "CHEAPEST" pill placed in the bottom-right corner next to the price.
 * - Selected state shows a solid service-coloured top header bar ("SELECTED · [ShortTag] ✓").
 */
function ServiceCard({
    serviceId,
    name,
    selected,
    dimmed,
    cheapest,
    cheapestLabel,
    selectedCardHeader,
    locale,
    currency,
    lkrPerUsd,
    onSelect,
    price,
    note,
    status,
}: {
    serviceId: string;
    name: string;
    selected: boolean;
    dimmed: boolean;
    cheapest: boolean;
    cheapestLabel: string;
    selectedCardHeader: string;
    locale: string;
    currency: Currency;
    lkrPerUsd: number;
    onSelect: () => void;
    /** Total in LKR, or null when a status message should be shown instead */
    price: number | null;
    note?: string;
    status?: { text: string; tone: "error" | "muted" };
}) {
    const color = getServiceColor(serviceId);
    const tagline = getServiceTagline(serviceId, locale);
    const isIndic = locale === "si" || locale === "ta";
    const priceParts = price !== null ? splitCurrencyPrice(price, currency, lkrPerUsd) : null;

    return (
        <m.button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            whileHover={{ y: -1.5 }}
            whileTap={{ scale: 0.985 }}
            transition={{ type: "spring", stiffness: 480, damping: 30 }}
            style={serviceStyle(color)}
            className={cn(
                "svc tap relative flex flex-col justify-between overflow-hidden rounded-md text-left transition-colors min-h-[56px] md:min-h-[76px] lg:min-h-[96px]",
                selected
                    ? "border-2 border-[var(--c)] bg-[color-mix(in_srgb,var(--c)_13%,hsl(var(--card)))] shadow-[0_2px_0_0_var(--c)] ring-1 ring-[var(--c)]/40"
                    : dimmed
                        ? "border-[1.5px] border-border/70 bg-muted/40 opacity-70 hover:border-foreground/40"
                        : "border-[1.5px] border-border bg-card hover:border-[var(--c)]"
            )}
        >
            {/* Selected state: solid service-colored top banner */}
            {selected ? (
                <div className="flex w-full items-center justify-between gap-1 bg-[var(--svc)] px-1.5 py-0.5 lg:px-2.5 lg:py-1 text-white">
                    <span
                        className={cn(
                            "min-w-0 font-mono font-bold uppercase tracking-tight truncate",
                            isIndic ? "text-[8.5px] md:text-[10px]" : "text-[8.5px] sm:text-[9.5px] md:text-[10.5px]"
                        )}
                    >
                        {selectedCardHeader}
                    </span>
                    <Check className="w-2.5 h-2.5 lg:w-3.5 lg:h-3.5 shrink-0" strokeWidth={3} aria-hidden="true" />
                </div>
            ) : (
                /* Unselected state: left colour bar (two-tone when service has an accent) */
                <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 w-1.5"
                    style={{ background: "linear-gradient(to bottom, var(--c) 0 68%, var(--ca) 68% 100%)" }}
                />
            )}

            <div
                className={cn(
                    "flex flex-1 flex-col justify-between w-full",
                    selected ? "px-2 py-0.5 lg:px-3 lg:py-2" : "py-1 pl-2.5 pr-1.5 lg:py-2 lg:pl-3.5 lg:pr-2.5"
                )}
            >
                <div className="w-full min-w-0">
                    <div className="flex items-center gap-1 lg:gap-1.5 w-full min-w-0">
                        <span
                            aria-hidden="true"
                            className="h-1.5 w-1.5 lg:h-2 lg:w-2 rounded-full bg-[var(--c)] shrink-0"
                        />
                        <span
                            className={cn(
                                "font-bold text-foreground leading-tight break-words",
                                isIndic ? "text-[10.5px] sm:text-xs md:text-sm lg:text-[15px]" : "text-xs md:text-sm lg:text-[15px]"
                            )}
                        >
                            {name}
                        </span>
                    </div>
                    <p
                        className={cn(
                            "text-muted-foreground truncate leading-tight pl-2.5 lg:pl-3.5 lg:mt-0.5",
                            isIndic ? "text-[8.5px] md:text-[10.5px] lg:text-xs" : "text-[9.5px] md:text-[11px] lg:text-xs"
                        )}
                    >
                        {tagline.cardHint}
                    </p>
                </div>

                <div className="flex items-baseline justify-between gap-1 w-full mt-0.5 lg:mt-1.5 pl-2.5 lg:pl-3.5">
                    {priceParts !== null ? (
                        <span className="font-mono text-sm sm:text-base md:text-lg lg:text-xl font-bold text-[var(--c)] tabular-nums leading-tight">
                            {currency === "USD" ? (
                                <>
                                    <span className="text-[11px] md:text-xs font-semibold mr-px">{priceParts.symbol}</span>
                                    {priceParts.value}
                                </>
                            ) : (
                                <>
                                    <span className="text-[10px] md:text-xs font-semibold">{priceParts.symbol}</span>{" "}
                                    {priceParts.value}
                                </>
                            )}
                        </span>
                    ) : (
                        <span
                            className={cn(
                                "font-mono text-[10.5px] lg:text-xs font-medium truncate",
                                status?.tone === "error" ? "text-destructive" : "text-muted-foreground"
                            )}
                        >
                            {status?.text ?? "—"}
                        </span>
                    )}
                    <span className="flex shrink-0 items-center gap-1">
                        {note && <span className="font-mono text-[9.5px] lg:text-[10.5px] font-semibold text-muted-foreground">{note}</span>}
                        {cheapest && (
                            <span
                                className={cn(
                                    "rounded-full bg-green-100 px-1.5 py-px lg:px-2 lg:py-0.5 font-bold uppercase tracking-wide text-green-800 dark:bg-green-900/50 dark:text-green-300",
                                    isIndic ? "text-[8.5px] lg:text-[9.5px]" : "text-[9px] lg:text-[10px]"
                                )}
                            >
                                {cheapestLabel}
                            </span>
                        )}
                    </span>
                </div>
            </div>
        </m.button>
    );
}

export default function PostageCalculator({ initialMode = "ems" }: { initialMode?: Destination }) {
    const locale = useLocale();
    const isIndic = locale === "si" || locale === "ta";
    const tHome = useTranslations("Home");
    const tc = useTranslations("Calculator");
    const { currency, lkrPerUsd } = useCurrency();
    const [config, setConfig] = useState<RateConfig>(DEFAULT_RATE_CONFIG);
    const [destination, setDestination] = useState<Destination>(initialMode);
    const [serviceId, setServiceId] = useState<string>("letter");
    const [emsCountryCode, setEmsCountryCode] = useState<string>("GB");
    const [intlTransport, setIntlTransport] = useState<InternationalTransport>("air");
    const [intlServiceId, setIntlServiceId] = useState<InternationalServiceId>("ems");
    const [intlRegistered, setIntlRegistered] = useState(false);
    const [showCountryWhyNote, setShowCountryWhyNote] = useState(false);
    const [weight, setWeight] = useState<string>(initialMode === "cod" ? "250" : initialMode === "ems" ? "20" : "30");
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

    const modeOptions: { id: Destination; label: string; icon: typeof Mail }[] = [
        { id: "ems", label: tc("modeIntl"), icon: Plane },
        { id: "cod", label: tc("modeCod"), icon: Banknote },
        { id: "domestic", label: tc("modeLocal"), icon: Mail },
    ];

    useEffect(() => {
        let active = true;
        if (cachedRateConfig && Date.now() - cachedRateConfigTimestamp < RATE_CACHE_TTL_MS) {
            setConfig(cachedRateConfig);
            return;
        }
        const controller = new AbortController();
        const fetchConfig = async () => {
            try {
                const res = await fetch("/api/admin/variables", { signal: controller.signal });
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
                cachedRateConfig = merged;
                cachedRateConfigTimestamp = Date.now();
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
                if ((e as Error)?.name === "AbortError") return;
                console.error("Failed to load rates config", e);
            }
        };
        fetchConfig();
        return () => {
            active = false;
            controller.abort();
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

    const domesticCheapest = useMemo(
        () =>
            cheapestIndex(
                domesticQuotes.map(({ result }) =>
                    result.error || result.exceedsMaxWeight ? null : result.totalCost
                )
            ),
        [domesticQuotes]
    );

    const intlCheapest = useMemo(
        () =>
            cheapestIndex(
                filteredIntlQuotes.map((q) =>
                    !q.available || q.result.error || q.result.exceedsMaxWeight ? null : q.result.totalCost
                )
            ),
        [filteredIntlQuotes]
    );

    // Colour of the currently highlighted result (drives the receipt banner background tint + border)
    const activeServiceKey =
        destination === "cod"
            ? "cod"
            : destination === "ems"
                ? activeIntlQuote.service.id
                : (selectedService?.id ?? "letter");

    const activeColor =
        destination === "cod"
            ? MODE_COLORS.cod
            : destination === "ems"
                ? getServiceColor(activeIntlQuote.service.id)
                : getServiceColor(selectedService?.id);

    const activeTagline = getServiceTagline(activeServiceKey, locale);

    const bannerStripe =
        destination === "cod"
            ? "bg-[var(--svc)]"
            : destination === "ems"
                ? activeIntlQuote.service.id === "ems"
                    ? "ems-stripe"
                    : activeIntlQuote.service.id === "air_letter" || activeIntlQuote.service.id === "air_printed"
                        ? "par-avion-stripe"
                        : "bg-[var(--svc)]"
                : "airmail-stripe";

    const weightPresets =
        destination === "cod"
            ? COD_WEIGHT_PRESETS
            : destination === "ems"
                ? INTL_WEIGHT_PRESETS
                : DOMESTIC_WEIGHT_PRESETS;

    const defaultWeightForMode = (mode: Destination) =>
        mode === "cod" ? "250" : mode === "ems" ? "20" : "30";

    const resetCalculatorForMode = (mode: Destination) => {
        setDestination(mode);
        setWeight(defaultWeightForMode(mode));
        setServiceId(
            config.domesticServices.some((s) => s.id === "letter")
                ? "letter"
                : (config.domesticServices[0]?.id ?? "letter")
        );
        setRegistered(false);
        setArReceipt(false);
        setCodAmount("2500");
        setEmsCountryCode(
            config.emsCountries.some((c) => c.code === "GB")
                ? "GB"
                : (config.emsCountries[0]?.code ?? "GB")
        );
        setIntlTransport("air");
        setIntlServiceId("ems");
        setIntlRegistered(false);
        setShowCountryWhyNote(false);
    };

    useEffect(() => {
        resetCalculatorForMode(initialMode);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialMode]);

    const handleModeChange = (mode: Destination) => {
        resetCalculatorForMode(mode);
    };

    const handleIntlTransportChange = (transport: InternationalTransport) => {
        setIntlTransport(transport);
        setWeight("20");
        setIntlServiceId(transport === "air" ? "ems" : "sea_letter");
        setIntlRegistered(false);
    };

    const handleStepWeight = (direction: "up" | "down") => {
        const next = stepWeight(weightGrams, direction, 10, 40000);
        setWeight(String(next));
    };

    const handleStepCodAmount = (direction: "up" | "down") => {
        const next = stepCodAmount(collectAmountNum, direction, 500, 100000);
        setCodAmount(String(next));
    };

    const localizedZone = getLocalizedZoneName(
        activeEmsZone?.id,
        activeEmsZone?.name ?? "EMS Zone",
        locale
    );

    const localizedCountryName = getLocalizedCountryName(
        activeEmsCountry?.code,
        activeEmsCountry?.name ?? "United Kingdom",
        locale
    );

    // Derive banner state for the active mode
    const banner = (() => {
        if (destination === "domestic") {
            const title = activeTagline.name || selectedService?.name || "Domestic Mail";
            const badgeLabel = (activeTagline.shortName || selectedService?.shortName || "Letter").toUpperCase();
            const maxWeightLabel = activeDomesticResult.maxWeight
                ? tc("maxWeight", { weight: formatWeightLabel(activeDomesticResult.maxWeight) })
                : undefined;

            if (activeDomesticResult.error) {
                return {
                    flagCode: "LK",
                    locationPill: tc("locationLocal"),
                    selectedBadge: tc("selectedPrefix", { service: badgeLabel }),
                    title,
                    subtitle: `${activeTagline.cardHint} · ${activeDomesticResult.error}`,
                    total: null as number | null,
                    error: activeDomesticResult.error,
                    footerNote: undefined as string | undefined,
                    rightFooter: maxWeightLabel,
                    items: [] as { label: string; value: string }[],
                };
            }
            const items: { label: string; value: string }[] = [
                { label: tc("itemBase"), value: formatCurrencyAmount(activeDomesticResult.baseCost, currency, lkrPerUsd) },
            ];
            if (activeDomesticResult.registrationFee > 0) {
                items.push({ label: tc("itemReg"), value: formatCurrencyAmount(activeDomesticResult.registrationFee, currency, lkrPerUsd, { plus: true }) });
            }
            if (activeDomesticResult.arReceiptFee > 0) {
                items.push({ label: tc("itemAr"), value: formatCurrencyAmount(activeDomesticResult.arReceiptFee, currency, lkrPerUsd, { plus: true }) });
            }
            return {
                flagCode: "LK",
                locationPill: tc("locationLocal"),
                selectedBadge: tc("selectedPrefix", { service: badgeLabel }),
                title,
                subtitle: `${activeTagline.cardHint} · ${activeDomesticResult.tierLabel}`,
                total: activeDomesticResult.totalCost,
                error: undefined,
                footerNote: undefined,
                rightFooter: maxWeightLabel,
                items,
            };
        }

        if (destination === "cod") {
            const title = tc("codTitle");
            const maxWeightLabel = tc("maxWeight", { weight: "40kg" });
            if (codResult.error) {
                return {
                    flagCode: "LK",
                    locationPill: tc("locationCod"),
                    selectedBadge: tc("selectedCod"),
                    title,
                    subtitle: `${activeTagline.cardHint} · ${codResult.error}`,
                    total: null as number | null,
                    error: codResult.error,
                    footerNote: undefined,
                    rightFooter: maxWeightLabel,
                    items: [] as { label: string; value: string }[],
                };
            }
            return {
                flagCode: "LK",
                locationPill: tc("locationCod"),
                selectedBadge: tc("selectedCod"),
                title,
                subtitle: `${codResult.tierLabel} · ${tc("collectAmount", {
                    amount:
                        currency === "USD"
                            ? `${collectAmountNum.toLocaleString()} (${formatCurrencyAmount(collectAmountNum, "USD", lkrPerUsd)})`
                            : collectAmountNum.toLocaleString(),
                })}`,
                total: codResult.totalCost,
                error: undefined,
                footerNote: undefined,
                rightFooter: tc("netRemittance", {
                    amount: formatCurrencyAmount(codResult.netRemittance, currency, lkrPerUsd),
                }),
                items: [
                    { label: tc("itemCourier"), value: formatCurrencyAmount(codResult.courierFee, currency, lkrPerUsd) },
                    { label: tc("itemMoFee"), value: formatCurrencyAmount(codResult.moneyOrderFee, currency, lkrPerUsd) },
                    { label: tc("itemCod"), value: formatCurrencyAmount(codResult.codServiceFee, currency, lkrPerUsd) },
                ],
            };
        }

        const isRegActive = activeIntlQuote.service.supportsRegistration && intlRegistered && activeIntlQuote.available;
        const localizedShortName = activeTagline.shortName || activeIntlQuote.service.shortName;
        const localizedFullName = activeTagline.name || activeIntlQuote.service.name;
        const serviceLabel = isRegActive
            ? tc("registeredPrefix", { service: localizedShortName })
            : localizedFullName;
        const badgeLabel = (isRegActive
            ? tc("regBadgePrefix", { service: localizedShortName })
            : localizedShortName
        ).toUpperCase();

        const shortZone =
            activeIntlQuote.service.id === "ems"
                ? localizedZone.short
                : tc("groupLabel", { group: activeEmsCountry?.group ?? "—" });

        const locationPill = activeEmsCountry
            ? `${localizedCountryName} · ${shortZone}`
            : shortZone;

        const maxW = activeIntlQuote.result.maxWeight ?? activeIntlQuote.service.maxWeight;
        const rightFooter = maxW ? tc("maxWeight", { weight: formatWeightLabel(maxW) }) : undefined;

        if (!activeIntlQuote.available) {
            return {
                flagCode: activeEmsCountry?.code ?? "GB",
                locationPill,
                selectedBadge: tc("selectedPrefix", { service: badgeLabel }),
                title: serviceLabel,
                subtitle: `${activeTagline.cardHint} · ${activeIntlQuote.shortUnavailableTag ?? "Unavailable"}`,
                total: null as number | null,
                error: tc("unavailableFor", {
                    tag: activeIntlQuote.shortUnavailableTag ?? "Unavailable",
                    country: localizedCountryName,
                }),
                footerNote: activeIntlQuote.unavailableReason,
                rightFooter,
                items: [] as { label: string; value: string }[],
            };
        }

        if (activeIntlQuote.result.error) {
            return {
                flagCode: activeEmsCountry?.code ?? "GB",
                locationPill,
                selectedBadge: tc("selectedPrefix", { service: badgeLabel }),
                title: serviceLabel,
                subtitle: `${activeTagline.cardHint} · ${activeIntlQuote.result.error}`,
                total: null as number | null,
                error: activeIntlQuote.result.error,
                footerNote: undefined,
                rightFooter,
                items: [] as { label: string; value: string }[],
            };
        }

        const items: { label: string; value: string }[] = [
            { label: tc("itemBase"), value: formatCurrencyAmount(activeIntlQuote.result.baseCost, currency, lkrPerUsd) },
        ];
        if (activeIntlQuote.result.registrationFee > 0) {
            items.push({
                label: tc("itemForeignReg"),
                value: formatCurrencyAmount(activeIntlQuote.result.registrationFee, currency, lkrPerUsd, { plus: true }),
            });
        }

        return {
            flagCode: activeEmsCountry?.code ?? "GB",
            locationPill,
            selectedBadge: tc("selectedPrefix", { service: badgeLabel }),
            title: serviceLabel,
            subtitle: `${activeTagline.cardHint} · ${activeIntlQuote.result.tierLabel}`,
            total: activeIntlQuote.result.totalCost,
            error: undefined,
            footerNote: undefined,
            rightFooter,
            items,
        };
    })();

    return (
        <form
            onSubmit={(e) => e.preventDefault()}
            aria-label={tc("formAriaLabel")}
            className="w-full flex flex-col gap-1 md:gap-3 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start"
        >
            {/* Left Workbench Column on Desktop (Mode Bar + Receipt Banner + Step 1 & Step 2 Controls) */}
            <div className="contents lg:flex lg:flex-col lg:col-span-5 lg:gap-4">
            {/* 1. Segmented Mode Bar */}
            <fieldset className="contents">
                <legend className="sr-only">{tc("modeLabel")}</legend>
                <div className="grid grid-cols-3 gap-1 rounded-lg border-2 border-foreground bg-card p-0.5 md:p-1">
                    {modeOptions.map(({ id, label, icon: Icon }) => {
                        const inputId = `${uid}-mode-${id}`;
                        const checked = destination === id;
                        return (
                            <div key={id} className="flex svc" style={serviceStyle(MODE_COLORS[id as keyof typeof MODE_COLORS])}>
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
                                        "tap relative flex w-full min-h-[38px] md:min-h-[54px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md px-1 py-0.5 font-bold transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-ring peer-focus-visible:outline-offset-1 text-center",
                                        isIndic ? "text-[10.5px] md:text-sm" : "text-xs md:text-sm",
                                        checked
                                            ? "text-white dark:text-background"
                                            : "text-[var(--c)] hover:bg-muted"
                                    )}
                                >
                                    {checked && (
                                        <m.span
                                            layoutId={`calc-mode-pill-${uid}`}
                                            transition={{ type: "spring", stiffness: 450, damping: 32 }}
                                            style={{ backgroundColor: "var(--c)" }}
                                            className="absolute inset-0 rounded-md shadow-[0_2px_0_0_hsl(var(--foreground))]"
                                            aria-hidden="true"
                                        />
                                    )}
                                    <Icon className="relative z-10 w-4 h-4 md:w-6 md:h-6 shrink-0" strokeWidth={2.2} aria-hidden="true" />
                                    <span className="relative z-10 leading-tight truncate max-w-full">{label}</span>
                                </label>
                            </div>
                        );
                    })}
                </div>
            </fieldset>

            {/* 2. Pinned Top Live Receipt Banner — Tinted with Selected Service Colour & Full Un-Cut Country Flag Pill */}
            <div
                role="status"
                aria-live="polite"
                data-testid="live-receipt-banner"
                data-active-service={activeServiceKey}
                className="svc rounded-lg border-2 border-[var(--c)] bg-[color-mix(in_srgb,var(--c)_13%,hsl(var(--card)))] overflow-hidden shadow-[3px_3px_0_0_var(--c)] transition-colors duration-150"
                style={serviceStyle(activeColor)}
            >
                <div className={cn("h-1.5 md:h-2", bannerStripe)} aria-hidden="true" />
                <div className="px-2.5 py-1.5 md:px-4 md:py-3">
                    {/* Top Pill Bar: Full Country + Zone Pill on left + Compact Selected Badge on right */}
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                        <span
                            data-testid="banner-country-pill"
                            className={cn(
                                "inline-flex min-w-0 items-center gap-1.5 rounded-full border border-foreground/30 bg-card px-2 py-0.5 font-bold text-foreground shadow-2xs",
                                isIndic ? "text-[10px] md:text-xs" : "text-[11px] md:text-xs"
                            )}
                        >
                            <CountryFlag
                                code={banner.flagCode}
                                title={banner.locationPill}
                                className="w-4 h-3 md:w-5 md:h-3.5 shrink-0"
                            />
                            <span className="truncate">{banner.locationPill}</span>
                        </span>

                        <span
                            data-testid="banner-selected-service"
                            className={cn(
                                "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-mono font-bold uppercase tracking-wide shadow-2xs",
                                isIndic ? "text-[9px] md:text-[10.5px]" : "text-[9.5px] md:text-[11px]",
                                activeServiceKey === "ems"
                                    ? "bg-[#FF8533] text-[#1A1714]"
                                    : "bg-[var(--svc)] text-white"
                            )}
                        >
                            {banner.selectedBadge}
                        </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <p
                                className={cn(
                                    "font-heading font-extrabold [font-stretch:88%] leading-tight text-foreground break-words",
                                    isIndic
                                        ? "text-[13px] sm:text-sm md:text-base"
                                        : "text-[14px] sm:text-base md:text-lg"
                                )}
                            >
                                {banner.title}
                            </p>
                            {banner.error ? (
                                <p className="flex items-center gap-1 font-mono text-[10.5px] md:text-xs font-medium text-destructive mt-0.5">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                    <span className="truncate">{banner.error}</span>
                                </p>
                            ) : (
                                <p
                                    className={cn(
                                        "font-mono text-foreground/80 truncate mt-0.5",
                                        isIndic ? "text-[9.5px] md:text-xs" : "text-[10px] md:text-xs"
                                    )}
                                >
                                    {banner.subtitle}
                                </p>
                            )}
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                            <div className="text-right">
                                <span className="inline-flex items-center justify-end gap-1 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-foreground/75 leading-none">
                                    <span>{tc("total")}</span>
                                    <span
                                        data-testid="banner-currency-indicator"
                                        className="rounded border border-foreground/30 bg-background/80 px-1 py-px text-[9px] font-bold text-foreground"
                                    >
                                        {CURRENCY_META[currency].symbol} {currency}
                                    </span>
                                </span>
                                <m.span
                                    key={`${activeServiceKey}-${currency}-${banner.total ?? "err"}`}
                                    initial={{ opacity: 0.65, y: 3 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.18, ease: "easeOut" }}
                                    data-testid="banner-total-price"
                                    className={cn(
                                        "block font-mono text-xl sm:text-2xl md:text-4xl font-bold tabular-nums leading-tight",
                                        banner.error ? "text-muted-foreground" : "text-[var(--c)]"
                                    )}
                                >
                                    {banner.total !== null
                                        ? (() => {
                                            const parts = splitCurrencyPrice(banner.total, currency, lkrPerUsd);
                                            return currency === "USD"
                                                ? `${parts.symbol}${parts.value}`
                                                : `${parts.symbol} ${parts.value}`;
                                        })()
                                        : "—"}
                                </m.span>
                                {currency === "USD" && banner.total !== null && (
                                    <span className="block font-mono text-[10px] font-medium text-foreground/75 tabular-nums leading-none mt-0.5">
                                        {tc("lkrEquivalent", { amount: banner.total.toLocaleString() })}
                                    </span>
                                )}
                            </div>
                            <Postmark
                                code={currency}
                                date={currency === "USD" ? `1$≈${Math.round(lkrPerUsd)}` : "17 NOV 26"}
                                size="sm"
                                tone="red"
                                rotate={-10}
                                className="hidden sm:block"
                            />
                        </div>
                    </div>

                    <div className="border-t border-dashed border-foreground/30 pt-1 mt-1 flex flex-wrap items-center justify-between gap-x-2.5 gap-y-0.5 font-mono text-[10.5px] md:text-xs">
                        {banner.items.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-foreground/80">
                                {banner.items.map((item) => (
                                    <span key={item.label}>
                                        {item.label}{" "}
                                        <strong className="text-foreground font-bold">{item.value}</strong>
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <span className="text-foreground/80 leading-snug">
                                {banner.footerNote ??
                                    (weightGrams <= 0 ? tc("enterValidWeight") : tc("adjustWeight"))}
                            </span>
                        )}
                        <span className="font-semibold text-foreground flex items-center gap-2">
                            {currency === "USD" && (
                                <span className="text-[10px] text-muted-foreground font-medium">
                                    {tc("exchangeRateNote", { rate: lkrPerUsd.toFixed(0) })}
                                </span>
                            )}
                            {banner.rightFooter && <span>{banner.rightFooter}</span>}
                        </span>
                    </div>
                </div>
            </div>

            {/* 3. Unified Compact Input Card: Step 1 Weight ([ - | ⚖️ 20 g | + ]) + Step 2 Country / COD Amount */}
            <div className="rounded-lg border-[1.5px] border-foreground bg-card p-1.5 md:p-3.5 shadow-[2px_2px_0_0_hsl(var(--foreground))] space-y-1.5">
                {/* Step 1: Centered Editable Weight Stepper ([ − | ⚖️ 20 g | + ]) */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label
                            htmlFor={weightInputId}
                            className={cn(
                                "flex items-center gap-1.5 font-heading font-extrabold uppercase tracking-wide text-foreground cursor-pointer",
                                isIndic ? "text-[10.5px] md:text-xs" : "text-xs md:text-sm"
                            )}
                        >
                            <StepBadge step={1} />
                            <span>{tc("step1Title")}</span>
                        </label>
                        <span className="font-mono text-[11px] md:text-xs font-bold text-foreground tabular-nums">
                            {weightGrams > 0 ? `= ${formatWeightLabel(weightGrams)}` : tc("enterGrams")}
                        </span>
                    </div>

                    <div className="grid grid-cols-[38px_1fr_38px] items-center rounded-md border-[1.5px] border-foreground bg-background overflow-hidden focus-within:ring-[3px] focus-within:ring-primary/25">
                        <button
                            type="button"
                            onClick={() => handleStepWeight("down")}
                            aria-label={tc("decreaseWeight")}
                            className="tap flex h-8 md:h-10 w-full items-center justify-center border-r border-foreground/30 bg-card text-foreground hover:bg-muted"
                        >
                            <Minus className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />
                        </button>

                        <label
                            htmlFor={weightInputId}
                            className="flex items-center justify-center gap-1.5 h-8 md:h-10 cursor-text px-2"
                        >
                            <Scale
                                className="w-3.5 h-3.5 md:w-4 md:h-4 text-muted-foreground shrink-0 pointer-events-none"
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
                                placeholder="20"
                                style={{ width: `${Math.max(2, (weight || "20").length + 0.5)}ch` }}
                                className="h-full bg-transparent text-center font-mono text-base md:text-lg font-bold text-foreground focus:outline-none tabular-nums"
                            />
                            <span className="pointer-events-none font-mono text-xs md:text-sm font-bold text-muted-foreground">
                                g
                            </span>
                        </label>

                        <button
                            type="button"
                            onClick={() => handleStepWeight("up")}
                            aria-label={tc("increaseWeight")}
                            className="tap flex h-8 md:h-10 w-full items-center justify-center border-l border-foreground/30 bg-card text-foreground hover:bg-muted"
                        >
                            <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />
                        </button>
                    </div>

                    <div className="mt-1 grid grid-cols-8 gap-1">
                        {weightPresets.map((preset) => {
                            const active = weightGrams === preset;
                            return (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setWeight(String(preset))}
                                    aria-pressed={active}
                                    className={cn(
                                        "tap flex items-center justify-center rounded-full border py-0.5 font-mono text-[10px] md:text-xs font-bold transition-colors min-h-[22px] md:min-h-[26px]",
                                        active
                                            ? "border-foreground bg-foreground text-background"
                                            : "border-foreground/35 bg-background text-foreground hover:border-foreground"
                                    )}
                                >
                                    {formatWeightLabel(preset)}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Step 2 (International): Destination Country & Air/Sea Mode inside the unified card */}
                {destination === "ems" && (
                    <div className="border-t border-border/80 pt-1.5 space-y-1">
                        <div className="flex items-center justify-between gap-1.5">
                            <label
                                htmlFor={emsCountryId}
                                className={cn(
                                    "flex items-center gap-1.5 font-heading font-extrabold uppercase tracking-wide text-foreground cursor-pointer min-w-0",
                                    isIndic ? "text-[10.5px] md:text-xs" : "text-xs md:text-sm"
                                )}
                            >
                                <StepBadge step={2} />
                                <span className="truncate">{tc("step2IntlTitle")}</span>
                            </label>
                            <button
                                type="button"
                                onClick={() => setShowCountryWhyNote((prev) => !prev)}
                                aria-expanded={showCountryWhyNote}
                                className="inline-flex items-center gap-1 font-mono text-[10px] md:text-[11px] font-semibold text-primary hover:underline shrink-0"
                            >
                                <Info className="w-3 h-3 shrink-0" aria-hidden="true" />
                                <span>{showCountryWhyNote ? tc("hideNote") : tc("missingWhy")}</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-[1fr_auto] gap-1 md:gap-2 items-center">
                            {/* Country Flag + Full-Width Select + Compact Chevron (no wide 'Change' text badge cutting off country name) */}
                            <div className="relative flex items-center h-8 md:h-10 min-w-0 rounded-md border-[1.5px] border-foreground bg-background px-1.5 md:px-2 gap-1.5 focus-within:ring-[3px] focus-within:ring-primary/25">
                                <span className="pointer-events-none shrink-0 flex items-center">
                                    <CountryFlag
                                        code={activeEmsCountry?.code ?? emsCountryCode}
                                        title={localizedCountryName}
                                        className="w-5 h-3.5 md:w-6 md:h-4"
                                    />
                                </span>
                                <select
                                    id={emsCountryId}
                                    name="emsCountry"
                                    value={emsCountryCode}
                                    onChange={(e) => setEmsCountryCode(e.target.value)}
                                    className={cn(
                                        "h-full flex-1 min-w-0 appearance-none bg-transparent font-bold text-foreground focus:outline-none cursor-pointer truncate",
                                        locale === "ta"
                                            ? "text-[11px] sm:text-sm md:text-base"
                                            : isIndic
                                                ? "text-xs sm:text-sm md:text-base"
                                                : "text-sm md:text-base"
                                    )}
                                >
                                    {sortedEmsCountries.map((c) => {
                                        const cName = getLocalizedCountryName(c.code, c.name, locale);
                                        const suffix =
                                            c.suspensionStatus === "suspended"
                                                ? tc("suspendedSuffix")
                                                : c.suspensionStatus === "restricted"
                                                    ? tc("noteSuffix")
                                                    : "";
                                        return (
                                            <option key={c.code} value={c.code}>
                                                {cName}
                                                {suffix}
                                            </option>
                                        );
                                    })}
                                </select>
                                <ChevronDown
                                    className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0 text-foreground pointer-events-none"
                                    strokeWidth={2.5}
                                    aria-hidden="true"
                                />
                            </div>

                            <div
                                role="group"
                                aria-label={tc("transportLabel")}
                                className="grid grid-cols-2 h-8 md:h-10 rounded-md border-[1.5px] border-foreground bg-background p-0.5 shrink-0"
                            >
                                <button
                                    type="button"
                                    onClick={() => handleIntlTransportChange("air")}
                                    aria-pressed={intlTransport === "air"}
                                    className={cn(
                                        "tap flex items-center justify-center gap-1 rounded-[4px] px-1.5 md:px-2 font-bold transition-colors",
                                        isIndic ? "text-[10.5px] md:text-xs" : "text-xs md:text-sm",
                                        intlTransport === "air"
                                            ? "bg-[#1D4E9E] text-white"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Plane className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" aria-hidden="true" />
                                    <span>{tc("air")}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleIntlTransportChange("sea")}
                                    aria-pressed={intlTransport === "sea"}
                                    className={cn(
                                        "tap flex items-center justify-center gap-1 rounded-[4px] px-1.5 md:px-2 font-bold transition-colors",
                                        isIndic ? "text-[10.5px] md:text-xs" : "text-xs md:text-sm",
                                        intlTransport === "sea"
                                            ? "bg-[#0E4A6B] text-white"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Ship className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" aria-hidden="true" />
                                    <span>{tc("sea")}</span>
                                </button>
                            </div>
                        </div>

                        <AnimatePresence initial={false}>
                            {showCountryWhyNote && (
                                <m.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2, ease: "easeOut" }}
                                    className="overflow-hidden"
                                >
                                    <div className="rounded-md border border-foreground/30 bg-muted/40 px-2.5 py-1.5 text-[11px] leading-snug text-foreground space-y-0.5">
                                        <p className="font-semibold">{tc("whyTitle")}</p>
                                        <p className="text-muted-foreground">{tc("whyBody")}</p>
                                    </div>
                                </m.div>
                            )}
                        </AnimatePresence>

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
                    </div>
                )}

                {/* Step 2 (COD): Collection Amount inside the unified card */}
                {destination === "cod" && (
                    <div className="border-t border-border/80 pt-1.5">
                        <div className="flex items-center justify-between mb-1">
                            <label
                                htmlFor={codAmountId}
                                className={cn(
                                    "flex items-center gap-1.5 font-heading font-extrabold uppercase tracking-wide text-foreground cursor-pointer",
                                    isIndic ? "text-[11px] md:text-xs" : "text-xs md:text-sm"
                                )}
                            >
                                <StepBadge step={2} />
                                <span>{tc("step2CodTitle")}</span>
                            </label>
                            <span className="font-mono text-[10.5px] font-semibold text-muted-foreground">
                                {tc("maxCodAmount")}
                            </span>
                        </div>

                        <div className="grid grid-cols-[40px_1fr_40px] items-center rounded-md border-[1.5px] border-foreground bg-background overflow-hidden focus-within:ring-[3px] focus-within:ring-primary/25">
                            <button
                                type="button"
                                onClick={() => handleStepCodAmount("down")}
                                aria-label={tc("decreaseCod")}
                                className="tap flex h-9 md:h-10 w-full items-center justify-center border-r border-foreground/30 bg-card text-foreground hover:bg-muted"
                            >
                                <Minus className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />
                            </button>

                            <label
                                htmlFor={codAmountId}
                                className="flex items-center justify-center gap-1 h-9 md:h-10 cursor-text px-2"
                            >
                                <span
                                    className="pointer-events-none font-mono text-xs md:text-sm font-bold text-muted-foreground"
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
                                    placeholder="2500"
                                    style={{ width: `${Math.max(4, (codAmount || "2500").length + 0.5)}ch` }}
                                    className="h-full bg-transparent text-center font-mono text-base md:text-lg font-bold text-foreground focus:outline-none tabular-nums"
                                />
                            </label>

                            <button
                                type="button"
                                onClick={() => handleStepCodAmount("up")}
                                aria-label={tc("increaseCod")}
                                className="tap flex h-9 md:h-10 w-full items-center justify-center border-l border-foreground/30 bg-card text-foreground hover:bg-muted"
                            >
                                <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />
                            </button>
                        </div>

                        <div className="mt-1 flex items-center gap-1 overflow-x-auto scrollbar-hide pb-0.5">
                            {COD_AMOUNT_PRESETS.map((amt) => {
                                const active = collectAmountNum === amt;
                                return (
                                    <button
                                        key={amt}
                                        type="button"
                                        onClick={() => setCodAmount(String(amt))}
                                        aria-pressed={active}
                                        className={cn(
                                            "tap shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10.5px] md:text-xs font-bold transition-colors min-h-[24px]",
                                            active
                                                ? "border-foreground bg-foreground text-background"
                                                : "border-foreground/35 bg-background text-foreground hover:border-foreground"
                                        )}
                                    >
                                        Rs. {formatCompactAmount(amt)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
            </div>

            {/* Right Workbench Column on Desktop (Step 3 Service Comparison Grid / Local Services / COD Breakdown) */}
            <div className="contents lg:flex lg:flex-col lg:col-span-7 lg:gap-4">
            {/* 4A. Domestic Mode: Step 2 Service Grid + Add-ons */}
            {destination === "domestic" && (
                <div className="rounded-lg border-[1.5px] border-foreground bg-card p-2 md:p-3.5 shadow-[2px_2px_0_0_hsl(var(--foreground))] flex flex-col gap-2">
                    <fieldset className="contents">
                        <legend className="flex items-center justify-between w-full mb-0.5">
                            <span
                                className={cn(
                                    "flex items-center gap-1.5 font-heading font-extrabold uppercase tracking-wide text-foreground",
                                    isIndic ? "text-[11px] md:text-xs" : "text-xs md:text-sm"
                                )}
                            >
                                <StepBadge step={2} />
                                <span>{tc("step2LocalTitle")}</span>
                            </span>
                        </legend>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 md:gap-2">
                            {domesticQuotes.map(({ service, result }, i) => {
                                const isOver = Boolean(result.exceedsMaxWeight);
                                const svcTagline = getServiceTagline(service.id, locale);
                                return (
                                    <ServiceCard
                                        key={service.id}
                                        serviceId={service.id}
                                        name={svcTagline.shortName || service.shortName || service.name}
                                        selected={selectedService?.id === service.id}
                                        dimmed={isOver}
                                        cheapest={i === domesticCheapest}
                                        cheapestLabel={tHome("cheapest")}
                                        selectedCardHeader={tc("selectedCardHeader", { tag: svcTagline.shortTag })}
                                        locale={locale}
                                        currency={currency}
                                        lkrPerUsd={lkrPerUsd}
                                        onSelect={() => setServiceId(service.id)}
                                        price={isOver || result.error ? null : result.totalCost}
                                        status={
                                            isOver && result.maxWeight
                                                ? { text: tc("maxWeight", { weight: formatWeightLabel(result.maxWeight) }), tone: "error" }
                                                : { text: "—", tone: "muted" }
                                        }
                                        note={service.flatRate && !isOver ? tc("flatRate") : undefined}
                                    />
                                );
                            })}
                        </div>
                    </fieldset>

                    {/* Compact Add-ons Bar */}
                    <div className="grid grid-cols-2 gap-1.5 md:gap-2 pt-1 border-t border-border">
                        <div
                            className={cn(
                                "flex items-center gap-2 rounded-md border-[1.5px] px-2 py-1.5 transition-colors min-h-[40px]",
                                !canRegister
                                    ? "border-border/60 bg-muted/40 opacity-60"
                                    : registered
                                        ? "border-foreground bg-background"
                                        : "border-border bg-background"
                            )}
                        >
                            <input
                                type="checkbox"
                                id={regCheckboxId}
                                name="registered"
                                checked={registered && canRegister}
                                disabled={!canRegister}
                                onChange={(e) => setRegistered(e.target.checked)}
                                className="h-4 w-4 shrink-0 rounded-sm border-foreground accent-[#1E40AF] cursor-pointer disabled:cursor-not-allowed"
                            />
                            <label
                                htmlFor={regCheckboxId}
                                className={cn(
                                    "flex-1 font-semibold leading-tight select-none",
                                    isIndic ? "text-[11px] md:text-xs" : "text-xs md:text-sm",
                                    canRegister ? "cursor-pointer text-foreground" : "cursor-not-allowed text-muted-foreground"
                                )}
                            >
                                <span className="block">{tc("registeredPost")}</span>
                                <span className="block font-mono text-[10px] text-muted-foreground">
                                    {canRegister
                                        ? formatCurrencyAmount(config.extraFees.registeredPost, currency, lkrPerUsd, { plus: true })
                                        : tc("naForService")}
                                </span>
                            </label>
                        </div>

                        <div
                            className={cn(
                                "flex items-center gap-2 rounded-md border-[1.5px] px-2 py-1.5 transition-colors min-h-[40px]",
                                !canAr
                                    ? "border-border/60 bg-muted/40 opacity-60"
                                    : arReceipt
                                        ? "border-foreground bg-background"
                                        : "border-border bg-background"
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
                                    "flex-1 font-semibold leading-tight select-none",
                                    isIndic ? "text-[11px] md:text-xs" : "text-xs md:text-sm",
                                    canAr ? "cursor-pointer text-foreground" : "cursor-not-allowed text-muted-foreground"
                                )}
                            >
                                <span className="block">{tc("arReceipt")}</span>
                                <span className="block font-mono text-[10px] text-muted-foreground">
                                    {canAr
                                        ? formatCurrencyAmount(config.extraFees.arReceipt, currency, lkrPerUsd, { plus: true })
                                        : tc("naForService")}
                                </span>
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* 4B. COD Mode: Step 3 Formula Breakdown */}
            {destination === "cod" && (
                <div className="rounded-lg border-[1.5px] border-foreground bg-card p-2 md:p-3.5 shadow-[2px_2px_0_0_hsl(var(--foreground))] flex flex-col gap-1.5">
                    <div
                        className={cn(
                            "flex items-center gap-1.5 font-heading font-extrabold uppercase tracking-wide text-foreground",
                            isIndic ? "text-[11px] md:text-xs" : "text-xs md:text-sm"
                        )}
                    >
                        <StepBadge step={3} />
                        <span>{tc("step3CodTitle")}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 md:gap-2">
                        <div className="rounded-md border-[1.5px] border-border bg-background px-2 py-1.5">
                            <span className="block font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground truncate">
                                {tc("slpCourier")}
                            </span>
                            <span className="block font-mono text-xs sm:text-sm md:text-base font-bold text-foreground mt-0.5 tabular-nums">
                                {formatCurrencyAmount(codResult.courierFee, currency, lkrPerUsd)}
                            </span>
                        </div>
                        <div className="rounded-md border-[1.5px] border-border bg-background px-2 py-1.5">
                            <span className="block font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground truncate">
                                {tc("pmtMoFee")}
                            </span>
                            <span className="block font-mono text-xs sm:text-sm md:text-base font-bold text-foreground mt-0.5 tabular-nums">
                                {formatCurrencyAmount(codResult.moneyOrderFee, currency, lkrPerUsd)}
                            </span>
                        </div>
                        <div className="rounded-md border-[1.5px] border-border bg-background px-2 py-1.5">
                            <span className="block font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground truncate">
                                {tc("codService")}
                            </span>
                            <span className="block font-mono text-xs sm:text-sm md:text-base font-bold text-foreground mt-0.5 tabular-nums">
                                {formatCurrencyAmount(codResult.codServiceFee, currency, lkrPerUsd)}
                            </span>
                        </div>
                    </div>

                    {codResult.subPostOfficeWarning && !codResult.error && (
                        <p className="flex items-start gap-1.5 rounded-md border border-secondary bg-secondary/20 px-2.5 py-1.5 text-[10.5px] md:text-xs text-foreground leading-snug">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" aria-hidden="true" />
                            <span>{tc("subPoWarning")}</span>
                        </p>
                    )}
                </div>
            )}

            {/* 4C. International Mail Mode: Step 3 Service Selection Grid (High Above the Fold) */}
            {destination === "ems" && (
                <div className="rounded-lg border-[1.5px] border-foreground bg-card p-1.5 md:p-3.5 shadow-[2px_2px_0_0_hsl(var(--foreground))] flex flex-col gap-1.5">
                    <fieldset className="contents">
                        <legend className="flex items-center justify-between w-full mb-0.5">
                            <span
                                className={cn(
                                    "flex items-center gap-1.5 font-heading font-extrabold uppercase tracking-wide text-foreground",
                                    isIndic ? "text-[10.5px] md:text-xs" : "text-xs md:text-sm"
                                )}
                            >
                                <StepBadge step={3} />
                                <span>
                                    {intlTransport === "air"
                                        ? tc("step3AirTitle")
                                        : tc("step3SeaTitle")}
                                </span>
                            </span>
                        </legend>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 md:gap-2">
                            {filteredIntlQuotes.map((quote, i) => {
                                const isOver = quote.available && Boolean(quote.result.exceedsMaxWeight);
                                const hasPrice = quote.available && !isOver && !quote.result.error;
                                const svcTagline = getServiceTagline(quote.service.id, locale);
                                return (
                                    <ServiceCard
                                        key={quote.service.id}
                                        serviceId={quote.service.id}
                                        name={svcTagline.shortName || quote.service.shortName}
                                        selected={activeIntlQuote.service.id === quote.service.id}
                                        dimmed={!quote.available || isOver}
                                        cheapest={i === intlCheapest}
                                        cheapestLabel={tHome("cheapest")}
                                        selectedCardHeader={tc("selectedCardHeader", { tag: svcTagline.shortName || svcTagline.shortTag })}
                                        locale={locale}
                                        currency={currency}
                                        lkrPerUsd={lkrPerUsd}
                                        onSelect={() => setIntlServiceId(quote.service.id)}
                                        price={hasPrice ? quote.result.totalCost : null}
                                        status={
                                            !quote.available
                                                ? { text: quote.shortUnavailableTag ?? "Unavailable", tone: "error" }
                                                : isOver && quote.result.maxWeight
                                                    ? { text: tc("maxWeight", { weight: formatWeightLabel(quote.result.maxWeight) }), tone: "error" }
                                                    : { text: "—", tone: "muted" }
                                        }
                                        note={hasPrice && quote.service.supportsRegistration && intlRegistered ? tc("itemReg") : undefined}
                                    />
                                );
                            })}
                        </div>
                    </fieldset>

                    {/* Foreign Registered Mail (+Rs. 870) + Group / Limit Info */}
                    <div className="grid grid-cols-2 gap-1.5 md:gap-2 pt-1 border-t border-border">
                        <div
                            className={cn(
                                "flex items-center gap-2 rounded-md border-[1.5px] px-2 py-1 transition-colors min-h-[38px]",
                                !canIntlRegister
                                    ? "border-border/60 bg-muted/40 opacity-60"
                                    : intlRegistered
                                        ? "border-foreground bg-background"
                                        : "border-border bg-background"
                            )}
                        >
                            <input
                                type="checkbox"
                                id={intlRegCheckboxId}
                                name="intlRegistered"
                                checked={intlRegistered && canIntlRegister}
                                disabled={!canIntlRegister}
                                onChange={(e) => setIntlRegistered(e.target.checked)}
                                className="h-4 w-4 shrink-0 rounded-sm border-foreground accent-[#1E40AF] cursor-pointer disabled:cursor-not-allowed"
                            />
                            <label
                                htmlFor={intlRegCheckboxId}
                                className={cn(
                                    "flex-1 font-semibold leading-tight select-none",
                                    isIndic ? "text-[11px] md:text-xs" : "text-xs md:text-sm",
                                    canIntlRegister ? "cursor-pointer text-foreground" : "cursor-not-allowed text-muted-foreground"
                                )}
                            >
                                <span className="block">{tc("registeredShort")}</span>
                                <span className="block font-mono text-[9.5px] md:text-[10.5px] text-muted-foreground">
                                    {canIntlRegister
                                        ? formatCurrencyAmount(foreignRegFeeAmount, currency, lkrPerUsd, { plus: true })
                                        : tc("trackedNa")}
                                </span>
                            </label>
                        </div>

                        <div className="rounded-md border-[1.5px] border-border bg-background px-2 py-1 lg:px-3 lg:py-2 flex flex-col justify-center min-h-[38px] lg:min-h-[48px]">
                            <span className="font-mono text-[9px] md:text-[10px] uppercase tracking-wider text-muted-foreground leading-none truncate">
                                {activeIntlQuote.service.id === "ems" ? tc("emsTariffZone") : tc("countryGroup")}
                            </span>
                            <span className="font-mono text-[11px] md:text-xs lg:text-sm font-bold text-foreground mt-0.5 truncate">
                                {activeIntlQuote.service.id === "ems"
                                    ? `${localizedZone.short} · ${tc("maxWeight", { weight: formatWeightLabel(activeIntlQuote.result.maxWeight ?? activeIntlQuote.service.maxWeight) })}`
                                    : `${tc("groupLabel", { group: activeEmsCountry?.group ?? "—" })} · ${tc("maxWeight", { weight: formatWeightLabel(activeIntlQuote.result.maxWeight ?? activeIntlQuote.service.maxWeight) })}`}
                            </span>
                        </div>
                    </div>
                </div>
            )}
            </div>

            {/* 5. Compact 1-line Mobile Reference Footer */}
            <p className="md:hidden text-center font-mono text-[10px] text-muted-foreground pt-0.5">
                {tc("mobileFooter")}
            </p>
        </form>
    );
}
