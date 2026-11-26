"use client";

import {
    type CompactOfficeIndex,
    LocalOfficeSearchEngine,
    isValidCompactOfficeIndex,
} from "./office-index";

const IDB_NAME = "sl-post-directory-index-db";
const IDB_VERSION = 1;
const IDB_STORE = "index";
const IDB_KEY = "compact-offices-v4";
const REVALIDATE_INTERVAL_MS = 1000 * 60 * 60; // 1 hour
const IDB_TIMEOUT_MS = 1200;

interface StoredIndexRecord {
    index: CompactOfficeIndex;
    etag: string | null;
    savedAt: number;
}

let memoryEngine: LocalOfficeSearchEngine | null = null;
let memoryEtag: string | null = null;
let memorySavedAt = 0;
let inFlightLoad: Promise<LocalOfficeSearchEngine | null> | null = null;
let backgroundRefreshStarted = false;

function openIndexDb(): Promise<IDBDatabase | null> {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
        return Promise.resolve(null);
    }
    return new Promise((resolve) => {
        let settled = false;
        const done = (val: IDBDatabase | null) => {
            if (settled) return;
            settled = true;
            globalThis.clearTimeout(timer);
            resolve(val);
        };
        const timer = globalThis.setTimeout(() => done(null), IDB_TIMEOUT_MS);

        try {
            const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(IDB_STORE)) {
                    db.createObjectStore(IDB_STORE);
                }
            };
            req.onsuccess = () => done(req.result);
            req.onerror = () => done(null);
            req.onblocked = () => done(null);
        } catch {
            done(null);
        }
    });
}

async function readIndexFromIdb(): Promise<StoredIndexRecord | null> {
    const db = await openIndexDb();
    if (!db) return null;
    return new Promise((resolve) => {
        let settled = false;
        const done = (val: StoredIndexRecord | null) => {
            if (settled) return;
            settled = true;
            globalThis.clearTimeout(timer);
            try {
                db.close();
            } catch {
                // Ignore close error
            }
            resolve(val);
        };
        const timer = globalThis.setTimeout(() => done(null), IDB_TIMEOUT_MS);

        try {
            const tx = db.transaction(IDB_STORE, "readonly");
            const store = tx.objectStore(IDB_STORE);
            const req = store.get(IDB_KEY);
            req.onsuccess = () => {
                const val = req.result as StoredIndexRecord | undefined;
                if (val && isValidCompactOfficeIndex(val.index) && val.index.r.length > 0) {
                    done(val);
                } else {
                    done(null);
                }
            };
            req.onerror = () => done(null);
            tx.onabort = () => done(null);
            tx.onerror = () => done(null);
        } catch {
            done(null);
        }
    });
}

async function writeIndexToIdb(record: StoredIndexRecord): Promise<void> {
    const db = await openIndexDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
        let settled = false;
        const done = () => {
            if (settled) return;
            settled = true;
            globalThis.clearTimeout(timer);
            try {
                db.close();
            } catch {
                // Ignore close error
            }
            resolve();
        };
        const timer = globalThis.setTimeout(done, IDB_TIMEOUT_MS);

        try {
            const tx = db.transaction(IDB_STORE, "readwrite");
            tx.objectStore(IDB_STORE).put(record, IDB_KEY);
            tx.oncomplete = () => done();
            tx.onerror = () => done();
            tx.onabort = () => done();
        } catch {
            done();
        }
    });
}

function notifyIndexUpdated(count: number) {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem("sl-post-local-index-count", String(count));
    } catch {
        // Ignore quota errors
    }
    window.dispatchEvent(new CustomEvent("slpost-offline-cache-updated", { detail: { count } }));
}

async function fetchIndexFromNetwork(currentEtag: string | null): Promise<LocalOfficeSearchEngine | null> {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
        return memoryEngine;
    }

    const headers: HeadersInit = {};
    if (currentEtag) {
        headers["If-None-Match"] = currentEtag;
    }

    try {
        const res = await fetch("/api/offices/index", { headers });
        if (res.status === 304) {
            memorySavedAt = Date.now();
            if (memoryEngine) {
                void writeIndexToIdb({
                    index: memoryEngine.index,
                    etag: currentEtag,
                    savedAt: memorySavedAt,
                });
            }
            return memoryEngine;
        }
        if (!res.ok) return memoryEngine;

        const payload = (await res.json()) as unknown;
        if (!isValidCompactOfficeIndex(payload) || payload.r.length === 0) {
            return memoryEngine;
        }

        const etag = res.headers.get("etag") || `"${payload.v}"`;
        const engine = new LocalOfficeSearchEngine(payload);
        memoryEngine = engine;
        memoryEtag = etag;
        memorySavedAt = Date.now();

        void writeIndexToIdb({
            index: payload,
            etag,
            savedAt: memorySavedAt,
        });
        notifyIndexUpdated(engine.totalCount);
        return engine;
    } catch {
        return memoryEngine;
    }
}

/**
 * Synchronous accessor for the hydrated local 4,158-office search engine.
 * Returns null if not yet loaded into memory.
 */
export function getLoadedOfficeIndexSync(): LocalOfficeSearchEngine | null {
    return memoryEngine;
}

/**
 * Returns the cached count of offices persisted in the local IndexedDB search index.
 */
export function getLocalIndexStoredCount(): number {
    if (memoryEngine) return memoryEngine.totalCount;
    if (typeof window === "undefined") return 0;
    try {
        const raw = window.localStorage.getItem("sl-post-local-index-count");
        const parsed = raw ? parseInt(raw, 10) : 0;
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
        return 0;
    }
}

/**
 * Ensures the compact 4,158-office index is hydrated into memory.
 * - First checks in-memory singleton (0ms).
 * - Next reads from IndexedDB (< 20ms, bounded by 1.2s safety timeout) and schedules a silent ETag check if stale.
 * - Otherwise fetches `/api/offices/index` once and saves to IndexedDB.
 */
export function ensureLocalOfficeIndex(): Promise<LocalOfficeSearchEngine | null> {
    if (memoryEngine) {
        if (
            !backgroundRefreshStarted &&
            Date.now() - memorySavedAt > REVALIDATE_INTERVAL_MS &&
            typeof navigator !== "undefined" &&
            navigator.onLine
        ) {
            backgroundRefreshStarted = true;
            void fetchIndexFromNetwork(memoryEtag).finally(() => {
                backgroundRefreshStarted = false;
            });
        }
        return Promise.resolve(memoryEngine);
    }

    if (inFlightLoad) return inFlightLoad;

    inFlightLoad = (async () => {
        const cached = await readIndexFromIdb();
        if (cached) {
            const engine = new LocalOfficeSearchEngine(cached.index);
            memoryEngine = engine;
            memoryEtag = cached.etag;
            memorySavedAt = cached.savedAt;
            notifyIndexUpdated(engine.totalCount);

            if (Date.now() - cached.savedAt > REVALIDATE_INTERVAL_MS) {
                void fetchIndexFromNetwork(cached.etag);
            }
            return engine;
        }

        return fetchIndexFromNetwork(null);
    })().finally(() => {
        inFlightLoad = null;
    });

    return inFlightLoad;
}
