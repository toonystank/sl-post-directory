import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/navigation";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { getLocalDivisionNames, loadLocalOffices } from "@/lib/local-sqlite";
import { safeJsonLd } from "@/lib/security";
import {
    buildEnglishCanonicalAlternates,
    buildLocalizedUrl,
    formatSriLankaPhone,
    getDefaultOpenGraphImages,
    getOgLocale,
    normalizePostalCode,
    slugifyDivision,
} from "@/lib/site";
import { ArrowRight, MapPin } from "lucide-react";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams({
    params: { locale },
}: {
    params: { locale: string };
}) {
    // Pre-render all canonical English division hub pages at build time;
    // localized views render on demand via ISR while canonicalizing to English.
    if (locale !== "en") return [];
    const seen = new Set<string>();
    const result: { division: string }[] = [];
    for (const name of getLocalDivisionNames()) {
        const slug = slugifyDivision(name);
        if (slug && !seen.has(slug)) {
            seen.add(slug);
            result.push({ division: slug });
        }
    }
    return result;
}

interface DivisionOfficeRow {
    id: string;
    slug: string;
    name: string;
    postalCode: string;
    type: string;
    phone: string;
}

interface DivisionDirectoryData {
    divisionName: string;
    offices: DivisionOfficeRow[];
    otherDivisions: { name: string; slug: string }[];
}

function buildOtherDivisions(
    allNames: string[],
    currentSlug: string
): { name: string; slug: string }[] {
    const seen = new Set<string>([currentSlug]);
    const list: { name: string; slug: string }[] = [];
    for (const raw of allNames) {
        const name = raw.trim();
        const slug = slugifyDivision(name);
        if (!name || !slug || seen.has(slug)) continue;
        seen.add(slug);
        list.push({ name, slug });
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
}

const getDivisionData = cache(async function getDivisionData(
    divisionSlug: string
): Promise<DivisionDirectoryData | null> {
    const cleanSlug = decodeURIComponent(divisionSlug).trim().toLowerCase();
    if (!cleanSlug) return null;

    if (hasDatabaseUrl) {
        try {
            const distinctDivisions = await prisma.postOfficeField.findMany({
                where: { name: "Division" },
                distinct: ["value"],
                select: { value: true },
            });
            const allDivisionNames = distinctDivisions.map((d) => d.value).filter(Boolean);
            const matched = distinctDivisions.find(
                (d) => slugifyDivision(d.value) === cleanSlug
            );
            if (matched) {
                const records = await prisma.postOffice.findMany({
                    where: {
                        fields: {
                            some: {
                                name: "Division",
                                value: { equals: matched.value, mode: "insensitive" },
                            },
                        },
                    },
                    orderBy: { name: "asc" },
                    select: {
                        id: true,
                        slug: true,
                        name: true,
                        postalCode: true,
                        fields: {
                            where: { name: { in: ["Type", "Phone", "Telephone"] } },
                            select: { name: true, value: true },
                        },
                    },
                });
                return {
                    divisionName: matched.value,
                    offices: records.map((r) => ({
                        id: r.id,
                        slug: r.slug,
                        name: r.name,
                        postalCode: normalizePostalCode(r.postalCode),
                        type: r.fields.find((f) => f.name === "Type")?.value || "Post Office",
                        phone: formatSriLankaPhone(
                            r.fields.find((f) => f.name === "Phone" || f.name === "Telephone")?.value
                        ),
                    })),
                    otherDivisions: buildOtherDivisions(allDivisionNames, cleanSlug),
                };
            }
        } catch {
            // Fall through to local dataset
        }
    }

    const local = loadLocalOffices();
    const matchedLocal = local.filter((o) => {
        const div = o.fields.find((f) => f.name === "Division")?.value;
        return div && slugifyDivision(div) === cleanSlug;
    });
    if (matchedLocal.length === 0) return null;
    const divisionName =
        matchedLocal[0].fields.find((f) => f.name === "Division")?.value || cleanSlug;

    return {
        divisionName,
        offices: matchedLocal
            .map((o) => ({
                id: o.id,
                slug: o.slug,
                name: o.name,
                postalCode: normalizePostalCode(o.postalCode),
                type: o.fields.find((f) => f.name === "Type")?.value || "Post Office",
                phone: formatSriLankaPhone(
                    o.fields.find((f) => f.name === "Phone" || f.name === "Telephone")?.value
                ),
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        otherDivisions: buildOtherDivisions(getLocalDivisionNames(), cleanSlug),
    };
});

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string; division: string }>;
}): Promise<Metadata> {
    const { division } = await params;
    const data = await getDivisionData(division);
    if (!data) {
        return { title: "District Post Offices Not Found" };
    }

    const slug = slugifyDivision(data.divisionName);
    const coded = data.offices.map((o) => o.postalCode).filter(Boolean).sort();
    const rangeHint =
        coded.length >= 2 && coded[0] !== coded[coded.length - 1]
            ? ` (Codes ${coded[0]}–${coded[coded.length - 1]})`
            : "";
    const title = `${data.divisionName} Post Offices & Postal Codes (${data.offices.length} Offices)`;
    const description = `Complete directory of ${data.offices.length} Sri Lanka post offices and 5-digit postal codes in ${data.divisionName}${rangeHint}, with telephone numbers, office types, and opening hours.`;
    const canonicalUrl = buildLocalizedUrl(`/district/${slug}`, "en");

    return {
        title,
        description,
        alternates: buildEnglishCanonicalAlternates(`/district/${slug}`),
        openGraph: {
            title,
            description,
            url: canonicalUrl,
            locale: getOgLocale("en"),
            images: getDefaultOpenGraphImages(title),
        },
    };
}

export default async function DistrictOfficesPage({
    params,
}: {
    params: Promise<{ locale: string; division: string }>;
}) {
    const { locale, division } = await params;
    setRequestLocale(locale);
    const data = await getDivisionData(division);

    if (!data || data.offices.length === 0) {
        notFound();
    }

    const slug = slugifyDivision(data.divisionName);
    const canonicalUrl = buildLocalizedUrl(`/district/${slug}`, "en");
    const mainOfficesCount = data.offices.filter((o) => !/sub post/i.test(o.type)).length;
    const subOfficesCount = data.offices.length - mainOfficesCount;
    const sortedCodes = data.offices.map((o) => o.postalCode).filter(Boolean).sort();
    const codeRange =
        sortedCodes.length >= 2 && sortedCodes[0] !== sortedCodes[sortedCodes.length - 1]
            ? `${sortedCodes[0]} – ${sortedCodes[sortedCodes.length - 1]}`
            : sortedCodes[0] || null;

    const breadcrumbJsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: buildLocalizedUrl("/", "en") },
            { "@type": "ListItem", position: 2, name: "Browse Directory", item: buildLocalizedUrl("/browse", "en") },
            { "@type": "ListItem", position: 3, name: data.divisionName, item: canonicalUrl },
        ],
    };

    const collectionJsonLd = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `${data.divisionName} Post Offices & Postal Codes`,
        url: canonicalUrl,
        description: `Directory of ${data.offices.length} post offices in ${data.divisionName}, Sri Lanka.`,
        mainEntity: {
            "@type": "ItemList",
            numberOfItems: data.offices.length,
            itemListElement: data.offices.slice(0, 50).map((office, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: office.postalCode ? `${office.name} (${office.postalCode})` : office.name,
                url: buildLocalizedUrl(`/office/${office.slug}`, "en"),
            })),
        },
    };

    return (
        <article className="container mx-auto max-w-5xl px-4 py-5 md:py-10 space-y-6">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: safeJsonLd(collectionJsonLd) }}
            />

            <header className="rounded-xl border-2 border-foreground bg-card p-5 sm:p-7 shadow-[4px_4px_0_0_hsl(var(--foreground))]">
                <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-primary mb-2">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    Postal Division Directory · Sri Lanka
                </div>
                <h1 className="display text-3xl sm:text-5xl">
                    {data.divisionName} Post Offices &amp; Postal Codes
                </h1>
                <p className="mt-2 text-sm sm:text-base text-muted-foreground">
                    Showing all <strong>{data.offices.length}</strong> postal locations in {data.divisionName}
                    {mainOfficesCount > 0 ? ` (${mainOfficesCount} main & hub offices, ${subOfficesCount} sub post offices)` : ""}
                    {codeRange ? ` covering postal codes ${codeRange}` : ""}.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                        href={`/browse?division=${encodeURIComponent(data.divisionName)}`}
                        className="tap inline-flex items-center gap-1.5 rounded-lg border-2 border-foreground bg-secondary/40 px-3.5 py-2 text-xs sm:text-sm font-bold hover:bg-secondary/70"
                    >
                        Filter &amp; search {data.divisionName} interactively
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                    <Link
                        href="/calculator"
                        className="tap inline-flex items-center gap-1.5 rounded-lg border border-foreground/40 bg-background px-3.5 py-2 text-xs sm:text-sm font-semibold hover:border-foreground"
                    >
                        2026 Postage Calculator
                    </Link>
                    <Link
                        href="/track"
                        className="tap inline-flex items-center gap-1.5 rounded-lg border border-foreground/40 bg-background px-3.5 py-2 text-xs sm:text-sm font-semibold hover:border-foreground"
                    >
                        Track SL Post Parcel
                    </Link>
                </div>
            </header>

            <div className="overflow-x-auto rounded-xl border-2 border-foreground bg-card">
                <table className="w-full text-left border-collapse text-sm">
                    <thead>
                        <tr className="border-b-2 border-foreground bg-muted/60 font-mono text-xs uppercase">
                            <th className="px-3.5 py-3">Post Office</th>
                            <th className="px-3.5 py-3">Postal Code</th>
                            <th className="px-3.5 py-3 hidden sm:table-cell">Type</th>
                            <th className="px-3.5 py-3 hidden md:table-cell">Telephone</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {data.offices.map((office) => (
                            <tr key={office.id} className="hover:bg-secondary/15">
                                <td className="px-3.5 py-3 font-semibold">
                                    <Link
                                        href={`/office/${office.slug}`}
                                        className="text-foreground hover:text-primary underline-offset-4 hover:underline"
                                    >
                                        {office.name}
                                    </Link>
                                </td>
                                <td className="px-3.5 py-3 font-mono font-bold text-primary">
                                    {office.postalCode || "—"}
                                </td>
                                <td className="px-3.5 py-3 hidden sm:table-cell text-muted-foreground">
                                    {office.type}
                                </td>
                                <td className="px-3.5 py-3 hidden md:table-cell font-mono text-xs text-muted-foreground">
                                    {office.phone || "—"}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {data.otherDivisions.length > 0 && (
                <section aria-labelledby="other-divisions-heading" className="rounded-xl border-2 border-foreground/30 bg-card/60 p-5">
                    <h2 id="other-divisions-heading" className="font-heading text-lg sm:text-xl font-extrabold [font-stretch:82%] mb-3">
                        Other Sri Lanka Postal Divisions
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        {data.otherDivisions.map((div) => (
                            <Link
                                key={div.slug}
                                href={`/district/${div.slug}`}
                                className="tap rounded-full border border-foreground/40 bg-background px-3 py-1.5 text-xs font-semibold hover:border-foreground hover:bg-secondary/35 transition-colors"
                            >
                                {div.name}
                            </Link>
                        ))}
                    </div>
                </section>
            )}
        </article>
    );
}
