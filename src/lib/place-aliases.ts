/**
 * Sinhala and Tamil town/district name aliases mapped to English SL Post office names.
 * Saved in UTF-8; uses explicit Unicode ranges for script detection.
 */

export const PLACE_ALIASES: Record<string, string> = {
    // 25 Districts
    "කොළඹ": "Colombo",
    "கொழும்பு": "Colombo",
    "ගම්පහ": "Gampaha",
    "கம்பஹா": "Gampaha",
    "කළුතර": "Kalutara",
    "களுத்துறை": "Kalutara",
    "මහනුවර": "Kandy",
    "නුවර": "Kandy",
    "கண்டி": "Kandy",
    "මාතලේ": "Matale",
    "மாத்தளை": "Matale",
    "නුවරඑළිය": "Nuwara Eliya",
    "நுவரெலியா": "Nuwara Eliya",
    "ගාල්ල": "Galle",
    "காலி": "Galle",
    "මාතර": "Matara",
    "மாத்தறை": "Matara",
    "හම්බන්තොට": "Hambantota",
    "அம்பாந்தோட்டை": "Hambantota",
    "යාපනය": "Jaffna",
    "யாழ்ப்பாணம்": "Jaffna",
    "කිලිනොච්චිය": "Kilinochchi",
    "කිලිනොච්චි": "Kilinochchi",
    "கிளிநொச்சி": "Kilinochchi",
    "මන්නාරම": "Mannar",
    "மன்னார்": "Mannar",
    "වවුනියාව": "Vavuniya",
    "වවුනියා": "Vavuniya",
    "வவுனியா": "Vavuniya",
    "මුලතිව්": "Mullaitivu",
    "முல்லைத்தீவு": "Mullaitivu",
    "මඩකලපුව": "Batticaloa",
    "மட்டக்களப்பு": "Batticaloa",
    "අම්පාර": "Ampara",
    "அம்பாறை": "Ampara",
    "ත්‍රිකුණාමලය": "Trincomalee",
    "திருக்கோணமலை": "Trincomalee",
    "திருகோணமலை": "Trincomalee",
    "කුරුණෑගල": "Kurunegala",
    "குருநாகல்": "Kurunegala",
    "පුත්තලම": "Puttalam",
    "புத்தளம்": "Puttalam",
    "අනුරාධපුරය": "Anuradhapura",
    "අනුරාධපුර": "Anuradhapura",
    "அனுராதபுரம்": "Anuradhapura",
    "පොළොන්නරුව": "Polonnaruwa",
    "பொலன்னறுவை": "Polonnaruwa",
    "බදුල්ල": "Badulla",
    "பதுளை": "Badulla",
    "මොණරාගල": "Monaragala",
    "මොනරාගල": "Monaragala",
    "மொனராகலை": "Monaragala",
    "රත්නපුර": "Ratnapura",
    "රත්නපුරය": "Ratnapura",
    "இரத்தினபுரி": "Ratnapura",
    "කෑගල්ල": "Kegalle",
    "கேகாலை": "Kegalle",

    // Major Towns
    "මීගමුව": "Negombo",
    "நீர்கொழும்பு": "Negombo",
    "නුගේගොඩ": "Nugegoda",
    "நுகேகொடை": "Nugegoda",
    "දෙහිවල": "Dehiwala",
    "தெஹிவளை": "Dehiwala",
    "මොරටුව": "Moratuwa",
    "மொரட்டுவை": "Moratuwa",
    "මහරගම": "Maharagama",
    "மகரகம": "Maharagama",
    "කැළණිය": "Kelaniya",
    "කැලණිය": "Kelaniya",
    "களனி": "Kelaniya",
    "පානදුර": "Panadura",
    "பாணந்துறை": "Panadura",
    "පේරාදෙණිය": "Peradeniya",
    "பேராதனை": "Peradeniya",
    "කටුගස්තොට": "Katugastota",
    "கட்டுகஸ்தோட்டை": "Katugastota",
    "ගම්පොළ": "Gampola",
    "ගම්පොල": "Gampola",
    "கம்பளை": "Gampola",
    "හලාවත": "Chilaw",
    "சிலாபம்": "Chilaw",
    "හැටන්": "Hatton",
    "ஹட்டன்": "Hatton",
    "බණ්ඩාරවෙල": "Bandarawela",
    "பண்டாரவளை": "Bandarawela",
    "ඇඹිලිපිටිය": "Embilipitiya",
    "எம்பிலிப்பிட்டிய": "Embilipitiya",
};

const SCRIPT_LETTER_REGEX = /[\u0D80-\u0DFF\u0B80-\u0BFF]/;
export const HAS_INDIC_SCRIPT_REGEX = /[\u0D80-\u0DFF\u0B80-\u0BFF]/;

export function normalizeScriptText(input: string): string {
    return input
        .normalize("NFC")
        .replace(/[\u200C\u200D]/g, "")
        .replace(/[.,;:]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

const NORMALIZED_ALIAS_MAP = new Map<string, string>();
const SORTED_ALIASES: Array<{ alias: string; englishName: string }> = [];

for (const [rawAlias, englishName] of Object.entries(PLACE_ALIASES)) {
    const norm = normalizeScriptText(rawAlias);
    if (!norm) continue;
    if (!NORMALIZED_ALIAS_MAP.has(norm)) {
        NORMALIZED_ALIAS_MAP.set(norm, englishName);
        SORTED_ALIASES.push({ alias: norm, englishName });
    }
}

SORTED_ALIASES.sort((a, b) => b.alias.length - a.alias.length);

export function resolveAlias(term: string): string | null {
    const norm = normalizeScriptText(term);
    if (!norm) return null;
    return NORMALIZED_ALIAS_MAP.get(norm) ?? null;
}

export interface AliasMatch {
    alias: string;
    englishName: string;
    index: number;
}

/**
 * Finds Sinhala/Tamil town aliases in arbitrary text at script-letter boundaries,
 * preferring longest matches first and avoiding partial overlaps inside compound names.
 */
export function findAliasesInText(text: string): AliasMatch[] {
    if (!text || !HAS_INDIC_SCRIPT_REGEX.test(text)) return [];

    const cleaned = text.normalize("NFC").replace(/[\u200C\u200D]/g, "");
    const matches: AliasMatch[] = [];
    const occupied: Array<[number, number]> = [];

    const overlapsOccupied = (start: number, end: number) =>
        occupied.some(([s, e]) => start < e && end > s);

    for (const { alias, englishName } of SORTED_ALIASES) {
        let searchFrom = 0;
        while (searchFrom < cleaned.length) {
            const idx = cleaned.indexOf(alias, searchFrom);
            if (idx === -1) break;
            const end = idx + alias.length;

            const prevCh = idx > 0 ? cleaned[idx - 1] : "";
            const nextCh = end < cleaned.length ? cleaned[end] : "";
            const prevIsScript = prevCh ? SCRIPT_LETTER_REGEX.test(prevCh) : false;
            const nextIsScript = nextCh ? SCRIPT_LETTER_REGEX.test(nextCh) : false;

            if (!prevIsScript && !nextIsScript && !overlapsOccupied(idx, end)) {
                occupied.push([idx, end]);
                matches.push({ alias, englishName, index: idx });
            }
            searchFrom = idx + 1;
        }
    }

    matches.sort((a, b) => a.index - b.index);
    return matches;
}
