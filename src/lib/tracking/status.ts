import type {
    CodTrackingResult,
    TrackingStatusCategory,
    TrackingStep,
} from "./types";

/**
 * Accurately classify Sri Lanka Post COD (bepost.lk) status labels.
 *
 * Important: phrases like "PENDING DELIVERY", "OUT FOR DELIVERY", "AWAITING DELIVERY",
 * "UNDELIVERED", and "NOT DELIVERED" all contain the substring "deliver" and MUST NOT
 * be misclassified as "delivered".
 */
export function classifyCodStatus(
    statusText: string,
    hasReceivedDate: boolean
): TrackingStatusCategory {
    const s = statusText.trim().toLowerCase();

    // 1. Final COD remittance settled
    if (s.includes("settled")) {
        return "settled";
    }

    // 2. Returned, failed, cancelled, refused, or explicitly undelivered
    if (
        s.includes("return") ||
        s.includes("fail") ||
        s.includes("cancel") ||
        s.includes("refus") ||
        s.includes("reject") ||
        s.includes("undelivered") ||
        /\bnot\s+delivered\b/.test(s)
    ) {
        return "returned";
    }

    // 3. Out with postman / out for delivery
    if (
        s.includes("out for delivery") ||
        s.includes("with postman") ||
        s.includes("post man") ||
        s.includes("handed over to")
    ) {
        return "out_for_delivery";
    }

    // 4. Pending / awaiting / ready for delivery (e.g. "PENDING DELIVERY")
    if (
        s.includes("pending") ||
        s.includes("awaiting") ||
        s.includes("waiting") ||
        s.includes("ready for delivery") ||
        s.includes("attempt")
    ) {
        return hasReceivedDate ? "arrived" : "pending";
    }

    // 5. Genuinely delivered — match past-tense "delivered" (word boundary) or "success",
    //    never the noun "delivery"
    if (/\bdelivered\b/.test(s) || s.includes("success")) {
        return "delivered";
    }

    // 6. Arrived / received at delivery post office
    if (s.includes("arrived") || s.includes("received") || hasReceivedDate) {
        return "arrived";
    }

    // 7. In transit / dispatched
    if (s.includes("transit") || s.includes("dispatch") || s.includes("sent")) {
        return "in_transit";
    }

    return "accepted";
}

export function buildCodSteps(
    category: TrackingStatusCategory,
    acceptingOffice?: string,
    deliveryOffice?: string,
    settledOffice?: string
): TrackingStep[] {
    const isReturned = category === "returned";
    const isSettled = category === "settled";

    const labels = [
        "Accepted",
        "In Transit",
        "Arrived",
        isReturned ? "Returned" : isSettled ? "Settled" : "Delivered",
    ];

    const details = [
        acceptingOffice ? `Accepted at ${acceptingOffice}` : undefined,
        acceptingOffice ? `Dispatched from ${acceptingOffice}` : undefined,
        deliveryOffice ? `Arrived at ${deliveryOffice}` : undefined,
        isReturned
            ? deliveryOffice
                ? `Returned from ${deliveryOffice}`
                : "Returned to sender"
            : isSettled
                ? settledOffice
                    ? `COD settled at ${settledOffice}`
                    : "COD payment settled"
                : deliveryOffice
                    ? `Delivered by ${deliveryOffice}`
                    : undefined,
    ];

    let activeIndex = 0;
    if (category === "in_transit" || category === "pending") activeIndex = 1;
    if (category === "arrived" || category === "out_for_delivery") activeIndex = 2;
    if (category === "delivered" || category === "settled" || category === "returned") {
        activeIndex = 3;
    }

    return labels.map((label, idx) => {
        let state: TrackingStep["state"] = "upcoming";
        if (idx < activeIndex) {
            state = "completed";
        } else if (idx === activeIndex) {
            state = isReturned && idx === 3 ? "error" : idx === 3 ? "completed" : "active";
        }
        return { label, detail: details[idx], state };
    });
}

export function estimateCodDelivery(
    category: TrackingStatusCategory,
    acceptingOffice?: string,
    deliveryOffice?: string
): string | undefined {
    if (category === "delivered" || category === "settled" || category === "returned") {
        return undefined;
    }
    if (category === "out_for_delivery") {
        return "Out with postman — delivery expected today";
    }
    if (category === "arrived") {
        return "Delivery expected today or next working day";
    }
    if (
        acceptingOffice &&
        deliveryOffice &&
        acceptingOffice.toLowerCase() === deliveryOffice.toLowerCase()
    ) {
        return "Estimated delivery in 1–2 business days";
    }
    return "Estimated delivery in 2–4 business days";
}

/**
 * Re-normalizes a cached or freshly parsed COD tracking result so statusCategory,
 * progress steps, and delivery estimate always stay consistent with statusLabel.
 */
export function normalizeCodTrackingResult(result: CodTrackingResult): CodTrackingResult {
    const statusCategory = classifyCodStatus(result.statusLabel, Boolean(result.receivedDate));
    const steps = buildCodSteps(
        statusCategory,
        result.acceptingOffice,
        result.deliveryOffice,
        result.settledOffice
    );
    const deliveryEstimate = estimateCodDelivery(
        statusCategory,
        result.acceptingOffice,
        result.deliveryOffice
    );
    return {
        ...result,
        statusCategory,
        steps,
        deliveryEstimate,
    };
}
