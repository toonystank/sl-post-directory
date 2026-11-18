import type { Metadata } from "next";
import OfflineFallbackClient from "@/components/OfflineFallbackClient";

export const metadata: Metadata = {
    title: "Offline",
    robots: { index: false, follow: false },
};

export default function OfflinePage() {
    return <OfflineFallbackClient />;
}
