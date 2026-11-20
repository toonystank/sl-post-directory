import * as cheerio from "cheerio";
import type {
    CodTrackingResult,
    SlpTrackingEvent,
    SlpTrackingResult,
    TrackingStatusCategory,
    TrackingStep,
} from "./types";
import {
    buildCodSteps,
    classifyCodStatus,
    estimateCodDelivery,
} from "./status";

export { buildCodSteps, classifyCodStatus, estimateCodDelivery };

const COD_KEY_LABELS: Record<string, string> = {
    acceptingpo: "Accepting Post Office",
    dateaccepted: "Date Accepted",
    deliverypo: "Delivery Post Office",
    receiveddate: "Received Date",
    posettled: "Settled Post Office",
    settleddate: "Settled Date",
};

/**
 * Clean a Post Office name from SL Post responses for display:
 * "PO Badulla" -> "Badulla Post Office"
 */
export function formatOfficeDisplayName(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    if (/^PO\s+/i.test(trimmed)) {
        return `${trimmed.replace(/^PO\s+/i, "").trim()} Post Office`;
    }
    return trimmed.replace(/\bPO\b/g, "Post Office").trim();
}

/**
 * Extract a clean search term to link a Post Office location to Lanka Post Directory.
 * Examples:
 * - "PO Badulla" -> "Badulla"
 * - "Malambe (CO)" -> "Malambe"
 * - "Kandy (KY)" -> "Kandy"
 */
export function extractOfficeSearchQuery(raw: string): string | undefined {
    const cleaned = raw
        .trim()
        .replace(/^PO\s+/i, "")
        .replace(/\s*\([A-Z]{2,4}\)\s*$/i, "")
        .replace(/\s+Post\s+Office$/i, "")
        .trim();
    return cleaned.length >= 2 ? cleaned : undefined;
}

export interface ParsedCodSummaryRow {
    barcode: string;
    found: boolean;
    statusText: string;
    detailsCsrfToken?: string;
    errorMessage?: string;
}

export interface ParsedCodSummaryPage {
    csrfToken: string;
    rows: ParsedCodSummaryRow[];
    rateLimited: boolean;
}

/**
 * Extract hidden csrf_token from any bepost.lk/p/Search page.
 */
export function extractBepostCsrfToken(html: string): string {
    const $ = cheerio.load(html);
    const val = $('input[name="csrf_token"]').first().attr("value");
    return val ? val.trim() : "";
}

/**
 * Parse the HTML returned by POST https://bepost.lk/p/Search/New_serch_barcode.php
 */
export function parseCodSummaryHtml(html: string): ParsedCodSummaryPage {
    const $ = cheerio.load(html);
    const bodyLower = $("body").text().toLowerCase();
    const rateLimited = bodyLower.includes("please wait a moment");
    const csrfToken = extractBepostCsrfToken(html);

    const rows: ParsedCodSummaryRow[] = [];

    $("table.result-table tr").each((i, row) => {
        if (i === 0) return; // header
        const cells = $(row).find("td");
        if (cells.length === 0) return;

        const barcode = $(cells[0]).text().trim().toUpperCase();
        if (!barcode) return;

        if (cells.length === 2 || $(cells[1]).attr("colspan")) {
            const msg = $(cells[1]).text().trim();
            rows.push({
                barcode,
                found: false,
                statusText: "Not Found",
                errorMessage: msg || "No record found",
            });
            return;
        }

        const statusText = $(cells[1]).text().trim();
        const detailsCsrf = $(cells[2]).find('input[name="csrf_token"]').attr("value")?.trim();

        rows.push({
            barcode,
            found: true,
            statusText: statusText || "Pending",
            detailsCsrfToken: detailsCsrf || csrfToken,
        });
    });

    return { csrfToken, rows, rateLimited };
}


/**
 * Parse the detail table from either:
 * - POST https://bepost.lk/p/Search/New_serch_barcode.php (with details_barcode)
 * - POST https://bepost.lk/p/Search/ (single search)
 */
export function parseCodDetailsHtml(html: string, requestedBarcode: string): CodTrackingResult | null {
    const $ = cheerio.load(html);
    const bodyLower = $("body").text().toLowerCase();

    if (
        bodyLower.includes("no record found") ||
        bodyLower.includes("invalid barcode") ||
        bodyLower.includes("please wait a moment")
    ) {
        return null;
    }

    const kv = new Map<string, { rawKey: string; value: string }>();

    $("table.result-table tr, table tr").each((_, row) => {
        const cols = $(row).find("td");
        if (cols.length >= 2) {
            const rawKey = $(cols[0]).text().trim();
            const value = $(cols[1]).text().trim();
            if (rawKey) {
                kv.set(rawKey.toLowerCase(), { rawKey, value });
            }
        }
    });

    if (kv.size === 0 || (!kv.has("status") && !kv.has("barcode"))) {
        return null;
    }

    const barcode = (kv.get("barcode")?.value || requestedBarcode).toUpperCase();
    const statusLabel = kv.get("status")?.value || "Pending";

    const rawAccepting = kv.get("acceptingpo")?.value || "";
    const dateAccepted = kv.get("dateaccepted")?.value || undefined;
    const rawDelivery = kv.get("deliverypo")?.value || "";
    const receivedDate = kv.get("receiveddate")?.value || undefined;
    const rawSettled = kv.get("posettled")?.value || "";
    const settledDate = kv.get("settleddate")?.value || undefined;

    const acceptingOffice = rawAccepting ? formatOfficeDisplayName(rawAccepting) : undefined;
    const deliveryOffice = rawDelivery ? formatOfficeDisplayName(rawDelivery) : undefined;
    const settledOffice = rawSettled ? formatOfficeDisplayName(rawSettled) : undefined;

    const statusCategory = classifyCodStatus(statusLabel, Boolean(receivedDate));

    const knownKeys = new Set([
        "barcode",
        "status",
        "acceptingpo",
        "dateaccepted",
        "deliverypo",
        "receiveddate",
        "posettled",
        "settleddate",
    ]);

    const extraFields: Array<{ key: string; label: string; value: string }> = [];
    for (const [lowerKey, entry] of kv.entries()) {
        if (!knownKeys.has(lowerKey) && entry.value) {
            const label =
                COD_KEY_LABELS[lowerKey] ??
                entry.rawKey.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\bPO\b/g, "Post Office");
            extraFields.push({
                key: lowerKey,
                label,
                value: formatOfficeDisplayName(entry.value),
            });
        }
    }

    return {
        service: "cod",
        barcode,
        statusLabel,
        statusCategory,
        acceptingOffice,
        acceptingOfficeQuery: rawAccepting ? extractOfficeSearchQuery(rawAccepting) : undefined,
        dateAccepted,
        deliveryOffice,
        deliveryOfficeQuery: rawDelivery ? extractOfficeSearchQuery(rawDelivery) : undefined,
        receivedDate,
        settledOffice,
        settledOfficeQuery: rawSettled ? extractOfficeSearchQuery(rawSettled) : undefined,
        settledDate,
        extraFields: extraFields.length > 0 ? extraFields : undefined,
        deliveryEstimate: estimateCodDelivery(statusCategory, acceptingOffice, deliveryOffice),
        steps: buildCodSteps(statusCategory, acceptingOffice, deliveryOffice, settledOffice),
        checkedAt: new Date().toISOString(),
    };
}

export interface ParsedSlpResponse {
    status: "ok" | "invalid_captcha" | "not_found";
    result?: SlpTrackingResult;
}

function deriveSlpStatus(latestEventText: string): {
    label: string;
    category: TrackingStatusCategory;
    stepIndex: number;
} {
    const ev = latestEventText.toLowerCase();

    if (ev.includes("return")) {
        return { label: "Returned", category: "returned", stepIndex: 4 };
    }
    if (
        (ev.includes("deliver") &&
            (ev.includes("item delivered") ||
                ev.includes("successful") ||
                ev.includes("delivered to") ||
                ev === "delivered"))
    ) {
        return { label: "Delivered", category: "delivered", stepIndex: 4 };
    }
    if (ev.includes("handed over to post man") || ev.includes("handed over to postman") || ev.includes("out for delivery")) {
        return { label: "Out for Delivery", category: "out_for_delivery", stepIndex: 3 };
    }
    if (ev.includes("receive") && ev.includes("delivery office")) {
        return { label: "Arrived at Delivery Office", category: "arrived", stepIndex: 2 };
    }
    if ((ev.includes("send") || ev.includes("dispatch")) && ev.includes("delivery")) {
        return { label: "In Transit to Delivery Office", category: "in_transit", stepIndex: 1 };
    }
    if (ev.includes("receive") && ev.includes("customer")) {
        return { label: "Accepted", category: "accepted", stepIndex: 0 };
    }

    return {
        label: latestEventText || "In Transit",
        category: "in_transit",
        stepIndex: 1,
    };
}

/**
 * Parse HTML returned by POST https://slpmail.slpost.gov.lk/track/index.php
 */
export function parseSlpHtml(html: string, requestedBarcode: string): ParsedSlpResponse {
    const $ = cheerio.load(html);
    const bodyText = $("body").text();
    const bodyLower = bodyText.toLowerCase();

    // Check explicit invalid CAPTCHA errors first
    if (
        bodyLower.includes("invalid code") ||
        bodyLower.includes("incorrect verification") ||
        bodyLower.includes("validation code does not match") ||
        bodyLower.includes("captcha") && bodyLower.includes("not match")
    ) {
        return { status: "invalid_captcha" };
    }

    if (
        bodyLower.includes("no record found") ||
        bodyLower.includes("no tracking information is available") ||
        bodyLower.includes("not found")
    ) {
        return { status: "not_found" };
    }

    const events: SlpTrackingEvent[] = [];

    $("table tr").each((_, row) => {
        // Ignore form layout rows
        if ($(row).find("input, select, button, form, img, textarea").length > 0) return;

        const cols = $(row).find("td");
        if (cols.length < 5) return;

        const idText = $(cols[0]).text().trim();
        if (!/^\d+$/.test(idText)) return; // Skip header row ("ID") or decorative rows

        const identNo = $(cols[1]).text().trim().toUpperCase() || requestedBarcode.toUpperCase();
        const eventText = $(cols[2]).text().trim();
        const dateTime = $(cols[3]).text().trim();
        const location = $(cols[4]).text().trim();

        if (!eventText && !dateTime) return;

        events.push({
            id: Number.parseInt(idText, 10),
            barcode: identNo,
            event: eventText,
            dateTime,
            location,
            officeQuery: extractOfficeSearchQuery(location),
        });
    });

    if (events.length === 0) {
        // If the page returned the form again without tracking rows, it's almost always a CAPTCHA mismatch
        if ($('input[name="input"]').length > 0 || bodyLower.includes("validation code")) {
            return { status: "invalid_captcha" };
        }
        return { status: "not_found" };
    }

    // Sort by numeric ID ascending (chronological)
    events.sort((a, b) => a.id - b.id);

    const latest = events[events.length - 1];
    const derived = deriveSlpStatus(latest.event);

    let acceptingOffice: string | undefined;
    let dateAccepted: string | undefined;
    let deliveryOffice: string | undefined;
    let receivedDate: string | undefined;
    let deliveredDate: string | undefined;

    for (const ev of events) {
        const lower = ev.event.toLowerCase();
        if (lower.includes("receive") && lower.includes("customer")) {
            acceptingOffice = ev.location;
            dateAccepted = ev.dateTime;
        } else if (lower.includes("receive") && lower.includes("delivery office")) {
            deliveryOffice = ev.location;
            receivedDate = ev.dateTime;
        } else if (lower.includes("item delivered") || (lower.includes("deliver") && lower.includes("success"))) {
            deliveredDate = ev.dateTime;
            if (!deliveryOffice) deliveryOffice = ev.location;
        }
    }

    const firstLoc = events[0]?.location;
    const lastLoc = latest.location;
    const isReturned = derived.category === "returned";

    const stepLabels = [
        "Accepted",
        "In Transit",
        "Arrived",
        "Out for Delivery",
        isReturned ? "Returned" : "Delivered",
    ];
    const stepDetails = [
        firstLoc ? `Accepted at ${firstLoc}` : undefined,
        firstLoc ? `Dispatched from ${firstLoc}` : undefined,
        deliveryOffice || lastLoc ? `Arrived at ${deliveryOffice || lastLoc}` : undefined,
        lastLoc ? `With postman at ${lastLoc}` : undefined,
        isReturned
            ? lastLoc
                ? `Returned from ${lastLoc}`
                : "Returned"
            : lastLoc
                ? `Delivered at ${lastLoc}`
                : "Delivered",
    ];

    const steps: TrackingStep[] = stepLabels.map((label, idx) => {
        let state: TrackingStep["state"] = "upcoming";
        if (idx < derived.stepIndex) {
            state = "completed";
        } else if (idx === derived.stepIndex) {
            state = isReturned && idx === 4 ? "error" : idx === 4 ? "completed" : "active";
        }
        return { label, detail: stepDetails[idx], state };
    });

    let deliveryEstimate: string | undefined;
    if (derived.category === "out_for_delivery") {
        deliveryEstimate = "Out with postman — delivery expected today";
    } else if (derived.category === "arrived") {
        deliveryEstimate = "Delivery expected today or next working day";
    } else if (derived.category === "accepted" || derived.category === "in_transit") {
        deliveryEstimate = "Estimated delivery in 1–3 business days";
    }

    return {
        status: "ok",
        result: {
            service: "slp",
            barcode: latest.barcode || requestedBarcode.toUpperCase(),
            statusLabel: derived.label,
            statusCategory: derived.category,
            acceptingOffice,
            acceptingOfficeQuery: acceptingOffice ? extractOfficeSearchQuery(acceptingOffice) : undefined,
            dateAccepted,
            deliveryOffice: deliveryOffice || (derived.stepIndex >= 2 ? lastLoc : undefined),
            deliveryOfficeQuery:
                deliveryOffice || (derived.stepIndex >= 2 ? lastLoc : undefined)
                    ? extractOfficeSearchQuery(deliveryOffice || lastLoc)
                    : undefined,
            receivedDate,
            deliveredDate,
            deliveryEstimate,
            events,
            steps,
            checkedAt: new Date().toISOString(),
        },
    };
}
