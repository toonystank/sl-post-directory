"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
    AlertTriangle,
    ArrowRight,
    ArrowUpDown,
    BookOpen,
    Check,
    CheckCircle2,
    ChevronDown,
    Compass,
    Copy,
    GraduationCap,
    MapPin,
    Package,
    Pin,
    PinOff,
    RefreshCw,
    Route,
    Search,
    Share2,
    Sparkles,
    X,
} from "lucide-react";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import { useStaffStation } from "@/context/StaffStationContext";
import { toRoutingOfficeNode, toStaffStation } from "@/lib/staff-station";
import StaffStationPicker from "@/components/staff/StaffStationPicker";
import { ensureLocalOfficeIndex } from "@/lib/office-index-client";
import {
    computeMailRoute,
    generateSortingQuizQuestions,
    inferHubFromOffice,
    lookupPrefixZone,
    POSTAL_PREFIX_ZONES,
    resolveOfficeForRoute,
    searchRoutingOffices,
    SORTING_HUBS,
    type QuizQuestion,
    type RoutingOfficeNode,
} from "@/lib/mail-routing";
import { cn } from "@/lib/utils";

type HubTab = "finder" | "hubs" | "guide" | "quiz";

function OfficePicker({
    label,
    placeholder,
    selected,
    onSelect,
    onClear,
    offices,
    actionSlot,
}: {
    label: string;
    placeholder: string;
    selected: RoutingOfficeNode | null;
    onSelect: (office: RoutingOfficeNode) => void;
    onClear: () => void;
    offices: RoutingOfficeNode[];
    actionSlot?: React.ReactNode;
}) {
    const [q, setQ] = React.useState("");
    const [open, setOpen] = React.useState(false);
    const boxRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const matches = React.useMemo(
        () => searchRoutingOffices(offices, q, 12),
        [q, offices]
    );

    return (
        <div ref={boxRef} className="relative min-w-0">
            <label className="label-mono block mb-1 text-[10px]">{label}</label>
            {selected ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border-2 border-foreground bg-background px-3 py-2">
                    <div className="min-w-0">
                        <p className="font-bold text-sm truncate">
                            {selected.name}
                            {selected.shortCode ? ` [${selected.shortCode}]` : ""}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono truncate">
                            {selected.postalCode || "No code"} · {selected.division || "Sri Lanka"}
                            {selected.delivery ? ` · ${selected.delivery === "Yes" ? "Delivery" : "Non-Delivery"}` : ""}
                        </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        {actionSlot}
                        <button
                            type="button"
                            onClick={() => {
                                onClear();
                                setQ("");
                            }}
                            aria-label="Clear office"
                            className="tap rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground shrink-0"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <input
                        type="search"
                        value={q}
                        onFocus={() => setOpen(true)}
                        onChange={(e) => {
                            setQ(e.target.value);
                            setOpen(true);
                        }}
                        placeholder={placeholder}
                        className="h-11 w-full rounded-lg border-2 border-foreground/60 bg-background pl-9 pr-3 text-sm font-medium focus:border-foreground focus:outline-none"
                    />
                </div>
            )}

            {open && !selected && q.trim().length > 0 && (
                <div className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border-2 border-foreground bg-card shadow-lg divide-y divide-border">
                    {matches.length === 0 ? (
                        <p className="px-3 py-3 text-xs text-muted-foreground">No matching post office found.</p>
                    ) : (
                        matches.map((o) => (
                            <button
                                key={o.id}
                                type="button"
                                onClick={() => {
                                    onSelect(o);
                                    setOpen(false);
                                    setQ("");
                                }}
                                className="tap flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted"
                            >
                                <span className="min-w-0">
                                    <span className="block font-semibold truncate">{o.name}</span>
                                    <span className="block text-[11px] text-muted-foreground truncate">
                                        {o.type || "Post Office"}
                                        {o.division ? ` · ${o.division}` : ""}
                                    </span>
                                </span>
                                <span className="flex items-center gap-1.5 shrink-0 font-mono text-xs">
                                    {o.shortCode && (
                                        <span className="rounded bg-muted px-1.5 py-0.5 font-bold">
                                            {o.shortCode}
                                        </span>
                                    )}
                                    <span className="text-muted-foreground">{o.postalCode || "—"}</span>
                                </span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

const GUIDE_SECTIONS = [
    {
        id: "hierarchy",
        title: "1. Postal Network Hierarchy",
        items: [
            {
                lead: "Colombo CME (01000):",
                body: "Central national hub, Foreign Mail & Parcel Exchange, EMS Centre, and Returned Letter Office (RLO).",
            },
            {
                lead: "RMSC & TPO Hubs:",
                body: "Regional Mail Sorting Centers (Kandy, Matara, Kurunegala, Anuradhapura, Ratnapura, Hatton, Badulla, Batticaloa, Jaffna) and Railway TPOs (Down Galle, Up Kandy, Up Badulla, Jaffna).",
            },
            {
                lead: "Controlling Main Post Office (Supra / Class I–II):",
                body: "Supervises subordinate SPOs/APOs, consolidates outbound dispatches, and distributes morning inbound mail bags.",
            },
            {
                lead: "Sub Post Office (SPO) & Agency Post Office (APO):",
                body: "Local community outlets; always check Delivery vs. Non-Delivery status before routing street-addressed mail.",
            },
        ],
    },
    {
        id: "bags",
        title: "2. Bag Types, Labels & Direct Bags",
        items: [
            {
                lead: "Letter (L) vs. Registered (R) Bags:",
                body: "Registered articles are bundled separately with a signed Registered List (RL) and enclosed in sealed Registered Bags.",
            },
            {
                lead: "Short Codes on Bag Labels:",
                body: "Verify the destination Main Office Short Code (e.g. AW Avissawella, AL Agalawatta, ATG Athurugiriya) alongside the 5-digit postcode.",
            },
            {
                lead: "Local & Regional Shortcuts:",
                body: "Items between two SPOs under the same Controlling Office stay in the local exchange; items sharing an RMSC bypass Colombo CME.",
            },
            {
                lead: "Direct Bags:",
                body: "Used when sustained daily volume warrants sealing directly to a destination office or hub without intermediate opening.",
            },
        ],
    },
    {
        id: "redirection",
        title: "3. Redirection & Forwarding Rules",
        items: [
            {
                lead: "Ordinary Mail (Free Next-Day Rule):",
                body: "Letters, postcards, printed packets, and newspapers may be redirected free of charge if unopened and re-posted no later than the day after delivery (excluding Sundays & holidays).",
            },
            {
                lead: "Registered Mail (Counter Only):",
                body: "Never drop a redirected registered item in a letter box — hand it directly at a Post Office counter by the next working day for free re-registration; otherwise it is treated as a fresh posting.",
            },
            {
                lead: "Parcels:",
                body: "Charged half the prepaid postage rate per redirection unless the old and new addresses fall within the same town delivery office area.",
            },
            {
                lead: "Written Instructions:",
                body: "Valid for up to 3 months unless renewed (longer if travelling abroad). Colombo inquiries go to the Chief Postmaster.",
            },
        ],
    },
    {
        id: "missent",
        title: "4. Missent Mail & Duplicate Town Names",
        items: [
            {
                lead: "Verify Duplicate Names:",
                body: "Sri Lanka has multiple offices sharing names (e.g. Kottawa in Colombo 10230 vs. Galle 80000). Always match both the District/Division and 2-digit prefix before bagging.",
            },
            {
                lead: "Non-Delivery Offices:",
                body: "If an item bears a Non-Delivery SPO name without PO Box details, route via its Controlling Office to prevent bounce loops.",
            },
            {
                lead: "Missent Endorsement:",
                body: "Endorse missent items with office date-stamp and forward immediately on the next dispatch to the true Controlling Office / RMSC, or to the Returned Letter Office (RLO) at CME when undeliverable.",
            },
        ],
    },
];

export default function RoutingHubClient() {
    const t = useTranslations("Routing");
    const tStaff = useTranslations("Staff");
    const searchParams = useSearchParams();
    const { station, hydrated: stationHydrated, setStation, clearStation } = useStaffStation();
    const [stationPickerOpen, setStationPickerOpen] = React.useState(false);
    const originManuallyClearedRef = React.useRef(false);

    const [offices, setOffices] = React.useState<RoutingOfficeNode[]>([]);
    const [divisions, setDivisions] = React.useState<string[]>([]);
    const [loadingIndex, setLoadingIndex] = React.useState(true);

    const initialTabParam = searchParams.get("tab");
    const initialTab: HubTab =
        initialTabParam === "hubs" || initialTabParam === "guide" || initialTabParam === "quiz"
            ? initialTabParam
            : "finder";
    const [activeTab, setActiveTab] = React.useState<HubTab>(initialTab);

    // Finder state
    const [origin, setOrigin] = React.useState<RoutingOfficeNode | null>(null);
    const [dest, setDest] = React.useState<RoutingOfficeNode | null>(null);
    const [copiedLabel, setCopiedLabel] = React.useState(false);

    // Hubs & Prefix state
    const [selectedHubName, setSelectedHubName] = React.useState<string>(
        searchParams.get("hub") || SORTING_HUBS[0].name
    );
    const [hubOfficeFilter, setHubOfficeFilter] = React.useState("");
    const [prefixQuery, setPrefixQuery] = React.useState("");

    // Quiz state
    const [quizDivision, setQuizDivision] = React.useState<string>("");
    const [questions, setQuestions] = React.useState<QuizQuestion[]>([]);
    const [qIdx, setQIdx] = React.useState(0);
    const [selectedAnswer, setSelectedAnswer] = React.useState<string | null>(null);
    const [score, setScore] = React.useState(0);
    const [answeredCount, setAnsweredCount] = React.useState(0);

    React.useEffect(() => {
        let active = true;
        ensureLocalOfficeIndex()
            .then((engine) => {
                if (!active || !engine) return;
                const nodes = engine.getRoutingNodes();
                setOffices(nodes);
                setDivisions(engine.divisions);

                const toParam = searchParams.get("to");
                const fromParam = searchParams.get("from");
                if (toParam) {
                    const hit =
                        nodes.find((n) => n.slug === toParam) ||
                        resolveOfficeForRoute(toParam, nodes)?.office ||
                        null;
                    if (hit) setDest(hit);
                }
                if (fromParam) {
                    const hit =
                        nodes.find((n) => n.slug === fromParam) ||
                        resolveOfficeForRoute(fromParam, nodes)?.office ||
                        null;
                    if (hit) setOrigin(hit);
                }
                const hubParam = searchParams.get("hub");
                if (hubParam) {
                    setSelectedHubName(hubParam);
                }
            })
            .finally(() => {
                if (active) setLoadingIndex(false);
            });
        return () => {
            active = false;
        };
    }, [searchParams]);

    // Pre-fill Origin when My Duty Station hydrates after offices loaded
    React.useEffect(() => {
        if (!stationHydrated || !station || offices.length === 0) return;
        if (searchParams.get("from") || origin || originManuallyClearedRef.current) return;
        const hit = offices.find((n) => n.slug === station.slug);
        if (hit) setOrigin(hit);
    }, [stationHydrated, station, offices, searchParams, origin]);

    // Sync top-bar / external station changes and discards cleanly into Origin
    const prevStationSlugRef = React.useRef<string | null>(null);
    React.useEffect(() => {
        if (!stationHydrated) return;
        const prevSlug = prevStationSlugRef.current;
        const nextSlug = station?.slug ?? null;
        if (prevSlug !== null && nextSlug && nextSlug !== prevSlug) {
            originManuallyClearedRef.current = false;
            const hit = offices.find((n) => n.slug === nextSlug);
            setOrigin(hit ?? toRoutingOfficeNode(station!));
        } else if (prevSlug !== null && nextSlug === null) {
            setOrigin((curr) => (curr?.slug === prevSlug ? null : curr));
        }
        prevStationSlugRef.current = nextSlug;
    }, [stationHydrated, station, offices]);

    const computedRoute = React.useMemo(() => {
        if (!dest) return null;
        return computeMailRoute(origin, dest, offices);
    }, [origin, dest, offices]);

    const buildRouteText = () => {
        if (!computedRoute) return "";
        const { bagLabel } = computedRoute;
        return [
            `TO: ${bagLabel.toOffice}`,
            `POSTCODE: ${bagLabel.postalCode} | SHORT CODE: ${bagLabel.shortCode}`,
            `RMSC / TPO: ${bagLabel.hub}`,
            `CONTROLLING OFFICE: ${bagLabel.controllingOffice}`,
            `ROUTE: ${computedRoute.steps.map((s) => s.title).join(" -> ")}`,
        ].join("\n");
    };

    const handleCopyBagLabel = async () => {
        const text = buildRouteText();
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            setCopiedLabel(true);
            setTimeout(() => setCopiedLabel(false), 2000);
        } catch {
            // ignore clipboard failure
        }
    };

    const handleShareRoute = async () => {
        const text = buildRouteText();
        if (!text) return;
        const url = typeof window !== "undefined" ? window.location.href : "";
        if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
            try {
                await navigator.share({
                    title: computedRoute?.bagLabel.toOffice || "Sri Lanka Post Route",
                    text,
                    url,
                });
                return;
            } catch (err) {
                if ((err as Error)?.name === "AbortError") return;
            }
        }
        await handleCopyBagLabel();
    };

    const applyPresetRoute = (fromTerm: string, toTerm: string) => {
        const oHit = resolveOfficeForRoute(fromTerm, offices)?.office ?? null;
        const dHit = resolveOfficeForRoute(toTerm, offices)?.office ?? null;
        if (oHit) setOrigin(oHit);
        if (dHit) setDest(dHit);
    };

    const hubOffices = React.useMemo(() => {
        const target = selectedHubName.toLowerCase();
        const q = hubOfficeFilter.trim().toLowerCase();
        return offices
            .filter((o) => {
                const hub = inferHubFromOffice(o).toLowerCase();
                const matchesHub = hub.includes(target) || target.includes(hub.split("/")[0].trim());
                if (!matchesHub) return false;
                if (!q) return true;
                return (
                    o.name.toLowerCase().includes(q) ||
                    o.postalCode.includes(q) ||
                    (o.shortCode || "").toLowerCase().includes(q)
                );
            })
            .slice(0, 120);
    }, [offices, selectedHubName, hubOfficeFilter]);

    const matchedPrefixZone = React.useMemo(() => {
        if (!prefixQuery.trim()) return null;
        return lookupPrefixZone(prefixQuery);
    }, [prefixQuery]);

    const filteredPrefixZones = React.useMemo(() => {
        const q = prefixQuery.trim().toLowerCase();
        if (!q) return POSTAL_PREFIX_ZONES;
        return POSTAL_PREFIX_ZONES.filter(
            (z) =>
                z.prefix.startsWith(q.slice(0, 2)) ||
                z.district.toLowerCase().includes(q) ||
                z.province.toLowerCase().includes(q) ||
                z.primaryHub.toLowerCase().includes(q) ||
                z.notes.toLowerCase().includes(q)
        );
    }, [prefixQuery]);

    const startNewQuiz = React.useCallback(
        (div: string) => {
            const generated = generateSortingQuizQuestions(offices, 10, div || null);
            setQuestions(generated);
            setQIdx(0);
            setSelectedAnswer(null);
            setScore(0);
            setAnsweredCount(0);
        },
        [offices]
    );

    React.useEffect(() => {
        if (activeTab === "quiz" && offices.length > 0 && questions.length === 0) {
            startNewQuiz(quizDivision);
        }
    }, [activeTab, offices.length, questions.length, quizDivision, startNewQuiz]);

    const currentQuestion = questions[qIdx];

    return (
        <div className="container mx-auto max-w-5xl px-4 py-4 md:py-10 space-y-4 md:space-y-6">
            {/* Compact Mobile-First Header */}
            <header className="rounded-xl border-2 border-foreground bg-card overflow-hidden shadow-[0_3px_0_0_hsl(var(--foreground))]">
                <div className="airmail-stripe h-1.5 sm:h-2" aria-hidden="true" />
                <div className="p-4 sm:p-6 md:p-7">
                    <p className="label-mono text-primary mb-1 text-[10px] sm:text-xs">{t("kicker")}</p>
                    <h1 className="display text-2xl sm:text-4xl md:text-5xl">{t("title")}</h1>
                    <p className="mt-1.5 text-xs sm:text-sm md:text-base text-muted-foreground max-w-2xl">
                        {t("subtitle")}
                    </p>
                </div>
            </header>

            {/* Sticky Mobile Segmented Tab Bar */}
            <div
                className="sticky top-[calc(52px+env(safe-area-inset-top))] md:static z-30 -mx-4 px-4 py-2 bg-background/95 backdrop-blur-md border-b border-border/60 md:border-0 md:mx-0 md:px-0 md:py-0"
                role="tablist"
            >
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                    {(
                        [
                            { id: "finder", label: t("tabFinder"), shortLabel: t("tabFinderShort"), Icon: Route },
                            { id: "hubs", label: t("tabHubs"), shortLabel: t("tabHubsShort"), Icon: Compass },
                            { id: "guide", label: t("tabGuide"), shortLabel: t("tabGuideShort"), Icon: BookOpen },
                            { id: "quiz", label: t("tabQuiz"), shortLabel: t("tabQuizShort"), Icon: GraduationCap },
                        ] as const
                    ).map(({ id, label, shortLabel, Icon }) => {
                        const active = activeTab === id;
                        return (
                            <button
                                key={id}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => setActiveTab(id)}
                                className={cn(
                                    "tap flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-lg border-2 px-2 py-2 sm:px-3 sm:py-2.5 text-[11px] sm:text-sm font-bold transition-colors",
                                    active
                                        ? "border-foreground bg-foreground text-background shadow-[0_2px_0_0_hsl(var(--primary))]"
                                        : "border-foreground/40 bg-card text-foreground hover:border-foreground"
                                )}
                            >
                                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                                <span className="sm:hidden truncate">{shortLabel}</span>
                                <span className="hidden sm:inline truncate">{label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {loadingIndex && offices.length === 0 && (
                <div className="rounded-xl border-2 border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    {t("loadingDirectory")}
                </div>
            )}

            {/* TAB 1: ROUTE & BAG FINDER */}
            {activeTab === "finder" && (
                <section className="space-y-5">
                    {/* Google-Maps-Style Stacked Origin -> Destination Card */}
                    <div className="rounded-xl border-2 border-foreground bg-card p-3.5 sm:p-5 space-y-3.5 shadow-[0_2px_0_0_hsl(var(--foreground))]">
                        {/* Staff Duty Station Bar */}
                        <div className="rounded-lg border border-border bg-secondary/15 px-3 py-2 space-y-2">
                            {stationHydrated && station ? (
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <Pin className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300 shrink-0" aria-hidden="true" />
                                        <span className="font-mono text-[10px] font-bold uppercase text-emerald-800 dark:text-emerald-300 shrink-0">
                                            {tStaff("myStationShort")}:
                                        </span>
                                        <span className="font-bold text-foreground truncate">
                                            {station.name}
                                            {station.shortCode ? ` [${station.shortCode}]` : ""}
                                        </span>
                                        {station.postalCode && (
                                            <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                                                {station.postalCode}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {origin?.slug !== station.slug && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    originManuallyClearedRef.current = false;
                                                    const hit = offices.find((n) => n.slug === station.slug);
                                                    setOrigin(
                                                        hit ?? toRoutingOfficeNode(station)
                                                    );
                                                }}
                                                className="tap rounded border border-primary/50 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary hover:bg-primary/20"
                                            >
                                                {tStaff("useAsOrigin")}
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setStationPickerOpen((v) => !v)}
                                            className="tap rounded border border-border bg-card px-2 py-0.5 text-[11px] font-semibold hover:bg-muted"
                                        >
                                            {tStaff("changeStation")}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                clearStation();
                                                setStationPickerOpen(false);
                                            }}
                                            aria-label={tStaff("clearStation")}
                                            className="tap rounded border border-border bg-card p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                        >
                                            <PinOff className="h-3 w-3" aria-hidden="true" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <span className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                                        <Pin className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
                                        <span className="truncate">{tStaff("staffPrompt")}</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setStationPickerOpen((v) => !v)}
                                        className="tap rounded border border-foreground/60 bg-card px-2.5 py-1 text-[11px] font-bold hover:bg-muted shrink-0"
                                    >
                                        {tStaff("setStation")}
                                    </button>
                                </div>
                            )}
                            {stationPickerOpen && (
                                <StaffStationPicker
                                    compact
                                    defaultOpen
                                    onSelected={() => {
                                        originManuallyClearedRef.current = false;
                                        setStationPickerOpen(false);
                                    }}
                                />
                            )}
                        </div>

                        <div className="relative flex items-stretch gap-2.5 sm:gap-3">
                            {/* Visual Route Connector Rail */}
                            <div className="hidden xs:flex flex-col items-center pt-7 pb-4 shrink-0" aria-hidden="true">
                                <span className="h-3 w-3 rounded-full border-2 border-foreground bg-background" />
                                <span className="my-1 flex-1 w-0.5 border-l-2 border-dashed border-foreground/40" />
                                <MapPin className="h-4 w-4 text-primary" />
                            </div>

                            {/* Stacked Inputs on Mobile, Side-by-Side on md+ */}
                            <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                                <OfficePicker
                                    label={t("originLabel")}
                                    placeholder={t("originPlaceholder")}
                                    selected={origin}
                                    onSelect={(node) => {
                                        originManuallyClearedRef.current = false;
                                        setOrigin(node);
                                    }}
                                    onClear={() => {
                                        originManuallyClearedRef.current = true;
                                        setOrigin(null);
                                    }}
                                    offices={offices}
                                    actionSlot={
                                        origin && station?.slug !== origin.slug ? (
                                            <button
                                                type="button"
                                                onClick={() => setStation(toStaffStation(origin))}
                                                aria-label={tStaff("pinAsStation")}
                                                title={tStaff("pinAsStation")}
                                                className="tap rounded-md p-1.5 text-primary hover:bg-primary/10 shrink-0"
                                            >
                                                <Pin className="h-4 w-4" aria-hidden="true" />
                                            </button>
                                        ) : null
                                    }
                                />
                                <OfficePicker
                                    label={t("destLabel")}
                                    placeholder={t("destPlaceholder")}
                                    selected={dest}
                                    onSelect={setDest}
                                    onClear={() => setDest(null)}
                                    offices={offices}
                                />
                            </div>

                            {/* Swap Button */}
                            {origin && dest && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const prevO = origin;
                                        originManuallyClearedRef.current = false;
                                        setOrigin(dest);
                                        setDest(prevO);
                                    }}
                                    aria-label={t("swapOffices")}
                                    title={t("swapOffices")}
                                    className="tap self-center mt-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-foreground bg-secondary text-secondary-foreground shadow-[0_2px_0_0_hsl(var(--foreground))] hover:opacity-90"
                                >
                                    <ArrowUpDown className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {/* Quick Route & Destination Chips (1-tap mobile presets, personalized for Duty Station) */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide pt-1 border-t border-border/60">
                            <span className="label-mono text-[10px] shrink-0 mr-1">{t("quickRoutes")}:</span>
                            {stationHydrated && station && offices.length > 0
                                ? [
                                      { label: "→ Colombo", code: "00100" },
                                      { label: "→ Kandy", code: "20000" },
                                      { label: "→ Jaffna", code: "40000" },
                                      { label: "→ Galle", code: "80000" },
                                      { label: "→ Matara", code: "81000" },
                                  ]
                                      .filter((p) => p.code !== station.postalCode)
                                      .map((preset) => (
                                          <button
                                              key={preset.code}
                                              type="button"
                                              onClick={() => {
                                                  originManuallyClearedRef.current = false;
                                                  const stationNode =
                                                      offices.find((n) => n.slug === station.slug) ??
                                                      null;
                                                  const targetNode =
                                                      resolveOfficeForRoute(preset.code, offices)
                                                          ?.office ?? null;
                                                  if (stationNode) setOrigin(stationNode);
                                                  if (targetNode) setDest(targetNode);
                                              }}
                                              className="tap shrink-0 rounded-full border border-primary/50 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-primary/15"
                                          >
                                              {preset.label}
                                          </button>
                                      ))
                                : [
                                      { label: "Kandy → Jaffna", from: "20000", to: "40000" },
                                      { label: "Galle → Avissawella", from: "80000", to: "10700" },
                                      { label: "Akarawita → Colombo", from: "10732", to: "00100" },
                                      { label: "Kurunegala → Matara", from: "60000", to: "81000" },
                                  ].map((preset) => (
                                      <button
                                          key={preset.label}
                                          type="button"
                                          onClick={() => applyPresetRoute(preset.from, preset.to)}
                                          className="tap shrink-0 rounded-full border border-foreground/45 bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary/35"
                                      >
                                          {preset.label}
                                      </button>
                                  ))}
                        </div>
                    </div>

                    {!computedRoute ? (
                        <div className="rounded-xl border-2 border-dashed border-foreground/35 bg-card/50 p-6 sm:p-8 text-center space-y-2">
                            <Package className="h-9 w-9 mx-auto text-primary" aria-hidden="true" />
                            <h2 className="font-heading text-lg sm:text-xl font-extrabold">{t("emptyTitle")}</h2>
                            <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
                                {t("emptyBody")}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-5 items-start">
                            {/* Bag Label Card First on Mobile (order-1 lg:order-2) */}
                            <div className="order-1 lg:order-2 space-y-3.5">
                                <div className="rounded-xl border-2 border-foreground bg-card overflow-hidden shadow-[0_3px_0_0_hsl(var(--foreground))]">
                                    <div className="bg-foreground text-background px-3.5 py-2.5 flex items-center justify-between gap-2">
                                        <span className="font-mono text-[11px] font-bold uppercase tracking-wider truncate">
                                            {t("bagLabelTitle")}
                                        </span>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                                type="button"
                                                onClick={handleCopyBagLabel}
                                                className="tap inline-flex items-center gap-1 rounded bg-background/15 px-2.5 py-1 text-[11px] font-semibold hover:bg-background/25"
                                            >
                                                {copiedLabel ? (
                                                    <>
                                                        <Check className="h-3 w-3" /> {t("copied")}
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="h-3 w-3" /> {t("copyLabel")}
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleShareRoute}
                                                className="tap inline-flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:opacity-90"
                                            >
                                                <Share2 className="h-3 w-3" />
                                                <span>{t("shareRoute")}</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-4 space-y-3 text-sm">
                                        <div>
                                            <span className="label-mono block text-[10px]">{t("bagTo")}</span>
                                            <p className="font-heading text-lg sm:text-xl font-extrabold mt-0.5">
                                                {computedRoute.bagLabel.toOffice}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 border-y border-dashed border-border py-2.5">
                                            <div>
                                                <span className="label-mono block text-[10px]">{t("postcode")}</span>
                                                <span className="font-mono text-base sm:text-lg font-bold">
                                                    {computedRoute.bagLabel.postalCode}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="label-mono block text-[10px]">{t("shortCode")}</span>
                                                <span className="font-mono text-base sm:text-lg font-bold">
                                                    {computedRoute.bagLabel.shortCode}
                                                </span>
                                            </div>
                                        </div>
                                        <dl className="space-y-1.5 text-xs">
                                            <div className="flex justify-between gap-2">
                                                <dt className="text-muted-foreground">{t("hub")}</dt>
                                                <dd className="font-mono font-bold text-right">
                                                    {computedRoute.bagLabel.hub}
                                                </dd>
                                            </div>
                                            <div className="flex justify-between gap-2">
                                                <dt className="text-muted-foreground">{t("controlling")}</dt>
                                                <dd className="font-semibold text-right">
                                                    {computedRoute.bagLabel.controllingOffice}
                                                </dd>
                                            </div>
                                            <div className="flex justify-between gap-2">
                                                <dt className="text-muted-foreground">{t("division")}</dt>
                                                <dd className="font-semibold text-right">
                                                    {computedRoute.bagLabel.division}
                                                </dd>
                                            </div>
                                        </dl>
                                        <p className="rounded-md bg-muted px-3 py-2 text-xs font-medium">
                                            {computedRoute.bagLabel.bagTypeHint}
                                        </p>
                                    </div>
                                </div>

                                {computedRoute.bagLabel.deliveryWarning && (
                                    <div className="flex items-start gap-2.5 rounded-xl border-2 border-amber-700/50 bg-amber-500/10 p-3.5 text-xs sm:text-sm">
                                        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300 mt-0.5" />
                                        <p className="font-medium">{computedRoute.bagLabel.deliveryWarning}</p>
                                    </div>
                                )}

                                {computedRoute.duplicateNames.length > 0 && (
                                    <div className="rounded-xl border-2 border-primary/50 bg-primary/5 p-3.5 text-xs sm:text-sm space-y-2">
                                        <p className="font-bold text-primary flex items-center gap-1.5">
                                            <MapPin className="h-4 w-4" />
                                            {t("duplicateWarningTitle", {
                                                name: dest?.name || "",
                                                count: computedRoute.duplicateNames.length + 1,
                                            })}
                                        </p>
                                        <p className="text-muted-foreground">{t("duplicateWarningBody")}</p>
                                        <ul className="space-y-1">
                                            {computedRoute.duplicateNames.map((dup) => (
                                                <li key={dup.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDest(dup)}
                                                        className="underline font-mono text-xs hover:text-primary text-left"
                                                    >
                                                        Switch to {dup.name} ({dup.postalCode || "No code"} ·{" "}
                                                        {dup.division || "Sri Lanka"})
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            {/* Connected Vertical Timeline */}
                            <div className="order-2 lg:order-1 rounded-xl border-2 border-foreground bg-card p-4 sm:p-5 space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 font-mono text-xs font-bold text-primary">
                                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                                        {computedRoute.scopeLabel}
                                    </span>
                                </div>
                                <p className="text-xs sm:text-sm font-medium text-foreground/90">
                                    {computedRoute.summary}
                                </p>

                                <ol className="relative pl-6 space-y-3 before:absolute before:left-[11px] before:top-3 before:bottom-3 before:w-0.5 before:bg-foreground/25">
                                    {computedRoute.steps.map((step, i) => {
                                        const isLast = i === computedRoute.steps.length - 1;
                                        return (
                                            <li key={`${step.role}-${i}`} className="relative">
                                                <span
                                                    className={cn(
                                                        "absolute -left-6 top-3 flex h-6 w-6 items-center justify-center rounded-full border-2 border-foreground font-mono text-[11px] font-extrabold",
                                                        isLast
                                                            ? "bg-primary text-primary-foreground"
                                                            : i === 0
                                                              ? "bg-secondary text-secondary-foreground"
                                                              : "bg-card text-foreground"
                                                    )}
                                                >
                                                    {i + 1}
                                                </span>
                                                <div className="rounded-lg border-2 border-foreground/30 bg-background p-3">
                                                    <div className="flex items-start justify-between gap-2.5">
                                                        <div className="min-w-0">
                                                            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                                                {step.role.replace(/_/g, " ")}
                                                            </p>
                                                            {step.officeSlug ? (
                                                                <Link
                                                                    href={`/office/${step.officeSlug}`}
                                                                    className="font-heading text-sm sm:text-base font-extrabold hover:text-primary underline decoration-foreground/25 underline-offset-4"
                                                                >
                                                                    {step.title}
                                                                </Link>
                                                            ) : (
                                                                <p className="font-heading text-sm sm:text-base font-extrabold">
                                                                    {step.title}
                                                                </p>
                                                            )}
                                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                                {step.subtitle}
                                                            </p>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                                            {step.shortCode && (
                                                                <span className="rounded border border-foreground/40 bg-card px-2 py-0.5 font-mono text-[11px] font-bold">
                                                                    {step.shortCode}
                                                                </span>
                                                            )}
                                                            {step.postalCode && (
                                                                <span className="font-mono text-xs text-muted-foreground">
                                                                    {step.postalCode}
                                                                </span>
                                                            )}
                                                            {step.badge && (
                                                                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-secondary-foreground">
                                                                    {step.badge}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ol>
                            </div>
                        </div>
                    )}
                </section>
            )}

            {/* TAB 2: RMSC / TPO HUBS & 00-91 PREFIX ZONES */}
            {activeTab === "hubs" && (
                <section className="space-y-6">
                    {/* Sorting Hubs Browser */}
                    <div className="rounded-xl border-2 border-foreground bg-card p-4 sm:p-5 space-y-4">
                        <div>
                            <h2 className="font-heading text-lg sm:text-xl font-extrabold">{t("hubsTitle")}</h2>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{t("hubsSubtitle")}</p>
                        </div>

                        {/* Horizontal scroll on mobile, wrapped on sm+ */}
                        <div className="flex flex-nowrap sm:flex-wrap gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                            {SORTING_HUBS.map((hub) => {
                                const active = selectedHubName.toLowerCase() === hub.name.toLowerCase();
                                return (
                                    <button
                                        key={hub.id}
                                        type="button"
                                        onClick={() => setSelectedHubName(hub.name)}
                                        className={cn(
                                            "tap shrink-0 rounded-md border-[1.5px] px-3 py-2 font-mono text-xs font-bold transition-colors whitespace-nowrap",
                                            active
                                                ? "border-foreground bg-primary text-primary-foreground"
                                                : "border-foreground/40 bg-background hover:border-foreground"
                                        )}
                                    >
                                        {hub.name}
                                    </button>
                                );
                            })}
                        </div>

                        {(() => {
                            const info = SORTING_HUBS.find(
                                (h) => h.name.toLowerCase() === selectedHubName.toLowerCase()
                            );
                            if (!info) return null;
                            return (
                                <div className="rounded-lg border border-border bg-background p-3.5 space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-heading font-extrabold text-base sm:text-lg">{info.name}</span>
                                        <span className="rounded bg-secondary px-2 py-0.5 font-mono text-xs font-bold">
                                            {info.kind} · {info.postalCode}
                                        </span>
                                        <span className="text-xs text-muted-foreground">{info.province}</span>
                                    </div>
                                    <p className="text-xs sm:text-sm text-muted-foreground">{info.description}</p>
                                </div>
                            );
                        })()}

                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="search"
                                value={hubOfficeFilter}
                                onChange={(e) => setHubOfficeFilter(e.target.value)}
                                placeholder={t("filterHubOfficesPlaceholder")}
                                className="h-11 w-full rounded-lg border-[1.5px] border-foreground/50 bg-background pl-9 pr-3 text-sm"
                            />
                        </div>

                        <div className="max-h-96 overflow-y-auto divide-y divide-border rounded-lg border border-border">
                            {hubOffices.map((o) => (
                                <Link
                                    key={o.id}
                                    href={`/office/${o.slug}`}
                                    className="tap flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm hover:bg-muted/70"
                                >
                                    <div className="min-w-0">
                                        <p className="font-semibold truncate">{o.name}</p>
                                        <p className="text-[11px] text-muted-foreground truncate">
                                            {o.type}
                                            {o.division ? ` · ${o.division}` : ""}
                                            {o.controllingOfficeName ? ` · via ${o.controllingOfficeName}` : ""}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                                        {o.shortCode && (
                                            <span className="rounded border border-border px-1.5 py-0.5 font-bold">
                                                {o.shortCode}
                                            </span>
                                        )}
                                        <span className="text-muted-foreground">{o.postalCode || "—"}</span>
                                    </div>
                                </Link>
                            ))}
                            {hubOffices.length === 0 && (
                                <p className="p-4 text-center text-sm text-muted-foreground">
                                    No offices matched in this sorting hub.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* 00-91 Postal Code Prefix Map: Stacked Cards on Mobile, Table on Desktop */}
                    <div className="rounded-xl border-2 border-foreground bg-card p-4 sm:p-5 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h2 className="font-heading text-lg sm:text-xl font-extrabold">{t("prefixTitle")}</h2>
                                <p className="text-xs sm:text-sm text-muted-foreground">{t("prefixSubtitle")}</p>
                            </div>
                            <input
                                type="search"
                                value={prefixQuery}
                                onChange={(e) => setPrefixQuery(e.target.value)}
                                placeholder="Type 20000, 81, Galle..."
                                className="h-11 w-full sm:w-64 rounded-lg border-[1.5px] border-foreground/60 bg-background px-3 text-sm font-mono"
                            />
                        </div>

                        {matchedPrefixZone && (
                            <div className="rounded-lg border-2 border-primary bg-primary/10 p-3.5 text-xs sm:text-sm flex flex-wrap items-center justify-between gap-2">
                                <span>
                                    <strong className="font-mono">{matchedPrefixZone.prefix}xxx</strong> →{" "}
                                    <strong>{matchedPrefixZone.district}</strong> ({matchedPrefixZone.province})
                                </span>
                                <span className="font-mono text-xs font-bold text-primary">
                                    Primary Hub: {matchedPrefixZone.primaryHub}
                                </span>
                            </div>
                        )}

                        {/* Mobile Stacked Cards */}
                        <div className="sm:hidden space-y-2">
                            {filteredPrefixZones.map((z) => (
                                <div key={z.prefix} className="rounded-lg border border-border bg-background p-3 space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-mono text-sm font-extrabold text-primary">
                                            {z.prefix}xxx · {z.district}
                                        </span>
                                        <span className="text-[11px] font-medium text-muted-foreground">
                                            {z.province}
                                        </span>
                                    </div>
                                    <p className="font-mono text-xs font-bold">{z.primaryHub}</p>
                                    <p className="text-[11px] text-muted-foreground leading-snug">{z.notes}</p>
                                </div>
                            ))}
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden sm:block overflow-x-auto rounded-lg border border-border">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-muted/70 font-mono text-[11px] uppercase">
                                    <tr>
                                        <th className="px-3 py-2.5">Prefix</th>
                                        <th className="px-3 py-2.5">District / Zone</th>
                                        <th className="px-3 py-2.5">Province</th>
                                        <th className="px-3 py-2.5">Primary Hub</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {filteredPrefixZones.map((z) => (
                                        <tr key={z.prefix} className="hover:bg-muted/40">
                                            <td className="px-3 py-2.5 font-mono font-bold text-primary">
                                                {z.prefix}xxx
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <p className="font-semibold">{z.district}</p>
                                                <p className="text-[11px] text-muted-foreground">{z.notes}</p>
                                            </td>
                                            <td className="px-3 py-2.5 text-muted-foreground">{z.province}</td>
                                            <td className="px-3 py-2.5 font-mono text-xs font-semibold">
                                                {z.primaryHub}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            )}

            {/* TAB 3: COLLAPSIBLE FIELD GUIDE */}
            {activeTab === "guide" && (
                <section className="rounded-xl border-2 border-foreground bg-card p-4 sm:p-6 space-y-4">
                    <div>
                        <h2 className="font-heading text-xl sm:text-2xl font-extrabold">{t("guideTitle")}</h2>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">{t("guideSubtitle")}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {GUIDE_SECTIONS.map((sec, idx) => (
                            <details
                                key={sec.id}
                                open={idx === 0}
                                className="group rounded-lg border-2 border-foreground/25 bg-background open:border-foreground/50"
                            >
                                <summary className="tap flex cursor-pointer list-none items-center justify-between gap-2 p-4 font-heading font-extrabold text-sm sm:text-base text-primary">
                                    <span>{sec.title}</span>
                                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                                </summary>
                                <ul className="px-4 pb-4 text-xs sm:text-sm space-y-2 text-muted-foreground list-disc pl-8 border-t border-border/60 pt-3">
                                    {sec.items.map((item) => (
                                        <li key={item.lead}>
                                            <strong className="text-foreground">{item.lead}</strong> {item.body}
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        ))}
                    </div>
                </section>
            )}

            {/* TAB 4: SORTING PRACTICE QUIZ */}
            {activeTab === "quiz" && (
                <section className="rounded-xl border-2 border-foreground bg-card p-4 sm:p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h2 className="font-heading text-lg sm:text-xl font-extrabold">{t("quizTitle")}</h2>
                            <p className="text-xs sm:text-sm text-muted-foreground">{t("quizSubtitle")}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                aria-label="Filter quiz by division"
                                value={quizDivision}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setQuizDivision(val);
                                    startNewQuiz(val);
                                }}
                                className="h-10 flex-1 sm:flex-initial rounded-md border-[1.5px] border-foreground bg-background px-2.5 text-xs font-semibold"
                            >
                                <option value="">All Sri Lanka</option>
                                {divisions.map((div) => (
                                    <option key={div} value={div}>
                                        {div}
                                    </option>
                                ))}
                            </select>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-10"
                                onClick={() => startNewQuiz(quizDivision)}
                            >
                                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                                {t("newQuiz")}
                            </Button>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5 border-y border-border py-2.5">
                        <div className="flex items-center justify-between font-mono text-xs">
                            <span>
                                Question {Math.min(qIdx + 1, questions.length)} / {questions.length}
                            </span>
                            <span className="font-bold text-primary">
                                Score: {score} / {answeredCount}
                            </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all duration-300"
                                style={{
                                    width: `${questions.length > 0 ? ((qIdx + 1) / questions.length) * 100 : 0}%`,
                                }}
                            />
                        </div>
                    </div>

                    {currentQuestion ? (
                        <div className="space-y-4">
                            <div>
                                <p className="label-mono text-muted-foreground mb-1">
                                    {currentQuestion.contextLabel}
                                </p>
                                <h3 className="font-heading text-base sm:text-xl font-extrabold">
                                    {currentQuestion.prompt}
                                </h3>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {currentQuestion.options.map((opt) => {
                                    const isPicked = selectedAnswer === opt;
                                    const isCorrect = opt === currentQuestion.correctAnswer;
                                    const showFeedback = selectedAnswer !== null;
                                    return (
                                        <button
                                            key={opt}
                                            type="button"
                                            disabled={showFeedback}
                                            onClick={() => {
                                                setSelectedAnswer(opt);
                                                setAnsweredCount((c) => c + 1);
                                                if (opt === currentQuestion.correctAnswer) {
                                                    setScore((s) => s + 1);
                                                }
                                            }}
                                            className={cn(
                                                "tap min-h-[48px] rounded-lg border-2 px-4 py-3 text-left text-sm font-semibold transition-colors",
                                                !showFeedback &&
                                                    "border-foreground/50 bg-background hover:border-foreground hover:bg-secondary/25",
                                                showFeedback &&
                                                    isCorrect &&
                                                    "border-emerald-700 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200",
                                                showFeedback &&
                                                    isPicked &&
                                                    !isCorrect &&
                                                    "border-destructive bg-destructive/15 text-destructive",
                                                showFeedback &&
                                                    !isPicked &&
                                                    !isCorrect &&
                                                    "border-border bg-background opacity-60"
                                            )}
                                        >
                                            {opt}
                                        </button>
                                    );
                                })}
                            </div>

                            {selectedAnswer !== null && (
                                <div className="rounded-lg border border-border bg-background p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-start gap-2.5 text-sm">
                                        <CheckCircle2
                                            className={cn(
                                                "h-5 w-5 shrink-0 mt-0.5",
                                                selectedAnswer === currentQuestion.correctAnswer
                                                    ? "text-emerald-600"
                                                    : "text-amber-600"
                                            )}
                                        />
                                        <p>{currentQuestion.explanation}</p>
                                    </div>
                                    {qIdx < questions.length - 1 ? (
                                        <Button
                                            type="button"
                                            size="sm"
                                            className="h-10 w-full sm:w-auto shrink-0"
                                            onClick={() => {
                                                setQIdx((i) => i + 1);
                                                setSelectedAnswer(null);
                                            }}
                                        >
                                            {t("nextQuestion")}
                                            <ArrowRight className="h-4 w-4 ml-1.5" />
                                        </Button>
                                    ) : (
                                        <Button
                                            type="button"
                                            size="sm"
                                            className="h-10 w-full sm:w-auto shrink-0"
                                            onClick={() => startNewQuiz(quizDivision)}
                                        >
                                            {t("playAgain")}
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Preparing sorting practice questions from the directory...
                        </p>
                    )}
                </section>
            )}
        </div>
    );
}
