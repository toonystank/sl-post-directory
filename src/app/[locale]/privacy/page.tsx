import type { Metadata } from "next";
import { Link } from "@/navigation";

export const metadata: Metadata = {
    title: "Privacy Policy",
    description:
        "Privacy Policy for Lanka Post Directory, including information about contributor submissions, analytics, cookies, and Google AdSense.",
    alternates: {
        canonical: "https://lankapost.vercel.app/privacy",
    },
};

export default function PrivacyPolicyPage() {
    return (
        <div className="container mx-auto max-w-3xl px-4 py-6 md:py-12 min-h-[calc(100vh-4rem)]">
            <header className="mb-8 border-b-2 border-foreground pb-6">
                <p className="label-mono mb-2">Legal &amp; Disclosures</p>
                <h1 className="display text-3xl md:text-5xl">Privacy Policy</h1>
                <p className="mt-3 font-mono text-xs text-muted-foreground">
                    Last updated: November 2026
                </p>
            </header>

            <div className="space-y-8 text-base leading-relaxed text-foreground/90">
                <section className="space-y-3">
                    <h2 className="font-heading text-xl font-extrabold [font-stretch:82%] text-foreground">
                        1. Overview &amp; Independent Disclaimer
                    </h2>
                    <p className="text-muted-foreground">
                        Lanka Post Directory is an independent, community-maintained directory of post offices, postal codes, and postage rates across Sri Lanka. It is not affiliated with, operated by, or endorsed by the Department of Posts (Sri Lanka Post).
                    </p>
                    <p className="text-muted-foreground">
                        You can browse the directory, look up postal codes, read postal guides, and use the postage calculator without creating an account or providing personal information.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="font-heading text-xl font-extrabold [font-stretch:82%] text-foreground">
                        2. Information We Collect
                    </h2>
                    <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                        <li>
                            <strong className="text-foreground">Optional Contributor Accounts:</strong> If you choose to register as a contributor, we store your name, email address, hashed password, and optional two-factor authentication settings solely to authenticate your account and attribute community contributions.
                        </li>
                        <li>
                            <strong className="text-foreground">Community Submissions:</strong> Suggested edits to post office details, user reviews, and community-uploaded photos are stored for moderation and public display on the relevant post office listing.
                        </li>
                        <li>
                            <strong className="text-foreground">Server &amp; Security Logs:</strong> Standard technical request metadata (such as IP address, browser user-agent, and timestamps) may be processed temporarily by our hosting infrastructure and rate-limiting systems to prevent spam and abuse.
                        </li>
                    </ul>
                </section>

                <section className="space-y-3">
                    <h2 className="font-heading text-xl font-extrabold [font-stretch:82%] text-foreground">
                        3. Cookies &amp; Google AdSense
                    </h2>
                    <p className="text-muted-foreground">
                        We use Google AdSense to help support the hosting and maintenance of this free directory. Third-party vendors, including Google, use cookies to serve ads based on a user&apos;s prior visits to this website or other websites.
                    </p>
                    <p className="text-muted-foreground">
                        Google&apos;s use of advertising cookies enables it and its partners to serve ads to you based on your visit to Lanka Post Directory and/or other sites on the Internet.
                    </p>
                    <p className="text-muted-foreground">
                        You may opt out of personalized advertising by visiting{" "}
                        <a
                            href="https://www.google.com/settings/ads"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary font-medium underline underline-offset-4 hover:text-primary/80"
                        >
                            Google Ads Settings
                        </a>
                        . Alternatively, you can opt out of a third-party vendor&apos;s use of cookies for personalized advertising by visiting{" "}
                        <a
                            href="https://www.aboutads.info"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary font-medium underline underline-offset-4 hover:text-primary/80"
                        >
                            www.aboutads.info
                        </a>
                        .
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="font-heading text-xl font-extrabold [font-stretch:82%] text-foreground">
                        4. Analytics
                    </h2>
                    <p className="text-muted-foreground">
                        We use Google Analytics to collect aggregated usage insights (such as page views, search interactions, and general device/browser statistics) so we can understand which directory features and postal guides are most helpful and improve site reliability.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="font-heading text-xl font-extrabold [font-stretch:82%] text-foreground">
                        5. Contact &amp; Data Requests
                    </h2>
                    <p className="text-muted-foreground">
                        If you have questions about this Privacy Policy, or would like to request correction or deletion of your contributor account or submitted content, please open an issue on our{" "}
                        <a
                            href="https://github.com/toonystank/sl-post-directory/issues"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary font-medium underline underline-offset-4 hover:text-primary/80"
                        >
                            GitHub repository
                        </a>
                        .
                    </p>
                </section>

                <div className="pt-4 border-t border-border">
                    <Link
                        href="/"
                        className="text-sm font-semibold text-primary underline underline-offset-4 hover:text-primary/80"
                    >
                        &larr; Back to Directory
                    </Link>
                </div>
            </div>
        </div>
    );
}
