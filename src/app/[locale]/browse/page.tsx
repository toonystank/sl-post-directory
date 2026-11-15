import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { Link } from "@/navigation";
import { ALPHABET, SERVICE_TAGS, POPULAR_SEARCHES } from "@/components/directory/types";

export const metadata: Metadata = {
    title: "Browse Post Offices A–Z",
    description: "Browse Sri Lanka post offices alphabetically, by postal service, or by popular town.",
};

export default async function BrowsePage() {
    const t = await getTranslations("Browse");

    const getServiceLabel = (tag: string) => {
        const key = tag.toLowerCase();
        if (key.startsWith("foreign")) return t("serviceForeign");
        if (key.startsWith("postal complex")) return t("serviceComplex");
        if (key.startsWith("regional")) return t("serviceSorting");
        return tag;
    };

    return (
        <div className="container mx-auto max-w-4xl px-4 py-6 md:py-10 space-y-8">
            <header>
                <h1 className="display text-3xl md:text-5xl">{t("title")}</h1>
                <p className="mt-2 text-muted-foreground">{t("lede")}</p>
            </header>

            <section>
                <h2 className="label-mono mb-3">{t("byLetter")}</h2>
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                    {ALPHABET.map((letter) => (
                        <Link
                            key={letter}
                            href={`/?letter=${letter}`}
                            className="tap flex h-11 sm:h-12 items-center justify-center rounded-[5px] border-[1.5px] border-foreground bg-card font-mono text-base font-semibold shadow-[0_2px_0_0_hsl(var(--foreground))] hover:bg-secondary/40"
                        >
                            {letter}
                        </Link>
                    ))}
                </div>
            </section>

            <section>
                <h2 className="label-mono mb-3">{t("byService")}</h2>
                <ul className="divide-y divide-border rounded-md border-2 border-foreground bg-card overflow-hidden">
                    {SERVICE_TAGS.map((tag) => (
                        <li key={tag}>
                            <Link
                                href={`/?service=${encodeURIComponent(tag)}`}
                                className="tap flex items-center justify-between px-4 py-3.5 font-semibold hover:bg-muted"
                            >
                                <span>{getServiceLabel(tag)}</span>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            </Link>
                        </li>
                    ))}
                </ul>
            </section>

            <section>
                <h2 className="label-mono mb-3">{t("popular")}</h2>
                <div className="flex flex-wrap gap-2">
                    {POPULAR_SEARCHES.map((town) => (
                        <Link
                            key={town}
                            href={`/?q=${encodeURIComponent(town)}`}
                            className="tap rounded-full border-[1.5px] border-foreground bg-card px-4 py-2 text-sm font-semibold hover:bg-secondary/40"
                        >
                            {town}
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
}
