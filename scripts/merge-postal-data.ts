/**
 * Multi-source merge & reconciliation script for Sri Lanka Post offices.
 * Reads (never modifies) `post-office-backup-2026-11-26.json` and merges:
 *   - scripts/cache/postage-lk-locations.json
 *   - scripts/cache/slpost-gov-lk.json
 *   - scripts/cache/osm-post-offices.json
 *   - src/data/offices-fallback.json
 *   - src/data/postal-codes-fallback.json
 *
 * Outputs:
 *   - post-office-enriched-2026-11-26.json (full backup schema)
 *   - src/data/offices-enriched.json (compact runtime dataset)
 *   - scripts/enrichment-report.json (before vs after coverage metrics)
 *
 * Run with: npx tsx scripts/merge-postal-data.ts
 */
import * as fs from "fs";
import * as path from "path";
import * as crypto from "node:crypto";
import { formatSriLankaPhone, normalizePostalCode } from "../src/lib/site";
import { inferHubFromOffice } from "../src/lib/mail-routing";
import type { OsmPostOffice, PostageLkLocation, SlpostOfficeContact } from "./harvest-postal-data";

interface BackupField {
    name: string;
    value: string;
    type: string;
}

interface BackupOffice {
    id: string;
    slug: string;
    name: string;
    postalCode: string;
    latitude: number | null;
    longitude: number | null;
    operatingHours: string | null;
    services: string[];
    createdAt?: string;
    updatedAt?: string;
    controllingOfficeId: string | null;
    rmsc: string | null;
    fields: BackupField[];
}

interface FallbackRow {
    "Office Name"?: string;
    "controlling Office"?: string;
    DS?: string;
    DPMG?: string;
    "PO Code"?: string | number;
    "Delivery / Non Delivery"?: string;
    "Te. No"?: string;
    "Number of SPO"?: string;
}

const ROOT = process.cwd();
const CACHE_DIR = path.join(ROOT, "scripts", "cache");

const EXTENDED_7_TO_9_NAMES = new Set([
    "kurunegala",
    "matara",
    "ratnapura",
    "rathnapura",
    "anuradhapura",
    "kandy",
    "batticaloa",
    "jaffna",
    "badulla",
]);

const EXTENDED_7_TO_8_NAMES = new Set([
    "colombo g. p. o.",
    "colombo gpo",
    "homagama",
    "avissawella",
    "mathugama",
    "matugama",
    "panadura",
    "kalutara",
    "kaluthara",
    "horana",
    "peliyagoda",
    "nittambuwa",
    "gampaha",
    "negombo",
    "puttalam",
    "chilaw",
    "maho",
    "kuliyapitiya",
    "nikaweratiya",
    "elpitiya",
    "ambalangoda",
    "galle",
    "ambalantota",
    "tangalle",
    "hambantota",
    "hambanthota",
    "kegalle",
    "yatiyantota",
    "pelmadulla",
    "embilipitiya",
    "balangoda",
    "habarana",
    "polonnaruwa",
    "medawachchiya",
    "thambuttegama",
    "gampola",
    "matale",
    "dambulla",
    "ginigathhena",
    "nuwara eliya",
    "nuwaraeliya",
    "trincomalee",
    "valachchenai",
    "kantale",
    "kalmunai",
    "ampara",
    "mahaoya",
    "vavuniya",
    "kilinochchi",
    "killinochchi",
    "mannar",
    "tanamalwila",
    "thanamalwila",
    "wellawaya",
    "monaragala",
    "siyambalanduwa",
    "bandarawela",
    "mahiyanganaya",
    "kataragama",
]);

const RMSC_HUB_RECORDS: Array<{
    name: string;
    postalCode: string;
    division: string;
    dpmg: string;
    shortCode: string;
    rmsc: string;
}> = [
    { name: "Kandy RMSC", postalCode: "20000", division: "Kandy (North)", dpmg: "Central", shortCode: "KD-RMSC", rmsc: "Kandy RMSC" },
    { name: "Matara RMSC", postalCode: "81000", division: "Matara", dpmg: "Southern", shortCode: "MR-RMSC", rmsc: "Matara RMSC" },
    { name: "Kurunegala RMSC", postalCode: "60000", division: "Kurunegala (North)", dpmg: "North Western", shortCode: "KG-RMSC", rmsc: "Kurunegala RMSC" },
    { name: "Anuradhapura RMSC", postalCode: "50000", division: "Anuradhapura", dpmg: "North Central", shortCode: "AD-RMSC", rmsc: "Anuradhapura RMSC" },
    { name: "Rathnapura RMSC", postalCode: "70000", division: "Rathnapura", dpmg: "Sabaragamuwa", shortCode: "RN-RMSC", rmsc: "Rathnapura RMSC" },
    { name: "Hatton RMSC", postalCode: "22000", division: "Nuwaraeliya", dpmg: "Central", shortCode: "HN-RMSC", rmsc: "Hatton RMSC" },
    { name: "Badulla RMSC", postalCode: "90000", division: "Badulla", dpmg: "Uva", shortCode: "BD-RMSC", rmsc: "Badulla RMSC" },
    { name: "Batticaloa RMSC", postalCode: "30000", division: "Batticaloa", dpmg: "Eastern", shortCode: "BT-RMSC", rmsc: "Batticaloa RMSC" },
    { name: "Jaffna RMSC", postalCode: "40000", division: "Jaffna", dpmg: "Northern", shortCode: "JA-RMSC", rmsc: "Jaffna RMSC" },
];

const DIVISION_ABBREV_MAP: Record<string, string> = {
    "co(n)": "Colombo (North)",
    "co(s)": "Colombo (South)",
    "co": "Colombo",
    "gp(n)": "Gampaha (North)",
    "gp(s)": "Gampaha (South)",
    "kt": "Kaluthara",
    "ky(n)": "Kandy (North)",
    "ky(s)": "Kandy (South)",
    "mt": "Matale",
    "ne": "Nuwaraeliya",
    "gl": "Galle",
    "mh": "Matara",
    "hb": "Hambanthota",
    "ja": "Jaffna",
    "va": "Vavuniya",
    "mn": "Mannar",
    "bt": "Batticaloa",
    "tr": "Trincomalee",
    "ap": "Ampara",
    "kg(n)": "Kurunegala (North)",
    "kg(s)": "Kurunegala (South)",
    "pt": "Puttalam",
    "ad": "Anuradhapura",
    "pr": "Polonnaruwa",
    "bd": "Badulla",
    "mg": "Monaragala",
    "rn": "Rathnapura",
    "ke": "Kegalle",
};

function normalizeSpelling(raw: string): string {
    return raw
        .toLowerCase()
        .replace(/\bsub\s*post\s*office\b/gi, "")
        .replace(/\bpost\s*office\b/gi, "")
        .replace(/\b(rural\s*)?agency\s*post\s*office\b/gi, "")
        .replace(/\b(spo|apo)\b/gi, "")
        .replace(/rathnapura/g, "ratnapura")
        .replace(/kaluthara/g, "kalutara")
        .replace(/hambanthota/g, "hambantota")
        .replace(/nuwaraeliya/g, "nuwara eliya")
        .replace(/addalachchenai/g, "addalaichenai")
        .replace(/killinochchi/g, "kilinochchi")
        .replace(/thanamalwila/g, "tanamalwila")
        .replace(/bazar/g, "bazaar")
        .replace(/\([^)]*\)/g, " ")
        .replace(/[^a-z0-9]+/g, "")
        .trim();
}

function normalizeDivision(raw?: string | null): string {
    if (!raw) return "";
    const trimmed = raw.trim();
    const mapped = DIVISION_ABBREV_MAP[trimmed.toLowerCase()];
    if (mapped) return mapped;
    return trimmed;
}

function parseFallbackOfficeName(raw: string): {
    cleanName: string;
    shortCode: string;
    postalCode: string;
} {
    const codeMatch = raw.match(/\(\s*(\d{4,5})\s*\)/);
    const postalCode = codeMatch ? normalizePostalCode(codeMatch[1]) : "";

    // Extract short codes like "( ATG )" or "( AW )" - 1-4 uppercase letters
    const shortMatch = raw.match(/\(\s*([A-Z]{1,4})\s*\)/);
    const shortCode = shortMatch ? shortMatch[1].trim().toUpperCase() : "";

    // Handle slash aliases like "Avissawella ( AW ) / Seethawakapura (STP) ( 10700 )" -> keep primary name
    const beforeParen = raw
        .replace(/\(\s*\d{4,5}\s*\)/g, " ")
        .replace(/\(\s*[A-Z]{1,5}\s*\)/g, " ")
        .split("/")[0]
        .replace(/\s+/g, " ")
        .trim();

    return { cleanName: beforeParen, shortCode, postalCode };
}

function formatPhoneList(rawPhones: string[]): string {
    const seenDigits = new Set<string>();
    const formatted: string[] = [];

    for (const raw of rawPhones) {
        // Split multi-number strings on " - ", "/", ",", ";"
        const parts = raw
            .split(/\s+-\s+|[\/,;]+/)
            .map((p) => p.trim())
            .filter(Boolean);
        for (const p of parts) {
            let digits = p.replace(/\D/g, "");
            if (!digits || digits.length < 7) continue;
            // Prefix Colombo 011 when official directory omitted area code on 7-digit 2xxxxxx/4xxxxxx numbers
            if (digits.length === 7 && /^[2457]/.test(digits)) {
                digits = `011${digits}`;
            }
            const clean = formatSriLankaPhone(digits);
            const normDigits = clean.replace(/\D/g, "");
            if (normDigits.length >= 9 && !seenDigits.has(normDigits)) {
                seenDigits.add(normDigits);
                formatted.push(clean);
            }
        }
    }
    return formatted.slice(0, 3).join(" / ");
}

function cleanSlug(name: string, postalCode: string, usedSlugs: Set<string>, idHint: string): string {
    const base =
        name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "office";
    let candidate = postalCode ? `${base}-${postalCode}` : base;
    if (usedSlugs.has(candidate)) {
        candidate = `${base}-${idHint.slice(-5)}`;
    }
    usedSlugs.add(candidate);
    return candidate;
}

function makeStableId(seed: string): string {
    const hash = crypto.createHash("sha1").update(seed).digest("hex").slice(0, 20);
    return `enr${hash}`;
}

function normalizeOfficeType(rawType: string, name: string): string {
    const low = `${rawType} ${name}`.toLowerCase();
    if (/\brmsc\b|\bsorting\s*hub\b/i.test(name)) return "RMSC / Sorting Hub";
    if (/agency\s*post|\bapo\b/i.test(low)) return "Agency Post Office";
    if (/sub\s*post/i.test(rawType)) return "Sub Post Office";
    return "Post Office";
}

function determineWorkingHours(
    name: string,
    type: string,
    is24Hour: boolean
): string {
    if (type === "RMSC / Sorting Hub") {
        return "24 Hours (Mail Sorting Operations)";
    }
    if (is24Hour) {
        return "Open 24 Hours";
    }
    const nameLow = name.trim().toLowerCase();
    if (EXTENDED_7_TO_9_NAMES.has(nameLow) && type === "Post Office") {
        return "Mon–Sat 7:00 AM – 9:00 PM";
    }
    if (EXTENDED_7_TO_8_NAMES.has(nameLow) && type === "Post Office") {
        return "Mon–Sat 7:00 AM – 8:00 PM";
    }
    if (type === "Agency Post Office") {
        return "Mon–Fri 8:30 AM – 4:30 PM (Varies by agency)";
    }
    if (type === "Sub Post Office") {
        return "Mon–Fri 8:30 AM – 4:00 PM · Sat 8:30 AM – 12:30 PM";
    }
    return "Mon–Fri 8:30 AM – 4:30 PM · Sat 8:30 AM – 1:00 PM";
}

function getField(fields: BackupField[], name: string): string {
    return fields.find((f) => f.name === name)?.value?.trim() || "";
}

function upsertField(fields: BackupField[], name: string, value: string, type = "TEXT") {
    const trimmed = value.trim();
    if (!trimmed) return;
    const existing = fields.find((f) => f.name === name);
    if (existing) {
        existing.value = trimmed;
    } else {
        fields.push({ name, value: trimmed, type });
    }
}

function loadJsonIfExists<T>(filePath: string, fallback: T): T {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function computeStats(offices: BackupOffice[]) {
    const total = offices.length;
    const withPhone = offices.filter((o) => Boolean(getField(o.fields, "Phone"))).length;
    const withFax = offices.filter((o) => Boolean(getField(o.fields, "Fax"))).length;
    const withPostcode = offices.filter((o) => /^\d{5}$/.test(o.postalCode)).length;
    const unpaddedPostcode = offices.filter((o) => o.postalCode && !/^\d{5}$/.test(o.postalCode)).length;
    const withShortCode = offices.filter((o) => Boolean(getField(o.fields, "Short Code"))).length;
    const withDelivery = offices.filter((o) => Boolean(getField(o.fields, "Delivery"))).length;
    const withGrade = offices.filter((o) => Boolean(getField(o.fields, "Grade"))).length;
    const withControlling = offices.filter((o) => Boolean(o.controllingOfficeId)).length;
    const withRmsc = offices.filter((o) => Boolean(o.rmsc)).length;
    const withCoords = offices.filter((o) => o.latitude !== null && o.longitude !== null).length;
    const withNonDefaultHours = offices.filter(
        (o) => o.operatingHours && o.operatingHours !== "8:00 AM - 4:00 PM (Weekdays)"
    ).length;

    const byType: Record<string, number> = {};
    for (const o of offices) {
        const t = getField(o.fields, "Type") || "Unknown";
        byType[t] = (byType[t] || 0) + 1;
    }

    return {
        total,
        withPhone,
        withFax,
        withPostcode,
        unpaddedPostcode,
        withShortCode,
        withDelivery,
        withGrade,
        withControlling,
        withRmsc,
        withCoords,
        withNonDefaultHours,
        byType,
    };
}

function main() {
    const backupPath = path.join(ROOT, "post-office-backup-2026-11-26.json");
    const backupOffices = JSON.parse(fs.readFileSync(backupPath, "utf8")) as BackupOffice[];
    const beforeStats = computeStats(backupOffices);

    const fallbackRaw = loadJsonIfExists<{ Main?: FallbackRow[] }>(
        path.join(ROOT, "src", "data", "offices-fallback.json"),
        { Main: [] }
    );
    const fallbackRows = fallbackRaw.Main || [];
    const postcodeFallback = loadJsonIfExists<Record<string, string>>(
        path.join(ROOT, "src", "data", "postal-codes-fallback.json"),
        {}
    );
    const slpostContacts = loadJsonIfExists<SlpostOfficeContact[]>(
        path.join(CACHE_DIR, "slpost-gov-lk.json"),
        []
    );
    const postageLocations = loadJsonIfExists<PostageLkLocation[]>(
        path.join(CACHE_DIR, "postage-lk-locations.json"),
        []
    );
    const osmOffices = loadJsonIfExists<OsmPostOffice[]>(
        path.join(CACHE_DIR, "osm-post-offices.json"),
        []
    );

    console.log(
        `Loaded sources -> backup:${backupOffices.length}, fallback:${fallbackRows.length}, slpost:${slpostContacts.length}, postage.lk:${postageLocations.length}, osm:${osmOffices.length}`
    );

    // Clone backup offices and deduplicate empty-postcode duplicates
    const namesWithValidCode = new Set<string>();
    for (const o of backupOffices) {
        const normCode = normalizePostalCode(o.postalCode);
        if (normCode) namesWithValidCode.add(normalizeSpelling(o.name));
    }

    const offices: BackupOffice[] = [];
    const usedSlugs = new Set<string>();
    for (const raw of backupOffices) {
        const rawCode = (raw.postalCode || "").trim();
        const isLettersOnly = /^[A-Za-z]{2,5}$/.test(rawCode);
        const normCode = isLettersOnly ? "" : normalizePostalCode(rawCode);
        if (!normCode && namesWithValidCode.has(normalizeSpelling(raw.name))) {
            continue;
        }
        const clone: BackupOffice = {
            ...raw,
            name: raw.name.trim(),
            postalCode: normCode,
            services: Array.isArray(raw.services) ? [...raw.services] : [],
            fields: (raw.fields || []).map((f) => ({ ...f })),
        };
        if (isLettersOnly && !getField(clone.fields, "Short Code")) {
            upsertField(clone.fields, "Short Code", rawCode.toUpperCase());
        } else if (isLettersOnly && /^\d{4,5}$/.test(getField(clone.fields, "Short Code"))) {
            const numericFromShort = normalizePostalCode(getField(clone.fields, "Short Code"));
            if (/^\d{5}$/.test(numericFromShort)) {
                clone.postalCode = numericFromShort;
            }
            const scField = clone.fields.find((f) => f.name === "Short Code");
            if (scField) scField.value = rawCode.toUpperCase();
        }
        usedSlugs.add(clone.slug);
        offices.push(clone);
    }

    // Build lookup indexes on `offices`
    const byNormName = new Map<string, BackupOffice[]>();
    const byPostcode = new Map<string, BackupOffice[]>();
    const byId = new Map<string, BackupOffice>();

    const indexOffice = (o: BackupOffice) => {
        byId.set(o.id, o);
        const key = normalizeSpelling(o.name);
        if (key) {
            const arr = byNormName.get(key) || [];
            arr.push(o);
            byNormName.set(key, arr);
        }
        if (o.postalCode) {
            const arr = byPostcode.get(o.postalCode) || [];
            arr.push(o);
            byPostcode.set(o.postalCode, arr);
        }
    };
    offices.forEach(indexOffice);

    const findBestMatch = (
        rawName: string,
        rawCode?: string,
        rawDivision?: string
    ): BackupOffice | null => {
        const normCode = normalizePostalCode(rawCode);
        const normName = normalizeSpelling(rawName);
        const normDiv = normalizeSpelling(normalizeDivision(rawDivision));

        const candidates = byNormName.get(normName) || [];
        if (candidates.length === 1) {
            const single = candidates[0];
            // If both have distinct postcodes, don't merge wrongly
            if (normCode && single.postalCode && normCode !== single.postalCode) {
                return null;
            }
            return single;
        }
        if (candidates.length > 1) {
            if (normCode) {
                const codeHit = candidates.find((c) => c.postalCode === normCode);
                if (codeHit) return codeHit;
            }
            if (normDiv) {
                const divHit = candidates.find(
                    (c) => normalizeSpelling(getField(c.fields, "Division")) === normDiv
                );
                if (divHit) return divHit;
            }
            return candidates[0];
        }
        if (normCode) {
            const codeCandidates = byPostcode.get(normCode) || [];
            if (codeCandidates.length === 1 && normName.length >= 4) {
                const candNorm = normalizeSpelling(codeCandidates[0].name);
                if (candNorm.startsWith(normName.slice(0, 4)) || normName.startsWith(candNorm.slice(0, 4))) {
                    return codeCandidates[0];
                }
            }
        }
        return null;
    };

    // 1. Merge postage.lk (adds missing offices, enriches postalCode, shortCode, grade, delivery, DS/DPMG)
    let addedFromPostageLk = 0;
    const postageCtrlLinks: Array<{ office: BackupOffice; ctrlName: string; div: string }> = [];

    for (const loc of postageLocations) {
        let target = findBestMatch(loc.name, loc.postalCode, loc.dsDivision);
        if (!target) {
            const normCode = /^\d{5}$/.test(normalizePostalCode(loc.postalCode))
            ? normalizePostalCode(loc.postalCode)
            : "";
            const id = makeStableId(`postage:${loc.slugId || loc.name}:${normCode}`);
            const slug = cleanSlug(loc.name, normCode, usedSlugs, id);
            target = {
                id,
                slug,
                name: loc.name.trim(),
                postalCode: normCode,
                latitude: null,
                longitude: null,
                operatingHours: null,
                services: [],
                controllingOfficeId: null,
                rmsc: null,
                fields: [],
            };
            offices.push(target);
            indexOffice(target);
            addedFromPostageLk++;
        }

        const normCode = /^\d{5}$/.test(normalizePostalCode(loc.postalCode))
            ? normalizePostalCode(loc.postalCode)
            : "";
        if (!target.postalCode && normCode) {
            target.postalCode = normCode;
        }
        if (loc.shortCode) {
            upsertField(target.fields, "Short Code", loc.shortCode.toUpperCase());
        }
        if (loc.grade) {
            upsertField(target.fields, "Grade", loc.grade);
        }
        if (loc.delivery === "Yes" || loc.delivery === "No") {
            upsertField(target.fields, "Delivery", loc.delivery);
        }
        if (loc.dsDivision && !getField(target.fields, "Division")) {
            upsertField(target.fields, "Division", loc.dsDivision);
        }
        if (loc.dpmgDivision) {
            upsertField(target.fields, "DPMG", loc.dpmgDivision);
        }
        if (loc.type) {
            const curType = getField(target.fields, "Type");
            if (!curType || curType === "Post office" || curType === "Sub Post office") {
                upsertField(target.fields, "Type", normalizeOfficeType(loc.type, target.name));
            }
        }
        if (loc.controllingOffice) {
            postageCtrlLinks.push({
                office: target,
                ctrlName: loc.controllingOffice,
                div: loc.dsDivision,
            });
        }
    }

    // 2. Merge local offices-fallback.json (3,850 phones, 100% delivery, 1,442 short codes, 3,381 controlling links)
    const fallbackCtrlLinks: Array<{ office: BackupOffice; ctrlName: string; div: string }> = [];
    for (const row of fallbackRows) {
        const rawName = String(row["Office Name"] || "").trim();
        if (!rawName) continue;
        const { cleanName, shortCode, postalCode: nameCode } = parseFallbackOfficeName(rawName);
        if (!cleanName) continue;

        const rawPoNorm = normalizePostalCode(String(row["PO Code"] ?? ""));
        const rowCode = (/^\d{5}$/.test(rawPoNorm) ? rawPoNorm : "") || nameCode;
        const rowDiv = normalizeDivision(row.DS);
        const target = findBestMatch(cleanName, rowCode, rowDiv);
        if (!target) continue;

        if (!target.postalCode && rowCode) {
            target.postalCode = rowCode;
        }
        if (shortCode && !getField(target.fields, "Short Code")) {
            upsertField(target.fields, "Short Code", shortCode);
        }
        const rawDel = String(row["Delivery / Non Delivery"] || "").trim();
        if (rawDel && !getField(target.fields, "Delivery")) {
            if (/^delivery$/i.test(rawDel)) upsertField(target.fields, "Delivery", "Yes");
            else if (/non[\s-]*delivery/i.test(rawDel)) upsertField(target.fields, "Delivery", "No");
        }
        if (row.DPMG && row.DPMG.trim() && !getField(target.fields, "DPMG")) {
            upsertField(target.fields, "DPMG", row.DPMG.trim());
        }
        const rawPhone = String(row["Te. No"] || "").trim();
        if (rawPhone && rawPhone !== "0" && rawPhone !== "-") {
            const formatted = formatPhoneList([rawPhone]);
            if (formatted && !getField(target.fields, "Phone")) {
                upsertField(target.fields, "Phone", formatted);
            }
        }
        const rawCtrl = String(row["controlling Office"] || "").trim();
        if (rawCtrl && rawCtrl !== "#N/A" && rawCtrl !== "N/A") {
            const { cleanName: ctrlClean } = parseFallbackOfficeName(rawCtrl);
            if (ctrlClean) {
                fallbackCtrlLinks.push({ office: target, ctrlName: ctrlClean, div: rowDiv });
            }
        }
    }

    // 3. Fill remaining postcodes from postal-codes-fallback.json
    const fallbackCodeMap = new Map<string, string>();
    for (const [k, v] of Object.entries(postcodeFallback)) {
        const c = normalizePostalCode(v);
        if (c) fallbackCodeMap.set(normalizeSpelling(k), c);
    }
    for (const o of offices) {
        if (!o.postalCode) {
            const code = fallbackCodeMap.get(normalizeSpelling(o.name));
            if (code) o.postalCode = code;
        }
    }

    // 4. Merge official slpost.gov.lk phone & fax directories (highest priority for phones)
    const slpostByNorm = new Map<string, SlpostOfficeContact[]>();
    for (const entry of slpostContacts) {
        const key = normalizeSpelling(entry.name);
        if (!key) continue;
        const arr = slpostByNorm.get(key) || [];
        arr.push(entry);
        slpostByNorm.set(key, arr);
    }

    for (const o of offices) {
        const key = normalizeSpelling(o.name);
        const matches = slpostByNorm.get(key);
        if (!matches || matches.length === 0) continue;

        const isMain = getField(o.fields, "Type").toLowerCase() === "post office";
        const preferred =
            matches.find((m) => (isMain ? m.source === "main" : m.source !== "main")) || matches[0];

        const existingPhone = getField(o.fields, "Phone");
        const officialPhones = formatPhoneList(preferred.phones);
        if (officialPhones) {
            // Merge official + existing without duplicates
            const combined = formatPhoneList([officialPhones, existingPhone].filter(Boolean));
            if (combined) upsertField(o.fields, "Phone", combined);
        }
        const officialFaxes = formatPhoneList(preferred.faxes);
        if (officialFaxes) {
            upsertField(o.fields, "Fax", officialFaxes);
        }
    }

    // Format any remaining existing Phone/Fax fields cleanly
    for (const o of offices) {
        const p = getField(o.fields, "Phone");
        if (p) {
            const fp = formatPhoneList([p]);
            if (fp) upsertField(o.fields, "Phone", fp);
        }
        const fx = getField(o.fields, "Fax");
        if (fx) {
            const ffx = formatPhoneList([fx]);
            if (ffx) upsertField(o.fields, "Fax", ffx);
        }
    }

    // 5. Add RMSC / Sorting Hubs as dedicated searchable records
    let addedRmscs = 0;
    for (const hub of RMSC_HUB_RECORDS) {
        if (byNormName.has(normalizeSpelling(hub.name))) continue;
        const id = makeStableId(`rmsc:${hub.name}`);
        const slug = cleanSlug(hub.name, "", usedSlugs, id);
        const hubOffice: BackupOffice = {
            id,
            slug,
            name: hub.name,
            postalCode: hub.postalCode,
            latitude: null,
            longitude: null,
            operatingHours: "24 Hours (Mail Sorting Operations)",
            services: ["regional sorting unit"],
            controllingOfficeId: null,
            rmsc: hub.rmsc,
            fields: [
                { name: "Type", value: "RMSC / Sorting Hub", type: "TEXT" },
                { name: "Division", value: hub.division, type: "TEXT" },
                { name: "DPMG", value: hub.dpmg, type: "TEXT" },
                { name: "Short Code", value: hub.shortCode, type: "TEXT" },
                { name: "Delivery", value: "No", type: "TEXT" },
                { name: "Is24Hour", value: "true", type: "TEXT" },
                { name: "Working Hours", value: "24 Hours (Mail Sorting Operations)", type: "TEXT" },
            ],
        };
        offices.push(hubOffice);
        indexOffice(hubOffice);
        addedRmscs++;
    }

    // 6. Add verified Agency Post Offices (APOs) & coordinates from OSM
    let addedOsmApos = 0;
    let matchedCoords = 0;
    for (const osm of osmOffices) {
        const isApo = /\bagency\b|\bapo\b/i.test(osm.name);
        const normCode = normalizePostalCode(osm.postcode);
        const normName = normalizeSpelling(osm.name);

        let target: BackupOffice | null = null;
        const candidates = byNormName.get(normName) || [];
        if (candidates.length === 1) {
            target = candidates[0];
        } else if (candidates.length > 1 && normCode) {
            target = candidates.find((c) => c.postalCode === normCode) || null;
        }

        if (target) {
            if (target.latitude === null || target.longitude === null) {
                target.latitude = Number(osm.lat.toFixed(6));
                target.longitude = Number(osm.lon.toFixed(6));
                matchedCoords++;
            }
            if (osm.phone && !getField(target.fields, "Phone")) {
                const fp = formatPhoneList([osm.phone]);
                if (fp) upsertField(target.fields, "Phone", fp);
            }
            if (isApo && getField(target.fields, "Type") !== "Post Office") {
                upsertField(target.fields, "Type", "Agency Post Office");
            }
        } else if (isApo && osm.name.length >= 4) {
            const id = makeStableId(`osm-apo:${osm.osmType}:${osm.osmId}`);
            const slug = cleanSlug(osm.name, normCode, usedSlugs, id);
            const apoOffice: BackupOffice = {
                id,
                slug,
                name: osm.name.trim(),
                postalCode: normCode,
                latitude: Number(osm.lat.toFixed(6)),
                longitude: Number(osm.lon.toFixed(6)),
                operatingHours: null,
                services: [],
                controllingOfficeId: null,
                rmsc: null,
                fields: [
                    { name: "Type", value: "Agency Post Office", type: "TEXT" },
                    { name: "Delivery", value: "No", type: "TEXT" },
                ],
            };
            if (osm.phone) {
                const fp = formatPhoneList([osm.phone]);
                if (fp) upsertField(apoOffice.fields, "Phone", fp);
            }
            offices.push(apoOffice);
            indexOffice(apoOffice);
            addedOsmApos++;
        }
    }

    // 7. Resolve missing controllingOfficeId links (postage.lk + fallback)
    const resolveCtrlTarget = (ctrlName: string, div: string): BackupOffice | null => {
        const candidates = byNormName.get(normalizeSpelling(ctrlName)) || [];
        if (candidates.length === 0) return null;
        if (candidates.length === 1) return candidates[0];
        const normDiv = normalizeSpelling(normalizeDivision(div));
        return (
            candidates.find(
                (c) =>
                    normalizeSpelling(getField(c.fields, "Division")) === normDiv &&
                    getField(c.fields, "Type") === "Post Office"
            ) ||
            candidates.find((c) => getField(c.fields, "Type") === "Post Office") ||
            candidates[0]
        );
    };

    for (const link of [...postageCtrlLinks, ...fallbackCtrlLinks]) {
        if (link.office.controllingOfficeId && byId.has(link.office.controllingOfficeId)) continue;
        const parent = resolveCtrlTarget(link.ctrlName, link.div);
        if (parent && parent.id !== link.office.id) {
            link.office.controllingOfficeId = parent.id;
        }
    }

    // Clear any broken or self-referential controllingOfficeId
    for (const o of offices) {
        if (o.controllingOfficeId && (!byId.has(o.controllingOfficeId) || o.controllingOfficeId === o.id)) {
            o.controllingOfficeId = null;
        }
    }

    // 8. Propagate RMSC from Controlling Office -> Sub Post Offices, then infer from zone/division
    for (const o of offices) {
        if (!o.rmsc && o.controllingOfficeId) {
            const parent = byId.get(o.controllingOfficeId);
            if (parent?.rmsc) {
                o.rmsc = parent.rmsc;
            }
        }
    }
    for (const o of offices) {
        if (!o.rmsc) {
            o.rmsc = inferHubFromOffice({
                rmsc: null,
                postalCode: o.postalCode,
                division: getField(o.fields, "Division"),
            });
        }
    }

    // 9. Normalize Type, Grade, Delivery (default Post Office -> Yes if missing), and Working Hours
    for (const o of offices) {
        const rawType = getField(o.fields, "Type");
        const cleanType = normalizeOfficeType(rawType, o.name);
        upsertField(o.fields, "Type", cleanType);

        if (!getField(o.fields, "Delivery") && cleanType === "Post Office") {
            upsertField(o.fields, "Delivery", "Yes");
        }

        const is24Hour = getField(o.fields, "Is24Hour") === "true";
        const hours = determineWorkingHours(o.name, cleanType, is24Hour);
        o.operatingHours = hours;
        upsertField(o.fields, "Working Hours", hours);
    }

    // Sort cleanly by name
    offices.sort((a, b) => a.name.localeCompare(b.name));

    const afterStats = computeStats(offices);
    const report = {
        generatedAt: new Date().toISOString(),
        sources: {
            backup: backupOffices.length,
            postageLk: postageLocations.length,
            slpostGovLk: slpostContacts.length,
            osm: osmOffices.length,
            addedFromPostageLk,
            addedRmscs,
            addedOsmApos,
            matchedCoords,
        },
        before: beforeStats,
        after: afterStats,
    };

    // Write outputs
    const enrichedBackupPath = path.join(ROOT, "post-office-enriched-2026-11-26.json");
    fs.writeFileSync(enrichedBackupPath, JSON.stringify(offices, null, 2));

    // Compact runtime JSON for src/data/offices-enriched.json
    const compactRuntime = offices.map((o) => ({
        id: o.id,
        slug: o.slug,
        name: o.name,
        postalCode: o.postalCode,
        ...(o.operatingHours ? { operatingHours: o.operatingHours } : {}),
        ...(o.services.length > 0 ? { services: o.services } : {}),
        ...(o.rmsc ? { rmsc: o.rmsc } : {}),
        ...(o.latitude !== null ? { latitude: o.latitude } : {}),
        ...(o.longitude !== null ? { longitude: o.longitude } : {}),
        ...(o.controllingOfficeId ? { controllingOfficeId: o.controllingOfficeId } : {}),
        fields: o.fields.map((f) => ({ name: f.name, value: f.value })),
    }));
    const compactPath = path.join(ROOT, "src", "data", "offices-enriched.json");
    fs.writeFileSync(compactPath, JSON.stringify(compactRuntime));

    const reportPath = path.join(ROOT, "scripts", "enrichment-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log("\n=== Enrichment Report ===");
    console.log(JSON.stringify(report, null, 2));
    console.log(
        `Compact runtime size: ${(fs.statSync(compactPath).size / (1024 * 1024)).toFixed(2)} MB`
    );
}

main();
