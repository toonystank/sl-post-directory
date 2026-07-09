import { prisma } from "@/lib/prisma";

/**
 * Fetches all site variables from the database and returns them as a key-value map.
 * This function can be cached heavily by Next.js in Server Components.
 */
export async function getVariablesMap(): Promise<Record<string, string>> {
    try {
        const variables = await prisma.siteVariable.findMany({
            select: { key: true, value: true }
        });
        
        const map: Record<string, string> = {};
        for (const v of variables) {
            map[v.key] = v.value;
        }
        return map;
    } catch (error) {
        console.error("Failed to fetch site variables:", error);
        return {};
    }
}

/**
 * Replaces all instances of {{key}} in the text with the corresponding value from the variables map.
 * If a key is not found in the map, it is left untouched.
 */
export function replacePlaceholders(text: string, variables: Record<string, string>): string {
    if (!text) return text;
    
    return text.replace(/\{\{\s*([\w\.\[\]]+)\s*\}\}/g, (match, path) => {
        const parts = path.split(/[\.\[\]]/).filter(Boolean);
        const rootKey = parts[0];
        const current = variables[rootKey];
        
        if (current === undefined) return match;
        
        if (parts.length === 1) {
            return current;
        }
        
        try {
            let obj = JSON.parse(current);
            for (let i = 1; i < parts.length; i++) {
                if (obj === undefined || obj === null) return match;
                obj = obj[parts[i]];
            }
            return obj !== undefined ? String(obj) : match;
        } catch (e) {
            return match;
        }
    });
}
