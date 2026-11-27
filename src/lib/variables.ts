import { hasDatabaseUrl, prisma } from "@/lib/prisma";

/**
 * Fetches all site variables from the database and returns them as a key-value map.
 * This function can be cached heavily by Next.js in Server Components.
 */
export async function getVariablesMap(): Promise<Record<string, string>> {
    if (!hasDatabaseUrl) {
        return {};
    }

    try {
        const variables = await prisma.siteVariable.findMany({
            select: { key: true, value: true }
        });
        
        const map: Record<string, string> = {};
        for (const v of variables) {
            map[v.key] = v.value;
        }
        return map;
    } catch {
        return {};
    }
}

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Replaces all instances of {{key}} in the text with the corresponding value from the variables map.
 * If a key is not found in the map, it is left untouched. Guards against prototype pollution.
 */
export function replacePlaceholders(text: string, variables: Record<string, string>): string {
    if (!text) return text;
    
    return text.replace(/\{\{\s*([\w\.\[\]]+)\s*\}\}/g, (match, path: string) => {
        const parts = path.split(/[\.\[\]]/).filter(Boolean);
        if (parts.length === 0 || parts.some((part) => FORBIDDEN_KEYS.has(part))) {
            return match;
        }

        const rootKey = parts[0];
        if (!Object.prototype.hasOwnProperty.call(variables, rootKey)) {
            return match;
        }
        const current = variables[rootKey];
        
        if (current === undefined) return match;
        
        if (parts.length === 1) {
            return current;
        }
        
        try {
            let obj: unknown = JSON.parse(current);
            for (let i = 1; i < parts.length; i++) {
                if (obj === undefined || obj === null || typeof obj !== "object") return match;
                const key = parts[i];
                if (FORBIDDEN_KEYS.has(key) || !Object.prototype.hasOwnProperty.call(obj, key)) {
                    return match;
                }
                obj = (obj as Record<string, unknown>)[key];
            }
            return obj !== undefined ? String(obj) : match;
        } catch {
            return match;
        }
    });
}
