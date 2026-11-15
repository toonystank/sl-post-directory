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
            name: "SL Post Courier",
            shortName: "SLP Courier",
            description: "Tracked courier service up to 40 kg",
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
            id: "speed_post",
            name: "Inland Speed Post",
            shortName: "Speed Post",
            description: "Express tracked delivery up to 10 kg",
            supportsRegistration: false,
            supportsAr: false,
            tiers: [
                { maxWeight: 20, price: 65 },
                { maxWeight: 40, price: 75 },
                { maxWeight: 60, price: 85 },
                { maxWeight: 80, price: 95 },
                { maxWeight: 100, price: 105 },
                { maxWeight: 150, price: 110 },
                { maxWeight: 200, price: 115 },
                { maxWeight: 250, price: 120 },
                { maxWeight: 300, price: 150 },
                { maxWeight: 400, price: 210 },
                { maxWeight: 450, price: 240 },
                { maxWeight: 500, price: 270 },
                { maxWeight: 600, price: 330 },
                { maxWeight: 700, price: 390 },
                { maxWeight: 750, price: 420 },
                { maxWeight: 800, price: 450 },
                { maxWeight: 900, price: 510 },
                { maxWeight: 1000, price: 570 },
                { maxWeight: 1250, price: 620 },
                { maxWeight: 1500, price: 670 },
                { maxWeight: 1750, price: 720 },
                { maxWeight: 2000, price: 770 },
                { maxWeight: 3000, price: 870 },
                { maxWeight: 4000, price: 970 },
                { maxWeight: 5000, price: 1070 },
                { maxWeight: 6000, price: 1170 },
                { maxWeight: 7000, price: 1270 },
                { maxWeight: 8000, price: 1370 },
                { maxWeight: 9000, price: 1470 },
                { maxWeight: 10000, price: 1570 },
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
            tiers: [
                { maxWeight: 250, price: 4200 },
                { maxWeight: 500, price: 5400 },
                { maxWeight: 1000, price: 7800 },
                { maxWeight: 1500, price: 9900 },
                { maxWeight: 2000, price: 12000 },
                { maxWeight: 3000, price: 16200 },
                { maxWeight: 5000, price: 24600 },
                { maxWeight: 10000, price: 45600 },
                { maxWeight: 20000, price: 87600 },
                { maxWeight: 30000, price: 129600 },
            ],
        },
        {
            id: "zone_b",
            name: "Zone B - Middle East & SE Asia",
            tiers: [
                { maxWeight: 250, price: 4800 },
                { maxWeight: 500, price: 6200 },
                { maxWeight: 1000, price: 9000 },
                { maxWeight: 1500, price: 11750 },
                { maxWeight: 2000, price: 14500 },
                { maxWeight: 3000, price: 19900 },
                { maxWeight: 5000, price: 30700 },
                { maxWeight: 10000, price: 57700 },
                { maxWeight: 20000, price: 111700 },
                { maxWeight: 30000, price: 165700 },
            ],
        },
        {
            id: "zone_c",
            name: "Zone C - Europe & UK",
            tiers: [
                { maxWeight: 250, price: 5800 },
                { maxWeight: 500, price: 7500 },
                { maxWeight: 1000, price: 11200 },
                { maxWeight: 1500, price: 14850 },
                { maxWeight: 2000, price: 18500 },
                { maxWeight: 3000, price: 25800 },
                { maxWeight: 5000, price: 40400 },
                { maxWeight: 10000, price: 76900 },
                { maxWeight: 20000, price: 149900 },
                { maxWeight: 30000, price: 222900 },
            ],
        },
        {
            id: "zone_d",
            name: "Zone D - Americas, East Asia & Oceania",
            tiers: [
                { maxWeight: 250, price: 6500 },
                { maxWeight: 500, price: 8500 },
                { maxWeight: 1000, price: 12800 },
                { maxWeight: 1500, price: 16900 },
                { maxWeight: 2000, price: 21000 },
                { maxWeight: 3000, price: 29200 },
                { maxWeight: 5000, price: 45600 },
                { maxWeight: 10000, price: 86600 },
                { maxWeight: 20000, price: 168600 },
                { maxWeight: 30000, price: 250600 },
            ],
        },
    ],
    emsCountries: [
        // South Asia (Group A / zone_a)
        { code: "IN", name: "India", zoneId: "zone_a", group: "A", seaMailAvailable: true, uPacketAvailable: true, tdsAvailable: true },
        {
            code: "MV",
            name: "Maldives",
            zoneId: "zone_a",
            group: "A",
            seaMailAvailable: false,
            seaMailNote: "Sea Mail to Maldives suspended by SL Post since April 2024 (no bilateral surface vessel dispatch)",
            uPacketAvailable: true,
            tdsAvailable: true,
        },
        {
            code: "BD",
            name: "Bangladesh",
            zoneId: "zone_a",
            group: "A",
            seaMailAvailable: false,
            seaMailNote: "No direct surface mail container route from Colombo",
            uPacketAvailable: false,
            tdsAvailable: false,
        },
        { code: "PK", name: "Pakistan", zoneId: "zone_a", group: "A", seaMailAvailable: true, uPacketAvailable: false, tdsAvailable: false },
        {
            code: "NP",
            name: "Nepal",
            zoneId: "zone_a",
            group: "A",
            seaMailAvailable: false,
            seaMailNote: "Landlocked country — Sea Mail not available",
            uPacketAvailable: false,
            tdsAvailable: false,
        },

        // Middle East (Group B & C / zone_b)
        { code: "AE", name: "United Arab Emirates", zoneId: "zone_b", group: "B", seaMailAvailable: true, uPacketAvailable: true, tdsAvailable: true },
        {
            code: "QA",
            name: "Qatar",
            zoneId: "zone_b",
            group: "B",
            seaMailAvailable: false,
            seaMailNote: "No bilateral Sea Mail container service to Qatar",
            uPacketAvailable: true,
            tdsAvailable: true,
            suspensionStatus: "restricted",
            restrictionNote: "Subject to airline routing delays on Middle East corridors.",
        },
        { code: "SA", name: "Saudi Arabia", zoneId: "zone_b", group: "C", seaMailAvailable: true, uPacketAvailable: true, tdsAvailable: true },
        {
            code: "OM",
            name: "Oman",
            zoneId: "zone_b",
            group: "B",
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
            seaMailAvailable: false,
            seaMailNote: "No direct surface mail dispatch to Jordan",
            uPacketAvailable: false,
            tdsAvailable: false,
        },
        {
            code: "IL",
            name: "Israel",
            zoneId: "zone_b",
            group: "C",
            seaMailAvailable: false,
            seaMailNote: "Temporarily suspended by SL Post due to regional conflict and flight cancellations.",
            uPacketAvailable: false,
            tdsAvailable: false,
            suspensionStatus: "suspended",
            restrictionNote: "Temporarily suspended by SL Post due to regional conflict and flight cancellations.",
            unavailableServices: {
                air_letter: "Suspended (conflict & flight cancellations)",
                air_printed: "Suspended (conflict & flight cancellations)",
                u_packet: "Suspended (conflict & flight cancellations)",
                tds: "Suspended (conflict & flight cancellations)",
                air_parcel: "Suspended (conflict & flight cancellations)",
                ems: "Suspended (conflict & flight cancellations)",
                sea_letter: "Suspended (conflict & flight cancellations)",
                sea_printed: "Suspended (conflict & flight cancellations)",
                sea_parcel: "Suspended (conflict & flight cancellations)",
            },
        },
        {
            code: "LB",
            name: "Lebanon",
            zoneId: "zone_b",
            group: "C",
            seaMailAvailable: false,
            seaMailNote: "Temporarily suspended by SL Post due to regional conflict and airline suspensions.",
            uPacketAvailable: false,
            tdsAvailable: false,
            suspensionStatus: "suspended",
            restrictionNote: "Temporarily suspended by SL Post due to regional conflict and airline suspensions.",
            unavailableServices: {
                air_letter: "Suspended (regional conflict)",
                air_printed: "Suspended (regional conflict)",
                u_packet: "Suspended (regional conflict)",
                tds: "Suspended (regional conflict)",
                air_parcel: "Suspended (regional conflict)",
                ems: "Suspended (regional conflict)",
                sea_letter: "Suspended (regional conflict)",
                sea_printed: "Suspended (regional conflict)",
                sea_parcel: "Suspended (regional conflict)",
            },
        },

        // Southeast & East Asia (Group C & D / zone_b & zone_d)
        { code: "SG", name: "Singapore", zoneId: "zone_b", group: "C", seaMailAvailable: true, uPacketAvailable: true, tdsAvailable: true },
        { code: "MY", name: "Malaysia", zoneId: "zone_b", group: "C", seaMailAvailable: true, uPacketAvailable: true, tdsAvailable: true },
        { code: "TH", name: "Thailand", zoneId: "zone_b", group: "C", seaMailAvailable: true, uPacketAvailable: true, tdsAvailable: true },
        { code: "ID", name: "Indonesia", zoneId: "zone_b", group: "C", seaMailAvailable: true, uPacketAvailable: true, tdsAvailable: false },
        {
            code: "PH",
            name: "Philippines",
            zoneId: "zone_b",
            group: "D",
            seaMailAvailable: false,
            seaMailNote: "No direct surface mail consolidation to Philippines",
            uPacketAvailable: true,
            tdsAvailable: false,
        },
        {
            code: "VN",
            name: "Vietnam",
            zoneId: "zone_b",
            group: "C",
            seaMailAvailable: false,
            seaMailNote: "No direct surface mail consolidation to Vietnam",
            uPacketAvailable: true,
            tdsAvailable: false,
        },
        { code: "CN", name: "China", zoneId: "zone_b", group: "D", seaMailAvailable: true, uPacketAvailable: true, tdsAvailable: true },
        { code: "HK", name: "Hong Kong", zoneId: "zone_b", group: "C", seaMailAvailable: true, uPacketAvailable: true, tdsAvailable: true },
        { code: "JP", name: "Japan", zoneId: "zone_d", group: "D", seaMailAvailable: true, uPacketAvailable: true, tdsAvailable: true },
        { code: "KR", name: "South Korea", zoneId: "zone_d", group: "D", seaMailAvailable: true, uPacketAvailable: true, tdsAvailable: true },

        // Europe & UK (Group E & F / zone_c)
        { code: "GB", name: "United Kingdom", zoneId: "zone_c", group: "F", seaMailAvailable: true, uPacketAvailable: true, tdsAvailable: true },
        {
            code: "DE",
            name: "Germany",
            zoneId: "zone_c",
            group: "E",
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
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: true,
            suspensionStatus: "restricted",
            restrictionNote: "EU Customs Rule: Commercial goods valued €45–€150 are restricted. Documents, gifts ≤€45 & parcels >€150 are accepted.",
        },
        { code: "NL", name: "Netherlands", zoneId: "zone_c", group: "E", seaMailAvailable: true, uPacketAvailable: true, tdsAvailable: true },
        {
            code: "ES",
            name: "Spain",
            zoneId: "zone_c",
            group: "E",
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
            seaMailAvailable: true,
            uPacketAvailable: true,
            tdsAvailable: false,
            suspensionStatus: "restricted",
            restrictionNote: "EU Customs Rule: Commercial goods valued €45–€150 are restricted. Documents, gifts ≤€45 & parcels >€150 are accepted.",
        },
        {
            code: "SE",
            name: "Sweden",
            zoneId: "zone_c",
            group: "F",
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
            group: "E",
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
            group: "E",
            seaMailAvailable: false,
            seaMailNote: "No direct surface mail route from SL Post",
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
            seaMailAvailable: false,
            seaMailNote: "Landlocked destination — no direct Sea Mail dispatch",
            uPacketAvailable: true,
            tdsAvailable: true,
        },
        {
            code: "IE",
            name: "Ireland",
            zoneId: "zone_c",
            group: "F",
            seaMailAvailable: false,
            seaMailNote: "No direct surface container dispatch to Ireland",
            uPacketAvailable: true,
            tdsAvailable: false,
        },
        {
            code: "RU",
            name: "Russia",
            zoneId: "zone_c",
            group: "E",
            seaMailAvailable: false,
            seaMailNote: "Suspended — no direct international airline or transit mail routing available.",
            uPacketAvailable: false,
            tdsAvailable: false,
            suspensionStatus: "suspended",
            restrictionNote: "Suspended — no direct international airline or transit mail routing available.",
            unavailableServices: {
                air_letter: "Suspended (no transit flights)",
                air_printed: "Suspended (no transit flights)",
                u_packet: "Suspended (no transit flights)",
                tds: "Suspended (no transit flights)",
                air_parcel: "Suspended (no transit flights)",
                ems: "Suspended (no transit flights)",
                sea_letter: "Suspended (no transit flights)",
                sea_printed: "Suspended (no transit flights)",
                sea_parcel: "Suspended (no transit flights)",
            },
        },
        {
            code: "UA",
            name: "Ukraine",
            zoneId: "zone_c",
            group: "E",
            seaMailAvailable: false,
            seaMailNote: "Suspended due to airspace closure and armed conflict.",
            uPacketAvailable: false,
            tdsAvailable: false,
            suspensionStatus: "suspended",
            restrictionNote: "Suspended due to airspace closure and armed conflict.",
            unavailableServices: {
                air_letter: "Suspended (airspace closure)",
                air_printed: "Suspended (airspace closure)",
                u_packet: "Suspended (airspace closure)",
                tds: "Suspended (airspace closure)",
                air_parcel: "Suspended (airspace closure)",
                ems: "Suspended (airspace closure)",
                sea_letter: "Suspended (airspace closure)",
                sea_printed: "Suspended (airspace closure)",
                sea_parcel: "Suspended (airspace closure)",
            },
        },

        // Oceania, Americas & Africa (Group C, E, F, G, H / zone_b, zone_c, zone_d)
        { code: "AU", name: "Australia", zoneId: "zone_d", group: "F", seaMailAvailable: true, uPacketAvailable: true, tdsAvailable: true },
        { code: "NZ", name: "New Zealand", zoneId: "zone_d", group: "G", seaMailAvailable: true, uPacketAvailable: true, tdsAvailable: true },
        { code: "US", name: "United States", zoneId: "zone_d", group: "H", seaMailAvailable: true, uPacketAvailable: true, tdsAvailable: true },
        {
            code: "CA",
            name: "Canada",
            zoneId: "zone_d",
            group: "H",
            seaMailAvailable: false,
            seaMailNote: "Sea Mail to Canada suspended by SL Post since Sept 2023 (no surface container route)",
            uPacketAvailable: true,
            tdsAvailable: true,
        },
        {
            code: "BR",
            name: "Brazil",
            zoneId: "zone_d",
            group: "H",
            seaMailAvailable: false,
            seaMailNote: "No bilateral Sea Mail container route to South America",
            uPacketAvailable: false,
            tdsAvailable: false,
        },
        {
            code: "ZA",
            name: "South Africa",
            zoneId: "zone_c",
            group: "E",
            seaMailAvailable: false,
            seaMailNote: "No direct Sea Mail consolidation to South Africa",
            uPacketAvailable: false,
            tdsAvailable: false,
        },
        { code: "EG", name: "Egypt", zoneId: "zone_b", group: "C", seaMailAvailable: true, uPacketAvailable: false, tdsAvailable: false },
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
            return {
                ...def,
                ...custom,
                shortName: custom.shortName || def.shortName,
                description: custom.description || def.description,
                flatRate: custom.flatRate ?? def.flatRate,
                supportsRegistration: custom.supportsRegistration ?? def.supportsRegistration,
                supportsAr: custom.supportsAr ?? def.supportsAr,
                supportsInsurance: custom.supportsInsurance ?? def.supportsInsurance,
            };
        });

        // Append any extra custom services created by an admin
        for (const s of loadedServices) {
            if (!defaultById.has(s.id) && Array.isArray(s.tiers) && s.tiers.length > 0) {
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
            return {
                ...def,
                ...custom,
                group: custom.group ?? def.group,
                seaMailAvailable: custom.seaMailAvailable ?? def.seaMailAvailable,
                seaMailNote: custom.seaMailNote ?? def.seaMailNote,
                uPacketAvailable: custom.uPacketAvailable ?? def.uPacketAvailable,
                uPacketNote: custom.uPacketNote ?? def.uPacketNote,
                tdsAvailable: custom.tdsAvailable ?? def.tdsAvailable,
                tdsNote: custom.tdsNote ?? def.tdsNote,
                suspensionStatus: custom.suspensionStatus ?? def.suspensionStatus,
                restrictionNote: custom.restrictionNote ?? def.restrictionNote,
                unavailableServices: custom.unavailableServices ?? def.unavailableServices,
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
        tiers = zone.tiers;
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
        name: "International EMS (Speed Post)",
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
            B: { base: 270, step: 190 },
            C: { base: 300, step: 210 },
            D: { base: 330, step: 240 },
            E: { base: 360, step: 270 },
            F: { base: 390, step: 300 },
            G: { base: 430, step: 340 },
            H: { base: 480, step: 420 },
        },
    },
    tds: {
        baseWeight: 100,
        stepWeight: 100,
        groups: {
            A: { base: 850, step: 320 },
            B: { base: 950, step: 380 },
            C: { base: 1100, step: 420 },
            D: { base: 1250, step: 480 },
            E: { base: 1450, step: 550 },
            F: { base: 1650, step: 620 },
            G: { base: 1850, step: 700 },
            H: { base: 2100, step: 820 },
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
        { maxWeight: 50, price: 290 },
        { maxWeight: 100, price: 460 },
        { maxWeight: 250, price: 1180 },
        { maxWeight: 500, price: 2260 },
        { maxWeight: 1000, price: 4190 },
        { maxWeight: 2000, price: 7780 },
    ],
    sea_printed: [
        { maxWeight: 50, price: 240 },
        { maxWeight: 100, price: 440 },
        { maxWeight: 250, price: 990 },
        { maxWeight: 500, price: 1930 },
        { maxWeight: 1000, price: 3480 },
        { maxWeight: 2000, price: 5920 },
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
                maxWeight: service.maxWeight,
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
                maxWeight: service.maxWeight,
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

    if (weightGrams > service.maxWeight) {
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
                maxWeight: service.maxWeight,
                exceedsMaxWeight: true,
                error: `Max ${formatWeightLabel(service.maxWeight)}`,
            },
        };
    }

    const foreignRegFee =
        options.registered && service.supportsRegistration
            ? (config.extraFees.foreignRegisteredPost ?? 870)
            : 0;

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
                maxWeight: service.maxWeight,
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
                maxWeight: service.maxWeight,
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
        service.maxWeight
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
            maxWeight: service.maxWeight,
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
