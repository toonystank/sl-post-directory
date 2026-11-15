/**
 * Weight bracket and corresponding postage price in LKR.
 */
export interface WeightTier {
    maxWeight: number; // in grams
    price: number;     // in LKR
}

/**
 * Definition for a Sri Lanka Post postal service and its pricing brackets.
 */
export interface PostalService {
    id: string;                 // e.g., "letter", "open_article", "parcel", "courier", "speed_post", "state", "newspaper", "postcard"
    name: string;               // e.g., "Ordinary / Business Letter"
    shortName?: string;         // Compact label for mobile 2-col grid, e.g., "Letter"
    description?: string;
    flatRate?: boolean;         // true for flat-rate services such as Postcard
    supportsRegistration?: boolean;
    supportsAr?: boolean;
    supportsInsurance?: boolean;
    tiers: WeightTier[];
}

/**
 * International EMS pricing zone and weight brackets.
 */
export interface EmsZone {
    id: string; // e.g., "zone_a"
    name: string; // e.g., "Zone A - South Asia"
    tiers: WeightTier[];
}

/**
 * Mapping between an ISO country code and an EMS zone.
 */
export interface EmsCountry {
    code: string; // e.g., "US", "GB"
    name: string; // e.g., "United States", "United Kingdom"
    zoneId: string;
}

/**
 * Additional flat fees and surcharges from the official SL Post tariff schedule.
 */
export interface ExtraFees {
    registeredPost: number;       // 60 LKR
    arReceipt: number;            // 100 LKR (Acknowledgement / Pink receipt)
    cod: number;                  // 50 LKR fixed COD service fee
    vpp?: number;                 // 50 LKR Value Payable Parcel fee
    postcard?: number;            // 40 LKR
    stampedEnvelopeSmall?: number; // 80 LKR
    stampedEnvelopeLarge?: number; // 90 LKR
}
