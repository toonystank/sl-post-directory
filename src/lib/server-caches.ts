/**
 * Shared server-side in-memory caches and invalidation helpers so mutation routes
 * can clear cached payloads without exporting non-handler functions from `route.ts`.
 */

import type { CompactOfficeIndex } from "./office-index";

export interface PublicConfigCacheEntry {
    data: {
        adsEnabled: boolean;
        rateVariables: { key: string; value: string }[];
    };
    builtAt: number;
}

export interface SerializedOfficeIndexCacheEntry {
    json: string;
    etag: string;
    builtAt: number;
    index?: CompactOfficeIndex;
}

let publicConfigCache: PublicConfigCacheEntry | null = null;
let officeIndexCache: SerializedOfficeIndexCacheEntry | null = null;

export function getPublicConfigCache(): PublicConfigCacheEntry | null {
    return publicConfigCache;
}

export function setPublicConfigCache(entry: PublicConfigCacheEntry | null): void {
    publicConfigCache = entry;
}

export function invalidatePublicConfigCache(): void {
    publicConfigCache = null;
}

export function getOfficeIndexCache(): SerializedOfficeIndexCacheEntry | null {
    return officeIndexCache;
}

export function setOfficeIndexCache(entry: SerializedOfficeIndexCacheEntry | null): void {
    officeIndexCache = entry;
}

export function invalidateOfficeIndexCache(): void {
    officeIndexCache = null;
}
