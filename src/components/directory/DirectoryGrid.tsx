import React from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostOffice, SearchMode } from "./types";
import PostOfficeCard from "./PostOfficeCard";

interface DirectoryGridProps {
    offices: PostOffice[];
    initialLoading: boolean;
    loading: boolean;
    hasActiveFilters: boolean;
    clearAll: () => void;
    nextCursor: number | null;
    total: number;
    query: string;
    activeLetter: string | null;
    searchMode: SearchMode;
    activeService: string | null;
    fetchOffices: (q: string, letter: string | null, mode: SearchMode, service: string | null, cursor: number, append: boolean) => void;
}

export default function DirectoryGrid({
    offices, initialLoading, loading, hasActiveFilters, clearAll,
    nextCursor, total, query, activeLetter, searchMode, activeService, fetchOffices
}: DirectoryGridProps) {
    if (initialLoading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
        );
    }

    if (offices.length === 0) {
        return (
            <div className="text-center py-16 bg-card/30 rounded-2xl border border-border/30 border-dashed">
                <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-muted-foreground opacity-50" />
                </div>
                <p className="text-lg font-medium mb-1">No post offices found</p>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
                    Try adjusting your filters or search terms. Browse the alphabet sidebar to explore all locations.
                </p>
                {hasActiveFilters && (
                    <button
                        onClick={clearAll}
                        className="px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
                    >
                        Reset Filters
                    </button>
                )}
            </div>
        );
    }

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {offices.map((po, index) => (
                    <PostOfficeCard key={po.id} office={po} index={index} />
                ))}
            </div>

            {/* Pagination Controls */}
            <div className="mt-12 flex justify-center py-4">
                {nextCursor !== null && (
                    <Button
                        onClick={() => fetchOffices(query, activeLetter, searchMode, activeService, nextCursor, true)}
                        disabled={loading}
                        variant="outline"
                        size="lg"
                        className="rounded-xl border-primary/20 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all duration-300 gap-2 min-w-[200px]"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                <span>Loading...</span>
                            </>
                        ) : (
                            "Load More Results"
                        )}
                    </Button>
                )}
                {nextCursor === null && offices.length > 0 && (
                    <p className="text-sm font-medium text-muted-foreground opacity-60">
                        End of directory — {total.toLocaleString()} locations
                    </p>
                )}
            </div>
        </>
    );
}
