import fs from "fs";
import path from "path";
import { createRequire } from "module";

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

interface SqliteRow {
    id: string;
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

/**
 * Loads and caches all Sri Lankan post offices from `prisma/dev.db`
 * using Node's built-in `node:sqlite` module in read-only mode.
 */
export function loadLocalOffices(): LocalOfficeRecord[] {
    if (cachedOffices !== null) {
        return cachedOffices;
    }

    const dbPath = path.join(process.cwd(), "prisma", "dev.db");
    if (!fs.existsSync(dbPath)) {
        cachedOffices = [];
        return cachedOffices;
    }

    const sqliteMod = getSqliteModule();
    if (!sqliteMod) {
        cachedOffices = [];
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
            const baseSlug = createBaseSlug(row.name) || row.id.toLowerCase();
            let slug = baseSlug;
            if (usedSlugs.has(slug)) {
                const withPostal = `${baseSlug}-${row.postalCode || row.id.slice(0, 6)}`;
                slug = usedSlugs.has(withPostal)
                    ? `${withPostal}-${row.id.slice(0, 6)}`
                    : withPostal;
            }
            usedSlugs.add(slug);

            const createdMs = Number(row.createdAt);
            const updatedMs = Number(row.updatedAt);

            return {
                id: row.id,
                name: row.name,
                slug,
                postalCode: row.postalCode || "",
                services: [],
                rmsc: null,
                latitude: null,
                longitude: null,
                createdAt: Number.isFinite(createdMs) && createdMs > 0 ? new Date(createdMs) : new Date(),
                updatedAt: Number.isFinite(updatedMs) && updatedMs > 0 ? new Date(updatedMs) : new Date(),
                fields: [
                    {
                        id: `${row.id}-type`,
                        officeId: row.id,
                        name: "Type",
                        value: "Post Office",
                    },
                    {
                        id: `${row.id}-hours`,
                        officeId: row.id,
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
        return cachedOffices;
    } catch {
        cachedOffices = [];
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
    cursor?: number;
    limit?: number;
}): {
    offices: LocalOfficeRecord[];
    total: number;
    nextCursor: number | null;
} {
    const allOffices = loadLocalOffices();
    let filtered = allOffices;

    const letter = params.letter?.trim() || "";
    if (letter && letter.toLowerCase() !== "all") {
        const letterUpper = letter.toUpperCase();
        filtered = filtered.filter((o) =>
            o.name.toUpperCase().startsWith(letterUpper)
        );
    }

    const service = params.service?.trim() || "";
    if (service) {
        const serviceLower = service.toLowerCase();
        const hasServicesProvided = filtered.some((o) =>
            o.fields.some((f) => f.name === "Services Provided")
        );
        filtered = filtered.filter(
            (o) =>
                o.services.some((s) => s.toLowerCase() === serviceLower) ||
                o.fields.some(
                    (f) =>
                        (hasServicesProvided ? f.name === "Services Provided" : true) &&
                        f.value.toLowerCase().includes(serviceLower)
                )
        );
    }

    const q = params.q?.trim() || "";
    if (q) {
        const qLower = q.toLowerCase();
        const mode = params.mode || "name";

        if (mode === "division") {
            filtered = filtered.filter((o) =>
                o.fields.some(
                    (f) =>
                        f.name === "Division" &&
                        f.value.toLowerCase().includes(qLower)
                )
            );
        } else {
            filtered = filtered.filter(
                (o) =>
                    o.name.toLowerCase().includes(qLower) ||
                    o.postalCode.toLowerCase().includes(qLower) ||
                    o.fields.some((f) => f.value.toLowerCase().includes(qLower))
            );

            filtered = [...filtered].sort((a, b) => {
                const aName = a.name.toLowerCase();
                const bName = b.name.toLowerCase();
                const aCode = a.postalCode.toLowerCase();
                const bCode = b.postalCode.toLowerCase();

                const aRank =
                    aName === qLower || aCode === qLower
                        ? 0
                        : aName.startsWith(qLower) || aCode.startsWith(qLower)
                            ? 1
                            : 2;
                const bRank =
                    bName === qLower || bCode === qLower
                        ? 0
                        : bName.startsWith(qLower) || bCode.startsWith(qLower)
                            ? 1
                            : 2;

                if (aRank !== bRank) return aRank - bRank;
                return a.name.localeCompare(b.name);
            });
        }
    }

    const cursor = Math.max(0, params.cursor ?? 0);
    const limit = Math.min(Math.max(params.limit ?? 12, 1), 100);
    const total = filtered.length;
    const offices = filtered.slice(cursor, cursor + limit);
    const nextCursor = cursor + limit < total ? cursor + limit : null;

    return { offices, total, nextCursor };
}

export function autocompleteLocalOffices(q: string, mode = "name"): string[] {
    const trimmed = q.trim();
    if (!trimmed) return [];

    const allOffices = loadLocalOffices();
    const qLower = trimmed.toLowerCase();

    if (mode === "division") {
        const divisions = new Set<string>();
        for (const office of allOffices) {
            for (const field of office.fields) {
                if (
                    field.name === "Division" &&
                    field.value.toLowerCase().startsWith(qLower)
                ) {
                    divisions.add(field.value);
                    if (divisions.size >= 5) return Array.from(divisions);
                }
            }
        }
        return Array.from(divisions);
    }

    const isNumeric = /^\d+$/.test(trimmed);
    const matches = allOffices
        .filter(
            (o) =>
                o.name.toLowerCase().includes(qLower) ||
                o.postalCode.includes(trimmed)
        )
        .sort((a, b) => {
            const aName = a.name.toLowerCase();
            const bName = b.name.toLowerCase();
            const aRank =
                aName === qLower || a.postalCode === trimmed
                    ? 0
                    : aName.startsWith(qLower) || a.postalCode.startsWith(trimmed)
                        ? 1
                        : 2;
            const bRank =
                bName === qLower || b.postalCode === trimmed
                    ? 0
                    : bName.startsWith(qLower) || b.postalCode.startsWith(trimmed)
                        ? 1
                        : 2;
            if (aRank !== bRank) return aRank - bRank;
            return a.name.localeCompare(b.name);
        });

    const suggestions: string[] = [];
    const seen = new Set<string>();
    for (const office of matches) {
        const label =
            isNumeric && office.postalCode
                ? `${office.name} (${office.postalCode})`
                : office.name;
        if (!seen.has(label)) {
            seen.add(label);
            suggestions.push(label);
            if (suggestions.length >= 5) break;
        }
    }

    return suggestions;
}

export function getLocalOfficeBySlug(slug: string): LocalOfficeRecord | null {
    const allOffices = loadLocalOffices();
    return (
        allOffices.find((o) => o.slug === slug) ??
        allOffices.find((o) => createBaseSlug(o.name) === slug) ??
        null
    );
}

export function getLocalOfficeById(id: string): LocalOfficeRecord | null {
    const allOffices = loadLocalOffices();
    return allOffices.find((o) => o.id === id) ?? null;
}
