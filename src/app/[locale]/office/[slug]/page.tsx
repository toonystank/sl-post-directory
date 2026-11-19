import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Building2, PenLine } from "lucide-react";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { getLocalOfficeBySlug } from "@/lib/local-sqlite";
import { getPostOfficeStatus } from "@/lib/holidays";
import {
    buildLocalizedAlternates,
    buildLocalizedUrl,
    formatSriLankaPhone,
    normalizePostalCode,
} from "@/lib/site";
import { Link } from "@/navigation";
import { CopyButton } from "@/components/CopyButton";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import Postmark from "@/components/brand/Postmark";
import StatusDot from "@/components/brand/StatusDot";
import PhotoGallery from "@/components/office/PhotoGallery";
import ReviewSection from "@/components/ReviewSection";
import { PhotoUploadClient } from "./PhotoUploadClient";
import OfficeActions from "./OfficeActions";

export const revalidate = 86400; // Cache the post office page for 24 hours

async function findOfficeWithFields(slug: string) {
    if (!hasDatabaseUrl) {
        return getLocalOfficeBySlug(slug);
    }
    try {
        return await prisma.postOffice.findUnique({
            where: { slug },
            include: { fields: true }
        });
    } catch {
        return getLocalOfficeBySlug(slug);
    }
}

async function findOfficeDetails(slug: string) {
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
                    orderBy: { createdAt: "desc" }
                },
                reviews: {
                    where: { status: "APPROVED" },
                    orderBy: { createdAt: "desc" },
                    take: 20,
                },
                controllingOffice: { select: { id: true, slug: true, name: true, postalCode: true } },
                controlledOffices: { select: { id: true, slug: true, name: true, postalCode: true } },
            }
        });
    } catch {
        return getLocalOfficeBySlug(slug);
    }
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
    const { locale, slug } = await params;

    const office = await findOfficeWithFields(slug);

    if (!office) {
        return {
            title: "Post Office Not Found",
        };
    }

    const postalCode = normalizePostalCode(office.postalCode);
    const typeField = office.fields.find((f) => f.name === "Type")?.value || "Post Office";
    const division = office.fields.find((f) => f.name === "Division")?.value;
    const codePart = postalCode ? ` - Postal Code ${postalCode}` : "";
    const title = `${office.name}${codePart}`;
    const description = `Find telephone numbers, opening hours, and directions for ${office.name} (${typeField}${division ? `, ${division}` : ""}).${postalCode ? ` Postal Code: ${postalCode}, Sri Lanka.` : " Sri Lanka Post office directory."} Check services, reviews, and photos.`;
    const canonicalUrl = buildLocalizedUrl(`/office/${office.slug}`, locale);

    return {
        title,
        description,
        alternates: buildLocalizedAlternates(`/office/${office.slug}`, locale),
        openGraph: {
            title: `${title} | Lanka Post Directory`,
            description,
            url: canonicalUrl,
        },
    };
}

export default async function OfficeDetails({ params }: { params: Promise<{ locale: string; slug: string }> }) {
    const { locale, slug } = await params;

    const office = await findOfficeDetails(slug);

    if (!office) {
        notFound();
    }

    const t = await getTranslations("Office");
    const tStatus = await getTranslations("Status");

    const normalizedCode = normalizePostalCode(office.postalCode);
    const type = office.fields.find((f) => f.name === "Type")?.value;
    const division = office.fields.find((f) => f.name === "Division")?.value;
    const divisionSlug = division
        ? division.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
        : null;
    const is24Hour = office.fields.find((f) => f.name === "Is24Hour")?.value === "true";
    const rawTelephone = office.fields.find((f) => f.name === "Telephone" || f.name === "Phone")?.value;
    const telephone = formatSriLankaPhone(rawTelephone) || undefined;
    const workingHoursField = office.fields.find((f) => f.name === "Working Hours")?.value?.trim();
    const hoursSummary = is24Hour
        ? t("open24h")
        : workingHoursField || "Mon–Fri 8:30–16:30 · Sat 9:00–13:00";

    const currentStatus = getPostOfficeStatus(locale, is24Hour);
    const statusLabel = currentStatus.status === "holiday" ? tStatus("holiday") : tStatus(currentStatus.label);

    const avgRating = office.reviews.length > 0
        ? office.reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / office.reviews.length
        : undefined;

    const firstImage = office.photos.length > 0 ? office.photos[0].url : undefined;
    const officeUrl = buildLocalizedUrl(`/office/${office.slug}`, locale);

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "PostOffice",
        "name": office.name,
        "address": {
            "@type": "PostalAddress",
            ...(normalizedCode ? { "postalCode": normalizedCode } : {}),
            ...(division ? { "addressRegion": division } : {}),
            "addressCountry": "LK"
        },
        "url": officeUrl,
        ...(telephone ? { "telephone": telephone } : {}),
        ...(firstImage ? { "image": firstImage } : {}),
        ...(office.latitude && office.longitude ? {
            "geo": {
                "@type": "GeoCoordinates",
                "latitude": office.latitude,
                "longitude": office.longitude
            }
        } : {}),
        "openingHoursSpecification": is24Hour ? [
            {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
                "opens": "00:00",
                "closes": "23:59"
            }
        ] : [
            {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                "opens": "08:30",
                "closes": "16:30"
            },
            {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": ["Saturday"],
                "opens": "09:00",
                "closes": "13:00"
            }
        ],
        ...(avgRating ? {
            "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": avgRating.toFixed(1),
                "reviewCount": office.reviews.length
            }
        } : {}),
    };

    const breadcrumbLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": buildLocalizedUrl("/", locale)
            },
            {
                "@type": "ListItem",
                "position": 2,
                "name": "Browse Post Offices",
                "item": buildLocalizedUrl("/browse", locale)
            },
            ...(division && divisionSlug ? [{
                "@type": "ListItem",
                "position": 3,
                "name": division,
                "item": buildLocalizedUrl(`/district/${divisionSlug}`, locale)
            }] : []),
            {
                "@type": "ListItem",
                "position": division && divisionSlug ? 4 : 3,
                "name": office.name,
                "item": officeUrl
            }
        ]
    };

    const detailFields = office.fields
        .filter((f) => f.name !== "Is24Hour")
        .map((f) =>
            f.name === "Phone" || f.name === "Telephone"
                ? { ...f, value: formatSriLankaPhone(f.value) }
                : f
        );
    const monoFieldNames = new Set(["Phone", "Telephone", "Short Code"]);

    return (
        <article className="container mx-auto max-w-3xl px-4 py-4 md:py-10">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
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
                                    <span>{type || t("typeDefault")}</span>
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
                <span className="font-mono text-xs text-muted-foreground">
                    {hoursSummary}
                </span>
            </div>

            {/* Action Row */}
            <OfficeActions
                name={office.name}
                postalCode={normalizedCode}
                phone={telephone}
                latitude={office.latitude}
                longitude={office.longitude}
            />

            {/* Details Definition List */}
            <section className="pt-6">
                <h2 className="sr-only">{t("details")}</h2>
                <dl className="divide-y divide-border border-b-2 border-foreground">
                    {normalizedCode && (
                        <div className="flex items-center justify-between gap-4 py-3.5">
                            <dt className="label-mono">{t("postalCode")}</dt>
                            <dd className="flex items-center gap-2 font-mono text-base font-semibold">
                                <span>{normalizedCode}</span>
                                <CopyButton text={normalizedCode} />
                            </dd>
                        </div>
                    )}

                    {office.rmsc && (
                        <div className="flex items-center justify-between gap-4 py-3.5">
                            <dt className="label-mono">{t("rmsc")}</dt>
                            <dd className="font-mono text-sm font-semibold text-primary text-right">{office.rmsc}</dd>
                        </div>
                    )}

                    {detailFields.map((field) => {
                        const isMono = monoFieldNames.has(field.name);
                        return (
                            <div key={field.id} className="flex items-center justify-between gap-4 py-3.5">
                                <dt className="label-mono shrink-0">{field.name}</dt>
                                <dd className={`flex items-center gap-2 text-right font-medium min-w-0 ${isMono ? "font-mono text-sm" : ""}`}>
                                    <span className="break-words">{field.value}</span>
                                    {isMono && <CopyButton text={field.value} />}
                                </dd>
                            </div>
                        );
                    })}
                </dl>
            </section>

            {/* Postal Network Section */}
            {(office.controllingOffice || (office.controlledOffices && office.controlledOffices.length > 0)) && (
                <section className="border-b-2 border-foreground py-8 space-y-5">
                    <div>
                        <h2 className="font-heading text-xl font-extrabold [font-stretch:82%]">{t("network")}</h2>
                        <p className="text-sm text-muted-foreground mt-1">{t("networkLede")}</p>
                    </div>

                    {office.controllingOffice && (
                        <div>
                            <h3 className="label-mono mb-2">{t("controlledBy")}</h3>
                            <Link
                                href={`/office/${office.controllingOffice.slug}`}
                                className="tap flex items-center justify-between gap-4 rounded-md border-2 border-foreground bg-card px-4 py-3 hover:bg-muted"
                            >
                                <span className="flex items-center gap-3 min-w-0">
                                    <Building2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                                    <span className="font-semibold truncate">{office.controllingOffice.name}</span>
                                </span>
                                {office.controllingOffice.postalCode && (
                                    <span className="font-mono text-sm text-muted-foreground shrink-0">
                                        {normalizePostalCode(office.controllingOffice.postalCode)}
                                    </span>
                                )}
                            </Link>
                        </div>
                    )}

                    {office.controlledOffices && office.controlledOffices.length > 0 && (
                        <div>
                            <h3 className="label-mono mb-2">{t("controls", { count: office.controlledOffices.length })}</h3>
                            <div className="divide-y divide-border rounded-md border border-foreground/30 bg-card overflow-hidden">
                                {office.controlledOffices.map((sub) => (
                                    <Link
                                        key={sub.id}
                                        href={`/office/${sub.slug}`}
                                        className="tap flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium hover:bg-muted"
                                    >
                                        <span className="truncate">{sub.name}</span>
                                        <span className="font-mono text-xs text-muted-foreground shrink-0">{normalizePostalCode(sub.postalCode)}</span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </section>
            )}

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
                            <Link href={`/suggest/${office.id}`}>
                                {t("suggestEdit")}
                            </Link>
                        </Button>
                    </div>
                </div>
            </section>
        </article>
    );
}
