import { Link } from "@/navigation";
import { Compass, Calculator, Home, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import Postmark from "@/components/brand/Postmark";

export default function NotFound() {
    return (
        <section className="container mx-auto max-w-2xl px-4 py-12 md:py-20">
            <div className="stamp-edge bg-foreground dark:bg-[hsl(var(--frame))] p-[2px]">
                <div className="stamp-edge bg-card">
                    <div className="airmail-stripe h-1.5" aria-hidden="true" />
                    <div className="p-6 sm:p-10 text-center">
                        <div className="flex justify-center mb-5">
                            <Postmark
                                code="404"
                                size="md"
                                tone="red"
                                rotate={-10}
                                label="RETURN TO SENDER"
                                bottomLabel="SRI LANKA POST"
                            />
                        </div>

                        <p className="font-mono text-xs font-bold uppercase tracking-widest text-primary mb-2">
                            Error 404 · Address Not Found
                        </p>
                        <h1 className="display text-3xl sm:text-5xl mb-3">
                            This mailbag is empty
                        </h1>
                        <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto mb-8 leading-relaxed">
                            The page or post office link you followed may have moved or been mistyped.
                            Jump straight back into the directory or postage calculator below.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto">
                            <Button asChild size="lg" className="h-12 gap-2">
                                <Link href="/">
                                    <Home className="h-4 w-4" aria-hidden="true" />
                                    Home
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="lg" className="h-12 gap-2 border-foreground">
                                <Link href="/browse">
                                    <Search className="h-4 w-4" aria-hidden="true" />
                                    Browse Offices
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="lg" className="h-12 gap-2 border-foreground">
                                <Link href="/calculator">
                                    <Calculator className="h-4 w-4" aria-hidden="true" />
                                    Postage Rates
                                </Link>
                            </Button>
                        </div>

                        <div className="mt-6 pt-5 border-t border-border">
                            <Link
                                href="/rates"
                                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                            >
                                <Compass className="h-4 w-4" aria-hidden="true" />
                                Explore International & Local Rate Tables &rarr;
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
