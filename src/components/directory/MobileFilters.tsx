import React from "react";
import { Separator } from "@/components/ui/separator";
import { ALPHABET, SERVICE_TAGS, SearchMode } from "./types";

interface MobileFiltersProps {
    isMobileExpanded: boolean;
    activeLetter: string | null;
    handleLetterFilter: (letter: string) => void;
    clearLetter: () => void;
    activeService: string | null;
    handleServiceFilter: (service: string) => void;
    clearService: () => void;
}

export default function MobileFilters({
    isMobileExpanded,
    activeLetter, handleLetterFilter, clearLetter,
    activeService, handleServiceFilter, clearService
}: MobileFiltersProps) {
    return (
        <div className={`transition-all duration-300 ease-in-out ${isMobileExpanded ? "block mt-3 opacity-100" : "hidden opacity-0"}`}>
            <div className="bg-card/50 backdrop-blur-xl border border-border/50 p-4 rounded-2xl space-y-5 mb-2 shadow-xl">
                {/* Alphabet Grid */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-[11px] uppercase text-muted-foreground font-bold tracking-wider">Alphabetically</h3>
                        {activeLetter && (
                            <button onClick={clearLetter} className="text-[10px] uppercase font-bold tracking-wider text-destructive hover:text-destructive/80">Clear</button>
                        )}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {ALPHABET.map((letter) => (
                            <button
                                key={letter}
                                onClick={() => handleLetterFilter(letter)}
                                className={`h-8 rounded-md text-[11px] font-semibold transition-all flex items-center justify-center border ${activeLetter === letter
                                    ? "bg-primary text-primary-foreground border-primary shadow-sm scale-105"
                                    : "bg-background/50 border-border/50 text-muted-foreground hover:bg-primary/10"
                                    }`}
                            >
                                {letter}
                            </button>
                        ))}
                    </div>
                </div>

                <Separator className="opacity-30" />

                {/* Services Row */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-[11px] uppercase text-muted-foreground font-bold tracking-wider">Services</h3>
                        {activeService && (
                            <button onClick={clearService} className="text-[10px] uppercase font-bold tracking-wider text-destructive hover:text-destructive/80">Clear</button>
                        )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                        {SERVICE_TAGS.map((tag) => (
                            <button
                                key={tag}
                                onClick={() => handleServiceFilter(tag)}
                                className={`text-left px-3 py-2 rounded-lg text-sm transition-all border ${activeService === tag
                                    ? "bg-blue-500/10 text-blue-400 border-blue-500/30 font-medium"
                                    : "bg-background/40 text-muted-foreground border-transparent hover:bg-muted/50"
                                    }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="truncate capitalize">{tag}</span>
                                    {activeService === tag && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></div>}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
