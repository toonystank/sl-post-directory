import type { LocalOfficeSearchEngine } from "@/lib/office-index";

/**
 * Common spelling variations used in SL Post tracking logs vs official directory office names.
 */
const TRACKING_OFFICE_ALIASES: Record<string, string> = {
    malambe: "Malabe",
    "mt lavinia": "Mount Lavinia",
    "mt. lavinia": "Mount Lavinia",
    "colombo gpo": "Colombo",
    gpo: "Colombo",
    "kandy gpo": "Kandy",
    "galle gpo": "Galle",
    "jaffna gpo": "Jaffna",
    "nuwaraeliya": "Nuwara Eliya",
    "anuradhapura": "Anuradhapura",
    "kurunegala": "Kurunegala",
    "ratnapura": "Ratnapura",
    "badulla": "Badulla",
};

export interface ResolvedTrackingOffice {
    displayName: string;
    slug?: string;
    postalCode?: string;
    division?: string;
    href: string;
}

/**
 * Resolve a raw tracking location or office query (e.g. "Malambe (CO)", "PO Badulla", "Kandy (KY)")
 * to a rich Lanka Post Directory office entry (with direct `/office/[slug]` link and 5-digit postcode).
 */
export function resolveTrackingOffice(
    rawLabel: string,
    rawQuery: string | undefined,
    engine: LocalOfficeSearchEngine | null
): ResolvedTrackingOffice {
    const baseQuery = (rawQuery || rawLabel || "")
        .trim()
        .replace(/^PO\s+/i, "")
        .replace(/\s*\([A-Z]{2,4}\)\s*$/i, "")
        .replace(/\s+Post\s+Office$/i, "")
        .trim();

    if (!baseQuery) {
        return {
            displayName: rawLabel,
            href: "/browse",
        };
    }

    const normalizedAlias = TRACKING_OFFICE_ALIASES[baseQuery.toLowerCase()] || baseQuery;

    if (engine) {
        const matches = engine.autocompleteRich(normalizedAlias, "name", 3);
        const best =
            matches.find((m) => m.queryValue.toLowerCase() === normalizedAlias.toLowerCase()) ||
            matches.find((m) =>
                m.queryValue.toLowerCase().startsWith(normalizedAlias.toLowerCase())
            ) ||
            matches[0];

        if (best && best.slug) {
            return {
                displayName: rawLabel,
                slug: best.slug,
                postalCode: best.postalCode,
                division: best.division,
                href: `/office/${best.slug}`,
            };
        }
    }

    return {
        displayName: rawLabel,
        href: `/browse?q=${encodeURIComponent(normalizedAlias)}`,
    };
}

export interface FormattedTrackingTimestamp {
    raw: string;
    dateShort: string;
    timeShort: string;
    postmarkDate: string;
    postmarkTime?: string;
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_UPPER = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/**
 * Parse SL Post timestamps like "2026-11-16 16:26:00" into human-readable date/time
 * and authentic circular date stamp (Postmark) strings.
 */
export function formatTrackingTimestamp(raw?: string): FormattedTrackingTimestamp | null {
    if (!raw || typeof raw !== "string") return null;
    const trimmed = raw.trim();
    const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) {
        return {
            raw: trimmed,
            dateShort: trimmed,
            timeShort: "",
            postmarkDate: trimmed.slice(0, 9).toUpperCase(),
        };
    }

    const year = Number.parseInt(m[1], 10);
    const monthIdx = Number.parseInt(m[2], 10) - 1;
    const day = Number.parseInt(m[3], 10);
    const hasTime = m[4] !== undefined && m[5] !== undefined;
    const hour24 = hasTime ? Number.parseInt(m[4], 10) : 0;
    const minute = hasTime ? Number.parseInt(m[5], 10) : 0;

    const monthShort = MONTHS_SHORT[monthIdx] || m[2];
    const monthUpper = MONTHS_UPPER[monthIdx] || m[2];
    const yy = String(year).slice(-2);

    const dateShort = `${day} ${monthShort} ${year}`;
    const postmarkDate = `${String(day).padStart(2, "0")} ${monthUpper} ${yy}`;

    if (!hasTime) {
        return {
            raw: trimmed,
            dateShort,
            timeShort: "",
            postmarkDate,
        };
    }

    const period = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    const minPadded = String(minute).padStart(2, "0");

    return {
        raw: trimmed,
        dateShort,
        timeShort: `${hour12}:${minPadded} ${period}`,
        postmarkDate,
        postmarkTime: `${period} ${String(hour12).padStart(2, "0")}.${minPadded}`,
    };
}
