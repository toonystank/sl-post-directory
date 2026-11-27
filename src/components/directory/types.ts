export interface OfficeField {
    name: string;
    value: string;
}

export interface PostOffice {
    id: string;
    slug: string;
    name: string;
    postalCode: string;
    operatingHours?: string | null;
    services: string[];
    fields: OfficeField[];
    rmsc?: string | null;
    controllingOffice?: {
        id: string;
        slug: string;
        name: string;
        postalCode?: string;
        shortCode?: string;
    } | null;
    controlledOffices?: {
        id: string;
        slug: string;
        name: string;
        postalCode: string;
        shortCode?: string;
        delivery?: string;
        type?: string;
    }[];
}

export interface SearchResponse {
    offices: PostOffice[];
    total: number;
    nextCursor: number | null;
}

export type SearchMode = "name" | "division";

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
export const POPULAR_SEARCHES = ["Colombo", "Kandy", "Nugegoda", "Galle", "Matara", "Jaffna", "Kurunegala", "Negombo"];
export const SERVICE_TAGS = ["Foreign parcel unit", "postal complex", "regional sorting unit"];
