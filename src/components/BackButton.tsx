"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BackButton() {
    const router = useRouter();

    return (
        <Button
            variant="ghost"
            className="mb-8 hover:bg-primary/10 hover:text-primary transition-colors -ml-4"
            onClick={() => router.back()}
        >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Directory
        </Button>
    );
}
