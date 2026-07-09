import { PostalService, EmsZone, EmsCountry, ExtraFees } from "./rate-types";

export type Destination = "domestic" | "ems";

export interface PostageResult {
    baseCost: number;
    registrationFee: number;
    codFee: number;
    totalCost: number;
    tierLabel: string;
    error?: string;
}

export interface RateConfig {
    domesticServices: PostalService[];
    emsZones: EmsZone[];
    emsCountries: EmsCountry[];
    extraFees: ExtraFees;
}

export function calculatePostage(
    config: RateConfig,
    destination: Destination,
    serviceId: string, // e.g., "oletter", "ems" (or country code if ems)
    weightGrams: number,
    registered: boolean = false,
    cod: boolean = false
): PostageResult {
    if (weightGrams <= 0) {
        return { baseCost: 0, registrationFee: 0, codFee: 0, totalCost: 0, tierLabel: "", error: "Weight must be greater than 0" };
    }

    let tiers: { maxWeight: number, price: number }[] | undefined;
    
    if (destination === "domestic") {
        const service = config.domesticServices.find(s => s.id === serviceId);
        if (!service) {
            return { baseCost: 0, registrationFee: 0, codFee: 0, totalCost: 0, tierLabel: "", error: "Invalid domestic service selected" };
        }
        tiers = service.tiers;
    } else if (destination === "ems") {
        // For EMS, serviceId is the ISO Country Code
        const country = config.emsCountries.find(c => c.code === serviceId);
        if (!country) {
            return { baseCost: 0, registrationFee: 0, codFee: 0, totalCost: 0, tierLabel: "", error: "Invalid EMS destination selected" };
        }
        const zone = config.emsZones.find(z => z.id === country.zoneId);
        if (!zone) {
            return { baseCost: 0, registrationFee: 0, codFee: 0, totalCost: 0, tierLabel: "", error: "Zone not configured for this country" };
        }
        tiers = zone.tiers;
    }

    if (!tiers || tiers.length === 0) {
        return { baseCost: 0, registrationFee: 0, codFee: 0, totalCost: 0, tierLabel: "", error: "No rate tiers configured for this service" };
    }

    const sortedTiers = [...tiers].sort((a, b) => a.maxWeight - b.maxWeight);
    const tier = sortedTiers.find((t) => weightGrams <= t.maxWeight);
    
    if (!tier) {
        const maxAllowed = sortedTiers[sortedTiers.length - 1].maxWeight;
        return {
            baseCost: 0,
            registrationFee: 0,
            codFee: 0,
            totalCost: 0,
            tierLabel: "",
            error: `Maximum weight for this service is ${maxAllowed >= 1000 ? (maxAllowed / 1000) + " kg" : maxAllowed + "g"}`,
        };
    }

    // SL Post typically only allows Registration and COD for domestic mail
    const registrationFee = registered && destination === "domestic" ? config.extraFees.registeredPost : 0;
    const codFee = cod && destination === "domestic" ? config.extraFees.cod : 0;
    const tierLabel = tier.maxWeight >= 1000 ? `Up to ${tier.maxWeight / 1000} kg` : `Up to ${tier.maxWeight}g`;

    return {
        baseCost: tier.price,
        registrationFee,
        codFee,
        totalCost: tier.price + registrationFee + codFee,
        tierLabel,
    };
}
