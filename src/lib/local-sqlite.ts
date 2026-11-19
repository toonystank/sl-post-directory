import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { normalizePostalCode, postalCodeSearchVariants } from "./site";

export interface LocalOfficeField {
    id: string;
    officeId: string;
    name: string;
    value: string;
}

export interface LocalOfficePhoto {
    id: string;
    url: string;
    caption: string | null;
}

export interface LocalOfficeReview {
    id: string;
    rating: number;
    content: string;
    authorName: string;
    createdAt: Date;
}

export interface LocalOfficeLink {
    id: string;
    slug: string;
    name: string;
    postalCode: string;
}

export interface LocalOfficeRecord {
    id: string;
    name: string;
    slug: string;
    postalCode: string;
    services: string[];
    rmsc: string | null;
    latitude: number | null;
    longitude: number | null;
    createdAt: Date;
    updatedAt: Date;
    fields: LocalOfficeField[];
    photos: LocalOfficePhoto[];
    reviews: LocalOfficeReview[];
    controllingOffice: LocalOfficeLink | null;
    controlledOffices: LocalOfficeLink[];
}

interface IndexedLocalOffice {
    record: LocalOfficeRecord;
    nameLower: string;
    baseSlug: string;
    codeLower: string;
    firstChar: string;
    divisionLower: string;
    fieldsLower: string[];
    servicesLower: Set<string>;
}

interface SqliteRow {
    id: string | number;
    name: string;
    postalCode: string;
    createdAt: number | string | null;
    updatedAt: number | string | null;
}

interface SqliteStatement {
    all: (...params: unknown[]) => SqliteRow[];
}

interface SqliteDatabase {
    prepare: (sql: string) => SqliteStatement;
    close: () => void;
}

interface SqliteModule {
    DatabaseSync: new (
        filename: string,
        options?: { open?: boolean; readOnly?: boolean }
    ) => SqliteDatabase;
}

let cachedOffices: LocalOfficeRecord[] | null = null;
let cachedIndex: IndexedLocalOffice[] | null = null;
let slugMap: Map<string, LocalOfficeRecord> | null = null;
let idMap: Map<string, LocalOfficeRecord> | null = null;

function createBaseSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function getSqliteModule(): SqliteModule | null {
    const proc = process as unknown as {
        getBuiltinModule?: (id: string) => unknown;
    };
    const builtin = proc.getBuiltinModule?.("node:sqlite") as
        | SqliteModule
        | undefined;
    if (builtin?.DatabaseSync) {
        return builtin;
    }

    try {
        const nodeRequire = createRequire(path.join(process.cwd(), "package.json"));
        const modName = "node:sqlite";
        const loaded = nodeRequire(modName) as SqliteModule | undefined;
        if (loaded?.DatabaseSync) {
            return loaded;
        }
    } catch {
        return null;
    }

    return null;
}

function buildSearchIndex(offices: LocalOfficeRecord[]): void {
    const slugs = new Map<string, LocalOfficeRecord>();
    const ids = new Map<string, LocalOfficeRecord>();

    cachedIndex = offices.map((record) => {
        ids.set(String(record.id), record);
        slugs.set(record.slug, record);
        const base = createBaseSlug(record.name);
        if (base && !slugs.has(base)) {
            slugs.set(base, record);
        }

        const divisionField = record.fields.find((f) => f.name === "Division");
        return {
            record,
            nameLower: record.name.toLowerCase(),
            baseSlug: base,
            codeLower: record.postalCode.toLowerCase(),
            firstChar: record.name.charAt(0).toUpperCase(),
            divisionLower: divisionField ? divisionField.value.toLowerCase() : "",
            fieldsLower: record.fields.map((f) => f.value.toLowerCase()),
            servicesLower: new Set(record.services.map((s) => s.toLowerCase())),
        };
    });

    slugMap = slugs;
    idMap = ids;
}

/**
 * Loads and caches all Sri Lankan post offices from `prisma/dev.db`
 * using Node's built-in `node:sqlite` module in read-only mode,
 * with precomputed lowercase indices for O(1) id/slug lookup and sub-ms filtering.
 */
export function loadLocalOffices(): LocalOfficeRecord[] {
    if (cachedOffices !== null) {
        return cachedOffices;
    }

    const dbPath = path.join(process.cwd(), "prisma", "dev.db");
    if (!fs.existsSync(dbPath)) {
        cachedOffices = [];
        buildSearchIndex([]);
        return cachedOffices;
    }

    const sqliteMod = getSqliteModule();
    if (!sqliteMod) {
        cachedOffices = [];
        buildSearchIndex([]);
        return cachedOffices;
    }

    let db: SqliteDatabase | null = null;
    try {
        db = new sqliteMod.DatabaseSync(dbPath, { open: true, readOnly: true });
        const rows = db
            .prepare(
                "SELECT id, name, postalCode, createdAt, updatedAt FROM PostOffice ORDER BY name ASC"
            )
            .all();

        const usedSlugs = new Set<string>();
        const offices: LocalOfficeRecord[] = rows.map((row) => {
            const rowId = String(row.id);
            const baseSlug = createBaseSlug(row.name) || rowId.toLowerCase();
            let slug = baseSlug;
            if (usedSlugs.has(slug)) {
                const withPostal = `${baseSlug}-${row.postalCode || rowId.slice(0, 6)}`;
                slug = usedSlugs.has(withPostal)
                    ? `${withPostal}-${rowId.slice(0, 6)}`
                    : withPostal;
            }
            usedSlugs.add(slug);

            const createdMs = Number(row.createdAt);
            const updatedMs = Number(row.updatedAt);

            return {
                id: rowId,
                name: row.name,
                slug,
                postalCode: normalizePostalCode(row.postalCode),
                services: [],
                rmsc: null,
                latitude: null,
                longitude: null,
                createdAt: Number.isFinite(createdMs) && createdMs > 0 ? new Date(createdMs) : new Date(),
                updatedAt: Number.isFinite(updatedMs) && updatedMs > 0 ? new Date(updatedMs) : new Date(),
                fields: [
                    {
                        id: `${rowId}-type`,
                        officeId: rowId,
                        name: "Type",
                        value: "Post Office",
                    },
                    {
                        id: `${rowId}-hours`,
                        officeId: rowId,
                        name: "Working Hours",
                        value: "8:00 AM - 4:00 PM (Weekdays)",
                    },
                ],
                photos: [],
                reviews: [],
                controllingOffice: null,
                controlledOffices: [],
            };
        });

        cachedOffices = offices;
        buildSearchIndex(offices);
        return cachedOffices;
    } catch {
        cachedOffices = [];
        buildSearchIndex([]);
        return cachedOffices;
    } finally {
        try {
            db?.close();
        } catch {
            // Ignore close errors on read-only fallback DB
        }
    }
}

export function queryLocalOffices(params: {
    q?: string;
    letter?: string;
    mode?: string;
    service?: string;
    division?: string;
    officeType?: string;
    is24Hour?: boolean;
    cursor?: number;
    limit?: number;
}): {
    offices: LocalOfficeRecord[];
    total: number;
    nextCursor: number | null;
} {
    loadLocalOffices();
    let filtered = cachedIndex ?? [];

    const letter = params.letter?.trim() || "";
    if (letter && letter.toLowerCase() !== "all") {
        const letterUpper = letter.charAt(0).toUpperCase();
        filtered = filtered.filter((item) => item.firstChar === letterUpper);
    }

    const service = params.service?.trim() || "";
    if (service) {
        const serviceLower = service.toLowerCase();
        filtered = filtered.filter(
            (item) =>
                item.servicesLower.has(serviceLower) ||
                item.fieldsLower.some((val) => val.includes(serviceLower))
        );
    }

    const division = params.division?.trim().toLowerCase() || "";
    if (division) {
        filtered = filtered.filter((item) => item.divisionLower === division);
    }

    const officeType = params.officeType?.trim().toLowerCase() || "";
    if (officeType) {
        filtered = filtered.filter((item) =>
            item.record.fields.some(
                (f) => f.name === "Type" && f.value.toLowerCase() === officeType
            )
        );
    }

    if (params.is24Hour) {
        filtered = filtered.filter((item) =>
            item.record.fields.some((f) => f.name === "Is24Hour" && f.value === "true")
        );
    }

    const q = params.q?.trim() || "";
    if (q) {
        const qLower = q.toLowerCase();
        const mode = params.mode || "name";
        const codeVariants = postalCodeSearchVariants(q).map((v) => v.toLowerCase());

        if (mode === "division") {
            filtered = filtered.filter((item) => item.divisionLower.includes(qLower));
        } else {
            const exact: IndexedLocalOffice[] = [];
            const prefix: IndexedLocalOffice[] = [];
            const contains: IndexedLocalOffice[] = [];

            for (const item of filtered) {
                const isCodeExact =
                    item.codeLower === qLower ||
                    (codeVariants.length > 0 && codeVariants.includes(item.codeLower));
                const isCodePrefix =
                    item.codeLower.startsWith(qLower) ||
                    (codeVariants.length > 0 &&
                        codeVariants.some((v) => item.codeLower.startsWith(v)));
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
                    item.fieldsLower.some((val) => val.includes(qLower))
                ) {
                    contains.push(item);
                }
            }

            // Inputs are already sorted by name ASC, so bucket concatenation preserves O(N) ranked order!
            filtered = [...exact, ...prefix, ...contains];
        }
    }

    const cursor = Math.max(0, params.cursor ?? 0);
    const limit = Math.min(Math.max(params.limit ?? 12, 1), 100);
    const total = filtered.length;
    const offices = filtered.slice(cursor, cursor + limit).map((item) => item.record);
    const nextCursor = cursor + limit < total ? cursor + limit : null;

    return { offices, total, nextCursor };
}

export function autocompleteLocalOffices(q: string, mode = "name"): string[] {
    const trimmed = q.trim();
    if (!trimmed) return [];

    loadLocalOffices();
    const index = cachedIndex ?? [];
    const qLower = trimmed.toLowerCase();

    if (mode === "division") {
        const divisions = new Set<string>();
        for (const item of index) {
            if (item.divisionLower.startsWith(qLower)) {
                const div = item.record.fields.find((f) => f.name === "Division")?.value;
                if (div) {
                    divisions.add(div);
                    if (divisions.size >= 5) return Array.from(divisions);
                }
            }
        }
        return Array.from(divisions);
    }

    const isNumeric = /^\d+$/.test(trimmed);
    const codeVariants = postalCodeSearchVariants(trimmed);
    const exact: LocalOfficeRecord[] = [];
    const prefix: LocalOfficeRecord[] = [];
    const contains: LocalOfficeRecord[] = [];

    for (const item of index) {
        const codeExact =
            item.record.postalCode === trimmed ||
            (codeVariants.length > 0 && codeVariants.includes(item.record.postalCode));
        const codePrefix =
            item.record.postalCode.startsWith(trimmed) ||
            (codeVariants.length > 0 &&
                codeVariants.some((v) => item.record.postalCode.startsWith(v)));
        const codeContains =
            item.record.postalCode.includes(trimmed) ||
            (codeVariants.length > 0 &&
                codeVariants.some((v) => item.record.postalCode.includes(v)));

        if (item.nameLower === qLower || codeExact) {
            exact.push(item.record);
        } else if (item.nameLower.startsWith(qLower) || codePrefix) {
            prefix.push(item.record);
        } else if (
            item.nameLower.includes(qLower) ||
            codeContains ||
            (mode === "all" && item.divisionLower.includes(qLower))
        ) {
            contains.push(item.record);
        }
    }

    const suggestions: string[] = [];
    const seen = new Set<string>();
    for (const bucket of [exact, prefix, contains]) {
        for (const office of bucket) {
            const label =
                isNumeric && office.postalCode
                    ? `${office.name} (${office.postalCode})`
                    : office.name;
            if (!seen.has(label)) {
                seen.add(label);
                suggestions.push(label);
                if (suggestions.length >= 5) return suggestions;
            }
        }
    }

    return suggestions;
}

export function getLocalOfficeBySlug(slug: string): LocalOfficeRecord | null {
    loadLocalOffices();
    return slugMap?.get(slug) ?? null;
}

export function getLocalOfficeById(id: string): LocalOfficeRecord | null {
    loadLocalOffices();
    return idMap?.get(String(id)) ?? null;
}
