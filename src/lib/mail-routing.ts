/**
 * Sri Lanka Post mail routing, RMSC/TPO sorting hubs, 00-91 postcode prefixes,
 * duplicate-name disambiguation, and trainee practice quiz helpers.
 */

import { HAS_INDIC_SCRIPT_REGEX, resolveAlias } from "./place-aliases";
import { normalizePostalCode } from "./site";

export interface PostalPrefixZone {
    prefix: string; // e.g., "00", "10", "20"
    district: string;
    province: string;
    primaryHub: string;
    notes: string;
}

export interface SortingHubInfo {
    id: string;
    name: string;
    shortLabel: string;
    kind: "CME" | "RMSC" | "TPO";
    province: string;
    postalCode: string;
    description: string;
    servesDivisions: string[];
}

export const POSTAL_PREFIX_ZONES: PostalPrefixZone[] = [
    { prefix: "00", district: "Colombo City (Colombo 01–15)", province: "Western", primaryHub: "Colombo CME", notes: "Fort GPO, Slave Island, Kollupitiya, Bambalapitiya, Borella, Cinnamon Gardens, Maradana, Pettah, Mutwal" },
    { prefix: "01", district: "Colombo Central / CME", province: "Western", primaryHub: "Colombo CME", notes: "Central Mail Exchange (01000) and central Colombo sorting units" },
    { prefix: "10", district: "Colombo District (Greater Colombo)", province: "Western", primaryHub: "Colombo CME", notes: "Nugegoda, Maharagama, Dehiwala, Mount Lavinia, Moratuwa, Homagama, Avissawella, Kaduwela" },
    { prefix: "11", district: "Gampaha", province: "Western", primaryHub: "Colombo CME", notes: "Gampaha, Negombo, Wattala, Ja-Ela, Kelaniya, Peliyagoda, Kadawatha, Minuwangoda, Nittambuwa, Veyangoda" },
    { prefix: "12", district: "Kalutara", province: "Western", primaryHub: "DOWN GALLE TPO", notes: "Kalutara, Panadura, Horana, Matugama, Beruwala, Aluthgama, Agalawatta, Bandaragama" },
    { prefix: "20", district: "Kandy", province: "Central", primaryHub: "Kandy RMSC", notes: "Kandy, Peradeniya, Gampola, Katugastota, Nawalapitiya, Kadugannawa, Kundasale, Teldeniya" },
    { prefix: "21", district: "Matale", province: "Central", primaryHub: "Kandy RMSC", notes: "Matale, Dambulla, Galewela, Sigiriya, Rattota, Ukuwela" },
    { prefix: "22", district: "Nuwara Eliya", province: "Central", primaryHub: "Hatton RMSC", notes: "Nuwara Eliya, Hatton, Talawakele, Ginigathhena, Maskeliya, Ragala, Walapane" },
    { prefix: "30", district: "Batticaloa", province: "Eastern", primaryHub: "Batticaloa RMSC", notes: "Batticaloa, Eravur, Kattankudy, Valachchenai, Kaluvanchikudy" },
    { prefix: "31", district: "Trincomalee", province: "Eastern", primaryHub: "Batticaloa RMSC", notes: "Trincomalee, Kantale, Kinniya, Mutur, Kuchchaveli" },
    { prefix: "32", district: "Ampara", province: "Eastern", primaryHub: "Batticaloa RMSC", notes: "Ampara, Kalmunai, Akkaraipattu, Sammanthurai, Sainthamaruthu, Pottuvil, Mahaoya" },
    { prefix: "40", district: "Jaffna", province: "Northern", primaryHub: "Jaffna RMSC / JAFFNA TPO", notes: "Jaffna, Chavakachcheri, Point Pedro, Nallur, Chunnakam, Kayts, Kopay" },
    { prefix: "41", district: "Mannar", province: "Northern", primaryHub: "JAFFNA TPO", notes: "Mannar, Murunkan, Nanattan, Pesalai, Talaimannar" },
    { prefix: "42", district: "Kilinochchi", province: "Northern", primaryHub: "JAFFNA TPO", notes: "Kilinochchi, Paranthan, Pallai, Pooneryn" },
    { prefix: "43", district: "Vavuniya", province: "Northern", primaryHub: "JAFFNA TPO", notes: "Vavuniya, Nedunkeni, Omanthai, Settikulam" },
    { prefix: "44", district: "Mullaitivu", province: "Northern", primaryHub: "JAFFNA TPO", notes: "Mullaitivu, Oddusuddan, Mankulam, Puthukkudiyiruppu" },
    { prefix: "50", district: "Anuradhapura", province: "North Central", primaryHub: "Anuradhapura RMSC", notes: "Anuradhapura, Kekirawa, Medawachchiya, Thambuttegama, Eppawala, Mihintale, Horowpathana" },
    { prefix: "51", district: "Polonnaruwa", province: "North Central", primaryHub: "Anuradhapura RMSC", notes: "Polonnaruwa, Kaduruwela, Hingurakgoda, Medirigiriya, Bakamoona" },
    { prefix: "60", district: "Kurunegala", province: "North Western", primaryHub: "Kurunegala RMSC", notes: "Kurunegala, Kuliyapitiya, Narammala, Polgahawela, Pannala, Mawathagama, Maho, Nikaweratiya, Wariyapola" },
    { prefix: "61", district: "Puttalam", province: "North Western", primaryHub: "Kurunegala RMSC", notes: "Puttalam, Chilaw, Wennappuwa, Marawila, Dankotuwa, Nattandiya, Anamaduwa, Kalpitiya" },
    { prefix: "70", district: "Ratnapura", province: "Sabaragamuwa", primaryHub: "Rathnapura RMSC", notes: "Ratnapura, Pelmadulla, Balangoda, Embilipitiya, Eheliyagoda, Kuruwita, Rakwana" },
    { prefix: "71", district: "Kegalle", province: "Sabaragamuwa", primaryHub: "UP KANDY TPO", notes: "Kegalle, Mawanella, Warakapola, Rambukkana, Ruwanwella, Yatiyantota, Dehiowita" },
    { prefix: "80", district: "Galle", province: "Southern", primaryHub: "DOWN GALLE TPO", notes: "Galle, Ambalangoda, Hikkaduwa, Elpitiya, Karapitiya, Baddegama, Ahangama, Bentota" },
    { prefix: "81", district: "Matara", province: "Southern", primaryHub: "Matara RMSC", notes: "Matara, Weligama, Akuressa, Deniyaya, Hakmana, Kamburupitiya, Dikwella" },
    { prefix: "82", district: "Hambantota", province: "Southern", primaryHub: "Matara RMSC", notes: "Hambantota, Tangalle, Tissamaharama, Ambalantota, Beliatta, Walasmulla, Kataragama" },
    { prefix: "90", district: "Badulla", province: "Uva", primaryHub: "Badulla RMSC / UP BADULLA TPO", notes: "Badulla, Bandarawela, Welimada, Haputale, Mahiyanganaya, Hali-Ela, Passara" },
    { prefix: "91", district: "Monaragala", province: "Uva", primaryHub: "Badulla RMSC / UP BADULLA TPO", notes: "Monaragala, Wellawaya, Bibile, Buttala, Siyambalanduwa, Thanamalwila" },
];

export const SORTING_HUBS: SortingHubInfo[] = [
    {
        id: "cme-colombo",
        name: "Colombo CME",
        shortLabel: "CME",
        kind: "CME",
        province: "Western",
        postalCode: "01000",
        description: "Central Mail Exchange (D.R. Wijewardena Mawatha) — primary national sorting hub, Foreign Mail & Parcel Exchange, EMS Centre, and Returned Letter Office (RLO).",
        servesDivisions: ["Colombo", "Colombo (North)", "Colombo (South)", "Gampaha (North)", "Gampaha (South)", "Gampaha"],
    },
    {
        id: "kandy-rmsc",
        name: "Kandy RMSC",
        shortLabel: "KD RMSC",
        kind: "RMSC",
        province: "Central",
        postalCode: "20000",
        description: "Regional Mail Sorting Center at Kandy Postal Complex — sorts domestic and regional mail bags for Kandy North/South and Matale divisions.",
        servesDivisions: ["Kandy (North)", "Kandy (South)", "Matale"],
    },
    {
        id: "matara-rmsc",
        name: "Matara RMSC",
        shortLabel: "MR RMSC",
        kind: "RMSC",
        province: "Southern",
        postalCode: "81000",
        description: "Southern Regional Mail Sorting Center handling Matara and Hambantota main and sub-office dispatches.",
        servesDivisions: ["Matara", "Hambanthota", "Hambantota"],
    },
    {
        id: "down-galle-tpo",
        name: "DOWN GALLE TPO",
        shortLabel: "DG TPO",
        kind: "TPO",
        province: "Southern / Western Coast",
        postalCode: "80000",
        description: "Coastal Line Railway Travelling Post Office linking Colombo CME with Kalutara, Galle, and Matara coastal offices.",
        servesDivisions: ["Kaluthara", "Kalutara", "Galle", "Matara"],
    },
    {
        id: "kurunegala-rmsc",
        name: "Kurunegala RMSC",
        shortLabel: "KG RMSC",
        kind: "RMSC",
        province: "North Western",
        postalCode: "60000",
        description: "North Western Regional Mail Sorting Center serving Kurunegala North/South and Puttalam coastal belt.",
        servesDivisions: ["Kurunegala (North)", "Kurunegala (South)", "Puttalam"],
    },
    {
        id: "anuradhapura-rmsc",
        name: "Anuradhapura RMSC",
        shortLabel: "AD RMSC",
        kind: "RMSC",
        province: "North Central",
        postalCode: "50000",
        description: "North Central Regional Mail Sorting Center serving Anuradhapura and Polonnaruwa districts.",
        servesDivisions: ["Anuradhapura", "Polonnaruwa"],
    },
    {
        id: "rathnapura-rmsc",
        name: "Rathnapura RMSC",
        shortLabel: "RN RMSC",
        kind: "RMSC",
        province: "Sabaragamuwa",
        postalCode: "70000",
        description: "Sabaragamuwa Regional Mail Sorting Center serving Ratnapura district and surrounding gem/estate routes.",
        servesDivisions: ["Rathnapura", "Ratnapura"],
    },
    {
        id: "hatton-rmsc",
        name: "Hatton RMSC",
        shortLabel: "HN RMSC",
        kind: "RMSC",
        province: "Central",
        postalCode: "22000",
        description: "Up-country Regional Mail Sorting Center handling Nuwara Eliya, Hatton, and hill-country estate post offices.",
        servesDivisions: ["Nuwaraeliya", "Nuwara Eliya"],
    },
    {
        id: "up-kandy-tpo",
        name: "UP KANDY TPO",
        shortLabel: "UK TPO",
        kind: "TPO",
        province: "Sabaragamuwa / Central",
        postalCode: "20000",
        description: "Main Line Railway Travelling Post Office handling Kegalle, Rambukkana, and Kandy rail-corridor bags.",
        servesDivisions: ["Kegalle", "Kandy (North)", "Kandy (South)"],
    },
    {
        id: "up-badulla-tpo",
        name: "UP BADULLA TPO",
        shortLabel: "UB TPO",
        kind: "TPO",
        province: "Central / Uva",
        postalCode: "90000",
        description: "Up-Country Night Mail Travelling Post Office serving Nuwara Eliya, Hatton, Bandarawela, Badulla, and Monaragala.",
        servesDivisions: ["Badulla", "Monaragala", "Nuwaraeliya"],
    },
    {
        id: "badulla-rmsc",
        name: "Badulla RMSC",
        shortLabel: "BD RMSC",
        kind: "RMSC",
        province: "Uva",
        postalCode: "90000",
        description: "Uva Province Regional Mail Sorting Center serving Badulla and Monaragala divisions.",
        servesDivisions: ["Badulla", "Monaragala"],
    },
    {
        id: "batticaloa-rmsc",
        name: "Batticaloa RMSC",
        shortLabel: "BT RMSC",
        kind: "RMSC",
        province: "Eastern",
        postalCode: "30000",
        description: "Eastern Province Regional Mail Sorting Center serving Batticaloa, Ampara, Kalmunai, and Trincomalee corridors.",
        servesDivisions: ["Batticaloa", "Ampara", "Trincomalee"],
    },
    {
        id: "jaffna-rmsc",
        name: "Jaffna RMSC",
        shortLabel: "JA RMSC",
        kind: "RMSC",
        province: "Northern",
        postalCode: "40000",
        description: "Northern Peninsula Regional Mail Sorting Center serving Jaffna, Point Pedro, Chavakachcheri, and islands.",
        servesDivisions: ["Jaffna"],
    },
    {
        id: "jaffna-tpo",
        name: "JAFFNA TPO",
        shortLabel: "JA TPO",
        kind: "TPO",
        province: "Northern",
        postalCode: "40000",
        description: "Northern Line Travelling Post Office linking Colombo CME & Anuradhapura with Vavuniya, Mannar, Kilinochchi, Mullaitivu, and Jaffna.",
        servesDivisions: ["Jaffna", "Kilinochchi", "Mannar", "Mullaitivu", "Vavuniya"],
    },
];

export interface RoutingOfficeNode {
    id: string;
    slug: string;
    name: string;
    postalCode: string;
    shortCode?: string;
    type?: string;
    grade?: string;
    division?: string;
    delivery?: "Yes" | "No" | "";
    rmsc?: string | null;
    controllingOfficeId?: string | null;
    controllingOfficeSlug?: string | null;
    controllingOfficeName?: string | null;
    controllingOfficePostalCode?: string | null;
    controllingOfficeShortCode?: string | null;
}

export interface RouteStep {
    role: "ORIGIN" | "ORIGIN_CONTROLLING" | "ORIGIN_HUB" | "NATIONAL_HUB" | "DEST_HUB" | "DEST_CONTROLLING" | "DESTINATION";
    title: string;
    subtitle: string;
    officeSlug?: string;
    postalCode?: string;
    shortCode?: string;
    badge?: string;
}

export interface ComputedMailRoute {
    scope: "SAME_OFFICE" | "SAME_CONTROLLING" | "SAME_HUB" | "CROSS_REGION" | "INBOUND_ONLY";
    scopeLabel: string;
    summary: string;
    steps: RouteStep[];
    bagLabel: {
        toOffice: string;
        shortCode: string;
        postalCode: string;
        division: string;
        hub: string;
        controllingOffice: string;
        deliveryWarning: string | null;
        bagTypeHint: string;
    };
    duplicateNames: RoutingOfficeNode[];
}

export function lookupPrefixZone(postalCodeOrPrefix: string): PostalPrefixZone | null {
    const digits = postalCodeOrPrefix.replace(/\D/g, "");
    if (digits.length < 2) return null;
    const prefix = digits.padStart(digits.length >= 5 ? 5 : 2, "0").slice(0, 2);
    return POSTAL_PREFIX_ZONES.find((z) => z.prefix === prefix) ?? null;
}

export function inferHubFromOffice(office: Pick<RoutingOfficeNode, "rmsc" | "postalCode" | "division">): string {
    if (office.rmsc && office.rmsc.trim()) {
        return office.rmsc.trim();
    }
    const zone = office.postalCode ? lookupPrefixZone(office.postalCode) : null;
    if (zone) return zone.primaryHub;

    const div = (office.division || "").toLowerCase();
    if (div.includes("colombo") || div.includes("gampaha")) return "Colombo CME";
    if (div.includes("kalut")) return "DOWN GALLE TPO";
    if (div.includes("galle")) return "DOWN GALLE TPO";
    if (div.includes("matara") || div.includes("hamban")) return "Matara RMSC";
    if (div.includes("kandy") || div.includes("matale")) return "Kandy RMSC";
    if (div.includes("nuwara")) return "Hatton RMSC";
    if (div.includes("kurunegala") || div.includes("puttalam")) return "Kurunegala RMSC";
    if (div.includes("anuradhapura") || div.includes("polonnaruwa")) return "Anuradhapura RMSC";
    if (div.includes("ratnapura") || div.includes("rathnapura")) return "Rathnapura RMSC";
    if (div.includes("kegalle")) return "UP KANDY TPO";
    if (div.includes("badulla") || div.includes("monaragala")) return "Badulla RMSC / UP BADULLA TPO";
    if (div.includes("batticaloa") || div.includes("ampara") || div.includes("trincomalee")) return "Batticaloa RMSC";
    if (div.includes("jaffna") || div.includes("kilinochchi") || div.includes("mannar") || div.includes("mullaitivu") || div.includes("vavuniya")) {
        return "JAFFNA TPO";
    }
    return "Colombo CME";
}

function normalizeHubToken(hub: string): string {
    return hub
        .split("/")[0]
        .trim()
        .toLowerCase()
        .replace(/rathnapura/g, "ratnapura");
}

function hubsOverlap(a: string, b: string): boolean {
    const partsA = a.split("/").map((p) => p.trim().toLowerCase().replace(/rathnapura/g, "ratnapura"));
    const partsB = b.split("/").map((p) => p.trim().toLowerCase().replace(/rathnapura/g, "ratnapura"));
    return partsA.some((pa) => pa && partsB.includes(pa));
}

export function computeMailRoute(
    origin: RoutingOfficeNode | null,
    dest: RoutingOfficeNode,
    allOffices: RoutingOfficeNode[] = []
): ComputedMailRoute {
    const bySlug = new Map(allOffices.map((o) => [o.slug, o]));
    const byId = new Map(allOffices.map((o) => [o.id, o]));

    const resolveControlling = (node: RoutingOfficeNode): RoutingOfficeNode | null => {
        if (node.controllingOfficeId && byId.has(node.controllingOfficeId)) {
            return byId.get(node.controllingOfficeId)!;
        }
        if (node.controllingOfficeSlug && bySlug.has(node.controllingOfficeSlug)) {
            return bySlug.get(node.controllingOfficeSlug)!;
        }
        if (node.controllingOfficeName) {
            return {
                id: node.controllingOfficeId || "",
                slug: node.controllingOfficeSlug || "",
                name: node.controllingOfficeName,
                postalCode: node.controllingOfficePostalCode || "",
                shortCode: node.controllingOfficeShortCode || "",
                type: "Post Office",
            };
        }
        return null;
    };

    const destCtrl = resolveControlling(dest);
    const destHub = inferHubFromOffice(dest);
    const originCtrl = origin ? resolveControlling(origin) : null;
    const originHub = origin ? inferHubFromOffice(origin) : "";

    const destNameKey = dest.name.trim().toLowerCase();
    const duplicateNames = allOffices.filter(
        (o) => o.slug !== dest.slug && o.name.trim().toLowerCase() === destNameKey
    );

    const steps: RouteStep[] = [];
    let scope: ComputedMailRoute["scope"] = "INBOUND_ONLY";
    let scopeLabel = "Standard Inbound Chain";
    let summary = "";

    const destBadge = dest.delivery === "No" ? "Non-Delivery Office" : dest.delivery === "Yes" ? "Delivery Office" : dest.type || "Office";

    if (origin && origin.slug === dest.slug) {
        scope = "SAME_OFFICE";
        scopeLabel = "Same Office (Local Counter / Beat)";
        summary = `Item posted at and addressed to ${dest.name}. Retain locally for counter collection or local postman delivery beat.`;
        steps.push({
            role: "DESTINATION",
            title: dest.name,
            subtitle: "Local retention — sort directly to delivery beat or counter window",
            officeSlug: dest.slug,
            postalCode: dest.postalCode,
            shortCode: dest.shortCode,
            badge: destBadge,
        });
    } else if (
        origin &&
        ((originCtrl && destCtrl && originCtrl.slug && originCtrl.slug === destCtrl.slug) ||
            (originCtrl && originCtrl.slug === dest.slug) ||
            (destCtrl && destCtrl.slug === origin.slug))
    ) {
        scope = "SAME_CONTROLLING";
        scopeLabel = "Same Controlling Office (Local Bag)";
        const sharedCtrl = originCtrl?.slug === dest.slug ? dest : destCtrl || origin;
        summary = `Both offices sit under ${sharedCtrl.name}. Bag locally via Controlling Office without routing to an RMSC or CME.`;
        steps.push({
            role: "ORIGIN",
            title: origin.name,
            subtitle: "Origin office — bundle & dispatch with Controlling Office bag",
            officeSlug: origin.slug,
            postalCode: origin.postalCode,
            shortCode: origin.shortCode,
        });
        if (origin.slug !== sharedCtrl.slug && dest.slug !== sharedCtrl.slug) {
            steps.push({
                role: "DEST_CONTROLLING",
                title: sharedCtrl.name,
                subtitle: "Controlling Main Post Office — cross-sorts local sub-office bags",
                officeSlug: sharedCtrl.slug || undefined,
                postalCode: sharedCtrl.postalCode,
                shortCode: sharedCtrl.shortCode,
                badge: "Local Exchange",
            });
        }
        steps.push({
            role: "DESTINATION",
            title: dest.name,
            subtitle: dest.delivery === "No" ? "Non-Delivery office — confirm handoff with Controlling Office" : "Final delivery office",
            officeSlug: dest.slug,
            postalCode: dest.postalCode,
            shortCode: dest.shortCode,
            badge: destBadge,
        });
    } else if (origin && hubsOverlap(originHub, destHub)) {
        scope = "SAME_HUB";
        scopeLabel = "Same Regional Hub (Direct RMSC / TPO)";
        summary = `Origin and destination share ${destHub}. Forward via regional sorting hub without transiting Colombo CME.`;
        steps.push({
            role: "ORIGIN",
            title: origin.name,
            subtitle: "Dispatch outbound mail bag",
            officeSlug: origin.slug,
            postalCode: origin.postalCode,
            shortCode: origin.shortCode,
        });
        if (originCtrl) {
            steps.push({
                role: "ORIGIN_CONTROLLING",
                title: originCtrl.name,
                subtitle: "Origin Controlling Office — closes regional hub bag",
                officeSlug: originCtrl.slug || undefined,
                postalCode: originCtrl.postalCode,
                shortCode: originCtrl.shortCode,
            });
        }
        steps.push({
            role: "DEST_HUB",
            title: destHub,
            subtitle: "Shared Regional Sorting Hub — sorts directly to destination controlling office",
            badge: "Regional Shortcut",
        });
        if (destCtrl && destCtrl.slug !== dest.slug) {
            steps.push({
                role: "DEST_CONTROLLING",
                title: destCtrl.name,
                subtitle: "Controlling Main Post Office for destination",
                officeSlug: destCtrl.slug || undefined,
                postalCode: destCtrl.postalCode,
                shortCode: destCtrl.shortCode,
            });
        }
        steps.push({
            role: "DESTINATION",
            title: dest.name,
            subtitle: dest.delivery === "No" ? "Non-Delivery office — verify delivery responsibility with Controlling Office" : "Final delivery office",
            officeSlug: dest.slug,
            postalCode: dest.postalCode,
            shortCode: dest.shortCode,
            badge: destBadge,
        });
    } else if (origin) {
        scope = "CROSS_REGION";
        scopeLabel = "Inter-Regional Routing (via CME Trunk)";
        summary = `Route from ${origin.name} (${originHub}) through Colombo CME trunk to ${destHub}, then down to ${destCtrl ? destCtrl.name : dest.name}.`;
        steps.push({
            role: "ORIGIN",
            title: origin.name,
            subtitle: "Origin office — enclose in outbound bag",
            officeSlug: origin.slug,
            postalCode: origin.postalCode,
            shortCode: origin.shortCode,
        });
        if (originCtrl) {
            steps.push({
                role: "ORIGIN_CONTROLLING",
                title: originCtrl.name,
                subtitle: "Origin Controlling Office — dispatches to regional RMSC/TPO",
                officeSlug: originCtrl.slug || undefined,
                postalCode: originCtrl.postalCode,
                shortCode: originCtrl.shortCode,
            });
        }
        if (normalizeHubToken(originHub) !== "colombo cme") {
            steps.push({
                role: "ORIGIN_HUB",
                title: originHub,
                subtitle: "Origin RMSC / TPO — forwards trunk bag to Colombo CME",
            });
        }
        if (normalizeHubToken(originHub) !== "colombo cme" && normalizeHubToken(destHub) !== "colombo cme") {
            steps.push({
                role: "NATIONAL_HUB",
                title: "Colombo CME (01000)",
                subtitle: "Central Mail Exchange — primary national trunk sorting",
                postalCode: "01000",
                shortCode: "CME",
            });
        }
        if (normalizeHubToken(destHub) !== "colombo cme") {
            steps.push({
                role: "DEST_HUB",
                title: destHub,
                subtitle: "Destination RMSC / TPO — sorts to destination Controlling Office",
            });
        }
        if (destCtrl && destCtrl.slug !== dest.slug) {
            steps.push({
                role: "DEST_CONTROLLING",
                title: destCtrl.name,
                subtitle: "Controlling Main Post Office — forwards morning/daily bag to sub-office",
                officeSlug: destCtrl.slug || undefined,
                postalCode: destCtrl.postalCode,
                shortCode: destCtrl.shortCode,
            });
        }
        steps.push({
            role: "DESTINATION",
            title: dest.name,
            subtitle: dest.delivery === "No" ? "Non-Delivery office — check Controlling Office for street delivery" : "Final delivery office",
            officeSlug: dest.slug,
            postalCode: dest.postalCode,
            shortCode: dest.shortCode,
            badge: destBadge,
        });
    } else {
        scope = "INBOUND_ONLY";
        scopeLabel = "Inbound Routing Chain";
        summary = `To forward mail to ${dest.name}, route via ${destHub}${destCtrl ? ` → Controlling Office ${destCtrl.name}` : ""}.`;
        if (normalizeHubToken(destHub) !== "colombo cme") {
            steps.push({
                role: "NATIONAL_HUB",
                title: "Colombo CME (01000)",
                subtitle: "National trunk hub (for inter-provincial mail)",
                postalCode: "01000",
                shortCode: "CME",
            });
        }
        steps.push({
            role: "DEST_HUB",
            title: destHub,
            subtitle: "Regional Mail Sorting Center / TPO serving this office",
        });
        if (destCtrl && destCtrl.slug !== dest.slug) {
            steps.push({
                role: "DEST_CONTROLLING",
                title: destCtrl.name,
                subtitle: "Controlling Main Post Office (supervisory & bag exchange hub)",
                officeSlug: destCtrl.slug || undefined,
                postalCode: destCtrl.postalCode,
                shortCode: destCtrl.shortCode,
            });
        }
        steps.push({
            role: "DESTINATION",
            title: dest.name,
            subtitle: dest.delivery === "No" ? "Non-Delivery office — counter pickup / check Controlling Office" : "Final delivery office",
            officeSlug: dest.slug,
            postalCode: dest.postalCode,
            shortCode: dest.shortCode,
            badge: destBadge,
        });
    }

    const deliveryWarning =
        dest.delivery === "No"
            ? `${dest.name} is a Non-Delivery office.${destCtrl ? ` Bag mail via Controlling Office ${destCtrl.name}${destCtrl.postalCode ? ` (${destCtrl.postalCode})` : ""} unless addressed to a PO Box / Poste Restante at ${dest.name}.` : " Verify street delivery coverage before direct bagging."}`
            : null;

    const bagTarget = destCtrl && dest.delivery === "No" ? `${destCtrl.name} (for ${dest.name})` : dest.name;
    const bagTypeHint = destCtrl
        ? `Standard Sub-Office Bag via ${destCtrl.name}${destCtrl.shortCode ? ` [${destCtrl.shortCode}]` : ""}`
        : `Direct Bag / Main Office Dispatch (${dest.shortCode || dest.postalCode || dest.name})`;

    return {
        scope,
        scopeLabel,
        summary,
        steps,
        bagLabel: {
            toOffice: bagTarget,
            shortCode: dest.shortCode || destCtrl?.shortCode || "—",
            postalCode: dest.postalCode || destCtrl?.postalCode || "—",
            division: dest.division || "Sri Lanka",
            hub: destHub,
            controllingOffice: destCtrl ? `${destCtrl.name}${destCtrl.shortCode ? ` (${destCtrl.shortCode})` : ""}` : "Self / Main Office",
            deliveryWarning,
            bagTypeHint,
        },
        duplicateNames,
    };
}

export interface QuizQuestion {
    id: string;
    prompt: string;
    contextLabel: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
}

/**
 * Generates deterministic or randomized sorting practice questions from an office list
 * so trainees can drill postcodes, short codes, controlling offices, and delivery status.
 */
export function generateSortingQuizQuestions(
    offices: RoutingOfficeNode[],
    count: number = 10,
    divisionFilter?: string | null
): QuizQuestion[] {
    const pool = divisionFilter
        ? offices.filter((o) => (o.division || "").toLowerCase() === divisionFilter.toLowerCase())
        : offices;

    const usable = pool.length >= 4 ? pool : offices;
    if (usable.length < 4) return [];

    const shuffle = <T,>(arr: T[]): T[] => {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    };

    const pickDistractors = (correct: string, candidates: string[], n = 3): string[] => {
        const unique = [...new Set(candidates.filter((c) => c && c !== correct))];
        return shuffle(unique).slice(0, n);
    };

    const questions: QuizQuestion[] = [];
    const shuffledPool = shuffle(usable);

    for (const office of shuffledPool) {
        if (questions.length >= count) break;

        const qTypes: Array<() => QuizQuestion | null> = [
            () => {
                if (!office.controllingOfficeName) return null;
                const allCtrls = usable.map((o) => o.controllingOfficeName || "").filter(Boolean);
                const distractors = pickDistractors(office.controllingOfficeName, allCtrls);
                if (distractors.length < 3) return null;
                return {
                    id: `ctrl-${office.id}`,
                    prompt: `Which Controlling Main Post Office supervises "${office.name}"?`,
                    contextLabel: `${office.type || "Sub Post Office"}${office.division ? ` · ${office.division}` : ""}`,
                    options: shuffle([office.controllingOfficeName, ...distractors]),
                    correctAnswer: office.controllingOfficeName,
                    explanation: `${office.name} (${office.postalCode || "no postcode"}) operates under Controlling Office ${office.controllingOfficeName}.`,
                };
            },
            () => {
                if (!office.postalCode) return null;
                const allCodes = usable.map((o) => o.postalCode).filter(Boolean);
                const distractors = pickDistractors(office.postalCode, allCodes);
                if (distractors.length < 3) return null;
                return {
                    id: `code-${office.id}`,
                    prompt: `What is the 5-digit postal code for "${office.name}"?`,
                    contextLabel: `${office.division || "Sri Lanka"}${office.type ? ` · ${office.type}` : ""}`,
                    options: shuffle([office.postalCode, ...distractors]),
                    correctAnswer: office.postalCode,
                    explanation: `The postal code for ${office.name}${office.division ? ` (${office.division})` : ""} is ${office.postalCode}.`,
                };
            },
            () => {
                if (!office.shortCode) return null;
                const allShorts = usable.map((o) => o.shortCode || "").filter(Boolean);
                const distractors = pickDistractors(office.shortCode, allShorts);
                if (distractors.length < 3) return null;
                return {
                    id: `short-${office.id}`,
                    prompt: `Which bag/office Short Code belongs to "${office.name}"?`,
                    contextLabel: `${office.division || "Sri Lanka"}${office.postalCode ? ` · ${office.postalCode}` : ""}`,
                    options: shuffle([office.shortCode, ...distractors]),
                    correctAnswer: office.shortCode,
                    explanation: `${office.name} uses short code "${office.shortCode}" on dispatch lists and bag labels.`,
                };
            },
            () => {
                const hub = inferHubFromOffice(office);
                const allHubs = SORTING_HUBS.map((h) => h.name);
                const distractors = pickDistractors(hub, allHubs);
                if (distractors.length < 3) return null;
                return {
                    id: `hub-${office.id}`,
                    prompt: `Which RMSC / TPO sorting hub routes mail for "${office.name}"?`,
                    contextLabel: `${office.division || "Sri Lanka"}${office.postalCode ? ` · ${office.postalCode}` : ""}`,
                    options: shuffle([hub, ...distractors]),
                    correctAnswer: hub,
                    explanation: `Mail for ${office.name}${office.division ? ` (${office.division})` : ""} is sorted through ${hub}.`,
                };
            },
            () => {
                if (office.delivery !== "Yes" && office.delivery !== "No") return null;
                const correct = office.delivery === "Yes" ? "Yes — Delivery Office" : "No — Non-Delivery Office";
                return {
                    id: `del-${office.id}`,
                    prompt: `Does "${office.name}" carry out street/beat mail delivery?`,
                    contextLabel: `${office.division || "Sri Lanka"}${office.postalCode ? ` · ${office.postalCode}` : ""}`,
                    options: ["Yes — Delivery Office", "No — Non-Delivery Office"],
                    correctAnswer: correct,
                    explanation:
                        office.delivery === "Yes"
                            ? `${office.name} is a Delivery Office with active postman delivery beats.`
                            : `${office.name} is a Non-Delivery Office${office.controllingOfficeName ? ` (controlled by ${office.controllingOfficeName})` : ""}.`,
                };
            },
        ];

        const builders = shuffle(qTypes);
        for (const build of builders) {
            const q = build();
            if (q) {
                questions.push(q);
                break;
            }
        }
    }

    return questions;
}

const ROUTE_NON_OFFICE_LEFT_RE =
    /^(?:(?:registered|ordinary|air|sea|surface|speed|express|slp|cod|ems|local|domestic|international|foreign|insured|bulk|parcel|letter|letters|packet|packets|postcard|postcards|newspaper|postage|rate|rates|fee|fees|shipping|weight|price|cost|courier|mail)\b|\d+(?:\.\d+)?\s*(?:kg|g|gm|gms|grams?|lkr|rs)\b|\s)+$/i;

function cleanRouteEndpoint(raw: string, side: "origin" | "dest"): string {
    let cleaned = raw.trim();
    if (side === "origin") {
        cleaned = cleaned.replace(
            /^(?:route|forward|forwarding|mail|send|post|bag|dispatch|from)\s+/i,
            ""
        );
        cleaned = cleaned.replace(/^from\s+/i, "");
    } else {
        cleaned = cleaned.replace(/^(?:to)\s+/i, "");
    }
    cleaned = cleaned
        .replace(/\b(?:post\s*office|sub\s*post\s*office|spo|po)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    return cleaned;
}

/**
 * Parses natural routing queries like "kandy to jafna", "from kandy to jaffna",
 * "kandy -> jaffna", "20000 to 40000", or "aw to ky".
 */
export function parseRouteQueryPair(
    rawQuery: string
): { originQuery: string; destQuery: string } | null {
    const trimmed = rawQuery.trim();
    if (!trimmed || trimmed.length < 5) return null;

    // Match explicit arrow or " to " separator (non-greedy left side so "from A to B" splits cleanly)
    const match = trimmed.match(/^(.+?)\s*(?:->|→|=>|\bto\b)\s*(.+)$/i);
    if (!match) return null;

    const rawLeft = match[1].trim();
    const rawRight = match[2].trim();
    if (ROUTE_NON_OFFICE_LEFT_RE.test(rawLeft)) {
        return null;
    }

    const originQuery = cleanRouteEndpoint(rawLeft, "origin");
    const destQuery = cleanRouteEndpoint(rawRight, "dest");

    if (originQuery.length < 2 || destQuery.length < 2) return null;
    if (ROUTE_NON_OFFICE_LEFT_RE.test(originQuery)) return null;

    return { originQuery, destQuery };
}

function boundedRouteEditDist(a: string, b: string, maxDist: number): number {
    const lenA = a.length;
    const lenB = b.length;
    if (Math.abs(lenA - lenB) > maxDist) return maxDist + 1;
    if (lenA === 0) return lenB;
    if (lenB === 0) return lenA;

    let prev = new Array<number>(lenB + 1);
    let curr = new Array<number>(lenB + 1);
    for (let j = 0; j <= lenB; j++) prev[j] = j;

    for (let i = 1; i <= lenA; i++) {
        curr[0] = i;
        let rowMin = curr[0];
        const chA = a.charCodeAt(i - 1);
        for (let j = 1; j <= lenB; j++) {
            const cost = chA === b.charCodeAt(j - 1) ? 0 : 1;
            const val = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
            curr[j] = val;
            if (val < rowMin) rowMin = val;
        }
        if (rowMin > maxDist) return maxDist + 1;
        const tmp = prev;
        prev = curr;
        curr = tmp;
    }
    return prev[lenB];
}

function typePreferenceScore(node: RoutingOfficeNode): number {
    const typeLow = (node.type || "").toLowerCase();
    if (typeLow === "rmsc / sorting hub") return 3;
    if (typeLow === "sub post office") return 2;
    if (typeLow === "agency post office") return 4;
    if (/supra/i.test(node.grade || "")) return 0;
    return 1;
}

/**
 * Resolves a town name, 5-digit postcode, short code, Sinhala/Tamil alias, or typo
 * (e.g. "jafna" -> Jaffna) against loaded RoutingOfficeNode entries.
 */
export function resolveOfficeForRoute(
    rawTerm: string,
    nodes: RoutingOfficeNode[]
): { office: RoutingOfficeNode; isFuzzyMatch: boolean } | null {
    const trimmed = rawTerm.trim();
    if (!trimmed || nodes.length === 0) return null;

    const resolvedTerm = HAS_INDIC_SCRIPT_REGEX.test(trimmed)
        ? (resolveAlias(trimmed) ?? trimmed)
        : trimmed;

    const qLower = resolvedTerm.toLowerCase();
    const qCompact = qLower.replace(/[^a-z0-9]/g, "");
    const paddedCode = /^\d{1,5}$/.test(resolvedTerm) ? normalizePostalCode(resolvedTerm) : "";

    let bestExact: RoutingOfficeNode | null = null;
    let bestExactScore = Infinity;

    let bestPrefix: RoutingOfficeNode | null = null;
    let bestPrefixScore = Infinity;

    let bestFuzzy: RoutingOfficeNode | null = null;
    let bestFuzzyDist = Infinity;
    let bestFuzzyScore = Infinity;

    const maxDist = qCompact.length >= 7 ? 2 : qCompact.length >= 4 ? 1 : 0;

    for (const node of nodes) {
        const nameLower = node.name.trim().toLowerCase();
        const nameCompact = nameLower.replace(/[^a-z0-9]/g, "");
        const shortLower = (node.shortCode || "").trim().toLowerCase();
        const typeScore = typePreferenceScore(node);

        const isExact =
            nameLower === qLower ||
            (qCompact.length >= 2 && nameCompact === qCompact) ||
            (paddedCode !== "" && node.postalCode === paddedCode) ||
            (shortLower !== "" && shortLower === qLower);

        if (isExact) {
            const score = typeScore * 100 + node.name.length;
            if (score < bestExactScore) {
                bestExactScore = score;
                bestExact = node;
            }
            continue;
        }

        const isPrefix =
            nameLower.startsWith(qLower) ||
            (qCompact.length >= 3 && nameCompact.startsWith(qCompact)) ||
            (shortLower !== "" && qLower.length >= 2 && shortLower.startsWith(qLower));

        if (isPrefix) {
            const score = typeScore * 100 + node.name.length;
            if (score < bestPrefixScore) {
                bestPrefixScore = score;
                bestPrefix = node;
            }
            continue;
        }

        if (maxDist > 0 && !/^\d+$/.test(resolvedTerm)) {
            const firstWord = nameLower.split(/[\s(/-]+/)[0] || nameCompact;
            const d1 = boundedRouteEditDist(qCompact, nameCompact, maxDist);
            const d2 = boundedRouteEditDist(qCompact, firstWord, maxDist);
            const dist = Math.min(d1, d2);
            if (dist <= maxDist) {
                const score = typeScore * 100 + node.name.length;
                if (dist < bestFuzzyDist || (dist === bestFuzzyDist && score < bestFuzzyScore)) {
                    bestFuzzyDist = dist;
                    bestFuzzyScore = score;
                    bestFuzzy = node;
                }
            }
        }
    }

    if (bestExact) return { office: bestExact, isFuzzyMatch: false };
    if (bestPrefix) return { office: bestPrefix, isFuzzyMatch: false };
    if (bestFuzzy) return { office: bestFuzzy, isFuzzyMatch: true };
    return null;
}

function isMainOrHubOffice(node: RoutingOfficeNode): boolean {
    return (
        /^post office$/i.test(node.type || "") ||
        /supra|rmsc/i.test(node.grade || node.type || "")
    );
}

function compareRoutingSearchTier(a: RoutingOfficeNode, b: RoutingOfficeNode): number {
    const aMain = isMainOrHubOffice(a);
    const bMain = isMainOrHubOffice(b);
    if (aMain !== bMain) return aMain ? -1 : 1;
    if (a.name.length !== b.name.length) return a.name.length - b.name.length;
    return a.name.localeCompare(b.name);
}

/**
 * Full-scan ranked office search for the Staff Duty Station picker and Mail Route Finder.
 * Evaluates every office so exact/prefix matches (e.g. "kandy") are never truncated by
 * alphabetically earlier Sub Post Offices whose division happens to match.
 */
export function searchRoutingOffices(
    offices: RoutingOfficeNode[],
    rawQuery: string,
    limit = 12
): RoutingOfficeNode[] {
    const trimmed = rawQuery.trim();
    if (!trimmed || offices.length === 0 || limit <= 0) return [];

    const resolvedTerm = HAS_INDIC_SCRIPT_REGEX.test(trimmed)
        ? (resolveAlias(trimmed) ?? trimmed)
        : trimmed;
    const term = resolvedTerm.toLowerCase();
    const compactTerm = term.replace(/[^a-z0-9]/g, "");
    const paddedCode = /^\d{1,5}$/.test(resolvedTerm) ? normalizePostalCode(resolvedTerm) : "";

    const tierExact: RoutingOfficeNode[] = [];
    const tierPrefix: RoutingOfficeNode[] = [];
    const tierContains: RoutingOfficeNode[] = [];
    const tierDivision: RoutingOfficeNode[] = [];

    for (const o of offices) {
        const nameL = o.name.trim().toLowerCase();
        const nameCompact = nameL.replace(/[^a-z0-9]/g, "");
        const codeL = (o.postalCode || "").trim().toLowerCase();
        const shortL = (o.shortCode || "").trim().toLowerCase();
        const divL = (o.division || "").trim().toLowerCase();

        if (
            nameL === term ||
            (compactTerm.length >= 2 && nameCompact === compactTerm) ||
            codeL === term ||
            (paddedCode !== "" && codeL === paddedCode) ||
            (shortL !== "" && shortL === term)
        ) {
            tierExact.push(o);
        } else if (
            nameL.startsWith(term) ||
            (compactTerm.length >= 2 && nameCompact.startsWith(compactTerm)) ||
            codeL.startsWith(term) ||
            (shortL !== "" && shortL.startsWith(term))
        ) {
            tierPrefix.push(o);
        } else if (
            nameL.includes(term) ||
            (compactTerm.length >= 2 && nameCompact.includes(compactTerm))
        ) {
            tierContains.push(o);
        } else if (divL.includes(term)) {
            tierDivision.push(o);
        }
    }

    tierExact.sort(compareRoutingSearchTier);
    tierPrefix.sort(compareRoutingSearchTier);
    tierContains.sort(compareRoutingSearchTier);
    tierDivision.sort(compareRoutingSearchTier);

    const combined = [...tierExact, ...tierPrefix, ...tierContains, ...tierDivision];
    if (combined.length === 0 && term.length >= 3) {
        const fuzzy = resolveOfficeForRoute(resolvedTerm, offices);
        if (fuzzy) {
            return [fuzzy.office];
        }
    }

    return combined.slice(0, limit);
}
