import type { CSSProperties } from "react";

/**
 * Visual identity for each postage service so people can recognise a service
 * by colour/icon alone (without reading English).
 *
 * - EMS: official UPU EMS logo colours (Pantone 286 C blue #0035AD + orange wing).
 * - Air mail: classic "Par Avion" airmail label blue / red stripes.
 * - Registered: traditional blue "R" registration label.
 * - Local letter / courier: Sri Lanka Post red + pillar-box yellow.
 * - Others: distinct hues chosen so no two neighbouring cards look alike.
 *
 * `light` is used on the light paper theme, `dark` is a brighter tint for dark mode.
 */
export interface ServiceColor {
    light: string;
    dark: string;
    /** Optional secondary accent (e.g. EMS orange wing) */
    accent?: string;
}

export const MODE_COLORS = {
    ems: { light: "#1D4E9E", dark: "#6E9BE8", accent: "#D7263D" }, // airmail blue + red
    cod: { light: "#15803D", dark: "#4ADE80" }, // money green
    domestic: { light: "#B4161B", dark: "#F0585C", accent: "#F5B700" }, // SL Post red + yellow
} satisfies Record<string, ServiceColor>;

export const SERVICE_COLORS: Record<string, ServiceColor> = {
    // International
    ems: { light: "#0035AD", dark: "#6B8CFF", accent: "#FF6600" },
    air_letter: { light: "#1D4E9E", dark: "#6E9BE8", accent: "#D7263D" },
    air_printed: { light: "#3B5BA9", dark: "#8EA6E6", accent: "#D7263D" },
    u_packet: { light: "#0F8A8A", dark: "#2DD4BF" },
    tds: { light: "#6D28D9", dark: "#A78BFA" },
    air_parcel: { light: "#B45309", dark: "#F59E0B" },
    sea_letter: { light: "#0E4A6B", dark: "#38BDF8" },
    sea_printed: { light: "#155E75", dark: "#22D3EE" },
    sea_parcel: { light: "#1E3A5F", dark: "#7DD3FC" },
    // Domestic
    letter: { light: "#B4161B", dark: "#F0585C", accent: "#F5B700" },
    open_article: { light: "#0F8A8A", dark: "#2DD4BF" },
    parcel: { light: "#15803D", dark: "#4ADE80" },
    courier: { light: "#C2410C", dark: "#FB923C", accent: "#F5B700" },
    speed_post: { light: "#EA580C", dark: "#FDBA74" },
    state: { light: "#7F1D1D", dark: "#FCA5A5" },
    newspaper: { light: "#475569", dark: "#CBD5E1" },
    postcard: { light: "#A16207", dark: "#FACC15" },
    // Add-ons
    registered: { light: "#1E40AF", dark: "#93C5FD" },
};

const FALLBACK: ServiceColor = { light: "#B4161B", dark: "#F0585C" };

export function getServiceColor(id: string | undefined): ServiceColor {
    return (id && SERVICE_COLORS[id]) || FALLBACK;
}

/** Inline CSS vars consumed by the `svc-*` Tailwind arbitrary classes. */
export function serviceStyle(c: ServiceColor): CSSProperties {
    return {
        ["--svc" as string]: c.light,
        ["--svc-dark" as string]: c.dark,
        ["--svc-accent" as string]: c.accent ?? c.light,
    } as CSSProperties;
}
