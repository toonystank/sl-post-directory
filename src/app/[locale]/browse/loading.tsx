export default function BrowseLoading() {
    return (
        <section className="relative w-full" aria-busy="true" aria-label="Loading post offices directory">
            {/* Browse Directory Header Skeleton */}
            <div className="border-b-2 border-foreground bg-card/40 md:paper-grain">
                <div className="container mx-auto px-4 py-5 md:py-8">
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                        <div className="min-w-0 space-y-2">
                            <div className="h-8 sm:h-9 md:h-12 w-64 sm:w-80 max-w-full rounded-md bg-muted animate-pulse" />
                            <div className="h-4 md:h-5 w-96 max-w-full rounded-sm bg-muted animate-pulse" />
                        </div>
                        <div className="h-10 w-44 rounded-md border-[1.5px] border-foreground/30 bg-muted animate-pulse shrink-0" />
                    </div>

                    <div className="mt-4 max-w-3xl">
                        <div className="h-12 w-full rounded-xl border-2 border-foreground/30 bg-card animate-pulse" />
                    </div>
                </div>
            </div>

            {/* Body Skeleton */}
            <div className="container mx-auto px-4 py-6 md:py-10">
                <div className="flex flex-col lg:flex-row items-start gap-8">
                    {/* Sidebar Skeleton (desktop) */}
                    <aside className="hidden lg:block w-72 shrink-0 space-y-6">
                        <div className="rounded-xl border-2 border-foreground/30 bg-card p-4 space-y-3">
                            <div className="h-4 w-28 rounded-sm bg-muted animate-pulse" />
                            <div className="grid grid-cols-6 gap-1.5">
                                {Array.from({ length: 18 }).map((_, i) => (
                                    <div key={i} className="h-8 rounded-sm bg-muted animate-pulse" />
                                ))}
                            </div>
                        </div>
                        <div className="rounded-xl border-2 border-foreground/30 bg-card p-4 space-y-2.5">
                            <div className="h-4 w-32 rounded-sm bg-muted animate-pulse" />
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-8 w-full rounded-md bg-muted animate-pulse" />
                            ))}
                        </div>
                    </aside>

                    {/* Results Skeleton */}
                    <div className="flex-1 w-full min-w-0 space-y-2.5">
                        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <div className="space-y-2">
                                <div className="h-7 md:h-8 w-52 rounded-md bg-muted animate-pulse" />
                                <div className="h-3.5 w-32 rounded-sm bg-muted animate-pulse" />
                            </div>
                            <div className="h-9 w-28 rounded-md bg-muted animate-pulse" />
                        </div>

                        {Array.from({ length: 8 }).map((_, i) => (
                            <div
                                key={i}
                                className="rounded-xl border-2 border-foreground/30 bg-card px-4 py-3.5 flex items-center justify-between gap-4"
                            >
                                <div className="flex-1 min-w-0 space-y-2">
                                    <div className="h-4 w-48 max-w-full bg-muted animate-pulse rounded-sm" />
                                    <div className="h-3 w-36 bg-muted animate-pulse rounded-sm" />
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <div className="h-8 w-20 bg-muted animate-pulse rounded-md" />
                                    <div className="h-8 w-8 bg-muted animate-pulse rounded-md" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
