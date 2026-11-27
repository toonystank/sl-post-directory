import type { PostOffice, SearchMode, SearchResponse } from "@/components/directory/types";
import { formatSriLankaPhone, normalizePostalCode, postalCodeSearchVariants } from "./site";
import { HAS_INDIC_SCRIPT_REGEX, resolveAlias } from "./place-aliases";
import { normalizePlaceName, type PlaceDictionary, type PlaceRecord } from "./address-extract";
import type { RoutingOfficeNode } from "./mail-routing";

/**
 * Compact tuple row for a single post office (v3):
 * [0] id
 * [1] slug
 * [2] name
 * [3] postalCode
 * [4] divisionIdx (-1 if none)
 * [5] typeIdx (-1 if default "Post Office")
 * [6] phone ("" if none)
 * [7] flagsBitmask (bit 0 = is24Hour, bit 1 = deliveryYes, bit 2 = deliveryNo, bit 3 = isSupra, bit 4 = isControlling)
 * [8] serviceIndices (indices into `s[]` lookup table)
 * [9] shortCode ("" if none)
 * [10] rmscIdx (-1 if none, index into `m[]`)
 * [11] controllingIdx (-1 if none, index into `r[]`)
 * [12] hoursIdx (-1 if none, index into `h[]`)
 */
export type CompactOfficeRow = [
    string,
    string,
    string,
    string,
    number,
    number,
    string,
    number,
    number[],
    string?,
    number?,
    number?,
    number?
];

export interface CompactOfficeIndex {
    v: string;
    count: number;
    d: string[];
    t: string[];
    s: string[];
    m?: string[]; // RMSC / TPO lookup table
    h?: string[]; // Working hours lookup table
    r: CompactOfficeRow[];
}

export interface OfficeIndexSourceRecord {
    id: string;
    slug: string;
    name: string;
    postalCode: string;
    operatingHours?: string | null;
    rmsc?: string | null;
    controllingOfficeId?: string | null;
    services?: string[];
    fields?: { name: string; value: string }[];
}

const FLAG_IS_24_HOUR = 1 << 0;
const FLAG_DELIVERY_YES = 1 << 1;
const FLAG_DELIVERY_NO = 1 << 2;
const FLAG_IS_SUPRA = 1 << 3;
const FLAG_IS_CONTROLLING = 1 << 4;

function fnv1aHash(input: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
}

/**
 * Encodes all Sri Lanka post offices into a dictionary-compressed tuple index.
 */
export function encodeOfficeIndex(records: OfficeIndexSourceRecord[]): CompactOfficeIndex {
    const divisionMap = new Map<string, number>();
    const typeMap = new Map<string, number>();
    const serviceMap = new Map<string, number>();
    const rmscMap = new Map<string, number>();
    const hoursMap = new Map<string, number>();

    const divisions: string[] = [];
    const types: string[] = [];
    const services: string[] = [];
    const rmscs: string[] = [];
    const hoursList: string[] = [];

    const intern = (map: Map<string, number>, arr: string[], raw?: string | null): number => {
        const val = (raw || "").trim();
        if (!val) return -1;
        const existing = map.get(val);
        if (existing !== undefined) return existing;
        const idx = arr.length;
        arr.push(val);
        map.set(val, idx);
        return idx;
    };

    // Deduplicate obvious lowercase/empty-postcode duplicates
    const namesWithPostalCode = new Set<string>();
    for (const rec of records) {
        if (normalizePostalCode(rec.postalCode)) {
            namesWithPostalCode.add(rec.name.trim().toLowerCase());
        }
    }
    const cleanedRecords = records.filter((rec) => {
        const hasCode = Boolean(normalizePostalCode(rec.postalCode));
        if (hasCode) return true;
        return !namesWithPostalCode.has(rec.name.trim().toLowerCase());
    });

    const sorted = [...cleanedRecords].sort((a, b) => a.name.localeCompare(b.name));
    const idToSortedIdx = new Map<string, number>();
    const controllingIds = new Set<string>();
    for (let i = 0; i < sorted.length; i++) {
        idToSortedIdx.set(sorted[i].id, i);
        if (sorted[i].controllingOfficeId) {
            controllingIds.add(sorted[i].controllingOfficeId!);
        }
    }

    const rows: CompactOfficeRow[] = new Array(sorted.length);
    const hashChunks: string[] = [String(sorted.length)];

    for (let i = 0; i < sorted.length; i++) {
        const rec = sorted[i];
        let division = "";
        let type = "";
        let phone = "";
        let shortCode = "";
        let delivery = "";
        let grade = "";
        let workingHours = rec.operatingHours?.trim() || "";
        let is24Hour = false;

        if (rec.fields) {
            for (const f of rec.fields) {
                if (f.name === "Division") division = f.value;
                else if (f.name === "Type") type = f.value;
                else if (f.name === "Short Code") shortCode = f.value.trim().toUpperCase();
                else if (f.name === "Delivery") delivery = f.value.trim();
                else if (f.name === "Grade") grade = f.value.trim();
                else if (f.name === "Working Hours" && !workingHours) workingHours = f.value.trim();
                else if (f.name === "Phone" || f.name === "Telephone") {
                    if (!phone && f.value) phone = formatSriLankaPhone(f.value);
                } else if (f.name === "Is24Hour" && f.value === "true") {
                    is24Hour = true;
                }
            }
        }

        const divIdx = intern(divisionMap, divisions, division);
        const normalizedType = type === "Post office" ? "Post Office" : type;
        const typeIdx = intern(typeMap, types, normalizedType === "Post Office" ? "" : normalizedType);
        const rmscIdx = intern(rmscMap, rmscs, rec.rmsc);
        const hoursIdx = intern(hoursMap, hoursList, workingHours);

        const svcIndices: number[] = [];
        if (rec.services && rec.services.length > 0) {
            for (const svc of rec.services) {
                const idx = intern(serviceMap, services, svc);
                if (idx >= 0 && !svcIndices.includes(idx)) svcIndices.push(idx);
            }
        }

        let flags = 0;
        if (is24Hour) flags |= FLAG_IS_24_HOUR;
        if (/^yes|delivery$/i.test(delivery)) flags |= FLAG_DELIVERY_YES;
        else if (/^no|non[\s-]*delivery$/i.test(delivery)) flags |= FLAG_DELIVERY_NO;
        if (/supra/i.test(grade) || /supra/i.test(normalizedType)) flags |= FLAG_IS_SUPRA;
        if (controllingIds.has(rec.id)) flags |= FLAG_IS_CONTROLLING;

        const postalCode = normalizePostalCode(rec.postalCode);
        const controllingIdx =
            rec.controllingOfficeId && idToSortedIdx.has(rec.controllingOfficeId)
                ? idToSortedIdx.get(rec.controllingOfficeId)!
                : -1;

        rows[i] = [
            rec.id,
            rec.slug,
            rec.name,
            postalCode,
            divIdx,
            typeIdx,
            phone,
            flags,
            svcIndices,
            shortCode,
            rmscIdx,
            controllingIdx,
            hoursIdx,
        ];

        if (i < 16 || i % 37 === 0 || i === sorted.length - 1) {
            hashChunks.push(`${rec.slug}:${postalCode}:${divIdx}:${flags}:${shortCode}:${rmscIdx}:${hoursIdx}`);
        }
    }

    const version = `v4-${sorted.length}-${fnv1aHash(hashChunks.join("|"))}`;
    return {
        v: version,
        count: sorted.length,
        d: divisions,
        t: types,
        s: services,
        m: rmscs,
        h: hoursList,
        r: rows,
    };
}

export function isValidCompactOfficeIndex(value: unknown): value is CompactOfficeIndex {
    if (!value || typeof value !== "object") return false;
    const obj = value as Partial<CompactOfficeIndex>;
    return (
        typeof obj.v === "string" &&
        Array.isArray(obj.d) &&
        Array.isArray(obj.t) &&
        Array.isArray(obj.s) &&
        Array.isArray(obj.r)
    );
}

/**
 * Reconstructs a PostOffice card object from a compact index tuple.
 */
export function decodeOfficeRowToPostOffice(
    index: CompactOfficeIndex,
    row: CompactOfficeRow,
    children?: CompactOfficeRow[]
): PostOffice {
    const [
        id,
        slug,
        name,
        postalCode,
        divIdx,
        typeIdx,
        phone,
        flags,
        svcIndices,
        shortCode = "",
        rmscIdx = -1,
        controllingIdx = -1,
        hoursIdx = -1,
    ] = row;

    const fields: { name: string; value: string }[] = [
        { name: "Type", value: typeIdx >= 0 ? (index.t[typeIdx] || "Post Office") : "Post Office" },
    ];
    if (divIdx >= 0 && index.d[divIdx]) {
        fields.push({ name: "Division", value: index.d[divIdx] });
    }
    if (phone) {
        fields.push({ name: "Phone", value: phone });
    }
    if (shortCode) {
        fields.push({ name: "Short Code", value: shortCode });
    }
    if ((flags & FLAG_DELIVERY_YES) !== 0) {
        fields.push({ name: "Delivery", value: "Yes" });
    } else if ((flags & FLAG_DELIVERY_NO) !== 0) {
        fields.push({ name: "Delivery", value: "No" });
    }
    if ((flags & FLAG_IS_SUPRA) !== 0) {
        fields.push({ name: "Grade", value: "Supra" });
    }
    if ((flags & FLAG_IS_24_HOUR) !== 0) {
        fields.push({ name: "Is24Hour", value: "true" });
    }

    const operatingHours = hoursIdx >= 0 && index.h?.[hoursIdx] ? index.h[hoursIdx] : null;
    if (operatingHours) {
        fields.push({ name: "Working Hours", value: operatingHours });
    }

    const services = svcIndices
        .map((idx) => index.s[idx])
        .filter((s): s is string => Boolean(s));

    const rmsc = rmscIdx >= 0 && index.m?.[rmscIdx] ? index.m[rmscIdx] : null;
    const ctrlRow = controllingIdx >= 0 ? index.r[controllingIdx] : undefined;
    const controllingOffice = ctrlRow
        ? {
              id: ctrlRow[0],
              slug: ctrlRow[1],
              name: ctrlRow[2],
              postalCode: ctrlRow[3],
              shortCode: ctrlRow[9] || "",
          }
        : null;

    const controlledOffices = children?.map((c) => ({
        id: c[0],
        slug: c[1],
        name: c[2],
        postalCode: c[3],
        shortCode: c[9] || "",
        delivery: (c[7] & FLAG_DELIVERY_YES) !== 0 ? "Yes" : (c[7] & FLAG_DELIVERY_NO) !== 0 ? "No" : "",
    }));

    return {
        id,
        slug,
        name,
        postalCode,
        operatingHours,
        services,
        fields,
        rmsc,
        controllingOffice,
        ...(controlledOffices && controlledOffices.length > 0 ? { controlledOffices } : {}),
    };
}

interface PreparedRow {
    row: CompactOfficeRow;
    nameLower: string;
    nameCompact: string;
    codeLower: string;
    codeStripped: string;
    shortCodeLower: string;
    firstChar: string;
    divisionLower: string;
    typeLower: string;
    is24Hour: boolean;
    deliveryYes: boolean;
    deliveryNo: boolean;
    isSupra: boolean;
    rmscLower: string;
    servicesLower: string[];
}

function cleanOfficeSearchTerm(raw: string): string {
    const stripped = raw
        .replace(/\b(post\s*office|main|branch|sub)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    return stripped || raw.trim();
}

function boundedEditDistance(a: string, b: string, maxDist: number): number {
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

function fuzzyMatchesName(item: PreparedRow, qLower: string, qCompact: string): boolean {
    if (qLower.length < 4) return false;
    if (item.nameCompact.includes(qCompact)) return true;

    const maxDist = qLower.length >= 7 ? 2 : 1;
    const candidateLen = Math.min(item.nameLower.length, qLower.length + maxDist);
    const candidatePrefix = item.nameLower.slice(0, candidateLen);
    if (boundedEditDistance(qLower, candidatePrefix, maxDist) <= maxDist) {
        return true;
    }
    const firstWord = item.nameLower.split(" ")[0];
    if (firstWord && Math.abs(firstWord.length - qLower.length) <= maxDist) {
        return boundedEditDistance(qLower, firstWord, maxDist) <= maxDist;
    }
    return false;
}

export interface LocalQueryParams {
    q?: string;
    mode?: SearchMode;
    letter?: string | null;
    service?: string | null;
    division?: string | null;
    officeType?: string | null;
    is24Hour?: boolean;
    delivery?: "yes" | "no" | null;
    rmsc?: string | null;
    cursor?: number;
    limit?: number;
}

export interface RichAutocompleteSuggestion {
    label: string;
    queryValue: string;
    slug?: string;
    postalCode?: string;
    division?: string;
    kind: "office" | "division";
}

export class LocalOfficeSearchEngine {
    readonly index: CompactOfficeIndex;
    private readonly prepared: PreparedRow[];
    private readonly slugMap: Map<string, CompactOfficeRow>;
    private readonly childrenByParentId: Map<string, CompactOfficeRow[]>;
    private cachedPlaceDict: PlaceDictionary | null = null;
    private cachedRoutingNodes: RoutingOfficeNode[] | null = null;
    readonly divisions: string[];
    readonly types: string[];
    readonly rmscs: string[];

    constructor(index: CompactOfficeIndex) {
        this.index = index;
        this.slugMap = new Map();
        this.childrenByParentId = new Map();
        this.divisions = [...index.d].filter(Boolean).sort((a, b) => a.localeCompare(b));
        const typeSet = new Set<string>(["Post Office", ...index.t.filter(Boolean)]);
        if (index.r.some((row) => (row[7] & FLAG_IS_SUPRA) !== 0)) {
            typeSet.add("Supra Post Office");
        }
        this.types = Array.from(typeSet).sort((a, b) => a.localeCompare(b));
        this.rmscs = [...(index.m || [])].filter(Boolean).sort((a, b) => a.localeCompare(b));

        for (const row of index.r) {
            const ctrlIdx = row[11] ?? -1;
            if (ctrlIdx >= 0 && index.r[ctrlIdx]) {
                const parentId = index.r[ctrlIdx][0];
                let bucket = this.childrenByParentId.get(parentId);
                if (!bucket) {
                    bucket = [];
                    this.childrenByParentId.set(parentId, bucket);
                }
                bucket.push(row);
            }
        }

        const divisionsLower = index.d.map((d) => d.toLowerCase());
        const typesLower = index.t.map((t) => t.toLowerCase());
        const servicesLower = index.s.map((s) => s.toLowerCase());
        const rmscsLower = (index.m || []).map((m) => m.toLowerCase());

        this.prepared = index.r.map((row) => {
            const [, slug, name, rawPostalCode, divIdx, typeIdx, , flags, svcIndices, shortCode = "", rmscIdx = -1] = row;
            const normalizedCode = normalizePostalCode(rawPostalCode);
            if (normalizedCode !== rawPostalCode) {
                row[3] = normalizedCode;
            }
            this.slugMap.set(slug, row);
            const nameLower = name.toLowerCase();
            const codeLower = normalizedCode.toLowerCase();
            return {
                row,
                nameLower,
                nameCompact: nameLower.replace(/[^a-z0-9]/g, ""),
                codeLower,
                codeStripped: codeLower.replace(/^0+/, ""),
                shortCodeLower: shortCode.trim().toLowerCase(),
                firstChar: name.charAt(0).toUpperCase(),
                divisionLower: divIdx >= 0 ? (divisionsLower[divIdx] || "") : "",
                typeLower: typeIdx >= 0 ? (typesLower[typeIdx] || "post office") : "post office",
                is24Hour: (flags & FLAG_IS_24_HOUR) !== 0,
                deliveryYes: (flags & FLAG_DELIVERY_YES) !== 0,
                deliveryNo: (flags & FLAG_DELIVERY_NO) !== 0,
                isSupra: (flags & FLAG_IS_SUPRA) !== 0,
                rmscLower: rmscIdx >= 0 ? (rmscsLower[rmscIdx] || "") : "",
                servicesLower: svcIndices.map((idx) => servicesLower[idx] || "").filter(Boolean),
            };
        });
    }

    get totalCount(): number {
        return this.prepared.length;
    }

    get version(): string {
        return this.index.v;
    }

    getBySlug(slug: string): PostOffice | null {
        const row = this.slugMap.get(slug);
        return row ? decodeOfficeRowToPostOffice(this.index, row) : null;
    }

    /**
     * Reconstructs lightweight RoutingOfficeNode records for all offices in < 3ms
     * for offline mail routing, RMSC hub browsing, and trainee quiz generation.
     */
    getRoutingNodes(): RoutingOfficeNode[] {
        if (this.cachedRoutingNodes) {
            return this.cachedRoutingNodes;
        }
        const nodes: RoutingOfficeNode[] = this.index.r.map((row) => {
            const [
                id,
                slug,
                name,
                postalCode,
                divIdx,
                typeIdx,
                ,
                flags,
                ,
                shortCode = "",
                rmscIdx = -1,
                controllingIdx = -1,
            ] = row;
            const ctrlRow = controllingIdx >= 0 ? this.index.r[controllingIdx] : undefined;
            return {
                id,
                slug,
                name,
                postalCode,
                shortCode: shortCode || undefined,
                type: typeIdx >= 0 ? (this.index.t[typeIdx] || "Post Office") : "Post Office",
                grade: (flags & FLAG_IS_SUPRA) !== 0 ? "Supra" : undefined,
                division: divIdx >= 0 ? this.index.d[divIdx] : undefined,
                delivery:
                    (flags & FLAG_DELIVERY_YES) !== 0
                        ? "Yes"
                        : (flags & FLAG_DELIVERY_NO) !== 0
                          ? "No"
                          : "",
                rmsc: rmscIdx >= 0 && this.index.m?.[rmscIdx] ? this.index.m[rmscIdx] : null,
                controllingOfficeId: ctrlRow ? ctrlRow[0] : null,
                controllingOfficeSlug: ctrlRow ? ctrlRow[1] : null,
                controllingOfficeName: ctrlRow ? ctrlRow[2] : null,
                controllingOfficePostalCode: ctrlRow ? ctrlRow[3] : null,
                controllingOfficeShortCode: ctrlRow ? ctrlRow[9] || "" : null,
            };
        });
        this.cachedRoutingNodes = nodes;
        return nodes;
    }

    getPlaceDictionary(): PlaceDictionary {
        if (this.cachedPlaceDict) {
            return this.cachedPlaceDict;
        }

        const normMap = new Map<string, PlaceRecord[]>();
        const postalMap = new Map<string, PlaceRecord[]>();
        const fuzzyBuckets = new Map<string, Array<{ norm: string; records: PlaceRecord[] }>>();

        for (const item of this.prepared) {
            const [, slug, name, postalCode, divIdx] = item.row;
            const division = divIdx >= 0 ? this.index.d[divIdx] : undefined;
            const record: PlaceRecord = {
                name,
                slug,
                postalCode: postalCode || undefined,
                division,
            };

            const norm = normalizePlaceName(name);
            if (norm.length >= 2) {
                let list = normMap.get(norm);
                if (!list) {
                    list = [];
                    normMap.set(norm, list);
                }
                list.push(record);
            }

            if (postalCode && /^\d{5}$/.test(postalCode)) {
                let pList = postalMap.get(postalCode);
                if (!pList) {
                    pList = [];
                    postalMap.set(postalCode, pList);
                }
                pList.push(record);
            }
        }

        const sortByCanonical = (a: PlaceRecord, b: PlaceRecord) => {
            const aHasDigits = /\d/.test(a.name) ? 1 : 0;
            const bHasDigits = /\d/.test(b.name) ? 1 : 0;
            if (aHasDigits !== bHasDigits) return aHasDigits - bHasDigits;
            return a.name.length - b.name.length;
        };

        for (const [norm, records] of normMap.entries()) {
            records.sort(sortByCanonical);
            const firstLetter = norm.charAt(0);
            if (firstLetter) {
                let bucket = fuzzyBuckets.get(firstLetter);
                if (!bucket) {
                    bucket = [];
                    fuzzyBuckets.set(firstLetter, bucket);
                }
                bucket.push({ norm, records });
            }
        }

        for (const records of postalMap.values()) {
            records.sort(sortByCanonical);
        }

        const dict: PlaceDictionary = {
            findExact(normalizedName: string): PlaceRecord[] {
                if (!normalizedName) return [];
                return normMap.get(normalizedName) ?? [];
            },
            findFuzzy(
                normalizedName: string,
                maxDist: number
            ): Array<{ record: PlaceRecord; distance: number }> {
                if (!normalizedName) return [];
                const bucket = fuzzyBuckets.get(normalizedName.charAt(0));
                if (!bucket) return [];
                const matches: Array<{ record: PlaceRecord; distance: number }> = [];
                for (const entry of bucket) {
                    if (Math.abs(entry.norm.length - normalizedName.length) > maxDist) {
                        continue;
                    }
                    const dist = boundedEditDistance(normalizedName, entry.norm, maxDist);
                    if (dist <= maxDist) {
                        for (const rec of entry.records) {
                            matches.push({ record: rec, distance: dist });
                        }
                    }
                }
                matches.sort((a, b) => a.distance - b.distance);
                return matches;
            },
            findByPostalCode(code5: string): PlaceRecord[] {
                const normalized = normalizePostalCode(code5);
                if (!normalized) return [];
                return postalMap.get(normalized) ?? [];
            },
        };

        this.cachedPlaceDict = dict;
        return dict;
    }

    query(params: LocalQueryParams): SearchResponse {
        const letter = (params.letter || "").trim().toUpperCase();
        const serviceLower = (params.service || "").trim().toLowerCase();
        const divisionFilterLower = (params.division || "").trim().toLowerCase();
        const typeFilterLower = (params.officeType || "").trim().toLowerCase();
        const only24Hour = Boolean(params.is24Hour);
        const deliveryFilter = params.delivery || null;
        const rmscFilterLower = (params.rmsc || "").trim().toLowerCase();
        const rawInput = (params.q || "").trim();
        const rawQ =
            rawInput && HAS_INDIC_SCRIPT_REGEX.test(rawInput)
                ? (resolveAlias(rawInput) ?? rawInput)
                : rawInput;
        const mode: SearchMode = params.mode === "division" ? "division" : "name";
        const cursor = Math.max(0, params.cursor ?? 0);
        const limit = Math.min(Math.max(params.limit ?? 24, 1), 100);

        let pool = this.prepared;

        if (letter && letter !== "ALL") {
            const ch = letter.charAt(0);
            pool = pool.filter((item) => item.firstChar === ch);
        }

        if (serviceLower) {
            pool = pool.filter((item) =>
                item.servicesLower.some((s) => s === serviceLower || s.includes(serviceLower))
            );
        }

        if (divisionFilterLower) {
            pool = pool.filter((item) => item.divisionLower === divisionFilterLower);
        }

        if (typeFilterLower) {
            if (typeFilterLower === "supra post office") {
                pool = pool.filter((item) => item.isSupra || item.typeLower === "supra post office");
            } else {
                pool = pool.filter((item) => item.typeLower === typeFilterLower);
            }
        }

        if (only24Hour) {
            pool = pool.filter((item) => item.is24Hour);
        }

        if (deliveryFilter === "yes") {
            pool = pool.filter((item) => item.deliveryYes);
        } else if (deliveryFilter === "no") {
            pool = pool.filter((item) => item.deliveryNo);
        }

        if (rmscFilterLower) {
            pool = pool.filter((item) => item.rmscLower.includes(rmscFilterLower));
        }

        let ranked: PreparedRow[];
        if (!rawQ) {
            ranked = pool;
        } else if (mode === "division") {
            const qLower = rawQ.toLowerCase();
            const prefix: PreparedRow[] = [];
            const contains: PreparedRow[] = [];
            for (const item of pool) {
                if (item.divisionLower.startsWith(qLower)) prefix.push(item);
                else if (item.divisionLower.includes(qLower)) contains.push(item);
            }
            ranked = [...prefix, ...contains];
        } else {
            const primaryTerm = cleanOfficeSearchTerm(rawQ);
            const qLower = primaryTerm.toLowerCase();
            const qCompact = qLower.replace(/[^a-z0-9]/g, "");
            const codeVariants = postalCodeSearchVariants(primaryTerm).map((v) => v.toLowerCase());
            const exact: PreparedRow[] = [];
            const prefix: PreparedRow[] = [];
            const contains: PreparedRow[] = [];
            const fuzzy: PreparedRow[] = [];

            for (const item of pool) {
                const isCodeExact =
                    item.codeLower === qLower ||
                    (codeVariants.length > 0 &&
                        (codeVariants.includes(item.codeLower) ||
                            (item.codeStripped !== "" && codeVariants.includes(item.codeStripped))));
                const isShortExact = item.shortCodeLower !== "" && item.shortCodeLower === qLower;
                const isCodePrefix =
                    item.codeLower.startsWith(qLower) ||
                    (codeVariants.length > 0 &&
                        codeVariants.some(
                            (v) =>
                                item.codeLower.startsWith(v) ||
                                (item.codeStripped !== "" && item.codeStripped.startsWith(v))
                        ));
                const isShortPrefix =
                    item.shortCodeLower !== "" && item.shortCodeLower.startsWith(qLower);
                const isCodeContains =
                    item.codeLower.includes(qLower) ||
                    (codeVariants.length > 0 &&
                        codeVariants.some((v) => item.codeLower.includes(v)));

                if (item.nameLower === qLower || isCodeExact || isShortExact) {
                    exact.push(item);
                } else if (item.nameLower.startsWith(qLower) || isCodePrefix || isShortPrefix) {
                    prefix.push(item);
                } else if (
                    item.nameLower.includes(qLower) ||
                    isCodeContains ||
                    item.divisionLower.includes(qLower)
                ) {
                    contains.push(item);
                } else if (fuzzyMatchesName(item, qLower, qCompact)) {
                    fuzzy.push(item);
                }
            }
            ranked = [...exact, ...prefix, ...contains, ...fuzzy];
        }

        const total = ranked.length;
        const slice = ranked.slice(cursor, cursor + limit);
        const offices = slice.map((item) =>
            decodeOfficeRowToPostOffice(
                this.index,
                item.row,
                this.childrenByParentId.get(item.row[0])
            )
        );
        const nextCursor = cursor + limit < total ? cursor + limit : null;

        return { offices, total, nextCursor };
    }

    autocompleteRich(
        rawQ: string,
        mode: "name" | "division" | "all" = "name",
        maxResults = 5
    ): RichAutocompleteSuggestion[] {
        const rawTrimmed = rawQ.trim();
        if (!rawTrimmed) return [];
        const trimmed = HAS_INDIC_SCRIPT_REGEX.test(rawTrimmed)
            ? (resolveAlias(rawTrimmed) ?? rawTrimmed)
            : rawTrimmed;
        const qLower = trimmed.toLowerCase();

        if (mode === "division") {
            const seen = new Set<string>();
            const prefix: RichAutocompleteSuggestion[] = [];
            const contains: RichAutocompleteSuggestion[] = [];
            for (const div of this.index.d) {
                const lower = div.toLowerCase();
                if (lower.startsWith(qLower)) {
                    if (!seen.has(div)) {
                        seen.add(div);
                        prefix.push({ label: div, queryValue: div, division: div, kind: "division" });
                    }
                } else if (lower.includes(qLower)) {
                    if (!seen.has(div)) {
                        seen.add(div);
                        contains.push({ label: div, queryValue: div, division: div, kind: "division" });
                    }
                }
            }
            return [...prefix, ...contains].slice(0, maxResults);
        }

        const isNumeric = /^\d+$/.test(trimmed);
        const codeVariants = postalCodeSearchVariants(trimmed).map((v) => v.toLowerCase());
        const qCompact = qLower.replace(/[^a-z0-9]/g, "");
        const exact: CompactOfficeRow[] = [];
        const prefix: CompactOfficeRow[] = [];
        const contains: CompactOfficeRow[] = [];
        const fuzzy: CompactOfficeRow[] = [];

        for (const item of this.prepared) {
            const isCodeExact =
                item.codeLower === qLower ||
                (codeVariants.length > 0 &&
                    (codeVariants.includes(item.codeLower) ||
                        (item.codeStripped !== "" && codeVariants.includes(item.codeStripped))));
            const isShortExact = item.shortCodeLower !== "" && item.shortCodeLower === qLower;
            const isCodePrefix =
                item.codeLower.startsWith(qLower) ||
                (codeVariants.length > 0 &&
                    codeVariants.some(
                        (v) =>
                            item.codeLower.startsWith(v) ||
                            (item.codeStripped !== "" && item.codeStripped.startsWith(v))
                    ));
            const isShortPrefix =
                item.shortCodeLower !== "" && item.shortCodeLower.startsWith(qLower);
            const isCodeContains =
                item.codeLower.includes(qLower) ||
                (codeVariants.length > 0 && codeVariants.some((v) => item.codeLower.includes(v)));

            if (item.nameLower === qLower || isCodeExact || isShortExact) {
                exact.push(item.row);
            } else if (item.nameLower.startsWith(qLower) || isCodePrefix || isShortPrefix) {
                prefix.push(item.row);
            } else if (
                item.nameLower.includes(qLower) ||
                isCodeContains ||
                (mode === "all" && item.divisionLower.includes(qLower))
            ) {
                contains.push(item.row);
            } else if (
                !isNumeric &&
                exact.length + prefix.length + contains.length < maxResults &&
                fuzzyMatchesName(item, qLower, qCompact)
            ) {
                fuzzy.push(item.row);
            }
        }

        const suggestions: RichAutocompleteSuggestion[] = [];
        const seen = new Set<string>();
        for (const bucket of [exact, prefix, contains, fuzzy]) {
            for (const row of bucket) {
                const [, slug, name, postalCode, divIdx, , , , , shortCode = ""] = row;
                const division = divIdx >= 0 ? this.index.d[divIdx] : undefined;
                const label =
                    isNumeric && postalCode
                        ? `${name} (${postalCode})`
                        : shortCode && shortCode.toLowerCase() === qLower
                          ? `${name} [${shortCode}]`
                          : name;
                const dedupKey = `${name.toLowerCase()}|${postalCode}`;
                if (!seen.has(dedupKey)) {
                    seen.add(dedupKey);
                    suggestions.push({
                        label,
                        queryValue: name,
                        slug,
                        postalCode: postalCode || undefined,
                        division,
                        kind: "office",
                    });
                    if (suggestions.length >= maxResults) return suggestions;
                }
            }
        }
        return suggestions;
    }

    autocomplete(rawQ: string, mode: "name" | "division" | "all" = "name", maxResults = 5): string[] {
        return this.autocompleteRich(rawQ, mode, maxResults).map((s) => s.label);
    }
}
