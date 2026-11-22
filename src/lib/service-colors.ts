import type { CSSProperties } from "react";

/**
 * Visual identity for each postage service so people can recognise a service
 * by colour & distinct icon alone (muscle memory, without reading labels).
 *
 * - EMS: official UPU EMS logo colours (Pantone 286 C blue #0035AD + orange wing).
 * - Air mail: classic "Par Avion" airmail label blue / red stripes.
 * - Registered: traditional blue "R" registration label.
 * - Local letter / courier: Sri Lanka Post red + pillar-box yellow.
 * - Others: distinct hues chosen so no two neighbouring cards look alike.
 *
 * `light` drives both tile fills & Day Post accents; `dark` provides high-contrast accents on Night Mail;
 * `lip` gives tactile 3D button depth under Direction A cards.
 */
export interface ServiceColor {
    light: string;
    dark: string;
    /** Darker bottom bevel / lip colour for tactile depth */
    lip?: string;
    /** Optional secondary accent (e.g. EMS orange wing or letter yellow) */
    accent?: string;
    /** Optional custom icon disc fill (e.g. Pillar-Box Yellow on SL Post red letter) */
    iconBg?: string;
    /** Optional custom icon glyph colour */
    iconFg?: string;
}

export const MODE_COLORS = {
    ems: { light: "#1D4E9E", dark: "#6E9BE8", accent: "#D7263D", lip: "#113168" },
    cod: { light: "#15803D", dark: "#4ADE80", lip: "#0D5327" },
    domestic: { light: "#B4161B", dark: "#F0585C", accent: "#F5B700", lip: "#7E0E12" },
} satisfies Record<string, ServiceColor>;

export const SERVICE_COLORS: Record<string, ServiceColor> = {
    // International
    ems: { light: "#0035AD", dark: "#6B8CFF", accent: "#FF6600", lip: "#002270" },
    air_parcel: { light: "#B45309", dark: "#F59E0B", lip: "#7C3704" },
    air_letter: { light: "#1D4E9E", dark: "#6E9BE8", accent: "#D7263D", lip: "#113168" },
    air_printed: { light: "#2E4C96", dark: "#8EA6E6", accent: "#D7263D", lip: "#1D3268" },
    u_packet: { light: "#0F766E", dark: "#2DD4BF", lip: "#0A4F4A" },
    tds: { light: "#6D28D9", dark: "#A78BFA", lip: "#4B189C" },
    sea_parcel: { light: "#0E4A6B", dark: "#38BDF8", lip: "#082F45" },
    sea_letter: { light: "#0369A1", dark: "#38BDF8", lip: "#02466B" },
    sea_printed: { light: "#155E75", dark: "#22D3EE", lip: "#0C3D4D" },
    // Domestic
    letter: {
        light: "#B4161B",
        dark: "#F0585C",
        accent: "#F5B700",
        lip: "#7E0E12",
        iconBg: "#F5B700",
        iconFg: "#1A1714",
    },
    open_article: { light: "#0F766E", dark: "#2DD4BF", lip: "#0A4F4A" },
    parcel: { light: "#15803D", dark: "#4ADE80", lip: "#0D5327" },
    courier: { light: "#C2410C", dark: "#FB923C", accent: "#F5B700", lip: "#872B06" },
    speed_post: { light: "#C2410C", dark: "#FB923C", accent: "#F5B700", lip: "#872B06" },
    state: { light: "#7F1D1D", dark: "#FCA5A5", lip: "#521010" },
    newspaper: { light: "#475569", dark: "#CBD5E1", lip: "#2D3748" },
    postcard: { light: "#A16207", dark: "#FACC15", lip: "#6E4204" },
    // Add-ons
    registered: { light: "#1E40AF", dark: "#93C5FD", lip: "#142B75" },
};

const FALLBACK: ServiceColor = { light: "#B4161B", dark: "#F0585C", lip: "#7E0E12" };

export function getServiceColor(id: string | undefined): ServiceColor {
    return (id && SERVICE_COLORS[id]) || FALLBACK;
}

/** Inline CSS vars consumed by the `svc` Tailwind utility classes. */
export function serviceStyle(c: ServiceColor): CSSProperties {
    return {
        ["--svc" as string]: c.light,
        ["--svc-dark" as string]: c.dark,
        ["--svc-accent" as string]: c.accent ?? c.light,
        ["--svc-lip" as string]: c.lip ?? c.light,
    } as CSSProperties;
}
