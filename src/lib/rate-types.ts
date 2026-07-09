export interface WeightTier {
    maxWeight: number; // in grams
    price: number;     // in LKR
}

export interface PostalService {
    id: string; // e.g., "oletter", "sp"
    name: string; // e.g., "Ordinary Letter", "SLP Courier"
    tiers: WeightTier[];
}

export interface EmsZone {
    id: string; // e.g., "zone1"
    name: string; // e.g., "Zone 1"
    tiers: WeightTier[];
}

export interface EmsCountry {
    code: string; // e.g., "US", "GB"
    name: string; // e.g., "United States", "United Kingdom"
    zoneId: string;
}

export interface ExtraFees {
    registeredPost: number;
    cod: number;
}
