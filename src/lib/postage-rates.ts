import {
    PostalService,
    EmsZone,
    EmsCountry,
    ExtraFees,
    WeightTier,
    CountryGroup,
    InternationalTransport,
    InternationalServiceId,
} from "./rate-types";

export type { CountryGroup, InternationalTransport, InternationalServiceId };

export type Destination = "domestic" | "cod" | "ems";

export interface PostageResult {
    baseCost: number;
    registrationFee: number;
    arReceiptFee: number;
    codFee: number;
    totalCost: number;
    tierLabel: string;
    maxWeight?: number;
    exceedsMaxWeight?: boolean;
    error?: string;
}

export interface DomesticServiceQuote {
    service: PostalService;
    result: PostageResult;
}

export interface CodPostageResult {
    courierFee: number;
    moneyOrderFee: number;
    codServiceFee: number;
    totalCost: number;
    netRemittance: number;
    tierLabel: string;
    subPostOfficeWarning: boolean;
    error?: string;
}

export interface RateConfig {
    domesticServices: PostalService[];
    emsZones: EmsZone[];
    emsCountries: EmsCountry[];
    extraFees: ExtraFees;
}

function round50(n: number): number {
    return Math.round(n / 50) * 50;
}

/**
 * Builds 0.5 kg EMS weight tiers from official tariff anchor points up to 20 kg or 30 kg.
 */
export function buildEmsTiers(
    p250: number,
    p500: number,
    p1000: number,
    p10k: number,
    p20k: number,
    p30k?: number,
    overrides?: Record<number, number>
): WeightTier[] {
    const tiers: WeightTier[] = [
        { maxWeight: 250, price: p250 },
        { maxWeight: 500, price: p500 },
        { maxWeight: 1000, price: p1000 },
    ];
    // 1.5kg (step 1) to 10kg (step 18)
    const p2500Override = overrides?.[2500];
    for (let step = 1; step <= 18; step++) {
        const w = 1000 + step * 500;
        let price: number;
        if (overrides?.[w] !== undefined) {
            price = overrides[w];
        } else if (p2500Override !== undefined && w >= 2500) {
            price = round50(p2500Override + ((w - 2500) / 7500) * (p10k - p2500Override));
        } else {
            price = round50(p1000 + (step / 18) * (p10k - p1000));
        }
        tiers.push({ maxWeight: w, price });
    }
    // 10.5kg (step 1) to 20kg (step 20)
    const p10500Override = overrides?.[10500];
    for (let step = 1; step <= 20; step++) {
        const w = 10000 + step * 500;
        let price: number;
        if (overrides?.[w] !== undefined) {
            price = overrides[w];
        } else if (p10500Override !== undefined) {
            price = round50(p10500Override + ((w - 10500) / 9500) * (p20k - p10500Override));
        } else {
            price = round50(p10k + (step / 20) * (p20k - p10k));
        }
        tiers.push({ maxWeight: w, price });
    }
    // 20.5kg (step 1) to 30kg (step 20) if max weight is 30kg
    if (p30k !== undefined) {
        for (let step = 1; step <= 20; step++) {
            const w = 20000 + step * 500;
            const price = overrides?.[w] ?? round50(p20k + (step / 20) * (p30k - p20k));
            tiers.push({ maxWeight: w, price });
        }
    }
    return tiers;
}

/**
 * Official Sri Lanka Post Domestic Postage Revision (effective February 9, 2026)
 * cross-verified against domesticpostagerevision2026-02-09.pdf and postage.lk.
 */
export const DEFAULT_RATE_CONFIG: RateConfig = {
    domesticServices: [
        {
            id: "letter",
            name: "Ordinary / Business Letter",
            shortName: "Letter",
            description: "Standard inland letter up to 2 kg",
            supportsRegistration: true,
            supportsAr: true,
            supportsInsurance: true,
            tiers: [
                { maxWeight: 30, price: 70 },
                { maxWeight: 40, price: 80 },
                { maxWeight: 50, price: 90 },
                { maxWeight: 60, price: 100 },
                { maxWeight: 70, price: 110 },
                { maxWeight: 80, price: 120 },
                { maxWeight: 90, price: 130 },
                { maxWeight: 100, price: 140 },
                { maxWeight: 200, price: 160 },
                { maxWeight: 300, price: 180 },
                { maxWeight: 400, price: 200 },
                { maxWeight: 500, price: 220 },
                { maxWeight: 600, price: 240 },
                { maxWeight: 700, price: 260 },
                { maxWeight: 800, price: 280 },
                { maxWeight: 900, price: 300 },
                { maxWeight: 1000, price: 320 },
                { maxWeight: 1250, price: 350 },
                { maxWeight: 1500, price: 380 },
                { maxWeight: 1750, price: 410 },
                { maxWeight: 2000, price: 440 },
            ],
        },
        {
            id: "open_article",
            name: "Open Article / Printed Matter",
            shortName: "Open Article",
            description: "Printed papers & open packets up to 2 kg",
            supportsRegistration: true,
            supportsAr: true,
            tiers: [
                { maxWeight: 30, price: 45 },
                { maxWeight: 60, price: 50 },
                { maxWeight: 90, price: 55 },
                { maxWeight: 120, price: 60 },
                { maxWeight: 150, price: 65 },
                { maxWeight: 180, price: 70 },
                { maxWeight: 210, price: 75 },
                { maxWeight: 240, price: 80 },
                { maxWeight: 270, price: 85 },
                { maxWeight: 300, price: 90 },
                { maxWeight: 330, price: 95 },
                { maxWeight: 360, price: 100 },
                { maxWeight: 390, price: 105 },
                { maxWeight: 420, price: 110 },
                { maxWeight: 450, price: 115 },
                { maxWeight: 480, price: 120 },
                { maxWeight: 510, price: 125 },
                { maxWeight: 540, price: 130 },
                { maxWeight: 570, price: 135 },
                { maxWeight: 600, price: 140 },
                { maxWeight: 630, price: 145 },
                { maxWeight: 660, price: 150 },
                { maxWeight: 690, price: 155 },
                { maxWeight: 720, price: 160 },
                { maxWeight: 750, price: 165 },
                { maxWeight: 780, price: 170 },
                { maxWeight: 810, price: 175 },
                { maxWeight: 840, price: 180 },
                { maxWeight: 870, price: 185 },
                { maxWeight: 900, price: 190 },
                { maxWeight: 930, price: 195 },
                { maxWeight: 960, price: 200 },
                { maxWeight: 1000, price: 215 },
                { maxWeight: 1500, price: 240 },
                { maxWeight: 2000, price: 265 },
            ],
        },
        {
            id: "parcel",
            name: "Ordinary Parcel",
            shortName: "Parcel",
            description: "Standard inland parcel up to 20 kg",
            supportsRegistration: false,
            supportsAr: true,
            supportsInsurance: true,
            tiers: [
                { maxWeight: 250, price: 150 },
                { maxWeight: 500, price: 200 },
                { maxWeight: 1000, price: 250 },
                { maxWeight: 2000, price: 300 },
                { maxWeight: 3000, price: 350 },
                { maxWeight: 4000, price: 400 },
                { maxWeight: 5000, price: 450 },
                { maxWeight: 6000, price: 500 },
                { maxWeight: 7000, price: 550 },
                { maxWeight: 8000, price: 600 },
                { maxWeight: 9000, price: 650 },
                { maxWeight: 10000, price: 700 },
                { maxWeight: 15000, price: 800 },
                { maxWeight: 20000, price: 900 },
            ],
        },
        {
            id: "courier",
            name: "SLP Courier (formerly Speed Post)",
            shortName: "SLP Courier",
            description: "Express tracked domestic courier (formerly Speed Post) up to 40 kg",
            supportsRegistration: false,
            supportsAr: false,
            tiers: [
                { maxWeight: 250, price: 200 },
                { maxWeight: 500, price: 250 },
                { maxWeight: 1000, price: 350 },
                { maxWeight: 2000, price: 400 },
                { maxWeight: 3000, price: 450 },
                { maxWeight: 4000, price: 500 },
                { maxWeight: 5000, price: 550 },
                { maxWeight: 6000, price: 600 },
                { maxWeight: 7000, price: 650 },
                { maxWeight: 8000, price: 700 },
                { maxWeight: 9000, price: 750 },
                { maxWeight: 10000, price: 800 },
                { maxWeight: 15000, price: 850 },
                { maxWeight: 20000, price: 1100 },
                { maxWeight: 25000, price: 1600 },
                { maxWeight: 30000, price: 2100 },
                { maxWeight: 35000, price: 2600 },
                { maxWeight: 40000, price: 3100 },
            ],
        },
        {
            id: "state",
            name: "On State Service (Official)",
            shortName: "State Service",
            description: "Government mail (includes registration) up to 5 kg",
            supportsRegistration: false,
            supportsAr: true,
            tiers: [
                { maxWeight: 30, price: 130 },
                { maxWeight: 40, price: 140 },
                { maxWeight: 50, price: 150 },
                { maxWeight: 60, price: 160 },
                { maxWeight: 70, price: 170 },
                { maxWeight: 80, price: 180 },
                { maxWeight: 90, price: 190 },
                { maxWeight: 100, price: 200 },
                { maxWeight: 200, price: 220 },
                { maxWeight: 300, price: 240 },
                { maxWeight: 400, price: 260 },
                { maxWeight: 500, price: 280 },
                { maxWeight: 600, price: 300 },
                { maxWeight: 700, price: 320 },
                { maxWeight: 800, price: 340 },
                { maxWeight: 900, price: 360 },
                { maxWeight: 1000, price: 380 },
                { maxWeight: 1250, price: 410 },
                { maxWeight: 1500, price: 440 },
                { maxWeight: 1750, price: 470 },
                { maxWeight: 2000, price: 500 },
                { maxWeight: 3000, price: 550 },
                { maxWeight: 4000, price: 600 },
                { maxWeight: 5000, price: 650 },
            ],
        },
        {
            id: "newspaper",
            name: "Registered Newspapers / Periodicals",
            shortName: "Newspaper",
            description: "Registered publications up to 1 kg",
            supportsRegistration: true,
            supportsAr: true,
            tiers: [
                { maxWeight: 60, price: 40 },
                { maxWeight: 120, price: 50 },
                { maxWeight: 240, price: 60 },
                { maxWeight: 360, price: 70 },
                { maxWeight: 480, price: 80 },
                { maxWeight: 600, price: 90 },
                { maxWeight: 720, price: 100 },
                { maxWeight: 840, price: 110 },
                { maxWeight: 960, price: 120 },
                { maxWeight: 1000, price: 130 },
            ],
        },
        {
            id: "postcard",
            name: "Postcard (Flat Rate)",
            shortName: "Postcard",
            description: "Standard inland postcard",
            flatRate: true,
            supportsRegistration: true,
            supportsAr: true,
            tiers: [{ maxWeight: 20, price: 40 }],
        },
    ],
    emsZones: [
        {
            id: "zone_a",
            name: "Zone A - South Asia",
            tiers: buildEmsTiers(4550, 4900, 5550, 16750, 28450, 37900),
        },
        {
            id: "zone_b",
            name: "Zone B - Middle East & SE Asia",
            tiers: buildEmsTiers(5550, 5850, 6350, 15900, 25750, 33350),
        },
        {
            id: "zone_c",
            name: "Zone C - Europe & UK",
            tiers: buildEmsTiers(7350, 7950, 9000, 28400, 49200, 67750),
        },
        {
            id: "zone_d",
            name: "Zone D - Americas, East Asia & Oceania",
            tiers: buildEmsTiers(8850, 9800, 11700, 45800, 82900, 117800),
        },
    ],
    emsCountries: [
        // South Asia (Group A & B / zone_a)
        {
            code: "IN",
            name: "India",
            zoneId: "zone_a",
            group: "A",
            emsMaxWeight: 30000,
            maxParcelWeight: 20000,
            emsTiers: buildEmsTiers(4550, 4900, 5550, 16750, 28450, 37900),
            airParcelRate: { first500g: 4200, additional500g: 520, maxWeight: 20000 },
            seaParcelRate: { first1000g: 3850, additional1000g: 610, maxWeight: 20000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: true,
        },
        {
            code: "MV",
            name: "Maldives",
            zoneId: "zone_a",
            group: "A",
            emsMaxWeight: 30000,
            maxParcelWeight: 20000,
            emsTiers: buildEmsTiers(4450, 4600, 4850, 9150, 13200, 15000),
            airParcelRate: { first500g: 2850, additional500g: 270, maxWeight: 20000 },
            seaParcelRate: { first1000g: 2800, additional1000g: 620, maxWeight: 20000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: true,
        },
        {
            code: "BD",
            name: "Bangladesh",
            zoneId: "zone_a",
            group: "B",
            emsMaxWeight: 30000,
            maxParcelWeight: 20000,
            emsTiers: buildEmsTiers(3150, 3400, 3800, 10900, 18100, 23000),
            airParcelRate: { first500g: 2500, additional500g: 500, maxWeight: 20000 },
            seaMailAvailable: false,
            seaMailNote: "No direct surface mail container route from Colombo",
            uPacketAvailable: true,
            tdsAvailable: false,
        },
        {
            code: "PK",
            name: "Pakistan",
            zoneId: "zone_a",
            group: "B",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(4600, 4850, 5300, 13350, 21550, 27500),
            airParcelRate: { first500g: 2800, additional500g: 500, maxWeight: 30000 },
            seaMailAvailable: false,
            seaMailNote: "No bilateral Sea Mail parcel service to Pakistan",
            uPacketAvailable: true,
            tdsAvailable: false,
        },
        {
            code: "NP",
            name: "Nepal",
            zoneId: "zone_a",
            group: "B",
            emsMaxWeight: 30000,
            maxParcelWeight: 20000,
            emsTiers: buildEmsTiers(3200, 3400, 3850, 11350, 19000, 24350),
            airParcelRate: { first500g: 2300, additional500g: 430, maxWeight: 20000 },
            seaMailAvailable: false,
            seaMailNote: "Landlocked country — Sea Mail not available",
            uPacketAvailable: true,
            tdsAvailable: false,
        },

        // Middle East (Group B & C / zone_b)
        {
            code: "AE",
            name: "United Arab Emirates",
            zoneId: "zone_b",
            group: "B",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(5550, 5850, 6350, 15900, 25750, 33350),
            airParcelRate: { first500g: 2800, additional500g: 550, maxWeight: 30000 },
            seaParcelRate: { first1000g: 3050, additional1000g: 730, maxWeight: 30000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: true,
        },
        {
            code: "QA",
            name: "Qatar",
            zoneId: "zone_b",
            group: "B",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(5350, 5850, 6900, 25300, 45050, 62500),
            airParcelRate: { first500g: 2900, additional500g: 590, maxWeight: 30000 },
            seaMailAvailable: false,
            seaMailNote: "No bilateral Sea Mail container service to Qatar",
            uPacketAvailable: true,
            tdsAvailable: true,
            suspensionStatus: "restricted",
            restrictionNote: "Subject to airline routing delays on Middle East corridors.",
        },
        {
            code: "SA",
            name: "Saudi Arabia",
            zoneId: "zone_b",
            group: "C",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(6100, 6450, 7100, 19400, 32250, 42900),
            airParcelRate: { first500g: 2850, additional500g: 790, maxWeight: 30000 },
            seaMailAvailable: false,
            seaMailNote: "No direct surface mail container route to Saudi Arabia",
            uPacketAvailable: true,
            tdsAvailable: true,
        },
        {
            code: "OM",
            name: "Oman",
            zoneId: "zone_b",
            group: "B",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(5500, 5800, 6250, 15000, 23950, 30650),
            airParcelRate: { first500g: 3150, additional500g: 510, maxWeight: 30000 },
            seaMailAvailable: false,
            seaMailNote: "No direct surface mail dispatch to Oman",
            uPacketAvailable: true,
            tdsAvailable: false,
        },
        {
            code: "KW",
            name: "Kuwait",
            zoneId: "zone_b",
            group: "C",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(4200, 4550, 5150, 16300, 27950, 37350),
            airParcelRate: { first500g: 3000, additional500g: 620, maxWeight: 30000 },
            seaMailAvailable: false,
            seaMailNote: "No direct surface mail dispatch to Kuwait",
            uPacketAvailable: true,
            tdsAvailable: false,
        },
        {
            code: "BH",
            name: "Bahrain",
            zoneId: "zone_b",
            group: "B",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(5550, 5850, 6450, 16800, 27550, 36050),
            airParcelRate: { first500g: 2900, additional500g: 610, maxWeight: 30000 },
            seaMailAvailable: false,
            seaMailNote: "No direct surface mail dispatch to Bahrain",
            uPacketAvailable: true,
            tdsAvailable: false,
        },
        {
            code: "JO",
            name: "Jordan",
            zoneId: "zone_b",
            group: "C",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(5650, 6050, 6800, 20350, 34700, 46750),
            airParcelRate: { first500g: 2900, additional500g: 770, maxWeight: 30000 },
            seaMailAvailable: false,
            seaMailNote: "No direct surface mail dispatch to Jordan",
            uPacketAvailable: true,
            tdsAvailable: false,
        },
        {
            code: "IL",
            name: "Israel",
            zoneId: "zone_b",
            group: "C",
            emsMaxWeight: 20000,
            maxParcelWeight: 20000,
            emsTiers: buildEmsTiers(6600, 7000, 7750, 21500, 36050),
            airParcelRate: { first500g: 4050, additional500g: 820, maxWeight: 20000 },
            seaParcelRate: { first1000g: 5400, additional1000g: 1870, maxWeight: 20000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: false,
            suspensionStatus: "restricted",
            restrictionNote: "Subject to Middle East airline routing delays.",
        },
        {
            code: "LB",
            name: "Lebanon",
            zoneId: "zone_b",
            group: "C",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(4350, 4800, 5700, 21750, 38800, 53650),
            airParcelRate: { first500g: 3450, additional500g: 820, maxWeight: 30000 },
            seaMailAvailable: false,
            seaMailNote: "No direct surface mail dispatch to Lebanon",
            uPacketAvailable: true,
            tdsAvailable: false,
            suspensionStatus: "restricted",
            restrictionNote: "Air Mail & U-Packet active (June 2025 circular); EMS & Air Parcel subject to airline routing availability.",
        },

        // Southeast & East Asia (Group B, C & D / zone_b & zone_d)
        {
            code: "SG",
            name: "Singapore",
            zoneId: "zone_b",
            group: "B",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(4600, 4850, 5300, 13850, 22600, 28850),
            airParcelRate: { first500g: 3300, additional500g: 510, maxWeight: 30000 },
            seaParcelRate: { first1000g: 3500, additional1000g: 640, maxWeight: 30000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: true,
        },
        {
            code: "MY",
            name: "Malaysia",
            zoneId: "zone_b",
            group: "B",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(6250, 6550, 7100, 16900, 27050, 34950),
            airParcelRate: { first500g: 3450, additional500g: 590, maxWeight: 30000 },
            seaParcelRate: { first1000g: 4850, additional1000g: 1700, maxWeight: 30000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: true,
        },
        {
            code: "TH",
            name: "Thailand",
            zoneId: "zone_b",
            group: "B",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(4350, 4600, 5100, 13600, 22300, 28750),
            airParcelRate: { first500g: 3200, additional500g: 560, maxWeight: 30000 },
            seaParcelRate: { first1000g: 4650, additional1000g: 1670, maxWeight: 30000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: true,
        },
        {
            code: "ID",
            name: "Indonesia",
            zoneId: "zone_b",
            group: "B",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(4700, 5000, 5650, 17700, 31650, 41500, { 1500: 6300, 2000: 6950, 2500: 8050, 10500: 20200 }),
            airParcelRate: { first500g: 3900, additional500g: 920, maxWeight: 30000 },
            seaMailAvailable: false,
            seaMailNote: "No bilateral Sea Mail parcel route to Indonesia",
            uPacketAvailable: true,
            tdsAvailable: false,
        },
        {
            code: "PH",
            name: "Philippines",
            zoneId: "zone_b",
            group: "C",
            emsMaxWeight: 20000,
            maxParcelWeight: 20000,
            emsTiers: buildEmsTiers(4700, 5100, 5800, 18800, 32500),
            airParcelRate: { first500g: 2700, additional500g: 810, maxWeight: 20000 },
            seaParcelRate: { first1000g: 3850, additional1000g: 1640, maxWeight: 20000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: false,
        },
        {
            code: "VN",
            name: "Vietnam",
            zoneId: "zone_b",
            group: "B",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(4350, 4600, 5100, 13600, 22300, 28750),
            airParcelRate: { first500g: 3200, additional500g: 560, maxWeight: 30000 },
            seaMailAvailable: false,
            seaMailNote: "No direct surface mail consolidation to Vietnam",
            uPacketAvailable: true,
            tdsAvailable: false,
        },
        {
            code: "CN",
            name: "China",
            zoneId: "zone_b",
            group: "C",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(2750, 3450, 4700, 27750, 52600, 75200),
            airParcelRate: { first500g: 3900, additional500g: 1020, maxWeight: 30000 },
            seaParcelRate: { first1000g: 4850, additional1000g: 1490, maxWeight: 30000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: true,
        },
        {
            code: "HK",
            name: "Hong Kong",
            zoneId: "zone_b",
            group: "C",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(4900, 5200, 5850, 19300, 30700, 39900, { 1500: 6450, 2000: 7050, 2500: 10200 }),
            airParcelRate: { first500g: 5050, additional500g: 720, maxWeight: 30000 },
            seaParcelRate: { first1000g: 5300, additional1000g: 920, maxWeight: 30000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: true,
        },
        {
            code: "TW",
            name: "Taiwan",
            zoneId: "zone_b",
            group: "C",
            emsMaxWeight: 20000,
            maxParcelWeight: 20000,
            emsTiers: buildEmsTiers(4150, 4500, 5200, 17750, 30950),
            airParcelRate: { first500g: 3700, additional500g: 770, maxWeight: 20000 },
            seaMailAvailable: false,
            seaMailNote: "No bilateral Sea Mail service to Taiwan",
            uPacketAvailable: true,
            tdsAvailable: false,
        },
        {
            code: "JP",
            name: "Japan",
            zoneId: "zone_d",
            group: "D",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(4850, 5300, 6250, 23250, 41400, 57250),
            airParcelRate: { first500g: 4000, additional500g: 1000, maxWeight: 30000 },
            seaParcelRate: { first1000g: 4300, additional1000g: 830, maxWeight: 30000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: true,
        },
        {
            code: "KR",
            name: "South Korea",
            zoneId: "zone_d",
            group: "D",
            emsMaxWeight: 30000,
            maxParcelWeight: 20000,
            emsTiers: buildEmsTiers(4750, 5200, 6000, 20550, 36000, 49200),
            airParcelRate: { first500g: 4250, additional500g: 890, maxWeight: 20000 },
            seaParcelRate: { first1000g: 5400, additional1000g: 1730, maxWeight: 20000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: true,
        },

        // Europe & UK (Group D & E / zone_c)
        {
            code: "GB",
            name: "United Kingdom",
            zoneId: "zone_c",
            group: "E",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(7750, 8350, 9500, 30100, 52250, 72150),
            airParcelRate: { first500g: 6650, additional500g: 1510, maxWeight: 30000 },
            seaParcelRate: { first1000g: 7050, additional1000g: 1850, maxWeight: 30000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: true,
        },
        {
            code: "DE",
            name: "Germany",
            zoneId: "zone_c",
            group: "E",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(7350, 7950, 9000, 28400, 49200, 67750),
            airParcelRate: { first500g: 6650, additional500g: 1150, maxWeight: 30000 },
            seaParcelRate: { first1000g: 7200, additional1000g: 1190, maxWeight: 30000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: true,
            suspensionStatus: "restricted",
            restrictionNote: "EU Customs Rule: Commercial goods valued €45–€150 are restricted. Documents, gifts ≤€45 & parcels >€150 are accepted.",
        },
        {
            code: "FR",
            name: "France",
            zoneId: "zone_c",
            group: "E",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(5250, 5950, 7300, 31750, 58150, 82250),
            airParcelRate: { first500g: 5300, additional500g: 1150, maxWeight: 30000 },
            seaParcelRate: { first1000g: 5300, additional1000g: 1080, maxWeight: 30000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: true,
            suspensionStatus: "restricted",
            restrictionNote: "EU Customs Rule: Commercial goods valued €45–€150 are restricted. Documents, gifts ≤€45 & parcels >€150 are accepted.",
        },
        {
            code: "IT",
            name: "Italy",
            zoneId: "zone_c",
            group: "E",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(6050, 6600, 7650, 26850, 47450, 65800),
            airParcelRate: { first500g: 4550, additional500g: 1130, maxWeight: 30000 },
            seaParcelRate: { first1000g: 6000, additional1000g: 2260, maxWeight: 30000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: true,
            suspensionStatus: "restricted",
            restrictionNote: "EU Customs Rule: Commercial goods valued €45–€150 are restricted. Documents, gifts ≤€45 & parcels >€150 are accepted.",
        },
        {
            code: "NL",
            name: "Netherlands",
            zoneId: "zone_c",
            group: "E",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(5550, 6100, 7250, 27250, 48700, 67950),
            airParcelRate: { first500g: 4600, additional500g: 1160, maxWeight: 30000 },
            seaParcelRate: { first1000g: 5600, additional1000g: 1860, maxWeight: 30000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: true,
        },
        {
            code: "ES",
            name: "Spain",
            zoneId: "zone_c",
            group: "E",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(5650, 6300, 7500, 29250, 52700, 73900),
            airParcelRate: { first500g: 5000, additional500g: 1250, maxWeight: 30000 },
            seaParcelRate: { first1000g: 5900, additional1000g: 1850, maxWeight: 30000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: false,
            suspensionStatus: "restricted",
            restrictionNote: "EU Customs Rule: Commercial goods valued €45–€150 are restricted. Documents, gifts ≤€45 & parcels >€150 are accepted.",
        },
        {
            code: "BE",
            name: "Belgium",
            zoneId: "zone_c",
            group: "E",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(5350, 5950, 7050, 27050, 48550, 67750),
            airParcelRate: { first500g: 6500, additional500g: 1190, maxWeight: 30000 },
            seaMailAvailable: false,
            seaMailNote: "No direct surface mail consolidation to Belgium",
            uPacketAvailable: true,
            tdsAvailable: false,
            suspensionStatus: "restricted",
            restrictionNote: "EU Customs Rule: Commercial goods valued €45–€150 are restricted. Documents, gifts ≤€45 & parcels >€150 are accepted.",
        },
        {
            code: "SE",
            name: "Sweden",
            zoneId: "zone_c",
            group: "D",
            emsMaxWeight: 20000,
            maxParcelWeight: 20000,
            emsTiers: buildEmsTiers(8550, 9100, 10150, 28700, 48650),
            airParcelRate: { first500g: 5650, additional500g: 1110, maxWeight: 20000 },
            seaParcelRate: { first1000g: 8600, additional1000g: 1870, maxWeight: 20000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: false,
            suspensionStatus: "restricted",
            restrictionNote: "EU Customs Rule: Commercial goods valued €45–€150 are restricted. Documents, gifts ≤€45 & parcels >€150 are accepted.",
        },
        {
            code: "AT",
            name: "Austria",
            zoneId: "zone_c",
            group: "D",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(5650, 6200, 7200, 25200, 44400, 61400),
            airParcelRate: { first500g: 4750, additional500g: 1010, maxWeight: 30000 },
            seaParcelRate: { first1000g: 7650, additional1000g: 1720, maxWeight: 30000 },
            seaMailAvailable: false,
            seaMailNote: "Landlocked destination — no Sea Mail route",
            uPacketAvailable: true,
            tdsAvailable: false,
            suspensionStatus: "restricted",
            restrictionNote: "EU Customs Rule: Commercial goods valued €45–€150 are restricted.",
        },
        {
            code: "PL",
            name: "Poland",
            zoneId: "zone_c",
            group: "D",
            emsMaxWeight: 20000,
            maxParcelWeight: 20000,
            emsTiers: buildEmsTiers(4850, 5350, 6350, 24150, 43150),
            airParcelRate: { first500g: 4800, additional500g: 1120, maxWeight: 20000 },
            seaParcelRate: { first1000g: 7050, additional1000g: 2660, maxWeight: 20000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: false,
            suspensionStatus: "restricted",
            restrictionNote: "EU Customs Rule: Commercial goods valued €45–€150 are restricted.",
        },
        {
            code: "CH",
            name: "Switzerland",
            zoneId: "zone_c",
            group: "E",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(7450, 8000, 9100, 28700, 49700, 68500),
            airParcelRate: { first500g: 4450, additional500g: 1130, maxWeight: 30000 },
            seaParcelRate: { first1000g: 7300, additional1000g: 1770, maxWeight: 30000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: true,
        },
        {
            code: "IE",
            name: "Ireland",
            zoneId: "zone_c",
            group: "E",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(6350, 6950, 8150, 29550, 52600, 73400),
            airParcelRate: { first500g: 4400, additional500g: 1220, maxWeight: 30000 },
            seaParcelRate: { first1000g: 5300, additional1000g: 1840, maxWeight: 30000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: false,
        },
        {
            code: "DK",
            name: "Denmark",
            zoneId: "zone_c",
            group: "E",
            emsMaxWeight: 20000,
            maxParcelWeight: 20000,
            emsTiers: buildEmsTiers(6750, 7300, 8400, 27350, 47750),
            airParcelRate: { first500g: 5000, additional500g: 1080, maxWeight: 20000 },
            seaParcelRate: { first1000g: 6050, additional1000g: 1820, maxWeight: 20000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: false,
        },
        {
            code: "FI",
            name: "Finland",
            zoneId: "zone_c",
            group: "D",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(6350, 6900, 7900, 25900, 45150, 62100),
            airParcelRate: { first500g: 5900, additional500g: 1090, maxWeight: 30000 },
            seaParcelRate: { first1000g: 7050, additional1000g: 1950, maxWeight: 30000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: false,
        },
        {
            code: "NO",
            name: "Norway",
            zoneId: "zone_c",
            group: "E",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(8650, 9250, 10350, 29950, 50950, 69750),
            airParcelRate: { first500g: 6800, additional500g: 1240, maxWeight: 30000 },
            seaParcelRate: { first1000g: 12150, additional1000g: 6090, maxWeight: 30000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: false,
        },
        {
            code: "GR",
            name: "Greece",
            zoneId: "zone_c",
            group: "D",
            emsMaxWeight: 30000,
            maxParcelWeight: 20000,
            emsTiers: buildEmsTiers(5700, 6200, 7100, 23300, 40500, 55500),
            airParcelRate: { first500g: 3900, additional500g: 1010, maxWeight: 20000 },
            seaParcelRate: { first1000g: 4350, additional1000g: 1420, maxWeight: 20000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: false,
        },
        {
            code: "PT",
            name: "Portugal",
            zoneId: "zone_c",
            group: "E",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(4500, 5150, 6400, 28600, 52550, 74250),
            airParcelRate: { first500g: 5600, additional500g: 1330, maxWeight: 30000 },
            seaMailAvailable: false,
            seaMailNote: "No direct surface mail consolidation to Portugal",
            uPacketAvailable: true,
            tdsAvailable: false,
        },
        {
            code: "TR",
            name: "Turkey",
            zoneId: "zone_c",
            group: "D",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(4800, 5300, 6200, 22500, 39850, 54950),
            airParcelRate: { first500g: 5250, additional500g: 1170, maxWeight: 30000 },
            seaMailAvailable: false,
            seaMailNote: "No direct surface mail consolidation to Turkey",
            uPacketAvailable: true,
            tdsAvailable: false,
        },
        {
            code: "RU",
            name: "Russia",
            zoneId: "zone_c",
            group: "D",
            emsMaxWeight: 20000,
            maxParcelWeight: 20000,
            emsTiers: buildEmsTiers(4450, 5000, 6050, 31250, 64300, 82700, { 1500: 7150, 2000: 8200, 2500: 12500, 10500: 44750 }),
            airParcelRate: { first500g: 6550, additional500g: 1460, maxWeight: 20000 },
            seaParcelRate: { first1000g: 9850, additional1000g: 2520, maxWeight: 20000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: false,
            suspensionStatus: "restricted",
            restrictionNote: "Subject to transit airline routing schedules.",
        },
        {
            code: "UA",
            name: "Ukraine",
            zoneId: "zone_c",
            group: "D",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(6650, 7150, 8050, 24400, 41850, 57100),
            airParcelRate: { first500g: 6150, additional500g: 1060, maxWeight: 30000 },
            seaParcelRate: { first1000g: 8400, additional1000g: 3000, maxWeight: 30000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: false,
            suspensionStatus: "restricted",
            restrictionNote: "Air Mail & U-Packet active (June 2025 circular); EMS & Air Parcel subject to airspace restrictions.",
        },

        // Oceania, Americas & Africa
        {
            code: "AU",
            name: "Australia",
            zoneId: "zone_d",
            group: "E",
            emsMaxWeight: 20000,
            maxParcelWeight: 20000,
            emsTiers: buildEmsTiers(4350, 5200, 6850, 36400, 68450),
            airParcelRate: { first500g: 4450, additional500g: 1360, maxWeight: 20000 },
            seaParcelRate: { first1000g: 4250, additional1000g: 1070, maxWeight: 20000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: true,
        },
        {
            code: "NZ",
            name: "New Zealand",
            zoneId: "zone_d",
            group: "F",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(4100, 5100, 7050, 42100, 80350, 116350),
            airParcelRate: { first500g: 5250, additional500g: 1630, maxWeight: 30000 },
            seaParcelRate: { first1000g: 6100, additional1000g: 2200, maxWeight: 30000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: true,
        },
        {
            code: "US",
            name: "United States",
            zoneId: "zone_d",
            group: "H",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(8850, 9800, 11700, 45800, 82900, 117800),
            airParcelRate: { first500g: 5250, additional500g: 2360, maxWeight: 30000 },
            seaParcelRate: { first1000g: 4200, additional1000g: 1630, maxWeight: 30000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: true,
        },
        {
            code: "CA",
            name: "Canada",
            zoneId: "zone_d",
            group: "H",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(4750, 5950, 8250, 49900, 95400, 138650),
            airParcelRate: { first500g: 5850, additional500g: 2210, maxWeight: 30000 },
            seaParcelRate: { first1000g: 5500, additional1000g: 1830, maxWeight: 30000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: true,
        },
        {
            code: "BR",
            name: "Brazil",
            zoneId: "zone_d",
            group: "H",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(6200, 7100, 8900, 41500, 76900, 110100),
            airParcelRate: { first500g: 5350, additional500g: 2050, maxWeight: 30000 },
            seaMailAvailable: false,
            seaMailNote: "No bilateral Sea Mail container route to South America",
            uPacketAvailable: true,
            tdsAvailable: false,
        },
        {
            code: "ZA",
            name: "South Africa",
            zoneId: "zone_c",
            group: "D",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(5050, 5750, 7150, 32000, 58900, 83500),
            airParcelRate: { first500g: 4200, additional500g: 1050, maxWeight: 30000 },
            seaParcelRate: { first1000g: 4500, additional1000g: 1280, maxWeight: 30000 },
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: false,
        },
        {
            code: "EG",
            name: "Egypt",
            zoneId: "zone_b",
            group: "C",
            emsMaxWeight: 30000,
            maxParcelWeight: 30000,
            emsTiers: buildEmsTiers(4800, 5250, 6050, 21300, 37500, 51450),
            airParcelRate: { first500g: 4050, additional500g: 1010, maxWeight: 30000 },
            seaMailAvailable: false,
            seaMailNote: "No direct Sea Mail consolidation to Egypt",
            uPacketAvailable: true,
            tdsAvailable: false,
        },
    ],
    extraFees: {
        registeredPost: 60,
        foreignRegisteredPost: 870,
        arReceipt: 100,
        cod: 50,
        vpp: 50,
        postcard: 40,
        stampedEnvelopeSmall: 80,
        stampedEnvelopeLarge: 90,
    },
};

/**
 * Formats a weight in grams into a compact human-readable label.
 */
export function formatWeightLabel(grams: number): string {
    if (grams >= 1000) {
        const kg = grams / 1000;
        return `${Number.isInteger(kg) ? kg : kg.toFixed(2).replace(/\.?0+$/, "")}kg`;
    }
    return `${grams}g`;
}

/**
 * Formats a tier bracket range (e.g., "30g < W ≤ 40g" or "Flat rate").
 */
export function formatTierBracket(tiers: WeightTier[], matchedIndex: number, flatRate?: boolean): string {
    if (flatRate) return "Flat rate";
    const tier = tiers[matchedIndex];
    if (!tier) return "";
    const prevMax = matchedIndex > 0 ? tiers[matchedIndex - 1].maxWeight : 0;
    return `${formatWeightLabel(prevMax)} < W ≤ ${formatWeightLabel(tier.maxWeight)}`;
}

/**
 * Normalizes and merges stored DB rate variables with the official Feb 9, 2026 defaults,
 * automatically upgrading legacy 3-service seeds while preserving full admin customizations.
 */
export function mergeWithDefaultConfig(loaded: Partial<RateConfig>): RateConfig {
    const defaultById = new Map(DEFAULT_RATE_CONFIG.domesticServices.map((s) => [s.id, s]));
    const loadedServices = Array.isArray(loaded.domesticServices) ? loaded.domesticServices : [];

    // Legacy seeds only used "oletter", "sp", "lop", or "dparcel"
    const hasCanonicalService = loadedServices.some((s) => defaultById.has(s.id));

    let domesticServices: PostalService[];
    if (!hasCanonicalService) {
        domesticServices = DEFAULT_RATE_CONFIG.domesticServices;
    } else {
        const loadedById = new Map(loadedServices.map((s) => [s.id, s]));
        domesticServices = DEFAULT_RATE_CONFIG.domesticServices.map((def) => {
            const custom = loadedById.get(def.id);
            if (!custom || !Array.isArray(custom.tiers) || custom.tiers.length === 0) {
                return def;
            }
            const isLegacyCourierName = def.id === "courier" && custom.name === "SL Post Courier";
            return {
                ...def,
                ...custom,
                name: isLegacyCourierName ? def.name : custom.name,
                shortName: isLegacyCourierName ? def.shortName : (custom.shortName || def.shortName),
                description: isLegacyCourierName ? def.description : (custom.description || def.description),
                flatRate: custom.flatRate ?? def.flatRate,
                supportsRegistration: custom.supportsRegistration ?? def.supportsRegistration,
                supportsAr: custom.supportsAr ?? def.supportsAr,
                supportsInsurance: custom.supportsInsurance ?? def.supportsInsurance,
            };
        });

        // Append any extra custom services created by an admin (drop retired speed_post/sp)
        for (const s of loadedServices) {
            if (
                !defaultById.has(s.id) &&
                s.id !== "speed_post" &&
                s.id !== "sp" &&
                Array.isArray(s.tiers) &&
                s.tiers.length > 0
            ) {
                domesticServices.push(s);
            }
        }
    }

    const defaultZoneIds = new Set(DEFAULT_RATE_CONFIG.emsZones.map((z) => z.id));
    const hasCanonicalZones = Array.isArray(loaded.emsZones) && loaded.emsZones.some((z) => defaultZoneIds.has(z.id));
    const emsZones = hasCanonicalZones && loaded.emsZones!.length > 0 ? loaded.emsZones! : DEFAULT_RATE_CONFIG.emsZones;

    let emsCountries: EmsCountry[];
    if (hasCanonicalZones && Array.isArray(loaded.emsCountries) && loaded.emsCountries.length > 0) {
        const loadedByCode = new Map(loaded.emsCountries.map((c) => [c.code.toUpperCase(), c]));
        const defaultCodes = new Set(DEFAULT_RATE_CONFIG.emsCountries.map((c) => c.code));
        emsCountries = DEFAULT_RATE_CONFIG.emsCountries.map((def) => {
            const custom = loadedByCode.get(def.code);
            if (!custom) return def;
            const hasCustomEmsTiers = Array.isArray(custom.emsTiers) && custom.emsTiers.length > 0;
            return {
                ...def,
                ...custom,
                group: hasCustomEmsTiers ? (custom.group ?? def.group) : def.group,
                emsMaxWeight: custom.emsMaxWeight ?? def.emsMaxWeight,
                maxParcelWeight: custom.maxParcelWeight ?? def.maxParcelWeight,
                emsTiers: hasCustomEmsTiers ? custom.emsTiers : def.emsTiers,
                airParcelRate: custom.airParcelRate ?? def.airParcelRate,
                seaParcelRate: custom.seaParcelRate ?? def.seaParcelRate,
                seaMailAvailable: hasCustomEmsTiers ? (custom.seaMailAvailable ?? def.seaMailAvailable) : def.seaMailAvailable,
                seaMailNote: hasCustomEmsTiers ? (custom.seaMailNote ?? def.seaMailNote) : def.seaMailNote,
                uPacketAvailable: hasCustomEmsTiers ? (custom.uPacketAvailable ?? def.uPacketAvailable) : def.uPacketAvailable,
                uPacketNote: hasCustomEmsTiers ? (custom.uPacketNote ?? def.uPacketNote) : def.uPacketNote,
                tdsAvailable: hasCustomEmsTiers ? (custom.tdsAvailable ?? def.tdsAvailable) : def.tdsAvailable,
                tdsNote: hasCustomEmsTiers ? (custom.tdsNote ?? def.tdsNote) : def.tdsNote,
                suspensionStatus: hasCustomEmsTiers ? (custom.suspensionStatus ?? def.suspensionStatus) : def.suspensionStatus,
                restrictionNote: hasCustomEmsTiers ? (custom.restrictionNote ?? def.restrictionNote) : def.restrictionNote,
                unavailableServices: hasCustomEmsTiers ? (custom.unavailableServices ?? def.unavailableServices) : def.unavailableServices,
            };
        });
        for (const custom of loaded.emsCountries) {
            if (!defaultCodes.has(custom.code.toUpperCase())) {
                emsCountries.push(custom);
            }
        }
    } else {
        emsCountries = DEFAULT_RATE_CONFIG.emsCountries;
    }

    const loadedExtra = loaded.extraFees;
    const extraFees: ExtraFees = {
        ...DEFAULT_RATE_CONFIG.extraFees,
        ...(loadedExtra || {}),
        registeredPost: loadedExtra?.registeredPost ?? DEFAULT_RATE_CONFIG.extraFees.registeredPost,
        foreignRegisteredPost:
            loadedExtra?.foreignRegisteredPost ?? DEFAULT_RATE_CONFIG.extraFees.foreignRegisteredPost,
        arReceipt: loadedExtra?.arReceipt ?? DEFAULT_RATE_CONFIG.extraFees.arReceipt,
        cod: !hasCanonicalService ? DEFAULT_RATE_CONFIG.extraFees.cod : (loadedExtra?.cod ?? DEFAULT_RATE_CONFIG.extraFees.cod),
    };

    return { domesticServices, emsZones, emsCountries, extraFees };
}

/**
 * Calculates Electronic Money Order (PMT) commission per Circular Item 16.i.
 * Maximum Money Order amount is LKR 100,000 (LKR 25,000 at Sub-Post Offices).
 */
export function calculatePmtCommission(amount: number): { fee: number; error?: string } {
    if (!Number.isFinite(amount) || amount <= 0) {
        return { fee: 0, error: "Enter a collection amount greater than 0" };
    }
    if (amount > 100000) {
        return { fee: 0, error: "Maximum COD / Money Order amount is LKR 100,000" };
    }
    if (amount <= 2000) {
        return { fee: Math.ceil(amount / 100) * 2 };
    }
    if (amount <= 10000) {
        return { fee: 40 + Math.ceil((amount - 2000) / 2000) * 10 };
    }
    if (amount <= 50000) {
        return { fee: 80 + Math.ceil((amount - 10000) / 40000) * 50 };
    }
    return { fee: 130 + Math.ceil((amount - 50000) / 50000) * 100 };
}

/**
 * Calculates Cash on Delivery (COD) postage breakdown per Circular Items 12, 16.i, and 24:
 * SL Post Courier Fee (by weight) + PMT Money Order Commission (by amount) + Fixed COD Fee (Rs. 50).
 */
export function calculateCodPostage(
    config: RateConfig,
    weightGrams: number,
    collectAmount: number
): CodPostageResult {
    const codServiceFee = config.extraFees.cod ?? 50;
    const courierService =
        config.domesticServices.find((s) => s.id === "courier") ||
        config.domesticServices.find((s) => s.id === "sp");

    if (!courierService || courierService.tiers.length === 0) {
        return {
            courierFee: 0,
            moneyOrderFee: 0,
            codServiceFee,
            totalCost: 0,
            netRemittance: 0,
            tierLabel: "",
            subPostOfficeWarning: false,
            error: "SL Post Courier rates not configured",
        };
    }

    if (!Number.isFinite(weightGrams) || weightGrams <= 0) {
        return {
            courierFee: 0,
            moneyOrderFee: 0,
            codServiceFee,
            totalCost: 0,
            netRemittance: 0,
            tierLabel: "",
            subPostOfficeWarning: false,
            error: "Enter a weight greater than 0g",
        };
    }

    const sortedTiers = [...courierService.tiers].sort((a, b) => a.maxWeight - b.maxWeight);
    const matchedIdx = sortedTiers.findIndex((t) => weightGrams <= t.maxWeight);

    if (matchedIdx === -1) {
        const maxAllowed = sortedTiers[sortedTiers.length - 1].maxWeight;
        return {
            courierFee: 0,
            moneyOrderFee: 0,
            codServiceFee,
            totalCost: 0,
            netRemittance: 0,
            tierLabel: "",
            subPostOfficeWarning: false,
            error: `Max COD weight is ${formatWeightLabel(maxAllowed)}`,
        };
    }

    const pmt = calculatePmtCommission(collectAmount);
    if (pmt.error) {
        return {
            courierFee: sortedTiers[matchedIdx].price,
            moneyOrderFee: 0,
            codServiceFee,
            totalCost: 0,
            netRemittance: 0,
            tierLabel: formatTierBracket(sortedTiers, matchedIdx),
            subPostOfficeWarning: false,
            error: pmt.error,
        };
    }

    const courierFee = sortedTiers[matchedIdx].price;
    const totalCost = courierFee + pmt.fee + codServiceFee;

    return {
        courierFee,
        moneyOrderFee: pmt.fee,
        codServiceFee,
        totalCost,
        netRemittance: Math.max(0, collectAmount - totalCost),
        tierLabel: formatTierBracket(sortedTiers, matchedIdx),
        subPostOfficeWarning: collectAmount > 25000,
    };
}

export interface PostageOptions {
    registered?: boolean;
    arReceipt?: boolean;
    cod?: boolean;
}

/**
 * Calculates postage for a single domestic service or international EMS destination.
 */
export function calculatePostage(
    config: RateConfig,
    destination: Destination,
    serviceId: string,
    weightGrams: number,
    registeredOrOptions: boolean | PostageOptions = false,
    legacyCod: boolean = false
): PostageResult {
    const opts: PostageOptions =
        typeof registeredOrOptions === "boolean"
            ? { registered: registeredOrOptions, cod: legacyCod }
            : registeredOrOptions;

    if (!Number.isFinite(weightGrams) || weightGrams <= 0) {
        return {
            baseCost: 0,
            registrationFee: 0,
            arReceiptFee: 0,
            codFee: 0,
            totalCost: 0,
            tierLabel: "",
            error: "Enter weight > 0g",
        };
    }

    let tiers: WeightTier[] | undefined;
    let service: PostalService | undefined;

    if (destination === "domestic") {
        service = config.domesticServices.find((s) => s.id === serviceId);
        if (!service) {
            return {
                baseCost: 0,
                registrationFee: 0,
                arReceiptFee: 0,
                codFee: 0,
                totalCost: 0,
                tierLabel: "",
                error: "Invalid domestic service selected",
            };
        }
        tiers = service.tiers;
    } else if (destination === "ems") {
        const country = config.emsCountries.find((c) => c.code === serviceId);
        if (!country) {
            return {
                baseCost: 0,
                registrationFee: 0,
                arReceiptFee: 0,
                codFee: 0,
                totalCost: 0,
                tierLabel: "",
                error: "Invalid EMS destination selected",
            };
        }
        if (country.emsTiers && country.emsTiers.length > 0) {
            tiers = country.emsMaxWeight
                ? country.emsTiers.filter((t) => t.maxWeight <= country.emsMaxWeight!)
                : country.emsTiers;
        } else {
            const zone = config.emsZones.find((z) => z.id === country.zoneId);
            if (!zone) {
                return {
                    baseCost: 0,
                    registrationFee: 0,
                    arReceiptFee: 0,
                    codFee: 0,
                    totalCost: 0,
                    tierLabel: "",
                    error: "Zone not configured for this country",
                };
            }
            tiers = country.emsMaxWeight
                ? zone.tiers.filter((t) => t.maxWeight <= country.emsMaxWeight!)
                : zone.tiers;
        }
    }

    if (!tiers || tiers.length === 0) {
        return {
            baseCost: 0,
            registrationFee: 0,
            arReceiptFee: 0,
            codFee: 0,
            totalCost: 0,
            tierLabel: "",
            error: "No rate tiers configured for this service",
        };
    }

    const sortedTiers = [...tiers].sort((a, b) => a.maxWeight - b.maxWeight);
    const maxAllowed = sortedTiers[sortedTiers.length - 1].maxWeight;

    // Flat-rate items (such as Postcards) always use their single flat tier price.
    if (service?.flatRate) {
        const flatPrice = sortedTiers[0].price;
        const registrationFee = opts.registered && service.supportsRegistration ? (config.extraFees.registeredPost ?? 60) : 0;
        const arReceiptFee = opts.arReceipt && service.supportsAr ? (config.extraFees.arReceipt ?? 100) : 0;
        return {
            baseCost: flatPrice,
            registrationFee,
            arReceiptFee,
            codFee: 0,
            totalCost: flatPrice + registrationFee + arReceiptFee,
            tierLabel: "Flat rate",
            maxWeight: maxAllowed,
        };
    }

    const matchedIdx = sortedTiers.findIndex((t) => weightGrams <= t.maxWeight);

    if (matchedIdx === -1) {
        return {
            baseCost: 0,
            registrationFee: 0,
            arReceiptFee: 0,
            codFee: 0,
            totalCost: 0,
            tierLabel: "",
            maxWeight: maxAllowed,
            exceedsMaxWeight: true,
            error: `Max ${formatWeightLabel(maxAllowed)}`,
        };
    }

    const tier = sortedTiers[matchedIdx];
    const registrationFee =
        destination === "domestic" && opts.registered && (service?.supportsRegistration ?? true)
            ? (config.extraFees.registeredPost ?? 60)
            : 0;
    const arReceiptFee =
        destination === "domestic" && opts.arReceipt && (service?.supportsAr ?? false)
            ? (config.extraFees.arReceipt ?? 100)
            : 0;
    const codFee =
        destination === "domestic" && opts.cod
            ? (config.extraFees.cod ?? 50)
            : 0;

    return {
        baseCost: tier.price,
        registrationFee,
        arReceiptFee,
        codFee,
        totalCost: tier.price + registrationFee + arReceiptFee + codFee,
        tierLabel: formatTierBracket(sortedTiers, matchedIdx),
        maxWeight: maxAllowed,
    };
}

/**
 * Evaluates all domestic services simultaneously for a given weight and add-on options.
 */
export function calculateAllDomesticServices(
    config: RateConfig,
    weightGrams: number,
    options: PostageOptions = {}
): DomesticServiceQuote[] {
    return config.domesticServices.map((service) => ({
        service,
        result: calculatePostage(config, "domestic", service.id, weightGrams, options),
    }));
}

// =============================================================================
// International Mail Services (Air Mail, U-Packet, TDS, Air Parcel, EMS, Sea Mail)
// =============================================================================

export interface InternationalServiceMeta {
    id: InternationalServiceId;
    name: string;
    shortName: string;
    transport: InternationalTransport;
    maxWeight: number;
    supportsRegistration: boolean;
    description: string;
}

export interface InternationalServiceQuote {
    service: InternationalServiceMeta;
    available: boolean;
    unavailableReason?: string;
    shortUnavailableTag?: string;
    result: PostageResult;
}

export const INTERNATIONAL_SERVICES: InternationalServiceMeta[] = [
    {
        id: "air_letter",
        name: "Air Mail Letter",
        shortName: "Air Letter",
        transport: "air",
        maxWeight: 2000,
        supportsRegistration: true,
        description: "Normal or registered international letter up to 2 kg",
    },
    {
        id: "air_printed",
        name: "Printed Matter / Open Packet",
        shortName: "Printed Matter",
        transport: "air",
        maxWeight: 2000,
        supportsRegistration: true,
        description: "Books, printed papers & open packets up to 2 kg",
    },
    {
        id: "u_packet",
        name: "U-Packet (Tracked Small Packet)",
        shortName: "U-Packet",
        transport: "air",
        maxWeight: 2000,
        supportsRegistration: false,
        description: "UPU tracked small packet for lightweight goods up to 2 kg",
    },
    {
        id: "tds",
        name: "TDS (Tracked Delivery Service)",
        shortName: "TDS Tracked",
        transport: "air",
        maxWeight: 2000,
        supportsRegistration: false,
        description: "Priority tracked delivery service up to 2 kg",
    },
    {
        id: "air_parcel",
        name: "Air Mail Parcel",
        shortName: "Air Parcel",
        transport: "air",
        maxWeight: 20000,
        supportsRegistration: false,
        description: "Standard international air parcel up to 20 kg",
    },
    {
        id: "ems",
        name: "International EMS (Expedited Mail)",
        shortName: "EMS Express",
        transport: "air",
        maxWeight: 30000,
        supportsRegistration: false,
        description: "Express priority courier documents & merchandise up to 30 kg",
    },
    {
        id: "sea_letter",
        name: "Sea Mail Letter",
        shortName: "Sea Letter",
        transport: "sea",
        maxWeight: 2000,
        supportsRegistration: true,
        description: "Surface maritime letter up to 2 kg",
    },
    {
        id: "sea_printed",
        name: "Sea Printed Matter / Small Packet",
        shortName: "Sea Printed",
        transport: "sea",
        maxWeight: 2000,
        supportsRegistration: true,
        description: "Surface maritime printed papers & small packets up to 2 kg",
    },
    {
        id: "sea_parcel",
        name: "Sea Mail Parcel",
        shortName: "Sea Parcel",
        transport: "sea",
        maxWeight: 20000,
        supportsRegistration: false,
        description: "Economy maritime parcel up to 20 kg",
    },
];

interface GroupStepRate {
    baseWeight: number;
    stepWeight: number;
    groups: Record<CountryGroup, { base: number; step: number }>;
}

/**
 * Official Tracked Delivery Service (TDS) rates w.e.f. 01.10.2025 (TDPostage.pdf).
 */
const TDS_GROUP_TIERS: Record<CountryGroup, WeightTier[]> = {
    A: [
        { maxWeight: 250, price: 1260 },
        { maxWeight: 500, price: 2130 },
        { maxWeight: 1000, price: 3900 },
        { maxWeight: 2000, price: 7420 },
    ],
    B: [
        { maxWeight: 250, price: 1380 },
        { maxWeight: 500, price: 2380 },
        { maxWeight: 1000, price: 4390 },
        { maxWeight: 2000, price: 8410 },
    ],
    C: [
        { maxWeight: 250, price: 1500 },
        { maxWeight: 500, price: 2620 },
        { maxWeight: 1000, price: 4860 },
        { maxWeight: 2000, price: 9360 },
    ],
    D: [
        { maxWeight: 250, price: 1620 },
        { maxWeight: 500, price: 2865 },
        { maxWeight: 1000, price: 5360 },
        { maxWeight: 2000, price: 10350 },
    ],
    E: [
        { maxWeight: 250, price: 1740 },
        { maxWeight: 500, price: 3100 },
        { maxWeight: 1000, price: 5830 },
        { maxWeight: 2000, price: 11290 },
    ],
    F: [
        { maxWeight: 250, price: 1860 },
        { maxWeight: 500, price: 3340 },
        { maxWeight: 1000, price: 6300 },
        { maxWeight: 2000, price: 12240 },
    ],
    G: [
        { maxWeight: 250, price: 2000 },
        { maxWeight: 500, price: 3620 },
        { maxWeight: 1000, price: 6870 },
        { maxWeight: 2000, price: 13370 },
    ],
    H: [
        { maxWeight: 250, price: 2570 },
        { maxWeight: 500, price: 4765 },
        { maxWeight: 1000, price: 9160 },
        { maxWeight: 2000, price: 17950 },
    ],
};

const GROUP_STEP_TABLES: Partial<Record<InternationalServiceId, GroupStepRate>> = {
    air_letter: {
        baseWeight: 20,
        stepWeight: 10,
        groups: {
            A: { base: 110, step: 35 },
            B: { base: 120, step: 40 },
            C: { base: 130, step: 40 },
            D: { base: 140, step: 45 },
            E: { base: 150, step: 50 },
            F: { base: 160, step: 55 },
            G: { base: 170, step: 60 },
            H: { base: 210, step: 85 },
        },
    },
    air_printed: {
        baseWeight: 20,
        stepWeight: 10,
        groups: {
            A: { base: 105, step: 35 },
            B: { base: 115, step: 40 },
            C: { base: 120, step: 40 },
            D: { base: 130, step: 45 },
            E: { base: 140, step: 50 },
            F: { base: 150, step: 55 },
            G: { base: 160, step: 60 },
            H: { base: 205, step: 85 },
        },
    },
    u_packet: {
        baseWeight: 50,
        stepWeight: 50,
        groups: {
            A: { base: 240, step: 170 },
            B: { base: 260, step: 195 },
            C: { base: 280, step: 215 },
            D: { base: 300, step: 240 },
            E: { base: 330, step: 260 },
            F: { base: 350, step: 285 },
            G: { base: 380, step: 310 },
            H: { base: 480, step: 420 },
        },
    },
    air_parcel: {
        baseWeight: 500,
        stepWeight: 500,
        groups: {
            A: { base: 2600, step: 750 },
            B: { base: 3100, step: 900 },
            C: { base: 3500, step: 1050 },
            D: { base: 3900, step: 1250 },
            E: { base: 4400, step: 1450 },
            F: { base: 4900, step: 1650 },
            G: { base: 5400, step: 1850 },
            H: { base: 6100, step: 2200 },
        },
    },
    sea_parcel: {
        baseWeight: 1000,
        stepWeight: 1000,
        groups: {
            A: { base: 2200, step: 600 },
            B: { base: 2500, step: 700 },
            C: { base: 2800, step: 800 },
            D: { base: 3100, step: 900 },
            E: { base: 3400, step: 1000 },
            F: { base: 3700, step: 1100 },
            G: { base: 4000, step: 1200 },
            H: { base: 4400, step: 1350 },
        },
    },
};

const SURFACE_FIXED_TIERS: Partial<Record<InternationalServiceId, WeightTier[]>> = {
    sea_letter: [
        { maxWeight: 20, price: 130 },
        { maxWeight: 50, price: 240 },
        { maxWeight: 100, price: 440 },
        { maxWeight: 250, price: 1020 },
        { maxWeight: 500, price: 1980 },
        { maxWeight: 1000, price: 3920 },
        { maxWeight: 2000, price: 7780 },
    ],
    sea_printed: [
        { maxWeight: 20, price: 120 },
        { maxWeight: 50, price: 230 },
        { maxWeight: 100, price: 410 },
        { maxWeight: 250, price: 970 },
        { maxWeight: 500, price: 1900 },
        { maxWeight: 1000, price: 3760 },
        { maxWeight: 2000, price: 7480 },
    ],
};

function resolveCountryGroup(country: EmsCountry): CountryGroup {
    if (country.group) return country.group;
    switch (country.zoneId) {
        case "zone_a":
            return "A";
        case "zone_b":
            return "B";
        case "zone_c":
            return "E";
        default:
            return "H";
    }
}

function getServiceAvailability(
    country: EmsCountry,
    service: InternationalServiceMeta
): { available: boolean; reason?: string; shortTag?: string } {
    if (country.suspensionStatus === "suspended") {
        return {
            available: false,
            reason:
                country.unavailableServices?.[service.id] ??
                country.restrictionNote ??
                `${country.name} postal services are currently suspended by Sri Lanka Post.`,
            shortTag: "Suspended",
        };
    }

    const explicitReason = country.unavailableServices?.[service.id];
    if (explicitReason) {
        return {
            available: false,
            reason: explicitReason,
            shortTag: "Unavailable",
        };
    }

    if (service.transport === "sea" && country.seaMailAvailable === false) {
        return {
            available: false,
            reason: country.seaMailNote ?? `No bilateral Sea Mail container route from Sri Lanka Post to ${country.name}.`,
            shortTag: "No Sea Route",
        };
    }

    if (service.id === "u_packet" && country.uPacketAvailable === false) {
        return {
            available: false,
            reason: country.uPacketNote ?? `No bilateral UPU U-Packet e-commerce agreement with ${country.name}.`,
            shortTag: "No U-Packet",
        };
    }

    if (service.id === "tds" && !country.tdsAvailable) {
        return {
            available: false,
            reason: country.tdsNote ?? `TDS Tracked service is only available to designated bilateral partner countries (not active for ${country.name}).`,
            shortTag: "No TDS",
        };
    }

    return { available: true };
}

function calculateStepBracket(
    weightGrams: number,
    baseWeight: number,
    basePrice: number,
    stepWeight: number,
    stepPrice: number,
    maxWeight: number
): { price: number; tierLabel: string } {
    if (weightGrams <= baseWeight) {
        return {
            price: basePrice,
            tierLabel: `0g < W ≤ ${formatWeightLabel(baseWeight)}`,
        };
    }
    const steps = Math.ceil((weightGrams - baseWeight) / stepWeight);
    const prevUpper = baseWeight + (steps - 1) * stepWeight;
    const upper = Math.min(maxWeight, baseWeight + steps * stepWeight);
    return {
        price: basePrice + steps * stepPrice,
        tierLabel: `${formatWeightLabel(prevUpper)} < W ≤ ${formatWeightLabel(upper)}`,
    };
}

/**
 * Calculates postage and availability for a specific international service and destination country.
 */
export function calculateInternationalService(
    config: RateConfig,
    countryCode: string,
    intlServiceId: InternationalServiceId,
    weightGrams: number,
    options: { registered?: boolean } = {}
): InternationalServiceQuote {
    const service = INTERNATIONAL_SERVICES.find((s) => s.id === intlServiceId) ?? INTERNATIONAL_SERVICES[0];
    const country = config.emsCountries.find((c) => c.code === countryCode);

    if (!country) {
        return {
            service,
            available: false,
            unavailableReason: "Selected destination country is not in the active tariff schedule.",
            shortUnavailableTag: "Unlisted",
            result: {
                baseCost: 0,
                registrationFee: 0,
                arReceiptFee: 0,
                codFee: 0,
                totalCost: 0,
                tierLabel: "",
                maxWeight: service.maxWeight,
                error: "Destination country not found",
            },
        };
    }

    const effectiveMaxWeight =
        service.id === "ems"
            ? (country.emsMaxWeight ?? service.maxWeight)
            : service.id === "air_parcel"
                ? (country.airParcelRate?.maxWeight ?? country.maxParcelWeight ?? service.maxWeight)
                : service.id === "sea_parcel"
                    ? (country.seaParcelRate?.maxWeight ?? country.maxParcelWeight ?? service.maxWeight)
                    : service.maxWeight;

    const availability = getServiceAvailability(country, service);
    if (!availability.available) {
        return {
            service,
            available: false,
            unavailableReason: availability.reason,
            shortUnavailableTag: availability.shortTag,
            result: {
                baseCost: 0,
                registrationFee: 0,
                arReceiptFee: 0,
                codFee: 0,
                totalCost: 0,
                tierLabel: "",
                maxWeight: effectiveMaxWeight,
                error: availability.reason,
            },
        };
    }

    if (!Number.isFinite(weightGrams) || weightGrams <= 0) {
        return {
            service,
            available: true,
            result: {
                baseCost: 0,
                registrationFee: 0,
                arReceiptFee: 0,
                codFee: 0,
                totalCost: 0,
                tierLabel: "",
                maxWeight: effectiveMaxWeight,
                error: "Enter weight > 0g",
            },
        };
    }

    if (service.id === "ems") {
        const emsRes = calculatePostage(config, "ems", country.code, weightGrams);
        return {
            service,
            available: true,
            result: emsRes,
        };
    }

    if (weightGrams > effectiveMaxWeight) {
        return {
            service,
            available: true,
            result: {
                baseCost: 0,
                registrationFee: 0,
                arReceiptFee: 0,
                codFee: 0,
                totalCost: 0,
                tierLabel: "",
                maxWeight: effectiveMaxWeight,
                exceedsMaxWeight: true,
                error: `Max ${formatWeightLabel(effectiveMaxWeight)}`,
            },
        };
    }

    const foreignRegFee =
        options.registered && service.supportsRegistration
            ? (config.extraFees.foreignRegisteredPost ?? 870)
            : 0;

    if (service.id === "tds") {
        const group = resolveCountryGroup(country);
        const tdsTiers = TDS_GROUP_TIERS[group];
        const matchedIdx = tdsTiers.findIndex((t) => weightGrams <= t.maxWeight);
        const idx = matchedIdx === -1 ? tdsTiers.length - 1 : matchedIdx;
        const tier = tdsTiers[idx];
        return {
            service,
            available: true,
            result: {
                baseCost: tier.price,
                registrationFee: 0,
                arReceiptFee: 0,
                codFee: 0,
                totalCost: tier.price,
                tierLabel: formatTierBracket(tdsTiers, idx),
                maxWeight: effectiveMaxWeight,
            },
        };
    }

    if (service.id === "air_parcel" && country.airParcelRate) {
        const { price, tierLabel } = calculateStepBracket(
            weightGrams,
            500,
            country.airParcelRate.first500g,
            500,
            country.airParcelRate.additional500g,
            effectiveMaxWeight
        );
        return {
            service,
            available: true,
            result: {
                baseCost: price,
                registrationFee: 0,
                arReceiptFee: 0,
                codFee: 0,
                totalCost: price,
                tierLabel,
                maxWeight: effectiveMaxWeight,
            },
        };
    }

    if (service.id === "sea_parcel" && country.seaParcelRate) {
        const { price, tierLabel } = calculateStepBracket(
            weightGrams,
            1000,
            country.seaParcelRate.first1000g,
            1000,
            country.seaParcelRate.additional1000g,
            effectiveMaxWeight
        );
        return {
            service,
            available: true,
            result: {
                baseCost: price,
                registrationFee: 0,
                arReceiptFee: 0,
                codFee: 0,
                totalCost: price,
                tierLabel,
                maxWeight: effectiveMaxWeight,
            },
        };
    }

    const surfaceTiers = SURFACE_FIXED_TIERS[service.id];
    if (surfaceTiers) {
        const matchedIdx = surfaceTiers.findIndex((t) => weightGrams <= t.maxWeight);
        const tier = surfaceTiers[matchedIdx === -1 ? surfaceTiers.length - 1 : matchedIdx];
        return {
            service,
            available: true,
            result: {
                baseCost: tier.price,
                registrationFee: foreignRegFee,
                arReceiptFee: 0,
                codFee: 0,
                totalCost: tier.price + foreignRegFee,
                tierLabel: formatTierBracket(surfaceTiers, matchedIdx === -1 ? surfaceTiers.length - 1 : matchedIdx),
                maxWeight: effectiveMaxWeight,
            },
        };
    }

    const stepTable = GROUP_STEP_TABLES[service.id];
    if (!stepTable) {
        return {
            service,
            available: false,
            unavailableReason: "Rate schedule not configured",
            shortUnavailableTag: "Unavailable",
            result: {
                baseCost: 0,
                registrationFee: 0,
                arReceiptFee: 0,
                codFee: 0,
                totalCost: 0,
                tierLabel: "",
                maxWeight: effectiveMaxWeight,
                error: "Rate schedule not configured",
            },
        };
    }

    const group = resolveCountryGroup(country);
    const { base, step } = stepTable.groups[group];
    const { price, tierLabel } = calculateStepBracket(
        weightGrams,
        stepTable.baseWeight,
        base,
        stepTable.stepWeight,
        step,
        effectiveMaxWeight
    );

    return {
        service,
        available: true,
        result: {
            baseCost: price,
            registrationFee: foreignRegFee,
            arReceiptFee: 0,
            codFee: 0,
            totalCost: price + foreignRegFee,
            tierLabel,
            maxWeight: effectiveMaxWeight,
        },
    };
}

/**
 * Evaluates all international mail services (Air Mail & Sea Mail) for a country and weight.
 */
export function calculateAllInternationalServices(
    config: RateConfig,
    countryCode: string,
    weightGrams: number,
    options: { registered?: boolean } = {}
): InternationalServiceQuote[] {
    return INTERNATIONAL_SERVICES.map((service) =>
        calculateInternationalService(config, countryCode, service.id, weightGrams, options)
    );
}
