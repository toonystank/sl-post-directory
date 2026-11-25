"use client";

import { useState, useEffect, useId, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { m, AnimatePresence } from "motion/react";
import {
    AlertTriangle,
    Banknote,
    Book,
    BookOpen,
    Check,
    ChevronDown,
    FileText,
    Info,
    Landmark,
    Mail,
    Minus,
    Newspaper,
    Package,
    Plane,
    Plus,
    Scale,
    ShieldCheck,
    Ship,
    Stamp,
    Tag,
    Truck,
    Zap,
} from "lucide-react";
import Postmark from "@/components/brand/Postmark";
import CountryFlag from "@/components/brand/CountryFlag";
import CountrySelector from "@/components/CountrySelector";
import { useCurrency } from "@/context/CurrencyContext";
import { CURRENCY_META, Currency, formatCurrencyAmount, splitCurrencyPrice } from "@/lib/currency";
import { MODE_COLORS, getServiceColor, serviceStyle } from "@/lib/service-colors";
import {
    getLocalizedCountryName,
    getServiceTagline,
    stepCodAmount,
    stepWeight,
} from "@/lib/calculator-ui";
import { triggerHaptic } from "@/lib/haptics";
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

const MOBILE_DOMESTIC_WEIGHT_PRESETS = [30, 100, 250, 1000, 5000];
const MOBILE_COD_WEIGHT_PRESETS = [250, 500, 1000, 2000, 5000];
const MOBILE_INTL_WEIGHT_PRESETS = [250, 500, 1000, 2000, 5000];

const COD_AMOUNT_PRESETS = [1000, 2500, 5000, 10000, 25000, 50000];

let cachedRateConfig: RateConfig | null = null;
let cachedRateConfigTimestamp = 0;
const RATE_CACHE_TTL_MS = 10 * 60_000;

const SERVICE_ICON_MAP: Record<string, typeof Mail> = {
    ems: Zap,
    air_parcel: Package,
    parcel: Package,
    air_letter: Plane,
    air_printed: BookOpen,
    u_packet: Tag,
    tds: ShieldCheck,
    sea_parcel: Ship,
    sea_letter: Mail,
    letter: Mail,
    sea_printed: Book,
    open_article: FileText,
    courier: Truck,
    speed_post: Truck,
    state: Landmark,
    newspaper: Newspaper,
    postcard: Stamp,
    cod: Banknote,
};

/** Distinct icon per service so users build immediate colour + icon muscle memory. */
function ServiceIcon({
    serviceId,
    className,
    strokeWidth,
}: {
    serviceId: string;
    className?: string;
    strokeWidth?: number;
}) {
    const IconComponent = SERVICE_ICON_MAP[serviceId] ?? Mail;
    return <IconComponent className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}

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

function formatWeightDraft(gramsStr: string, unit: "g" | "kg"): string {
    const grams = parseInt(gramsStr, 10);
    if (!Number.isFinite(grams) || grams <= 0) return "";
    if (unit === "g") return String(grams);
    return Number((grams / 1000).toFixed(3)).toString();
}

function formatCompactAmount(amount: number): string {
    if (amount >= 1000) {
        const k = amount / 1000;
        return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
    }
    return String(amount);
}

/**
 * Muscle-memory full-colour service tile:
 * - Distinct background tint + darker 3D tactile bottom lip + unmistakable icon.
 * - Selected tiles get a crisp high-contrast outer ring and white check badge.
 * - Unavailable or overweight tiles cleanly desaturate with a subtle status badge.
 */
function ServiceCard({
    serviceId,
    name,
    selected,
    dimmed,
    cheapest,
    cheapestLabel,
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

    const topStripe =
        serviceId === "ems"
            ? "ems-stripe"
            : serviceId === "air_letter" || serviceId === "air_printed"
                ? "par-avion-stripe"
                : null;

    if (dimmed || priceParts === null) {
        return (
            <m.button
                type="button"
                onClick={onSelect}
                aria-pressed={selected}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 480, damping: 30 }}
                style={serviceStyle(color)}
                className={cn(
                    "svc tap relative flex flex-col justify-between overflow-hidden rounded-[16px] border px-2.5 py-2 text-left transition-colors min-h-[74px] md:min-h-[86px]",
                    selected
                        ? "border-destructive bg-muted/90 ring-2 ring-destructive/40"
                        : "border-border bg-muted/70 opacity-75 hover:opacity-95"
                )}
            >
                <div className="flex w-full items-center justify-between gap-1.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-muted-foreground">
                        <ServiceIcon serviceId={serviceId} className="h-3.5 w-3.5" strokeWidth={2.3} />
                    </span>
                    <span
                        className={cn(
                            "rounded-full border px-1.5 py-0.5 font-mono text-[9px] md:text-[10px] font-bold truncate",
                            status?.tone === "error"
                                ? "border-destructive/40 bg-destructive/10 text-destructive"
                                : "border-border bg-card text-muted-foreground"
                        )}
                    >
                        {status?.text ?? "—"}
                    </span>
                </div>

                <div className="mt-1.5 w-full min-w-0">
                    <span
                        className={cn(
                            "block font-bold leading-tight text-foreground/85 truncate",
                            isIndic ? "text-[11px] md:text-xs" : "text-[12px] md:text-sm"
                        )}
                    >
                        {name}
                    </span>
                    <p
                        className={cn(
                            "text-muted-foreground truncate leading-tight mt-0.5",
                            isIndic ? "text-[9px] md:text-[10.5px]" : "text-[10px] md:text-xs"
                        )}
                    >
                        {tagline.cardHint}
                    </p>
                </div>
            </m.button>
        );
    }

    return (
        <m.button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            whileHover={{ y: -1.5 }}
            whileTap={{ scale: 0.975 }}
            transition={{ type: "spring", stiffness: 480, damping: 30 }}
            style={{
                ...serviceStyle(color),
                backgroundColor: "var(--svc)",
                boxShadow: "0 3px 0 0 var(--cl)",
            }}
            className={cn(
                "svc tap relative flex flex-col justify-between overflow-hidden rounded-[16px] border border-white/20 px-2.5 py-2 text-left text-white transition-all min-h-[78px] md:min-h-[90px]",
                selected &&
                    "ring-2 ring-foreground ring-offset-2 ring-offset-background"
            )}
        >
            {topStripe && (
                <span
                    aria-hidden="true"
                    className={cn("absolute inset-x-0 top-0 h-[3px]", topStripe)}
                />
            )}

            <div className={cn("w-full min-w-0", topStripe && "pt-0.5")}>
                <div className="flex w-full items-center justify-between gap-1.5">
                    <span className="flex items-center gap-1.5 min-w-0">
                        <span
                            style={{
                                backgroundColor: color.iconBg ?? "rgba(255, 255, 255, 0.22)",
                                color: color.iconFg ?? "#FFFFFF",
                            }}
                            className="flex h-6 w-6 md:h-7 md:w-7 shrink-0 items-center justify-center rounded-full"
                        >
                            <ServiceIcon serviceId={serviceId} className="h-3.5 w-3.5 md:h-4 md:w-4" strokeWidth={2.4} />
                        </span>
                        <span
                            className={cn(
                                "font-extrabold leading-tight text-white truncate",
                                isIndic ? "text-[11px] sm:text-xs md:text-sm" : "text-[12px] md:text-sm"
                            )}
                        >
                            {name}
                        </span>
                    </span>

                    {selected && (
                        <span
                            style={{ color: "var(--svc)" }}
                            className="flex h-4 w-4 md:h-5 md:w-5 shrink-0 items-center justify-center rounded-full bg-white shadow-xs"
                        >
                            <Check className="h-2.5 w-2.5 md:h-3 md:w-3" strokeWidth={3.2} aria-hidden="true" />
                        </span>
                    )}
                </div>

                <p
                    className={cn(
                        "truncate text-white/85 leading-tight mt-0.5",
                        isIndic ? "text-[9px] md:text-[10.5px]" : "text-[10px] md:text-[11px]"
                    )}
                >
                    {tagline.cardHint}
                </p>
            </div>

            <div className="mt-1.5 flex w-full items-center justify-between gap-1.5">
                <span className="font-mono text-[14px] sm:text-[15px] md:text-lg font-black text-white tabular-nums leading-none shrink-0">
                    {currency === "USD" ? (
                        <>
                            <span className="text-[11px] md:text-xs font-bold mr-px">{priceParts.symbol}</span>
                            {priceParts.value}
                        </>
                    ) : (
                        <>
                            <span className="text-[10.5px] md:text-xs font-bold">{priceParts.symbol}</span>{" "}
                            {priceParts.value}
                        </>
                    )}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                    {note && (
                        <span className="font-mono text-[9.5px] font-bold text-white/85">
                            {note}
                        </span>
                    )}
                    {cheapest && (
                        <span
                            className={cn(
                                "shrink-0 rounded-full bg-black/25 px-1.5 py-0.5 font-bold uppercase tracking-wide text-white",
                                isIndic ? "text-[8px] md:text-[9px]" : "text-[8.5px] md:text-[9.5px]"
                            )}
                        >
                            {cheapestLabel}
                        </span>
                    )}
                </span>
            </div>
        </m.button>
    );
}

export interface PostageCalculatorProps {
    initialMode?: Destination;
    initialCountry?: string;
    initialWeight?: string;
    initialCodAmount?: string;
    initialService?: string;
    initialTransport?: InternationalTransport;
    initialRegistered?: boolean;
}

export default function PostageCalculator({
    initialMode = "ems",
    initialCountry,
    initialWeight,
    initialCodAmount,
    initialService,
    initialTransport,
    initialRegistered,
}: PostageCalculatorProps) {
    const locale = useLocale();
    const isIndic = locale === "si" || locale === "ta";
    const tHome = useTranslations("Home");
    const tc = useTranslations("Calculator");
    const { currency, lkrPerUsd } = useCurrency();

    const defaultInitialWeight =
        initialWeight && /^\d+$/.test(initialWeight) && Number(initialWeight) > 0
            ? initialWeight
            : initialMode === "cod"
                ? "250"
                : initialMode === "ems"
                    ? "20"
                    : "30";

    const [config, setConfig] = useState<RateConfig>(() =>
        cachedRateConfig && Date.now() - cachedRateConfigTimestamp < RATE_CACHE_TTL_MS
            ? cachedRateConfig
            : DEFAULT_RATE_CONFIG
    );
    const [destination, setDestination] = useState<Destination>(initialMode);
    const [serviceId, setServiceId] = useState<string>(
        initialMode === "domestic" && initialService ? initialService : "letter"
    );
    const [emsCountryCode, setEmsCountryCode] = useState<string>(
        initialCountry && DEFAULT_RATE_CONFIG.emsCountries.some((c) => c.code === initialCountry)
            ? initialCountry
            : "GB"
    );
    const [intlTransport, setIntlTransport] = useState<InternationalTransport>(initialTransport ?? "air");
    const [intlServiceId, setIntlServiceId] = useState<InternationalServiceId>(
        initialMode === "ems" && initialService
            ? (initialService as InternationalServiceId)
            : initialTransport === "sea"
                ? "sea_letter"
                : "ems"
    );
    const [intlRegistered, setIntlRegistered] = useState(Boolean(initialMode === "ems" && initialRegistered));
    const [showCountryWhyNote, setShowCountryWhyNote] = useState(false);
    const [countryPickerOpen, setCountryPickerOpen] = useState(false);
    const [receiptExpanded, setReceiptExpanded] = useState(false);

    const [weight, setWeight] = useState<string>(defaultInitialWeight);
    const [weightUnit, setWeightUnit] = useState<"g" | "kg">("g");
    const [weightInputText, setWeightInputText] = useState<string>(defaultInitialWeight);

    const [codAmount, setCodAmount] = useState<string>(
        initialCodAmount && /^\d+$/.test(initialCodAmount) && Number(initialCodAmount) > 0
            ? initialCodAmount
            : "2500"
    );
    const [registered, setRegistered] = useState(Boolean(initialMode === "domestic" && initialRegistered));
    const [arReceipt, setArReceipt] = useState(false);

    const uid = useId();
    const weightInputId = `${uid}-weight`;
    const codAmountId = `${uid}-cod-amount`;
    const emsCountryId = `${uid}-ems-country`;
    const regCheckboxId = `${uid}-registered`;
    const arCheckboxId = `${uid}-ar-receipt`;
    const intlRegCheckboxId = `${uid}-intl-registered`;
    const receiptDetailsId = `${uid}-receipt-details`;

    const modeOptions: { id: Destination; label: string; icon: typeof Mail }[] = [
        { id: "ems", label: tc("modeIntl"), icon: Plane },
        { id: "cod", label: tc("modeCod"), icon: Banknote },
        { id: "domestic", label: tc("modeLocal"), icon: Mail },
    ];

    useEffect(() => {
        if (typeof window === "undefined" || !window.location.search) return;
        let cancelled = false;
        queueMicrotask(() => {
            if (cancelled) return;
            const sp = new URLSearchParams(window.location.search);
            const m = sp.get("mode");
            const mode: Destination =
                m === "cod" ? "cod" : m === "local" ? "domestic" : m === "intl" || m === "ems" ? "ems" : initialMode;
            if (m) setDestination(mode);

            const c = sp.get("country")?.toUpperCase();
            if (c && DEFAULT_RATE_CONFIG.emsCountries.some((item) => item.code === c)) {
                setEmsCountryCode(c);
            }

            const w = sp.get("weight");
            if (w && /^\d+$/.test(w) && Number(w) > 0) {
                setWeight(w);
                setWeightUnit("g");
                setWeightInputText(w);
            }

            const cod = sp.get("codAmount");
            if (cod && /^\d+$/.test(cod) && Number(cod) > 0) {
                setCodAmount(cod);
            }

            const tr = sp.get("transport");
            if (tr === "sea" || tr === "air") {
                setIntlTransport(tr);
            }

            const svc = sp.get("service");
            if (svc) {
                if (mode === "domestic") setServiceId(svc);
                else if (mode === "ems") setIntlServiceId(svc as InternationalServiceId);
            } else if (tr === "sea" && mode === "ems") {
                setIntlServiceId("sea_letter");
            }

            const reg = sp.get("registered");
            if (reg === "1" || reg === "true") {
                if (mode === "domestic") setRegistered(true);
                else if (mode === "ems") setIntlRegistered(true);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [initialMode]);

    useEffect(() => {
        let active = true;
        const RATE_STORAGE_KEY = "sl-post-rate-config-v1";

        const applyVariables = (vars: { key: string; value: string }[]) => {
            if (!active) return;
            const loaded: Partial<RateConfig> = {};
            for (const v of vars) {
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
        };

        if (cachedRateConfig && Date.now() - cachedRateConfigTimestamp < RATE_CACHE_TTL_MS) {
            return;
        }

        let isLocalFresh = false;
        try {
            const raw = window.localStorage.getItem(RATE_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as { vars?: { key: string; value: string }[]; savedAt?: number };
                if (Array.isArray(parsed.vars)) {
                    const vars = parsed.vars;
                    queueMicrotask(() => applyVariables(vars));
                    if (typeof parsed.savedAt === "number" && Date.now() - parsed.savedAt < RATE_CACHE_TTL_MS) {
                        isLocalFresh = true;
                    }
                }
            }
        } catch {
            // Ignore storage errors
        }

        if (isLocalFresh || (typeof navigator !== "undefined" && !navigator.onLine)) {
            return;
        }

        const controller = new AbortController();
        const fetchConfig = async () => {
            try {
                const res = await fetch("/api/public/config", { signal: controller.signal });
                if (!res.ok || !active) return;
                const data = (await res.json()) as { rateVariables?: { key: string; value: string }[] };
                const vars = Array.isArray(data?.rateVariables) ? data.rateVariables : [];
                if (!active) return;

                try {
                    window.localStorage.setItem(
                        RATE_STORAGE_KEY,
                        JSON.stringify({ vars, savedAt: Date.now() })
                    );
                } catch {
                    // Ignore storage quota errors
                }

                if (vars.length > 0) {
                    applyVariables(vars);
                }
            } catch (e) {
                if ((e as Error)?.name === "AbortError") return;
            }
        };

        const timer = window.setTimeout(fetchConfig, 400);
        return () => {
            active = false;
            window.clearTimeout(timer);
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

    const desktopWeightPresets =
        destination === "cod"
            ? COD_WEIGHT_PRESETS
            : destination === "ems"
                ? INTL_WEIGHT_PRESETS
                : DOMESTIC_WEIGHT_PRESETS;

    const mobileWeightPresets =
        destination === "cod"
            ? MOBILE_COD_WEIGHT_PRESETS
            : destination === "ems"
                ? MOBILE_INTL_WEIGHT_PRESETS
                : MOBILE_DOMESTIC_WEIGHT_PRESETS;

    const defaultWeightForMode = (mode: Destination) =>
        mode === "cod" ? "250" : mode === "ems" ? "20" : "30";

    const applyGramsWeight = (gramsStr: string, targetUnit: "g" | "kg" = weightUnit) => {
        setWeight(gramsStr);
        setWeightInputText(formatWeightDraft(gramsStr, targetUnit));
    };

    const resetCalculatorForMode = (mode: Destination) => {
        const nextW = defaultWeightForMode(mode);
        setDestination(mode);
        setWeightUnit("g");
        applyGramsWeight(nextW, "g");
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
        setReceiptExpanded(false);
    };

    const handleModeChange = (mode: Destination) => {
        triggerHaptic("selection");
        resetCalculatorForMode(mode);
    };

    const handleIntlTransportChange = (transport: InternationalTransport) => {
        if (transport === intlTransport) return;
        triggerHaptic("selection");
        setIntlTransport(transport);
        // Preserve entered parcel weight when switching Air <-> Sea so users can compare directly!
        const nextId: InternationalServiceId =
            transport === "air"
                ? "ems"
                : weightGrams > 2000
                    ? "sea_parcel"
                    : "sea_letter";
        setIntlServiceId(nextId);
        setIntlRegistered(false);
    };

    const handleWeightTextChange = (raw: string) => {
        if (weightUnit === "g") {
            const clean = sanitizeDigits(raw);
            setWeightInputText(clean);
            setWeight(clean);
            return;
        }
        const clean = raw.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
        setWeightInputText(clean);
        if (!clean || clean === ".") {
            setWeight("");
            return;
        }
        const parsedKg = parseFloat(clean);
        if (Number.isFinite(parsedKg)) {
            const grams = Math.min(99999, Math.round(parsedKg * 1000));
            setWeight(grams > 0 ? String(grams) : "");
        }
    };

    const handleToggleWeightUnit = () => {
        triggerHaptic("selection");
        const nextUnit = weightUnit === "g" ? "kg" : "g";
        setWeightUnit(nextUnit);
        setWeightInputText(formatWeightDraft(weight, nextUnit));
    };

    const handleStepWeight = (direction: "up" | "down") => {
        triggerHaptic("selection");
        const next = stepWeight(weightGrams, direction, 10, 40000);
        applyGramsWeight(String(next));
    };

    const handleStepCodAmount = (direction: "up" | "down") => {
        triggerHaptic("selection");
        const next = stepCodAmount(collectAmountNum, direction, 500, 100000);
        setCodAmount(String(next));
    };

    const localizedCountryName = getLocalizedCountryName(
        activeEmsCountry?.code,
        activeEmsCountry?.name ?? "United Kingdom",
        locale
    );

    // Derive Hero Price Receipt Banner state (zone-free!)
    const banner = (() => {
        if (destination === "domestic") {
            const title = activeTagline.name || selectedService?.name || "Domestic Mail";
            const badgeLabel = activeTagline.shortName || selectedService?.shortName || "Letter";
            const maxWeightLabel = activeDomesticResult.maxWeight
                ? tc("maxWeight", { weight: formatWeightLabel(activeDomesticResult.maxWeight) })
                : undefined;

            if (activeDomesticResult.error) {
                return {
                    flagCode: "LK",
                    locationPill: tc("locationLocal"),
                    badgeLabel,
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
                badgeLabel,
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
                    badgeLabel: tc("modeCod"),
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
                badgeLabel: tc("modeCod"),
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
        const badgeLabel = isRegActive
            ? tc("registeredPrefix", { service: localizedShortName })
            : localizedShortName;

        const maxW = activeIntlQuote.result.maxWeight ?? activeIntlQuote.service.maxWeight;
        const rightFooter = maxW ? tc("maxWeight", { weight: formatWeightLabel(maxW) }) : undefined;

        if (!activeIntlQuote.available) {
            return {
                flagCode: activeEmsCountry?.code ?? "GB",
                locationPill: localizedCountryName,
                badgeLabel,
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
                locationPill: localizedCountryName,
                badgeLabel,
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
            locationPill: localizedCountryName,
            badgeLabel,
            title: serviceLabel,
            subtitle: `${activeTagline.cardHint} · ${activeIntlQuote.result.tierLabel}`,
            total: activeIntlQuote.result.totalCost,
            error: undefined,
            footerNote: undefined,
            rightFooter,
            items,
        };
    })();

    const priceParts =
        banner.total !== null ? splitCurrencyPrice(banner.total, currency, lkrPerUsd) : null;

    return (
        <form
            onSubmit={(e) => e.preventDefault()}
            aria-label={tc("formAriaLabel")}
            className="w-full flex flex-col gap-1.5 md:gap-3 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start"
        >
            {/* Left Workbench Column on Desktop: Mode Segmented Control + Pinned Hero Price Receipt + Input Card */}
            <div className="contents lg:flex lg:flex-col lg:col-span-5 lg:gap-3.5">
                {/* 1. Compact Segmented Mode Control */}
                <fieldset className="contents">
                    <legend className="sr-only">{tc("modeLabel")}</legend>
                    <div className="grid grid-cols-3 h-[38px] md:h-[52px] gap-1 rounded-xl bg-muted p-1 md:border-2 md:border-foreground md:bg-card">
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
                                            "tap relative flex w-full cursor-pointer items-center justify-center gap-1.5 md:flex-col md:gap-0.5 rounded-lg px-1.5 py-0.5 font-extrabold transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-ring peer-focus-visible:outline-offset-1 text-center",
                                            isIndic ? "text-[11px] md:text-xs" : "text-xs md:text-sm",
                                            checked ? "text-white" : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        {checked && (
                                            <m.span
                                                layoutId={`calc-mode-pill-${uid}`}
                                                transition={{ type: "spring", stiffness: 450, damping: 32 }}
                                                style={{ backgroundColor: "var(--svc)" }}
                                                className="absolute inset-0 rounded-lg shadow-xs"
                                                aria-hidden="true"
                                            />
                                        )}
                                        <Icon className="relative z-10 w-3.5 h-3.5 md:w-5 md:h-5 shrink-0" strokeWidth={2.3} aria-hidden="true" />
                                        <span className="relative z-10 leading-tight truncate max-w-full">{label}</span>
                                    </label>
                                </div>
                            );
                        })}
                    </div>
                </fieldset>

                {/* 2. Collapsible Receipt & Info Card (collapsed by default, hides price until expanded) */}
                <div
                    data-testid="live-receipt-banner"
                    data-active-service={activeServiceKey}
                    style={serviceStyle(activeColor)}
                    className="svc w-full"
                >
                    <AnimatePresence initial={false} mode="wait">
                        {!receiptExpanded ? (
                            <button
                                key="collapsed"
                                type="button"
                                data-testid="receipt-expand-toggle"
                                aria-expanded={false}
                                aria-controls={receiptDetailsId}
                                onClick={() => {
                                    triggerHaptic("selection");
                                    setReceiptExpanded(true);
                                }}
                                className="tap w-full flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-muted-foreground hover:border-foreground/50 hover:text-foreground transition-colors cursor-pointer"
                            >
                                <span className="inline-flex items-center gap-1.5">
                                    <Info className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                    <span>{tc("expandMoreInfo")}</span>
                                </span>
                                <ChevronDown className="w-4 h-4 shrink-0" aria-hidden="true" />
                            </button>
                        ) : (
                            <m.div
                                key="expanded"
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.14, ease: "easeOut" }}
                                className="rounded-2xl bg-card border-2 border-[var(--c)] overflow-hidden shadow-[0_6px_18px_-4px_rgba(26,23,20,0.14)] dark:shadow-[0_6px_20px_-4px_rgba(0,0,0,0.45)] transition-colors duration-150"
                            >
                                <div className={cn("h-[3px] md:h-1", bannerStripe)} aria-hidden="true" />
                                <button
                                    type="button"
                                    data-testid="receipt-expand-toggle"
                                    aria-expanded={true}
                                    aria-controls={receiptDetailsId}
                                    onClick={() => {
                                        triggerHaptic("selection");
                                        setReceiptExpanded(false);
                                    }}
                                    className="tap w-full flex items-center justify-between gap-2 border-b border-border/70 px-3 py-1.5 md:px-4 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                >
                                    <span className="inline-flex items-center gap-1.5 text-foreground">
                                        <Info className="w-3.5 h-3.5 shrink-0 text-[var(--c)]" aria-hidden="true" />
                                        <span>{tc("moreInfoToggle")}</span>
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-[11px]">
                                        <span>{tc("collapseMoreInfo")}</span>
                                        <ChevronDown className="w-4 h-4 shrink-0 rotate-180" aria-hidden="true" />
                                    </span>
                                </button>

                                <div
                                    id={receiptDetailsId}
                                    role="status"
                                    aria-live="polite"
                                    className="px-3 py-2 md:px-4 md:py-3 space-y-1.5"
                                >
                                    {/* Row 1: Country Flag + Name pill | Weight Pill */}
                                    <div className="flex items-center justify-between gap-2">
                                        {destination === "ems" ? (
                                            <button
                                                type="button"
                                                data-testid="banner-country-pill"
                                                aria-label={tc("changeCountryAria")}
                                                onClick={() => {
                                                    triggerHaptic("light");
                                                    setCountryPickerOpen(true);
                                                }}
                                                className="tap inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-0.5 text-[11.5px] md:text-xs font-extrabold text-foreground min-w-0 text-left hover:border-foreground/50 transition-colors cursor-pointer"
                                            >
                                                <CountryFlag
                                                    code={banner.flagCode}
                                                    decorative
                                                    className="w-4 h-3 shrink-0"
                                                />
                                                <span className="leading-snug">{localizedCountryName}</span>
                                                <ChevronDown className="w-3 h-3 shrink-0 opacity-70" aria-hidden="true" />
                                            </button>
                                        ) : (
                                            <span
                                                data-testid="banner-country-pill"
                                                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-0.5 text-[11.5px] md:text-xs font-extrabold text-foreground min-w-0"
                                            >
                                                <CountryFlag
                                                    code={banner.flagCode}
                                                    decorative
                                                    className="w-4 h-3 shrink-0"
                                                />
                                                <span className="leading-snug">{banner.locationPill}</span>
                                            </span>
                                        )}

                                        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[10.5px] md:text-xs font-extrabold text-foreground shrink-0 tabular-nums">
                                            <Scale className="w-2.5 h-2.5 opacity-70" aria-hidden="true" />
                                            <span>{weightGrams > 0 ? formatWeightLabel(weightGrams) : "0 g"}</span>
                                        </span>
                                    </div>

                                    {/* Row 2: Solid Service Pill + Subtitle left | HUGE Tabular Price right */}
                                    <div className="w-full flex items-end justify-between gap-2 text-left pt-0.5">
                                        <span className="flex flex-col items-start gap-0.5 min-w-0 flex-1">
                                            <span
                                                data-testid="banner-selected-service"
                                                style={{ backgroundColor: "var(--svc)" }}
                                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] md:text-[11px] font-extrabold text-white shrink-0"
                                            >
                                                <ServiceIcon serviceId={activeServiceKey} className="w-3 h-3 shrink-0" strokeWidth={2.5} />
                                                <span>{banner.badgeLabel}</span>
                                            </span>
                                            {banner.error ? (
                                                <span className="flex items-center gap-1 font-mono text-[10.5px] md:text-xs font-semibold text-destructive w-full truncate">
                                                    <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
                                                    <span className="truncate">{banner.error}</span>
                                                </span>
                                            ) : (
                                                <span className="text-[10.5px] md:text-xs font-medium text-muted-foreground truncate w-full">
                                                    {banner.subtitle}
                                                </span>
                                            )}
                                        </span>

                                        <span className="flex items-center gap-2 shrink-0">
                                            <span className="flex flex-col items-end">
                                                <span className="inline-flex items-center gap-1 font-mono text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground leading-none mb-0.5">
                                                    <span>{tc("total")}</span>
                                                    <span>·</span>
                                                    <span data-testid="banner-currency-indicator">
                                                        {CURRENCY_META[currency].symbol} {currency}
                                                    </span>
                                                </span>
                                                <m.span
                                                    key={`${activeServiceKey}-${currency}-${banner.total ?? "err"}`}
                                                    initial={{ opacity: 0.65, y: 3 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ duration: 0.16, ease: "easeOut" }}
                                                    data-testid="banner-total-price"
                                                    className={cn(
                                                        "block font-mono text-[22px] sm:text-2xl md:text-3xl font-black tabular-nums leading-none tracking-tight",
                                                        banner.error ? "text-muted-foreground" : "text-[var(--c)]"
                                                    )}
                                                >
                                                    {priceParts
                                                        ? currency === "USD"
                                                            ? `${priceParts.symbol}${priceParts.value}`
                                                            : `${priceParts.symbol} ${priceParts.value}`
                                                        : "—"}
                                                </m.span>
                                                {currency === "USD" && banner.total !== null && (
                                                    <span className="block font-mono text-[9.5px] font-medium text-muted-foreground tabular-nums leading-none mt-0.5">
                                                        {tc("lkrEquivalent", { amount: banner.total.toLocaleString() })}
                                                    </span>
                                                )}
                                            </span>
                                            <Postmark
                                                code={currency}
                                                date={currency === "USD" ? `1$≈${Math.round(lkrPerUsd)}` : "17 NOV 26"}
                                                size="sm"
                                                tone="red"
                                                rotate={-10}
                                                className="hidden md:block shrink-0"
                                            />
                                        </span>
                                    </div>

                                    {/* Fee Breakdown Strip */}
                                    <div className="border-t border-dashed border-border pt-1.5 mt-1 flex flex-wrap items-center justify-between gap-x-2.5 gap-y-0.5 font-mono text-[10.5px] md:text-xs">
                                        {banner.items.length > 0 ? (
                                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-muted-foreground">
                                                {banner.items.map((item) => (
                                                    <span key={item.label}>
                                                        {item.label}{" "}
                                                        <strong className="text-foreground font-bold">{item.value}</strong>
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground leading-snug">
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
                            </m.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* 3. Unified Compact Input Card: Full-Width Country Selector (Intl) / Amount (COD) + Editable Weight Bar */}
                <div className="rounded-2xl border border-border md:border-[1.5px] md:border-foreground bg-card p-2 md:p-3.5 shadow-[var(--shadow-elev-1)] space-y-1.5">
                    {destination === "ems" && (
                        <div className="space-y-1">
                            <CountrySelector
                                id={emsCountryId}
                                countries={sortedEmsCountries}
                                value={emsCountryCode}
                                locale={locale}
                                isIndic={isIndic}
                                open={countryPickerOpen}
                                onOpenChange={setCountryPickerOpen}
                                onChange={setEmsCountryCode}
                                labels={{
                                    searchPlaceholder: tc("searchCountryPlaceholder"),
                                    searchAriaLabel: tc("searchCountryAria"),
                                    clearSearchAriaLabel: tc("clearCountrySearch"),
                                    popularHeading: tc("popularCountries"),
                                    allCountriesLabel: (count) => tc("allCountriesCount", { count }),
                                    matchingCountriesLabel: (count) => tc("matchingCountriesCount", { count }),
                                    noResultsLabel: (q) => tc("noCountriesFound", { query: q }),
                                    suspendedSuffix: tc("suspendedSuffix"),
                                    noteSuffix: tc("noteSuffix"),
                                    changeLabel: tc("change"),
                                    sheetTitle: tc("chooseCountry"),
                                }}
                            />

                            {(activeEmsCountry?.restrictionNote ||
                                (intlTransport === "sea" && activeEmsCountry?.seaMailAvailable === false)) && (
                                <p
                                    className={cn(
                                        "flex items-start gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] md:text-xs leading-snug",
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

                    {destination === "cod" && (
                        <div className="space-y-1">
                            <div className="flex items-center justify-between px-0.5">
                                <label
                                    htmlFor={codAmountId}
                                    className="font-mono text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground cursor-pointer"
                                >
                                    {tc("step2CodTitle")}
                                </label>
                                <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                                    {tc("maxCodAmount")}
                                </span>
                            </div>

                            <div className="grid grid-cols-[42px_1fr_42px] h-[42px] items-center rounded-xl border border-border md:border-[1.5px] md:border-foreground bg-background overflow-hidden focus-within:ring-[3px] focus-within:ring-primary/25">
                                <button
                                    type="button"
                                    onClick={() => handleStepCodAmount("down")}
                                    aria-label={tc("decreaseCod")}
                                    className="tap flex h-full w-full items-center justify-center border-r border-border bg-card text-foreground hover:bg-muted"
                                >
                                    <Minus className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />
                                </button>

                                <label
                                    htmlFor={codAmountId}
                                    className="flex items-center justify-center gap-1 h-full cursor-text px-2"
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
                                        className="h-full bg-transparent text-center font-mono text-base md:text-lg font-black text-foreground focus:outline-none tabular-nums"
                                    />
                                </label>

                                <button
                                    type="button"
                                    onClick={() => handleStepCodAmount("up")}
                                    aria-label={tc("increaseCod")}
                                    className="tap flex h-full w-full items-center justify-center border-l border-border bg-card text-foreground hover:bg-muted"
                                >
                                    <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />
                                </button>
                            </div>

                            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-0.5">
                                {COD_AMOUNT_PRESETS.map((amt) => {
                                    const active = collectAmountNum === amt;
                                    return (
                                        <button
                                            key={amt}
                                            type="button"
                                            onClick={() => {
                                                triggerHaptic("selection");
                                                setCodAmount(String(amt));
                                            }}
                                            aria-pressed={active}
                                            className={cn(
                                                "tap shrink-0 rounded-lg border px-2 py-1 font-mono text-[10.5px] md:text-xs font-extrabold transition-colors min-h-[28px]",
                                                active
                                                    ? "border-foreground bg-foreground text-background"
                                                    : "border-border bg-background text-foreground hover:border-foreground"
                                            )}
                                        >
                                            Rs. {formatCompactAmount(amt)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Directly Editable Weight Bar (g / kg) + Single-Row Presets */}
                    <div className="space-y-1.5">
                        <div className="grid grid-cols-[42px_1fr_42px] h-[42px] items-center rounded-xl border border-border md:border-[1.5px] md:border-foreground bg-background overflow-hidden focus-within:ring-[3px] focus-within:ring-primary/25">
                            <button
                                type="button"
                                onClick={() => handleStepWeight("down")}
                                aria-label={tc("decreaseWeight")}
                                className="tap flex h-full w-full items-center justify-center border-r border-border bg-card text-foreground hover:bg-muted"
                            >
                                <Minus className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />
                            </button>

                            <div className="flex items-center justify-center gap-1.5 px-2 h-full min-w-0">
                                <label htmlFor={weightInputId} className="sr-only">
                                    {tc("step1Title")}
                                </label>
                                <Scale
                                    className="w-3.5 h-3.5 text-muted-foreground shrink-0 pointer-events-none"
                                    aria-hidden="true"
                                />
                                <input
                                    id={weightInputId}
                                    name="weight"
                                    type="text"
                                    inputMode={weightUnit === "kg" ? "decimal" : "numeric"}
                                    pattern={weightUnit === "kg" ? "[0-9.]*" : "[0-9]*"}
                                    enterKeyHint="done"
                                    autoComplete="off"
                                    value={weightInputText}
                                    onChange={(e) => handleWeightTextChange(e.target.value)}
                                    placeholder={weightUnit === "kg" ? "1" : "20"}
                                    style={{ width: `${Math.max(3, (weightInputText || "20").length + 0.5)}ch` }}
                                    className="h-full bg-transparent text-center font-mono text-[15px] md:text-base font-black text-foreground focus:outline-none tabular-nums"
                                />
                                <button
                                    type="button"
                                    onClick={handleToggleWeightUnit}
                                    aria-label={tc("switchWeightUnitAria")}
                                    className="tap rounded-md border border-border bg-card px-2 py-0.5 font-mono text-[11px] font-extrabold text-foreground hover:bg-muted shrink-0"
                                >
                                    {weightUnit}
                                </button>
                                {weightGrams > 0 &&
                                    ((weightUnit === "g" && weightGrams >= 1000) ||
                                        (weightUnit === "kg" && weightGrams < 1000)) && (
                                        <span className="font-mono text-[10px] font-bold text-muted-foreground truncate">
                                            ({formatWeightLabel(weightGrams)})
                                        </span>
                                    )}
                            </div>

                            <button
                                type="button"
                                onClick={() => handleStepWeight("up")}
                                aria-label={tc("increaseWeight")}
                                className="tap flex h-full w-full items-center justify-center border-l border-border bg-card text-foreground hover:bg-muted"
                            >
                                <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />
                            </button>
                        </div>

                        {/* Mobile: single crisp 5-button row */}
                        <div className="grid grid-cols-5 gap-1 md:hidden">
                            {mobileWeightPresets.map((preset) => {
                                const active = weightGrams === preset;
                                return (
                                    <button
                                        key={preset}
                                        type="button"
                                        onClick={() => {
                                            triggerHaptic("selection");
                                            applyGramsWeight(String(preset));
                                        }}
                                        aria-pressed={active}
                                        className={cn(
                                            "tap flex h-[30px] items-center justify-center rounded-lg border font-mono text-[11px] font-extrabold transition-colors",
                                            active
                                                ? "border-foreground bg-foreground text-background"
                                                : "border-border bg-background text-foreground hover:border-foreground"
                                        )}
                                    >
                                        {formatWeightLabel(preset)}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Desktop: full 8-button row */}
                        <div className="hidden md:grid md:grid-cols-8 gap-1">
                            {desktopWeightPresets.map((preset) => {
                                const active = weightGrams === preset;
                                return (
                                    <button
                                        key={preset}
                                        type="button"
                                        onClick={() => {
                                            triggerHaptic("selection");
                                            applyGramsWeight(String(preset));
                                        }}
                                        aria-pressed={active}
                                        className={cn(
                                            "tap flex min-h-[28px] items-center justify-center rounded-lg border py-0.5 font-mono text-xs font-bold transition-colors",
                                            active
                                                ? "border-foreground bg-foreground text-background"
                                                : "border-border bg-background text-foreground hover:border-foreground"
                                        )}
                                    >
                                        {formatWeightLabel(preset)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Workbench Column on Desktop: Parcel Type Header (with Air | Sea Toggle!) + Color-Coded Service Tiles */}
            <div className="contents lg:flex lg:flex-col lg:col-span-7 lg:gap-4">
                {/* 4A. Domestic Mode: Service Grid + Add-ons */}
                {destination === "domestic" && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between w-full px-0.5">
                            <span
                                className={cn(
                                    "font-mono font-bold uppercase tracking-wider text-muted-foreground",
                                    isIndic ? "text-[10.5px] md:text-xs" : "text-[10.5px] md:text-xs"
                                )}
                            >
                                {tc("step2LocalTitle")}
                            </span>
                        </div>
                        <fieldset className="contents">
                            <legend className="sr-only">{tc("step2LocalTitle")}</legend>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                                            locale={locale}
                                            currency={currency}
                                            lkrPerUsd={lkrPerUsd}
                                            onSelect={() => {
                                                triggerHaptic("selection");
                                                setServiceId(service.id);
                                            }}
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
                        <div className="grid grid-cols-2 gap-2 pt-1">
                            <div
                                className={cn(
                                    "flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors min-h-[44px]",
                                    !canRegister
                                        ? "border-border/60 bg-muted/40 opacity-60"
                                        : registered
                                            ? "border-foreground bg-card shadow-[var(--shadow-elev-1)]"
                                            : "border-border bg-card"
                                )}
                            >
                                <input
                                    type="checkbox"
                                    id={regCheckboxId}
                                    name="registered"
                                    checked={registered && canRegister}
                                    disabled={!canRegister}
                                    onChange={(e) => {
                                        triggerHaptic("selection");
                                        setRegistered(e.target.checked);
                                    }}
                                    className="h-4 w-4 shrink-0 rounded-sm border-foreground accent-[#1E40AF] dark:accent-[#60A5FA] cursor-pointer disabled:cursor-not-allowed"
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
                                    "flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors min-h-[44px]",
                                    !canAr
                                        ? "border-border/60 bg-muted/40 opacity-60"
                                        : arReceipt
                                            ? "border-foreground bg-card shadow-[var(--shadow-elev-1)]"
                                            : "border-border bg-card"
                                )}
                            >
                                <input
                                    type="checkbox"
                                    id={arCheckboxId}
                                    name="arReceipt"
                                    checked={arReceipt && canAr}
                                    disabled={!canAr}
                                    onChange={(e) => {
                                        triggerHaptic("selection");
                                        setArReceipt(e.target.checked);
                                    }}
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

                {/* 4B. COD Mode: Money-Green Breakdown Card */}
                {destination === "cod" && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between px-0.5">
                            <span className="font-mono text-[10.5px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                {tc("step3CodTitle")}
                            </span>
                        </div>

                        <div className="rounded-[18px] bg-[#15803D] p-3.5 text-white shadow-[0_3px_0_0_#0D5327] ring-2 ring-foreground ring-offset-2 ring-offset-background">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20">
                                        <Banknote className="h-4.5 w-4.5" strokeWidth={2.2} aria-hidden="true" />
                                    </span>
                                    <div className="min-w-0">
                                        <div className="text-sm font-black leading-tight truncate">{tc("codTitle")}</div>
                                        <div className="text-[11px] text-white/85 truncate">{activeTagline.cardHint}</div>
                                    </div>
                                </div>
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[#15803D]">
                                    <Check className="h-3 w-3" strokeWidth={3.2} aria-hidden="true" />
                                </span>
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-white/25 grid grid-cols-3 gap-2 text-center">
                                <div className="rounded-xl bg-black/15 px-2 py-1.5">
                                    <span className="block font-mono text-[9.5px] uppercase tracking-wider text-white/75 truncate">
                                        {tc("slpCourier")}
                                    </span>
                                    <span className="block font-mono text-xs sm:text-sm font-extrabold mt-0.5 tabular-nums">
                                        {codResult.error ? "—" : formatCurrencyAmount(codResult.courierFee, currency, lkrPerUsd)}
                                    </span>
                                </div>
                                <div className="rounded-xl bg-black/15 px-2 py-1.5">
                                    <span className="block font-mono text-[9.5px] uppercase tracking-wider text-white/75 truncate">
                                        {tc("pmtMoFee")} + {tc("codService")}
                                    </span>
                                    <span className="block font-mono text-xs sm:text-sm font-extrabold mt-0.5 tabular-nums">
                                        {codResult.error
                                            ? "—"
                                            : formatCurrencyAmount(codResult.moneyOrderFee + codResult.codServiceFee, currency, lkrPerUsd)}
                                    </span>
                                </div>
                                <div className="rounded-xl bg-white/20 px-2 py-1.5">
                                    <span className="block font-mono text-[9.5px] uppercase tracking-wider text-white/90 truncate">
                                        {tc("netPayoutShort")}
                                    </span>
                                    <span className="block font-mono text-xs sm:text-sm font-black mt-0.5 tabular-nums">
                                        {codResult.error ? "—" : formatCurrencyAmount(codResult.netRemittance, currency, lkrPerUsd)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {codResult.subPostOfficeWarning && !codResult.error && (
                            <p className="flex items-start gap-1.5 rounded-xl border border-secondary bg-secondary/20 px-3 py-2 text-[11px] md:text-xs text-foreground leading-snug">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" aria-hidden="true" />
                                <span>{tc("subPoWarning")}</span>
                            </p>
                        )}
                    </div>
                )}

                {/* 4C. International Mail Mode: Parcel Type Header (with Air | Sea Toggle) + Muscle-Memory Service Grid */}
                {destination === "ems" && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between w-full gap-2 px-0.5">
                            <span
                                className={cn(
                                    "font-mono font-bold uppercase tracking-wider text-muted-foreground truncate",
                                    isIndic ? "text-[10px] md:text-xs" : "text-[10.5px] md:text-xs"
                                )}
                            >
                                {intlTransport === "air" ? tc("step3AirTitle") : tc("step3SeaTitle")}
                            </span>

                            <div
                                role="group"
                                aria-label={tc("transportLabel")}
                                className="inline-grid grid-cols-2 h-8 rounded-xl border border-border bg-card p-0.5 shrink-0 shadow-[var(--shadow-elev-1)]"
                            >
                                <button
                                    type="button"
                                    onClick={() => handleIntlTransportChange("air")}
                                    aria-pressed={intlTransport === "air"}
                                    className={cn(
                                        "tap flex items-center justify-center gap-1 rounded-[9px] px-2.5 font-extrabold transition-colors",
                                        isIndic ? "text-[10.5px] md:text-xs" : "text-[11px] md:text-xs",
                                        intlTransport === "air"
                                            ? "bg-[#1D4E9E] text-white"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Plane className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                    <span>{tc("air")}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleIntlTransportChange("sea")}
                                    aria-pressed={intlTransport === "sea"}
                                    className={cn(
                                        "tap flex items-center justify-center gap-1 rounded-[9px] px-2.5 font-extrabold transition-colors",
                                        isIndic ? "text-[10.5px] md:text-xs" : "text-[11px] md:text-xs",
                                        intlTransport === "sea"
                                            ? "bg-[#0E4A6B] text-white"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Ship className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                    <span>{tc("sea")}</span>
                                </button>
                            </div>
                        </div>

                        <fieldset className="contents">
                            <legend className="sr-only">
                                {intlTransport === "air" ? tc("step3AirTitle") : tc("step3SeaTitle")}
                            </legend>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                                            locale={locale}
                                            currency={currency}
                                            lkrPerUsd={lkrPerUsd}
                                            onSelect={() => {
                                                triggerHaptic("selection");
                                                setIntlServiceId(quote.service.id);
                                            }}
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

                        {/* Foreign Registered Mail (+Rs. 870) + Zone-Free Service Weight Limit Card */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                            <div
                                className={cn(
                                    "flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors min-h-[44px]",
                                    !canIntlRegister
                                        ? "border-border/60 bg-muted/40 opacity-60"
                                        : intlRegistered
                                            ? "border-foreground bg-card shadow-[var(--shadow-elev-1)]"
                                            : "border-border bg-card"
                                )}
                            >
                                <input
                                    type="checkbox"
                                    id={intlRegCheckboxId}
                                    name="intlRegistered"
                                    checked={intlRegistered && canIntlRegister}
                                    disabled={!canIntlRegister}
                                    onChange={(e) => {
                                        triggerHaptic("selection");
                                        setIntlRegistered(e.target.checked);
                                    }}
                                    className="h-4 w-4 shrink-0 rounded-sm border-foreground accent-[#1E40AF] dark:accent-[#60A5FA] cursor-pointer disabled:cursor-not-allowed"
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
                                    <span className="block font-mono text-[10px] text-muted-foreground">
                                        {canIntlRegister
                                            ? formatCurrencyAmount(foreignRegFeeAmount, currency, lkrPerUsd, { plus: true })
                                            : tc("trackedNa")}
                                    </span>
                                </label>
                            </div>

                            <div className="rounded-xl border border-border bg-card px-2.5 py-2 flex flex-col justify-center min-h-[44px] shadow-[var(--shadow-elev-1)]">
                                <span className="font-mono text-[9.5px] md:text-[10px] uppercase tracking-wider text-muted-foreground leading-none truncate">
                                    {tc("weightLimitLabel")}
                                </span>
                                <span className="font-mono text-[11.5px] md:text-xs font-extrabold text-foreground mt-1 truncate">
                                    {tc("maxWeight", {
                                        weight: formatWeightLabel(
                                            activeIntlQuote.result.maxWeight ?? activeIntlQuote.service.maxWeight
                                        ),
                                    })}
                                </span>
                            </div>
                        </div>

                        {/* Missing Country Explanatory Note cleanly tucked below Intl services */}
                        <div className="pt-0.5">
                            <button
                                type="button"
                                onClick={() => setShowCountryWhyNote((prev) => !prev)}
                                aria-expanded={showCountryWhyNote}
                                className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-primary hover:underline"
                            >
                                <Info className="w-3 h-3 shrink-0" aria-hidden="true" />
                                <span>{showCountryWhyNote ? tc("hideNote") : tc("missingWhy")}</span>
                            </button>

                            <AnimatePresence initial={false}>
                                {showCountryWhyNote && (
                                    <m.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.2, ease: "easeOut" }}
                                        className="overflow-hidden mt-1.5"
                                    >
                                        <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs leading-snug text-foreground space-y-0.5 shadow-[var(--shadow-elev-1)]">
                                            <p className="font-semibold">{tc("whyTitle")}</p>
                                            <p className="text-muted-foreground">{tc("whyBody")}</p>
                                        </div>
                                    </m.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                )}
            </div>

            {/* 5. Compact 1-line Mobile Reference Footer */}
            <p className="md:hidden text-center font-mono text-[10px] text-muted-foreground pt-1">
                {tc("mobileFooter")}
            </p>
        </form>
    );
}
