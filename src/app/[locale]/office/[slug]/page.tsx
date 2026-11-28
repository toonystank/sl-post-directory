import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
    AlertTriangle,
    ArrowRight,
    Building2,
    CheckCircle2,
    Compass,
    PenLine,
    Phone,
    XCircle,
} from "lucide-react";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { getLocalOfficeBySlug, getLocalOfficesByDivision } from "@/lib/local-sqlite";
import { getPostOfficeStatus, parseOperatingHours } from "@/lib/holidays";
import { inferHubFromOffice } from "@/lib/mail-routing";
import { safeJsonLd } from "@/lib/security";
import {
    buildOfficeMetadataCopy,
    buildOfficeSeoContent,
    classifyOfficeSitemapTier,
    selectRelatedDivisionOffices,
    type DivisionSiblingCandidate,
    type OfficeSeoInput,
} from "@/lib/seo-office";
import {
    buildEnglishCanonicalAlternates,
    buildLocalizedAlternates,
    buildLocalizedUrl,
    formatSriLankaPhone,
    getDefaultOpenGraphImages,
    getOgLocale,
    normalizePostalCode,
    slugifyDivision,
} from "@/lib/site";
import { Link } from "@/navigation";
import { CopyButton } from "@/components/CopyButton";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import Postmark from "@/components/brand/Postmark";
import StatusDot from "@/components/brand/StatusDot";
import PhotoGallery from "@/components/office/PhotoGallery";
import ControlledOfficesList, { type ControlledOfficeItem } from "@/components/office/ControlledOfficesList";
import StaffNetworkPanel from "@/components/office/StaffNetworkPanel";
import RmscHubLabel from "@/components/office/RmscHubLabel";
import ReviewSection from "@/components/ReviewSection";
import { PhotoUploadClient } from "./PhotoUploadClient";
import OfficeActions from "./OfficeActions";

export const revalidate = 86400; // Cache the post office page for 24 hours
export const dynamicParams = true;

// Returning an empty array activates Next.js 16 on-demand ISR caching for all 4,000+ office pages
// without slowing down builds or hitting PostgreSQL on every crawler request.
export function generateStaticParams() {
    return [];
}

const findDivisionSiblings = cache(async function findDivisionSiblings(
    division: string
): Promise<DivisionSiblingCandidate[]> {
    const clean = division.trim();
    if (!clean) return [];

    const fromLocal = (): DivisionSiblingCandidate[] =>
        getLocalOfficesByDivision(clean).map((o) => ({
            slug: o.slug,
            name: o.name,
            postalCode: normalizePostalCode(o.postalCode),
            type: o.fields.find((f) => f.name === "Type")?.value || "Post Office",
        }));

    if (!hasDatabaseUrl) return fromLocal();
    try {
        const rows = await prisma.postOffice.findMany({
            where: {
                fields: {
                    some: {
                        name: "Division",
                        value: { equals: clean, mode: "insensitive" },
                    },
                },
            },
            orderBy: { name: "asc" },
            select: {
                slug: true,
                name: true,
                postalCode: true,
                fields: {
                    where: { name: "Type" },
                    select: { value: true },
                },
            },
        });
        if (rows.length === 0) return fromLocal();
        return rows.map((r) => ({
            slug: r.slug,
            name: r.name,
            postalCode: normalizePostalCode(r.postalCode),
            type: r.fields[0]?.value || "Post Office",
        }));
    } catch {
        return fromLocal();
    }
});

const findOfficeDetails = cache(async function findOfficeDetails(slug: string) {
    if (!hasDatabaseUrl) {
        return getLocalOfficeBySlug(slug);
    }
    try {
        return await prisma.postOffice.findUnique({
            where: { slug },
            include: {
                fields: true,
                photos: {
                    where: { status: "APPROVED" },
                    orderBy: { createdAt: "desc" },
                },
                reviews: {
                    where: { status: "APPROVED" },
                    orderBy: { createdAt: "desc" },
                    take: 20,
                },
                controllingOffice: {
                    select: {
                        id: true,
                        slug: true,
                        name: true,
                        postalCode: true,
                        rmsc: true,
                        fields: {
                            where: { name: { in: ["Short Code", "Phone", "Telephone", "Delivery"] } },
                            select: { name: true, value: true },
                        },
                    },
                },
                controlledOffices: {
                    orderBy: { name: "asc" },
                    select: {
                        id: true,
                        slug: true,
                        name: true,
                        postalCode: true,
                        fields: {
                            where: { name: { in: ["Short Code", "Delivery", "Type"] } },
                            select: { name: true, value: true },
                        },
                    },
                },
            },
        });
    } catch {
        return getLocalOfficeBySlug(slug);
    }
});

async function getApprovedReviewSummary(
    postOfficeId: string,
    fallbackReviews: { rating: number }[]
): Promise<{ count: number; avgRating: number | undefined }> {
    if (!hasDatabaseUrl) {
        if (fallbackReviews.length === 0) return { count: 0, avgRating: undefined };
        const avg = fallbackReviews.reduce((s, r) => s + r.rating, 0) / fallbackReviews.length;
        return { count: fallbackReviews.length, avgRating: avg };
    }
    try {
        const agg = await prisma.review.aggregate({
            where: { postOfficeId, status: "APPROVED" },
            _avg: { rating: true },
            _count: { _all: true },
        });
        const count = agg._count._all;
        return {
            count,
            avgRating: count > 0 && agg._avg.rating !== null ? agg._avg.rating : undefined,
        };
    } catch {
        if (fallbackReviews.length === 0) return { count: 0, avgRating: undefined };
        const avg = fallbackReviews.reduce((s, r) => s + r.rating, 0) / fallbackReviews.length;
        return { count: fallbackReviews.length, avgRating: avg };
    }
}

function splitPhoneNumbers(raw?: string | null): string[] {
    if (!raw) return [];
    return raw
        .split(/\s*\/\s*/)
        .map((part) => formatSriLankaPhone(part.trim()))
        .filter(Boolean);
}

type OfficeRecord = NonNullable<Awaited<ReturnType<typeof findOfficeDetails>>>;

function extractOfficeSeoContext(office: OfficeRecord, open24hLabel: string = "Open 24 hours") {
    const getField = (name: string) =>
        office.fields.find((f) => f.name === name)?.value?.trim() || "";

    const normalizedCode = normalizePostalCode(office.postalCode);
    const type = getField("Type") || "Post Office";
    const grade = getField("Grade");
    const shortCode = getField("Short Code");
    const delivery = getField("Delivery");
    const division = getField("Division");
    const dpmg = getField("DPMG");
    const fax = formatSriLankaPhone(getField("Fax"));
    const is24Hour = getField("Is24Hour") === "true";
    const rawTelephone = getField("Telephone") || getField("Phone");
    const phoneNumbers = splitPhoneNumbers(rawTelephone);
    const workingHoursField =
        ("operatingHours" in office && office.operatingHours ? office.operatingHours.trim() : "") ||
        getField("Working Hours");
    const parsedHours = parseOperatingHours(workingHoursField, is24Hour, type);
    const hoursSummary = is24Hour ? open24hLabel : parsedHours.summary;
    const isDeliveryOffice = /^yes|delivery$/i.test(delivery);
    const isNonDeliveryOffice = /^no|non/i.test(delivery);
    const effectiveRmsc =
        office.rmsc ||
        inferHubFromOffice({
            rmsc: null,
            postalCode: normalizedCode,
            division,
        });

    const ctrlRaw = office.controllingOffice as
        | {
              id: string;
              slug: string;
              name: string;
              postalCode: string;
              shortCode?: string;
              phone?: string;
              fields?: { name: string; value: string }[];
          }
        | null
        | undefined;

    const controllingOffice = ctrlRaw
        ? {
              id: ctrlRaw.id,
              slug: ctrlRaw.slug,
              name: ctrlRaw.name,
              postalCode: normalizePostalCode(ctrlRaw.postalCode),
              shortCode:
                  ctrlRaw.shortCode ||
                  ctrlRaw.fields?.find((f) => f.name === "Short Code")?.value ||
                  "",
              phone:
                  formatSriLankaPhone(
                      ctrlRaw.phone ||
                          ctrlRaw.fields?.find((f) => f.name === "Phone" || f.name === "Telephone")
                              ?.value
                  ) || "",
          }
        : null;

    const seoInput: OfficeSeoInput = {
        name: office.name,
        postalCode: normalizedCode,
        type,
        grade: grade || undefined,
        shortCode: shortCode || undefined,
        division: division || undefined,
        dpmg: dpmg || undefined,
        rmsc: effectiveRmsc || undefined,
        phoneNumbers,
        fax: fax || undefined,
        hoursSummary,
        is24Hour,
        weekdayHours: parsedHours.weekday?.label,
        saturdayHours: parsedHours.saturday?.label,
        sundayHours: parsedHours.sunday?.label,
        isDeliveryOffice,
        isNonDeliveryOffice,
        controllingOffice: controllingOffice
            ? {
                  name: controllingOffice.name,
                  postalCode: controllingOffice.postalCode,
                  phone: controllingOffice.phone || undefined,
              }
            : null,
        controlledCount: office.controlledOffices?.length ?? 0,
    };

    return { seoInput, type, normalizedCode, division, controllingOffice };
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
    const { locale, slug } = await params;

    const office = await findOfficeDetails(slug);

    if (!office) {
        return {
            title: "Post Office Not Found",
        };
    }

    const { seoInput, type, normalizedCode } = extractOfficeSeoContext(office);
    const { tier } = classifyOfficeSitemapTier({ type, postalCode: normalizedCode });
    const isMajorTier = tier === 1;
    const effectiveLocale = isMajorTier ? locale : "en";
    const { title, description } = buildOfficeMetadataCopy(seoInput, effectiveLocale);
    const canonicalUrl = buildLocalizedUrl(`/office/${office.slug}`, effectiveLocale);

    return {
        title,
        description,
        alternates: isMajorTier
            ? buildLocalizedAlternates(`/office/${office.slug}`, locale)
            : buildEnglishCanonicalAlternates(`/office/${office.slug}`),
        openGraph: {
            title: `${title} | Lanka Post Directory`,
            description,
            url: canonicalUrl,
            locale: getOgLocale(effectiveLocale),
            images: getDefaultOpenGraphImages(`${title} | Lanka Post Directory`),
        },
    };
}

export default async function OfficeDetails({
    params,
}: {
    params: Promise<{ locale: string; slug: string }>;
}) {
    const { locale, slug } = await params;
    setRequestLocale(locale);

    const office = await findOfficeDetails(slug);

    if (!office) {
        notFound();
    }

    const divisionRaw =
        office.fields.find((f) => f.name === "Division")?.value?.trim() || "";

    const [t, tStatus, reviewSummary, divisionSiblings] = await Promise.all([
        getTranslations("Office"),
        getTranslations("Status"),
        getApprovedReviewSummary(office.id, office.reviews),
        divisionRaw ? findDivisionSiblings(divisionRaw) : Promise.resolve([]),
    ]);

    const getField = (name: string) =>
        office.fields.find((f) => f.name === name)?.value?.trim() || "";

    const normalizedCode = normalizePostalCode(office.postalCode);
    const type = getField("Type") || t("typeDefault");
    const grade = getField("Grade");
    const shortCode = getField("Short Code");
    const delivery = getField("Delivery");
    const division = divisionRaw;
    const dpmg = getField("DPMG");
    const fax = formatSriLankaPhone(getField("Fax"));
    const divisionSlug = division ? slugifyDivision(division) : null;
    const is24Hour = getField("Is24Hour") === "true";
    const rawTelephone = getField("Telephone") || getField("Phone");
    const phoneNumbers = splitPhoneNumbers(rawTelephone);
    const primaryTelephone = phoneNumbers[0];

    const workingHoursField =
        ("operatingHours" in office && office.operatingHours ? office.operatingHours.trim() : "") ||
        getField("Working Hours");
    const parsedHours = parseOperatingHours(workingHoursField, is24Hour, type);
    const hoursSummary = is24Hour ? t("open24h") : parsedHours.summary;

    const currentStatus = getPostOfficeStatus(locale, is24Hour, workingHoursField);
    const statusLabel =
        currentStatus.status === "holiday" ? tStatus("holiday") : tStatus(currentStatus.label);

    const isDeliveryOffice = /^yes|delivery$/i.test(delivery);
    const isNonDeliveryOffice = /^no|non/i.test(delivery);
    const effectiveRmsc =
        office.rmsc ||
        inferHubFromOffice({
            rmsc: null,
            postalCode: normalizedCode,
            division,
        });

    // Normalize controllingOffice fields across Prisma and LocalOfficeRecord shapes
    const ctrlRaw = office.controllingOffice as
        | {
              id: string;
              slug: string;
              name: string;
              postalCode: string;
              shortCode?: string;
              phone?: string;
              fields?: { name: string; value: string }[];
          }
        | null
        | undefined;

    const controllingOffice = ctrlRaw
        ? {
              id: ctrlRaw.id,
              slug: ctrlRaw.slug,
              name: ctrlRaw.name,
              postalCode: normalizePostalCode(ctrlRaw.postalCode),
              shortCode:
                  ctrlRaw.shortCode ||
                  ctrlRaw.fields?.find((f) => f.name === "Short Code")?.value ||
                  "",
              phone:
                  formatSriLankaPhone(
                      ctrlRaw.phone ||
                          ctrlRaw.fields?.find((f) => f.name === "Phone" || f.name === "Telephone")
                              ?.value
                  ) || "",
          }
        : null;

    const controlledOffices: ControlledOfficeItem[] = (office.controlledOffices || []).map((sub) => {
        const subAny = sub as {
            id: string;
            slug: string;
            name: string;
            postalCode: string;
            shortCode?: string;
            delivery?: string;
            type?: string;
            fields?: { name: string; value: string }[];
        };
        return {
            id: subAny.id,
            slug: subAny.slug,
            name: subAny.name,
            postalCode: normalizePostalCode(subAny.postalCode),
            shortCode:
                subAny.shortCode ||
                subAny.fields?.find((f) => f.name === "Short Code")?.value ||
                "",
            delivery:
                subAny.delivery ||
                subAny.fields?.find((f) => f.name === "Delivery")?.value ||
                "",
            type:
                subAny.type ||
                subAny.fields?.find((f) => f.name === "Type")?.value ||
                "",
        };
    });

    const avgRating = reviewSummary.avgRating;
    const totalApprovedReviews = reviewSummary.count;

    const firstImage = office.photos.length > 0 ? office.photos[0].url : undefined;
    const officeUrl = buildLocalizedUrl(`/office/${office.slug}`, locale);

    const openingHoursSpecification = parsedHours.is24Hour
        ? [
              {
                  "@type": "OpeningHoursSpecification",
                  dayOfWeek: [
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday",
                      "Saturday",
                      "Sunday",
                  ],
                  opens: "00:00",
                  closes: "23:59",
              },
          ]
        : [
              ...(parsedHours.weekday
                  ? [
                        {
                            "@type": "OpeningHoursSpecification",
                            dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                            opens: parsedHours.weekday.open24h,
                            closes: parsedHours.weekday.close24h,
                        },
                    ]
                  : []),
              ...(parsedHours.saturday
                  ? [
                        {
                            "@type": "OpeningHoursSpecification",
                            dayOfWeek: ["Saturday"],
                            opens: parsedHours.saturday.open24h,
                            closes: parsedHours.saturday.close24h,
                        },
                    ]
                  : []),
              ...(parsedHours.sunday
                  ? [
                        {
                            "@type": "OpeningHoursSpecification",
                            dayOfWeek: ["Sunday"],
                            opens: parsedHours.sunday.open24h,
                            closes: parsedHours.sunday.close24h,
                        },
                    ]
                  : []),
          ];

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "PostOffice",
        name: office.name,
        address: {
            "@type": "PostalAddress",
            ...(normalizedCode ? { postalCode: normalizedCode } : {}),
            ...(division ? { addressRegion: division } : {}),
            addressCountry: "LK",
        },
        url: officeUrl,
        ...(primaryTelephone ? { telephone: primaryTelephone } : {}),
        ...(firstImage ? { image: firstImage } : {}),
        ...(office.latitude && office.longitude
            ? {
                  geo: {
                      "@type": "GeoCoordinates",
                      latitude: office.latitude,
                      longitude: office.longitude,
                  },
              }
            : {}),
        openingHoursSpecification,
        ...(avgRating !== undefined && totalApprovedReviews > 0
            ? {
                  aggregateRating: {
                      "@type": "AggregateRating",
                      ratingValue: avgRating.toFixed(1),
                      reviewCount: totalApprovedReviews,
                  },
              }
            : {}),
    };

    const breadcrumbLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            {
                "@type": "ListItem",
                position: 1,
                name: "Home",
                item: buildLocalizedUrl("/", locale),
            },
            {
                "@type": "ListItem",
                position: 2,
                name: "Browse Post Offices",
                item: buildLocalizedUrl("/browse", locale),
            },
            ...(division && divisionSlug
                ? [
                      {
                          "@type": "ListItem",
                          position: 3,
                          name: division,
                          item: buildLocalizedUrl(`/district/${divisionSlug}`, locale),
                      },
                  ]
                : []),
            {
                "@type": "ListItem",
                position: division && divisionSlug ? 4 : 3,
                name: office.name,
                item: officeUrl,
            },
        ],
    };

    const coreHandledFields = new Set([
        "Is24Hour",
        "Type",
        "Grade",
        "Short Code",
        "Delivery",
        "Working Hours",
        "Phone",
        "Telephone",
        "Fax",
        "Division",
        "DPMG",
    ]);
    const extraFields = office.fields.filter((f) => !coreHandledFields.has(f.name));

    const seoContent = buildOfficeSeoContent(
        {
            name: office.name,
            postalCode: normalizedCode,
            type,
            grade: grade || undefined,
            shortCode: shortCode || undefined,
            division: division || undefined,
            dpmg: dpmg || undefined,
            rmsc: effectiveRmsc || undefined,
            phoneNumbers,
            fax: fax || undefined,
            hoursSummary,
            is24Hour,
            weekdayHours: parsedHours.weekday?.label,
            saturdayHours: parsedHours.saturday?.label,
            sundayHours: parsedHours.sunday?.label,
            isDeliveryOffice,
            isNonDeliveryOffice,
            controllingOffice: controllingOffice
                ? {
                      name: controllingOffice.name,
                      postalCode: controllingOffice.postalCode,
                      phone: controllingOffice.phone || undefined,
                  }
                : null,
            controlledCount: controlledOffices.length,
        },
        locale
    );

    const relatedDivisionOffices = selectRelatedDivisionOffices(
        office.slug,
        divisionSiblings,
        8
    );

    return (
        <article className="container mx-auto max-w-3xl px-4 py-4 md:py-10">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbLd) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: safeJsonLd(seoContent.faqJsonLd) }}
            />

            <div className="hidden md:block mb-4">
                <BackButton />
            </div>

            {/* Stamp-edged Hero Panel */}
            <div className="stamp-edge bg-foreground dark:bg-[hsl(var(--frame))] p-[2px]">
                <div className="stamp-edge bg-card">
                    <div className="bg-secondary/25 dark:bg-secondary/10 px-4 py-5 sm:px-6 sm:py-6 md:px-8 md:py-8">
                        <div className="flex items-start justify-between gap-3 sm:gap-4">
                            <div className="min-w-0 flex-1">
                                <h1 className="display text-[1.85rem] leading-[1.08] sm:text-4xl md:text-6xl [overflow-wrap:break-word] hyphens-none">
                                    {office.name}
                                </h1>
                                <p className="mt-2 text-sm sm:text-base md:text-lg font-medium text-foreground/80">
                                    <span>
                                        {type}
                                        {grade ? ` · ${grade}` : ""}
                                    </span>
                                    {division && divisionSlug && (
                                        <>
                                            {" · "}
                                            <Link
                                                href={`/district/${divisionSlug}`}
                                                className="underline decoration-foreground/30 underline-offset-4 hover:text-primary hover:decoration-primary"
                                            >
                                                {division}
                                            </Link>
                                        </>
                                    )}
                                </p>

                                {/* Operational Quick Badges: Delivery + Short Code */}
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    {isDeliveryOffice && (
                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-700/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                            {t("deliveryOffice")}
                                        </span>
                                    )}
                                    {isNonDeliveryOffice && (
                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-700/40 bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-900 dark:text-amber-300">
                                            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                            {t("nonDeliveryOffice")}
                                        </span>
                                    )}
                                    {shortCode && (
                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/40 bg-card px-2.5 py-1 font-mono text-xs font-bold">
                                            <span>{t("shortCodeLabel")}: {shortCode}</span>
                                            <CopyButton text={shortCode} />
                                        </span>
                                    )}
                                </div>
                            </div>
                            {normalizedCode && (
                                <>
                                    <Postmark
                                        code={normalizedCode}
                                        size="sm"
                                        tone="red"
                                        rotate={-8}
                                        label={(division || "SRI LANKA").toUpperCase()}
                                        className="sm:hidden shrink-0"
                                    />
                                    <Postmark
                                        code={normalizedCode}
                                        size="md"
                                        tone="red"
                                        waves
                                        rotate={-10}
                                        label={(division || "SRI LANKA").toUpperCase()}
                                        className="hidden sm:inline-flex -mr-2 shrink-0"
                                    />
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Status Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-foreground py-3 px-1">
                <StatusDot status={currentStatus.status} label={statusLabel} variant="strip" />
                <span className="font-mono text-xs text-muted-foreground">{hoursSummary}</span>
            </div>

            {/* Action Row */}
            <OfficeActions
                name={office.name}
                postalCode={normalizedCode}
                phone={primaryTelephone}
                latitude={office.latitude}
                longitude={office.longitude}
            />

            {/* Structured Operational Details Definition List */}
            <section className="pt-6">
                <h2 className="sr-only">{t("details")}</h2>
                <dl className="divide-y divide-border border-b-2 border-foreground">
                    <div className="flex items-center justify-between gap-4 py-3.5">
                        <dt className="label-mono">{t("postalCode")}</dt>
                        <dd className="flex items-center gap-2 font-mono text-base font-semibold">
                            <span>{normalizedCode || "—"}</span>
                            {normalizedCode && <CopyButton text={normalizedCode} />}
                        </dd>
                    </div>

                    <div className="flex items-center justify-between gap-4 py-3.5">
                        <dt className="label-mono">{t("shortCodeLabel")}</dt>
                        <dd className="flex items-center gap-2 font-mono text-sm font-semibold">
                            <span>{shortCode || "—"}</span>
                            {shortCode && <CopyButton text={shortCode} />}
                        </dd>
                    </div>

                    <div className="flex items-center justify-between gap-4 py-3.5">
                        <dt className="label-mono">{t("deliveryLabel")}</dt>
                        <dd className="text-right font-medium text-sm">
                            {isDeliveryOffice
                                ? t("deliveryYesDetail")
                                : isNonDeliveryOffice
                                  ? t("deliveryNoDetail")
                                  : "—"}
                        </dd>
                    </div>

                    <div className="flex items-center justify-between gap-4 py-3.5">
                        <dt className="label-mono">{t("typeAndGrade")}</dt>
                        <dd className="text-right font-medium text-sm">
                            {type}
                            {grade ? ` · ${grade}` : ""}
                        </dd>
                    </div>

                    <div className="flex items-start justify-between gap-4 py-3.5">
                        <dt className="label-mono pt-0.5 shrink-0">{t("workingHours")}</dt>
                        <dd className="text-right text-sm font-medium space-y-0.5">
                            {parsedHours.is24Hour ? (
                                <p className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                                    {hoursSummary}
                                </p>
                            ) : (
                                <>
                                    {parsedHours.weekday && (
                                        <p>
                                            <span className="text-muted-foreground">{t("weekdays")}:</span>{" "}
                                            <span className="font-mono">{parsedHours.weekday.label}</span>
                                        </p>
                                    )}
                                    {parsedHours.saturday && (
                                        <p>
                                            <span className="text-muted-foreground">{t("saturday")}:</span>{" "}
                                            <span className="font-mono">{parsedHours.saturday.label}</span>
                                        </p>
                                    )}
                                    <p>
                                        <span className="text-muted-foreground">{t("sunday")}:</span>{" "}
                                        <span className="font-mono">
                                            {parsedHours.sunday ? parsedHours.sunday.label : t("closedLabel")}
                                        </span>
                                    </p>
                                </>
                            )}
                        </dd>
                    </div>

                    <div className="flex items-start justify-between gap-4 py-3.5">
                        <dt className="label-mono pt-0.5 shrink-0">{t("telephoneLabel")}</dt>
                        <dd className="text-right font-mono text-sm font-medium space-y-1">
                            {phoneNumbers.length > 0 ? (
                                phoneNumbers.map((num) => (
                                    <div key={num} className="flex items-center justify-end gap-2">
                                        <a
                                            href={`tel:${num.replace(/[^0-9+]/g, "")}`}
                                            className="inline-flex items-center gap-1.5 hover:text-primary underline decoration-foreground/25 underline-offset-4"
                                        >
                                            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                                            <span>{num}</span>
                                        </a>
                                        <CopyButton text={num} />
                                    </div>
                                ))
                            ) : (
                                <span className="text-muted-foreground">—</span>
                            )}
                        </dd>
                    </div>

                    {fax && (
                        <div className="flex items-center justify-between gap-4 py-3.5">
                            <dt className="label-mono shrink-0">Fax</dt>
                            <dd className="flex items-center gap-2 font-mono text-sm font-medium">
                                <span>{fax}</span>
                                <CopyButton text={fax} />
                            </dd>
                        </div>
                    )}

                    {division && (
                        <div className="flex items-center justify-between gap-4 py-3.5">
                            <dt className="label-mono shrink-0">{t("divisionLabel")}</dt>
                            <dd className="text-right font-medium text-sm">
                                {divisionSlug ? (
                                    <Link
                                        href={`/district/${divisionSlug}`}
                                        className="underline decoration-foreground/30 underline-offset-4 hover:text-primary"
                                    >
                                        {division}
                                    </Link>
                                ) : (
                                    division
                                )}
                                {dpmg ? ` · ${dpmg} Province` : ""}
                            </dd>
                        </div>
                    )}

                    <div className="flex items-center justify-between gap-4 py-3.5">
                        <dt className="label-mono">{t("rmsc")}</dt>
                        <dd className="text-right">
                            <RmscHubLabel rmsc={effectiveRmsc} variant="detail" />
                        </dd>
                    </div>

                    {office.latitude !== null && office.longitude !== null && (
                        <div className="flex items-center justify-between gap-4 py-3.5">
                            <dt className="label-mono shrink-0">{t("coordinatesLabel")}</dt>
                            <dd className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                                <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>
                                    {office.latitude.toFixed(5)}, {office.longitude.toFixed(5)}
                                </span>
                            </dd>
                        </div>
                    )}

                    {extraFields.map((field) => (
                        <div key={field.id} className="flex items-center justify-between gap-4 py-3.5">
                            <dt className="label-mono shrink-0">{field.name}</dt>
                            <dd className="text-right font-medium text-sm break-words min-w-0">
                                {field.value}
                            </dd>
                        </div>
                    ))}
                </dl>
            </section>

            {/* Postal Network & Mail Forwarding Section */}
            <section className="border-b-2 border-foreground py-8 space-y-5">
                <StaffNetworkPanel
                    office={{
                        id: office.id,
                        slug: office.slug,
                        name: office.name,
                        postalCode: normalizedCode,
                        shortCode: shortCode || undefined,
                        division: division || undefined,
                        type,
                        rmsc: effectiveRmsc,
                        controllingOfficeId: office.controllingOfficeId ?? controllingOffice?.id ?? null,
                        delivery: isDeliveryOffice ? "Yes" : isNonDeliveryOffice ? "No" : undefined,
                    }}
                />

                {/* Visual Inbound Mail Routing Chain */}
                <div className="rounded-lg border-2 border-foreground/30 bg-secondary/15 p-4">
                    <p className="label-mono mb-2.5">{t("inboundChainLabel")}</p>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm font-medium">
                        {!effectiveRmsc.toLowerCase().includes("colombo cme") && (
                            <>
                                <span className="rounded border border-foreground/30 bg-card px-2 py-1 font-mono text-xs">
                                    Colombo CME (01000)
                                </span>
                                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                            </>
                        )}
                        <RmscHubLabel rmsc={effectiveRmsc} variant="chain" />
                        {controllingOffice && (
                            <>
                                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                                <Link
                                    href={`/office/${controllingOffice.slug}`}
                                    className="rounded border border-foreground/40 bg-card px-2 py-1 font-semibold hover:border-primary"
                                >
                                    {controllingOffice.name}
                                    {controllingOffice.shortCode ? ` [${controllingOffice.shortCode}]` : ""}
                                </Link>
                            </>
                        )}
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                        <span className="rounded border-2 border-foreground bg-card px-2 py-1 font-bold">
                            {office.name}
                            {normalizedCode ? ` (${normalizedCode})` : ""}
                        </span>
                    </div>
                </div>

                {/* Non-Delivery Forwarding Notice */}
                {isNonDeliveryOffice && (
                    <div className="flex items-start gap-3 rounded-lg border-2 border-amber-700/40 bg-amber-500/10 p-3.5 text-sm">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300 mt-0.5" aria-hidden="true" />
                        <div>
                            <p className="font-bold text-amber-950 dark:text-amber-200">{t("nonDeliveryNoticeTitle")}</p>
                            <p className="text-muted-foreground mt-0.5">
                                {controllingOffice
                                    ? t("nonDeliveryNoticeWithParent", { parent: controllingOffice.name })
                                    : t("nonDeliveryNoticeGeneric")}
                            </p>
                        </div>
                    </div>
                )}

                {controllingOffice && (
                    <div>
                        <h3 className="label-mono mb-2">{t("controlledBy")}</h3>
                        <Link
                            href={`/office/${controllingOffice.slug}`}
                            className="tap flex items-center justify-between gap-4 rounded-md border-2 border-foreground bg-card px-4 py-3 hover:bg-muted"
                        >
                            <span className="flex items-center gap-3 min-w-0">
                                <Building2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                                <span className="min-w-0">
                                    <span className="block font-semibold truncate">{controllingOffice.name}</span>
                                    {controllingOffice.phone && (
                                        <span className="block font-mono text-xs text-muted-foreground">
                                            {controllingOffice.phone}
                                        </span>
                                    )}
                                </span>
                            </span>
                            <span className="flex items-center gap-2 shrink-0">
                                {controllingOffice.shortCode && (
                                    <span className="rounded border border-foreground/30 bg-muted px-2 py-0.5 font-mono text-xs font-bold">
                                        {controllingOffice.shortCode}
                                    </span>
                                )}
                                {controllingOffice.postalCode && (
                                    <span className="font-mono text-sm font-semibold text-muted-foreground">
                                        {controllingOffice.postalCode}
                                    </span>
                                )}
                            </span>
                        </Link>
                    </div>
                )}

                {controlledOffices.length > 0 && (
                    <ControlledOfficesList offices={controlledOffices} />
                )}
            </section>

            {/* Contextual Overview & FAQs (adds unique informational value and structured FAQ answers) */}
            <section className="border-b-2 border-foreground py-8 space-y-5">
                <div className="space-y-2">
                    <h2 className="font-heading text-xl font-extrabold [font-stretch:82%]">
                        {seoContent.overviewHeading}
                    </h2>
                    <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                        {seoContent.overviewParagraph}
                    </p>
                </div>

                <div className="rounded-lg border-2 border-foreground/25 bg-card p-4 sm:p-5 space-y-3">
                    <h3 className="label-mono">{seoContent.faqHeading}</h3>
                    <dl className="divide-y divide-border">
                        {seoContent.faqs.map((faq) => (
                            <div key={faq.question} className="py-3 first:pt-0 last:pb-0">
                                <dt className="font-bold text-sm sm:text-base text-foreground mb-1">
                                    {faq.question}
                                </dt>
                                <dd className="text-sm text-muted-foreground leading-relaxed">
                                    {faq.answer}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </section>

            {/* Community Photos Section */}
            <section className="border-b-2 border-foreground py-8 space-y-6">
                <div>
                    <h2 className="font-heading text-xl font-extrabold [font-stretch:82%]">{t("photos")}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{t("photosLede")}</p>
                </div>

                <PhotoGallery
                    photos={office.photos.map((p) => ({ ...p, caption: p.caption ?? undefined }))}
                    officeName={office.name}
                />

                <div>
                    <h3 className="label-mono mb-3">{t("addPhoto")}</h3>
                    <PhotoUploadClient officeId={office.id} />
                </div>
            </section>

            {/* Reviews Section */}
            <section className="border-b-2 border-foreground py-8">
                <ReviewSection
                    reviews={office.reviews.map((r) => ({
                        ...r,
                        createdAt: r.createdAt.toISOString(),
                    }))}
                    officeId={office.id}
                />
            </section>

            {/* Internal Crawl Mesh: Nearby / Same Division Post Offices & Postal Tools */}
            {relatedDivisionOffices.length > 0 && division && divisionSlug && (
                <section className="border-b-2 border-foreground py-8 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="font-heading text-xl font-extrabold [font-stretch:82%]">
                            Other Post Offices in {division}
                        </h2>
                        <Link
                            href={`/district/${divisionSlug}`}
                            className="text-xs sm:text-sm font-semibold text-primary hover:underline shrink-0"
                        >
                            View all &rarr;
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {relatedDivisionOffices.map((sibling) => (
                            <Link
                                key={sibling.slug}
                                href={`/office/${sibling.slug}`}
                                className="tap flex items-center justify-between gap-3 rounded-md border border-foreground/30 bg-card px-3.5 py-2.5 text-sm hover:border-foreground hover:bg-secondary/20 transition-colors"
                            >
                                <span className="font-semibold truncate">{sibling.name}</span>
                                <span className="font-mono text-xs font-bold text-primary shrink-0">
                                    {sibling.postalCode || sibling.type || "PO"}
                                </span>
                            </Link>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                        <Link
                            href="/calculator"
                            className="tap rounded-full border border-foreground/40 bg-background px-3 py-1.5 text-xs font-semibold hover:border-foreground hover:bg-secondary/30"
                        >
                            2026 Postage Calculator
                        </Link>
                        <Link
                            href="/track"
                            className="tap rounded-full border border-foreground/40 bg-background px-3 py-1.5 text-xs font-semibold hover:border-foreground hover:bg-secondary/30"
                        >
                            Track SL Post Parcel
                        </Link>
                        <Link
                            href="/rates"
                            className="tap rounded-full border border-foreground/40 bg-background px-3 py-1.5 text-xs font-semibold hover:border-foreground hover:bg-secondary/30"
                        >
                            International &amp; Local Rates
                        </Link>
                    </div>
                </section>
            )}

            {/* Suggest an Edit */}
            <section className="pt-8 pb-4">
                <div className="rounded-md border-2 border-foreground bg-card overflow-hidden">
                    <div className="airmail-stripe h-1.5" aria-hidden="true" />
                    <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h3 className="font-heading text-lg font-extrabold [font-stretch:82%] flex items-center gap-2">
                                <PenLine className="w-4 h-4 text-primary" aria-hidden="true" />
                                {t("workHere")}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-0.5">{t("workHereBody")}</p>
                        </div>
                        <Button asChild size="lg" className="w-full sm:w-auto shrink-0">
                            <Link href={`/suggest/${office.id}`} rel="nofollow">{t("suggestEdit")}</Link>
                        </Button>
                    </div>
                </div>
            </section>
        </article>
    );
}
