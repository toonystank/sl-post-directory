export type TrackingServiceType = "cod" | "slp" | "international";

export type BarcodeClassification =
    | "cod_only"       // BD...LK (exclusively COD)
    | "slp_likely"     // NA...LK, BF...LK (check COD first, pre-load SLP CAPTCHA)
    | "cod_then_slp"   // RA...LK, BG...LK, RR...LK, etc. (check COD first, fallback to SLP)
    | "international"; // 13-char UPU ending in non-LK country code

export type TrackingStatusCategory =
    | "accepted"
    | "in_transit"
    | "arrived"
    | "out_for_delivery"
    | "delivered"
    | "settled"
    | "returned"
    | "pending"
    | "not_found"
    | "error";

export interface TrackingStep {
    label: string;
    detail?: string;
    state: "completed" | "active" | "upcoming" | "error";
}

export interface CodTrackingResult {
    service: "cod";
    barcode: string;
    statusLabel: string;
    statusCategory: TrackingStatusCategory;
    acceptingOffice?: string;
    acceptingOfficeQuery?: string;
    dateAccepted?: string;
    deliveryOffice?: string;
    deliveryOfficeQuery?: string;
    receivedDate?: string;
    settledOffice?: string;
    settledOfficeQuery?: string;
    settledDate?: string;
    extraFields?: Array<{ key: string; label: string; value: string }>;
    deliveryEstimate?: string;
    steps: TrackingStep[];
    checkedAt: string;
}

export interface SlpTrackingEvent {
    id: number;
    barcode: string;
    event: string;
    dateTime: string;
    location: string;
    officeQuery?: string;
}

export interface SlpTrackingResult {
    service: "slp";
    barcode: string;
    statusLabel: string;
    statusCategory: TrackingStatusCategory;
    acceptingOffice?: string;
    acceptingOfficeQuery?: string;
    dateAccepted?: string;
    deliveryOffice?: string;
    deliveryOfficeQuery?: string;
    receivedDate?: string;
    deliveredDate?: string;
    deliveryEstimate?: string;
    events: SlpTrackingEvent[];
    steps: TrackingStep[];
    checkedAt: string;
}

export interface InternationalTrackingHandoff {
    service: "international";
    barcode: string;
    countryCode: string;
    upuUrl: string;
}

export type UnifiedTrackingResult = CodTrackingResult | SlpTrackingResult;

export interface CodLookupItemResponse {
    barcode: string;
    classification: BarcodeClassification;
    found: boolean;
    eligibleForSlp: boolean;
    result?: CodTrackingResult;
    error?: string;
}

export interface CodBatchApiResponse {
    success: boolean;
    items: CodLookupItemResponse[];
    error?: string;
}

export interface SlpCaptchaApiResponse {
    success: boolean;
    image?: string;
    token?: string;
    error?: string;
}

export interface SlpTrackApiResponse {
    success: boolean;
    status: "ok" | "invalid_captcha" | "not_found" | "error";
    result?: SlpTrackingResult;
    error?: string;
}
