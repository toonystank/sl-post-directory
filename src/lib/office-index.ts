import type { PostOffice, SearchMode, SearchResponse } from "@/components/directory/types";
import { formatSriLankaPhone, normalizePostalCode, postalCodeSearchVariants } from "./site";

/**
 * Compact tuple row for a single post office:
 * [0] id
 * [1] slug
 * [2] name
 * [3] postalCode
 * [4] divisionIdx (-1 if none)
 * [5] typeIdx (-1 if default "Post Office")
 * [6] phone ("" if none)
 * [7] flagsBitmask (bit 0 = is24Hour)
 * [8] serviceIndices (indices into `s[]` lookup table)
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
    number[]
];

export interface CompactOfficeIndex {
    v: string;
    count: number;
    d: string[];
    t: string[];
    s: string[];
    r: CompactOfficeRow[];
}

export interface OfficeIndexSourceRecord {
    id: string;
    slug: string;
    name: string;
    postalCode: string;
    services?: string[];
    fields?: { name: string; value: string }[];
}

const FLAG_IS_24_HOUR = 1;

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
 * For 4,158 offices, the resulting JSON gzips to ~90–130 KB while retaining every
 * field needed for instant client-side search, A–Z browse, postcode & service filtering.
 */
export function encodeOfficeIndex(records: OfficeIndexSourceRecord[]): CompactOfficeIndex {
    const divisionMap = new Map<string, number>();
    const typeMap = new Map<string, number>();
    const serviceMap = new Map<string, number>();

    const divisions: string[] = [];
    const types: string[] = [];
    const services: string[] = [];

    const intern = (map: Map<string, number>, arr: string[], raw?: string): number => {
        const val = (raw || "").trim();
        if (!val) return -1;
        const existing = map.get(val);
        if (existing !== undefined) return existing;
        const idx = arr.length;
        arr.push(val);
        map.set(val, idx);
        return idx;
    };

    // Deduplicate obvious lowercase/empty-postcode duplicates (e.g. "kabagamuwa" without postcode vs "Kabagamuwa" with 71202)
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
    const rows: CompactOfficeRow[] = new Array(sorted.length);
    const hashChunks: string[] = [String(sorted.length)];

    for (let i = 0; i < sorted.length; i++) {
        const rec = sorted[i];
        let division = "";
        let type = "";
        let phone = "";
        let is24Hour = false;

        if (rec.fields) {
            for (const f of rec.fields) {
                if (f.name === "Division") division = f.value;
                else if (f.name === "Type") type = f.value;
                else if (f.name === "Phone" || f.name === "Telephone") {
                    if (!phone && f.value) phone = formatSriLankaPhone(f.value);
                } else if (f.name === "Is24Hour" && f.value === "true") {
                    is24Hour = true;
                }
            }
        }

        const divIdx = intern(divisionMap, divisions, division);
        const typeIdx = intern(typeMap, types, type === "Post Office" ? "" : type);
        const svcIndices: number[] = [];
        if (rec.services && rec.services.length > 0) {
            for (const svc of rec.services) {
                const idx = intern(serviceMap, services, svc);
                if (idx >= 0 && !svcIndices.includes(idx)) svcIndices.push(idx);
            }
        }

        const flags = is24Hour ? FLAG_IS_24_HOUR : 0;
        const postalCode = normalizePostalCode(rec.postalCode);

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
        ];

        // Sample rows into deterministic content version hash
        if (i < 16 || i % 37 === 0 || i === sorted.length - 1) {
            hashChunks.push(`${rec.slug}:${postalCode}:${divIdx}:${flags}`);
        }
    }

    const version = `v2-${sorted.length}-${fnv1aHash(hashChunks.join("|"))}`;
    return {
        v: version,
        count: sorted.length,
        d: divisions,
        t: types,
        s: services,
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
    row: CompactOfficeRow
): PostOffice {
    const [id, slug, name, postalCode, divIdx, typeIdx, phone, flags, svcIndices] = row;
    const fields: { name: string; value: string }[] = [
        { name: "Type", value: typeIdx >= 0 ? (index.t[typeIdx] || "Post Office") : "Post Office" },
    ];
    if (divIdx >= 0 && index.d[divIdx]) {
        fields.push({ name: "Division", value: index.d[divIdx] });
    }
    if (phone) {
        fields.push({ name: "Phone", value: phone });
    }
    if ((flags & FLAG_IS_24_HOUR) !== 0) {
        fields.push({ name: "Is24Hour", value: "true" });
    }

    const services = svcIndices
        .map((idx) => index.s[idx])
        .filter((s): s is string => Boolean(s));

    return {
        id,
        slug,
        name,
        postalCode,
        services,
        fields,
    };
}

interface PreparedRow {
    row: CompactOfficeRow;
    nameLower: string;
    nameCompact: string;
    codeLower: string;
    codeStripped: string;
    firstChar: string;
    divisionLower: string;
    typeLower: string;
    is24Hour: boolean;
    servicesLower: string[];
}

function cleanOfficeSearchTerm(raw: string): string {
    const stripped = raw
        .replace(/\b(post\s*office|main|branch|sub)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    return stripped || raw.trim();
}

/**
 * Lightweight bounded Levenshtein distance (early-exits if > maxDist).
 * Keeps fuzzy matching across 4,158 names well under 5ms on mobile CPUs.
 */
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
            const val = Math.min(
                prev[j] + 1,
                curr[j - 1] + 1,
                prev[j - 1] + cost
            );
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
    // Compare against the first token or full name prefix for fast typo tolerance
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

/**
 * In-memory search engine hydrated from the compact office index.
 * Executes autocomplete, A–Z browse, postcode, division, type, 24h, and service filters in < 10ms.
 */
export class LocalOfficeSearchEngine {
    readonly index: CompactOfficeIndex;
    private readonly prepared: PreparedRow[];
    private readonly slugMap: Map<string, CompactOfficeRow>;
    readonly divisions: string[];
    readonly types: string[];

    constructor(index: CompactOfficeIndex) {
        this.index = index;
        this.slugMap = new Map();
        this.divisions = [...index.d].filter(Boolean).sort((a, b) => a.localeCompare(b));
        const typeSet = new Set<string>(["Post Office", ...index.t.filter(Boolean)]);
        this.types = Array.from(typeSet).sort((a, b) => a.localeCompare(b));

        const divisionsLower = index.d.map((d) => d.toLowerCase());
        const typesLower = index.t.map((t) => t.toLowerCase());
        const servicesLower = index.s.map((s) => s.toLowerCase());

        this.prepared = index.r.map((row) => {
            const [, slug, name, rawPostalCode, divIdx, typeIdx, , flags, svcIndices] = row;
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
                firstChar: name.charAt(0).toUpperCase(),
                divisionLower: divIdx >= 0 ? (divisionsLower[divIdx] || "") : "",
                typeLower: typeIdx >= 0 ? (typesLower[typeIdx] || "post office") : "post office",
                is24Hour: (flags & FLAG_IS_24_HOUR) !== 0,
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

    query(params: LocalQueryParams): SearchResponse {
        const letter = (params.letter || "").trim().toUpperCase();
        const serviceLower = (params.service || "").trim().toLowerCase();
        const divisionFilterLower = (params.division || "").trim().toLowerCase();
        const typeFilterLower = (params.officeType || "").trim().toLowerCase();
        const only24Hour = Boolean(params.is24Hour);
        const rawQ = (params.q || "").trim();
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
            pool = pool.filter((item) => item.typeLower === typeFilterLower);
        }

        if (only24Hour) {
            pool = pool.filter((item) => item.is24Hour);
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
                const isCodePrefix =
                    item.codeLower.startsWith(qLower) ||
                    (codeVariants.length > 0 &&
                        codeVariants.some(
                            (v) =>
                                item.codeLower.startsWith(v) ||
                                (item.codeStripped !== "" && item.codeStripped.startsWith(v))
                        ));
                const isCodeContains =
                    item.codeLower.includes(qLower) ||
                    (codeVariants.length > 0 &&
                        codeVariants.some((v) => item.codeLower.includes(v)));

                if (item.nameLower === qLower || isCodeExact) {
                    exact.push(item);
                } else if (item.nameLower.startsWith(qLower) || isCodePrefix) {
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
        const offices = slice.map((item) => decodeOfficeRowToPostOffice(this.index, item.row));
        const nextCursor = cursor + limit < total ? cursor + limit : null;

        return { offices, total, nextCursor };
    }

    autocompleteRich(
        rawQ: string,
        mode: "name" | "division" | "all" = "name",
        maxResults = 5
    ): RichAutocompleteSuggestion[] {
        const trimmed = rawQ.trim();
        if (!trimmed) return [];
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
            const isCodePrefix =
                item.codeLower.startsWith(qLower) ||
                (codeVariants.length > 0 &&
                    codeVariants.some(
                        (v) =>
                            item.codeLower.startsWith(v) ||
                            (item.codeStripped !== "" && item.codeStripped.startsWith(v))
                    ));
            const isCodeContains =
                item.codeLower.includes(qLower) ||
                (codeVariants.length > 0 && codeVariants.some((v) => item.codeLower.includes(v)));

            if (item.nameLower === qLower || isCodeExact) {
                exact.push(item.row);
            } else if (item.nameLower.startsWith(qLower) || isCodePrefix) {
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
                const [, slug, name, postalCode, divIdx] = row;
                const division = divIdx >= 0 ? this.index.d[divIdx] : undefined;
                const label = isNumeric && postalCode ? `${name} (${postalCode})` : name;
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
