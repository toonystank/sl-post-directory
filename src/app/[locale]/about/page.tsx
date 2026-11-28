import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/navigation";
import { buildEnglishCanonicalAlternates, getContactEmail } from "@/lib/site";

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: "About & Contact",
        description:
            "Learn about Lanka Post Directory — an independent Sri Lanka post office finder, 2026 postage calculator, and live parcel tracker, including official data sources and contact information.",
        alternates: buildEnglishCanonicalAlternates("/about"),
    };
}

export default async function AboutPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    const contactEmail = getContactEmail();

    return (
        <div className="container mx-auto max-w-3xl px-4 py-6 md:py-12 min-h-[calc(100vh-4rem)]">
            <header className="mb-8 border-b-2 border-foreground pb-6">
                <p className="label-mono mb-2">Independent Postal Resource</p>
                <h1 className="display text-3xl md:text-5xl">About Lanka Post Directory</h1>
                <p className="mt-3 text-sm text-muted-foreground">
                    Built for Sri Lankan residents, e-commerce sellers, and travelers in English, සිංහල, and தமிழ்.
                </p>
            </header>

            <div className="space-y-8 text-base leading-relaxed text-foreground/90">
                <section className="space-y-3">
                    <h2 className="font-heading text-xl font-extrabold [font-stretch:82%] text-foreground">
                        1. What Lanka Post Directory Does
                    </h2>
                    <p className="text-muted-foreground">
                        Lanka Post Directory makes public Sri Lankan postal information fast, searchable, and mobile-friendly—even on slow or offline connections:
                    </p>
                    <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                        <li>
                            <strong className="text-foreground">4,000+ Post Offices &amp; Postal Codes:</strong> Search every main, sub, and agency post office across Sri Lanka by town, postal code, division, or Sinhala/Tamil name, complete with controlling office hierarchies and operating hours.
                        </li>
                        <li>
                            <strong className="text-foreground">2026 Postage Rate Calculator:</strong> Instant tariff calculations for domestic letters, registered post, parcels, SLP Courier, Cash on Delivery (COD) net payouts, and international Air/Sea/EMS destinations.
                        </li>
                        <li>
                            <strong className="text-foreground">Live COD &amp; SLP Courier Tracking:</strong> Track single or batch barcodes with camera barcode scanning and optional OCR receipt extraction.
                        </li>
                        <li>
                            <strong className="text-foreground">Offline-First &amp; Trilingual:</strong> Installable Progressive Web App and Android Trusted Web Activity supporting English, Sinhala, and Tamil with local directory caching.
                        </li>
                    </ul>
                </section>

                <section className="space-y-3 rounded-md border-2 border-foreground bg-card p-5">
                    <h2 className="font-heading text-xl font-extrabold [font-stretch:82%] text-foreground">
                        2. Official Non-Affiliation Disclaimer &amp; Data Sources
                    </h2>
                    <p className="text-muted-foreground">
                        Lanka Post Directory is an <strong className="text-foreground">independent, community-maintained project</strong>. It is <strong className="text-foreground">not affiliated with, operated by, sponsored by, or endorsed by the Department of Posts (Sri Lanka Post)</strong> or any Sri Lankan government agency.
                    </p>
                    <p className="text-muted-foreground">
                        Directory details, postage tariff schedules, and tracking lookups are compiled from public official references and community-moderated updates, including:
                    </p>
                    <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground">
                        <li>
                            Department of Posts, Sri Lanka —{" "}
                            <a
                                href="https://slpost.gov.lk"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary font-medium underline underline-offset-4 hover:text-primary/80"
                            >
                                slpost.gov.lk
                            </a>{" "}
                            (published domestic/foreign postage circulars and post office finder)
                        </li>
                        <li>
                            Sri Lanka Post COD &amp; Parcel Tracking Portal —{" "}
                            <a
                                href="https://bepost.lk"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary font-medium underline underline-offset-4 hover:text-primary/80"
                            >
                                bepost.lk
                            </a>{" "}
                            and{" "}
                            <a
                                href="https://slpmail.slpost.gov.lk/track/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary font-medium underline underline-offset-4 hover:text-primary/80"
                            >
                                slpmail.slpost.gov.lk/track
                            </a>
                        </li>
                    </ul>
                    <p className="text-xs text-muted-foreground">
                        Always confirm final counter charges, cut-off times, and public holiday hours directly with your local post office before dispatching time-sensitive mail.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="font-heading text-xl font-extrabold [font-stretch:82%] text-foreground">
                        3. Contact &amp; Community Contributions
                    </h2>
                    <p className="text-muted-foreground">
                        Spotted an outdated telephone number, missing sub-post office, or tariff update? Every office page includes a &ldquo;Suggest an edit&rdquo; workflow reviewed by moderators.
                    </p>
                    <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                        {contactEmail && (
                            <li>
                                <strong className="text-foreground">Email Support &amp; Corrections:</strong>{" "}
                                <a
                                    href={`mailto:${contactEmail}`}
                                    className="text-primary font-medium underline underline-offset-4 hover:text-primary/80"
                                >
                                    {contactEmail}
                                </a>
                            </li>
                        )}
                        <li>
                            <strong className="text-foreground">Bug Reports &amp; Open Source:</strong>{" "}
                            <a
                                href="https://github.com/toonystank/sl-post-directory/issues"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary font-medium underline underline-offset-4 hover:text-primary/80"
                            >
                                github.com/toonystank/sl-post-directory/issues
                            </a>
                        </li>
                        <li>
                            <strong className="text-foreground">Contributor Account:</strong>{" "}
                            <Link
                                href="/login"
                                className="text-primary font-medium underline underline-offset-4 hover:text-primary/80"
                            >
                                Sign in or register to submit directory edits
                            </Link>
                        </li>
                    </ul>
                </section>

                <div className="pt-4 border-t border-border flex flex-wrap gap-6">
                    <Link
                        href="/"
                        className="text-sm font-semibold text-primary underline underline-offset-4 hover:text-primary/80"
                    >
                        &larr; Back to Directory
                    </Link>
                    <Link
                        href="/privacy"
                        className="text-sm font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    >
                        Privacy Policy
                    </Link>
                    <Link
                        href="/terms"
                        className="text-sm font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    >
                        Terms of Use
                    </Link>
                </div>
            </div>
        </div>
    );
}
