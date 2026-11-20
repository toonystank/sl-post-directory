import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/navigation";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { loadLocalOffices } from "@/lib/local-sqlite";
import {
    buildLocalizedAlternates,
    buildLocalizedUrl,
    formatSriLankaPhone,
    getDefaultOpenGraphImages,
    getOgLocale,
    normalizePostalCode,
} from "@/lib/site";
import { ArrowRight, MapPin } from "lucide-react";

export const revalidate = 86400;
export const dynamicParams = true;

function slugifyDivision(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

interface DivisionOfficeRow {
    id: string;
    slug: string;
    name: string;
    postalCode: string;
    type: string;
    phone: string;
}

async function getDivisionData(divisionSlug: string): Promise<{
    divisionName: string;
    offices: DivisionOfficeRow[];
} | null> {
    const cleanSlug = decodeURIComponent(divisionSlug).trim().toLowerCase();
    if (!cleanSlug) return null;

    if (hasDatabaseUrl) {
        try {
            const distinctDivisions = await prisma.postOfficeField.findMany({
                where: { name: "Division" },
                distinct: ["value"],
                select: { value: true },
            });
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
                };
            }
        } catch {
            // Fall through to local SQLite
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
        offices: matchedLocal.map((o) => ({
            id: o.id,
            slug: o.slug,
            name: o.name,
            postalCode: normalizePostalCode(o.postalCode),
            type: o.fields.find((f) => f.name === "Type")?.value || "Post Office",
            phone: formatSriLankaPhone(
                o.fields.find((f) => f.name === "Phone" || f.name === "Telephone")?.value
            ),
        })),
    };
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string; division: string }>;
}): Promise<Metadata> {
    const { locale, division } = await params;
    const data = await getDivisionData(division);
    if (!data) {
        return { title: "District Post Offices Not Found" };
    }

    const slug = slugifyDivision(data.divisionName);
    const title = `${data.divisionName} Post Offices & Postal Codes (${data.offices.length} Offices)`;
    const description = `Complete list of ${data.offices.length} Sri Lanka post offices and 5-digit postal codes in ${data.divisionName}, with telephone numbers and opening hours.`;

    return {
        title,
        description,
        alternates: buildLocalizedAlternates(`/district/${slug}`, locale),
        openGraph: {
            title,
            description,
            url: buildLocalizedUrl(`/district/${slug}`, locale),
            locale: getOgLocale(locale),
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
    const breadcrumbJsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: buildLocalizedUrl("/", locale) },
            { "@type": "ListItem", position: 2, name: "Browse Directory", item: buildLocalizedUrl("/browse", locale) },
            { "@type": "ListItem", position: 3, name: data.divisionName, item: buildLocalizedUrl(`/district/${slug}`, locale) },
        ],
    };

    return (
        <article className="container mx-auto max-w-5xl px-4 py-5 md:py-10 space-y-6">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
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
                    Showing all <strong>{data.offices.length}</strong> post offices and sub post offices in {data.divisionName}.
                </p>
                <div className="mt-4">
                    <Link
                        href={`/browse?division=${encodeURIComponent(data.divisionName)}`}
                        className="tap inline-flex items-center gap-1.5 rounded-lg border-2 border-foreground bg-secondary/40 px-3.5 py-2 text-xs sm:text-sm font-bold hover:bg-secondary/70"
                    >
                        Filter &amp; search {data.divisionName} interactively
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
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
        </article>
    );
}
