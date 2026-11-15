"use client";

import { useRouter } from "@/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BackButton() {
    const router = useRouter();
    const t = useTranslations("Office");

    return (
        <Button
            variant="ghost"
            size="sm"
            className="-ml-2 text-muted-foreground hover:text-foreground"
            onClick={() => router.back()}
        >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> {t("backToDirectory")}
        </Button>
    );
}
