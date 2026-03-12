export interface OfficeField {
    name: string;
    value: string;
}

export interface PostOffice {
    id: string;
    name: string;
    postalCode: string;
    services: string[];
    fields: OfficeField[];
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
