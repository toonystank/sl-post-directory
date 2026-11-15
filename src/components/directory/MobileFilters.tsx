"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Sheet, SheetContent } from "@/components/shell/Sheet";
import { Button } from "@/components/ui/button";
import { LetterKeypad, ServiceToggles } from "./filters";

interface MobileFiltersProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    activeLetter: string | null;
    handleLetterFilter: (letter: string) => void;
    activeService: string | null;
    handleServiceFilter: (service: string) => void;
    onClear: () => void;
    total: number;
}

/** Filters as a native-style bottom sheet (phones and tablets). */
export default function MobileFilters({
    open, onOpenChange,
    activeLetter, handleLetterFilter,
    activeService, handleServiceFilter,
    onClear, total,
}: MobileFiltersProps) {
    const t = useTranslations("Search");
    const tf = useTranslations("Filters");

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                title={t("filtersTitle")}
                footer={
                    <div className="flex gap-2">
                        <Button variant="outline" className="h-12 flex-1" onClick={onClear} disabled={!activeLetter && !activeService}>
                            {t("clear")}
                        </Button>
                        <Button className="h-12 flex-[2]" onClick={() => onOpenChange(false)}>
                            {t("apply")} · {total.toLocaleString()}
                        </Button>
                    </div>
                }
            >
                <section className="mb-6">
                    <h3 className="label-mono mb-3">{tf("alphabetical")}</h3>
                    <LetterKeypad activeLetter={activeLetter} onSelect={handleLetterFilter} />
                </section>
                <section>
                    <h3 className="label-mono mb-1">{tf("service")}</h3>
                    <ServiceToggles activeService={activeService} onSelect={handleServiceFilter} />
                </section>
            </SheetContent>
        </Sheet>
    );
}
