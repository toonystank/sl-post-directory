import { normalizePostalCode } from "./site";
import type { RoutingOfficeNode } from "./mail-routing";

export const STAFF_STATION_STORAGE_KEY = "sl-post-staff-station-v1";

export type StaffDeliveryFlag = "Yes" | "No" | "";

export interface StaffStation {
    id: string;
    slug: string;
    name: string;
    postalCode: string;
    shortCode?: string;
    division?: string;
    type?: string;
    rmsc?: string | null;
    controllingOfficeId?: string | null;
    delivery?: StaffDeliveryFlag;
}

function cleanOptionalString(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeDeliveryFlag(value: unknown): StaffDeliveryFlag | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (trimmed === "Yes" || trimmed === "No" || trimmed === "") {
        return trimmed;
    }
    if (/^yes|delivery$/i.test(trimmed)) return "Yes";
    if (/^no|non/i.test(trimmed)) return "No";
    return undefined;
}

export function toStaffStation(node: RoutingOfficeNode): StaffStation {
    return {
        id: node.id,
        slug: node.slug,
        name: node.name,
        postalCode: node.postalCode,
        shortCode: node.shortCode,
        division: node.division,
        type: node.type,
        rmsc: node.rmsc ?? undefined,
        controllingOfficeId: node.controllingOfficeId ?? null,
        delivery: node.delivery,
    };
}

export function toRoutingOfficeNode(station: StaffStation): RoutingOfficeNode {
    return {
        id: station.id,
        slug: station.slug,
        name: station.name,
        postalCode: station.postalCode,
        shortCode: station.shortCode,
        division: station.division,
        type: station.type,
        rmsc: station.rmsc ?? null,
        controllingOfficeId: station.controllingOfficeId ?? null,
        delivery: station.delivery,
    };
}

/**
 * Safely parses a stored StaffStation JSON string from localStorage.
 * Returns null if malformed or missing required fields (id, slug, name).
 */
export function parseStaffStation(raw: string | null): StaffStation | null {
    if (!raw || typeof raw !== "string") return null;
    try {
        const parsed = JSON.parse(raw) as Record<string, unknown> | null;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return null;
        }
        const id = typeof parsed.id === "string" ? parsed.id.trim() : "";
        const slug = typeof parsed.slug === "string" ? parsed.slug.trim() : "";
        const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
        if (!id || !slug || !name) {
            return null;
        }
        const rawCode = typeof parsed.postalCode === "string" ? parsed.postalCode.trim() : "";
        const postalCode = rawCode ? normalizePostalCode(rawCode) : "";

        return {
            id,
            slug,
            name,
            postalCode,
            shortCode: cleanOptionalString(parsed.shortCode),
            division: cleanOptionalString(parsed.division),
            type: cleanOptionalString(parsed.type),
            rmsc: cleanOptionalString(parsed.rmsc),
            controllingOfficeId:
                typeof parsed.controllingOfficeId === "string" && parsed.controllingOfficeId.trim()
                    ? parsed.controllingOfficeId.trim()
                    : parsed.controllingOfficeId === null
                      ? null
                      : undefined,
            delivery: normalizeDeliveryFlag(parsed.delivery),
        };
    } catch {
        return null;
    }
}

export function serializeStaffStation(station: StaffStation): string {
    return JSON.stringify({
        id: station.id.trim(),
        slug: station.slug.trim(),
        name: station.name.trim(),
        postalCode: station.postalCode ? normalizePostalCode(station.postalCode) : "",
        ...(station.shortCode ? { shortCode: station.shortCode.trim() } : {}),
        ...(station.division ? { division: station.division.trim() } : {}),
        ...(station.type ? { type: station.type.trim() } : {}),
        ...(station.rmsc ? { rmsc: station.rmsc.trim() } : {}),
        ...(station.controllingOfficeId !== undefined
            ? { controllingOfficeId: station.controllingOfficeId }
            : {}),
        ...(station.delivery ? { delivery: station.delivery.trim() } : {}),
    });
}

/**
 * Builds a Mail Routing Hub link. When a staff duty station is active (and
 * differs from the target office), pre-fills `from=<station.slug>`.
 */
export function buildRoutingHref(destSlug: string, station?: StaffStation | null): string {
    if (station && station.slug && station.slug !== destSlug) {
        return `/routing?from=${encodeURIComponent(station.slug)}&to=${encodeURIComponent(destSlug)}`;
    }
    return `/routing?to=${encodeURIComponent(destSlug)}`;
}

/**
 * Parses single-sided destination route queries entered by postal staff when a
 * duty station is active (e.g., "to jafna", "-> 40000", "→ matara").
 */
export function parseSingleSidedRouteQuery(rawQuery: string): string | null {
    const trimmed = rawQuery.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^(?:to\s+|->\s*|→\s*)(.+)$/i);
    if (!match) return null;
    const candidate = match[1].replace(/[?.!,;:]+$/, "").trim();
    if (candidate.length < 2) return null;
    if (/(?:\s+to\s+|->|→)/i.test(candidate)) return null;
    return candidate;
}
