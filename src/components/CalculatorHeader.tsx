"use client";

import { useTranslations } from "next-intl";

export default function CalculatorHeader() {
    const t = useTranslations("Calculator");

    return (
        <header className="hidden md:block max-w-2xl lg:max-w-7xl mx-auto w-full mb-6">
            <p className="label-mono mb-1.5">{t("kicker")}</p>
            <h1 className="display text-4xl lg:text-5xl mb-2">
                {t("title")}
            </h1>
            <p className="text-muted-foreground text-base max-w-3xl">
                {t("subtitle")}
            </p>
            <div className="mt-3 border-l-4 border-secondary bg-card px-4 py-2 text-xs text-muted-foreground">
                <strong className="text-foreground">{t("circularLabel")}</strong> {t("circularBody")}
            </div>
        </header>
    );
}
