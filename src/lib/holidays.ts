/**
 * Sri Lankan Public Holidays for 2026
 * Used for determining post office closed/open status.
 * 
 * Source: Government of Sri Lanka Gazette
 * NOTE: Update this list annually or fetch dynamically from an API.
 */

interface Holiday {
    date: string; // MM-DD format
    name: { en: string; si: string; ta: string };
}

const holidays2026: Holiday[] = [
    { date: "01-14", name: { en: "Tamil Thai Pongal", si: "තමිල් තෛපොංගල්", ta: "தமிழ் தைப்பொங்கல்" }},
    { date: "01-15", name: { en: "Duruthu Full Moon Poya", si: "දුරුතු පුර පෝය", ta: "துருத்து முழு நிலா பொய" }},
    { date: "02-04", name: { en: "Independence Day", si: "නිදහස් දිනය", ta: "சுதந்திர தினம்" }},
    { date: "02-14", name: { en: "Navam Full Moon Poya", si: "නවම් පුර පෝය", ta: "நவம் முழு நிலா பொய" }},
    { date: "03-14", name: { en: "Maha Shivaratri", si: "මහා ශිවරාත්‍රී", ta: "மகா சிவராத்திரி" }},
    { date: "03-15", name: { en: "Medin Full Moon Poya", si: "මැදින් පුර පෝය", ta: "மேதின் முழு நிலா பொய" }},
    { date: "03-31", name: { en: "Id-Ul-Fitr (Ramazan)", si: "ඊද්-උල්-ෆිත්ර්", ta: "ரமலான் பெருநாள்" }},
    { date: "04-02", name: { en: "Good Friday", si: "මහ සිකුරාදා", ta: "புனித வெள்ளி" }},
    { date: "04-13", name: { en: "Day prior to Sinhala & Tamil New Year", si: "සිංහල හා දෙමළ අලුත් අවුරුදු පෙර දිනය", ta: "சிங்கள, தமிழ் புத்தாண்டு முன்தினம்" }},
    { date: "04-14", name: { en: "Sinhala & Tamil New Year", si: "සිංහල හා දෙමළ අලුත් අවුරුද්ද", ta: "சிங்கள, தமிழ் புத்தாண்டு" }},
    { date: "04-14", name: { en: "Bak Full Moon Poya", si: "බක් පුර පෝය", ta: "பக் முழு நிலா பொய" }},
    { date: "05-01", name: { en: "May Day", si: "මැයි දිනය", ta: "மே தினம்" }},
    { date: "05-12", name: { en: "Vesak Full Moon Poya", si: "වෙසක් පුර පෝය", ta: "வெசாக் முழு நிலா பொய" }},
    { date: "05-13", name: { en: "Day after Vesak", si: "වෙසක් පුර පෝයට පසු දිනය", ta: "வெசாக் அடுத்த நாள்" }},
    { date: "06-07", name: { en: "Id-Ul-Alha (Hajj)", si: "ඊද්-උල්-අල්හා", ta: "ஹஜ் பெருநாள்" }},
    { date: "06-11", name: { en: "Poson Full Moon Poya", si: "පොසොන් පුර පෝය", ta: "போசன் முழு நிலா பொய" }},
    { date: "07-07", name: { en: "Milad-Un-Nabi (Prophet's Birthday)", si: "මිලාද්-උන්-නබි", ta: "நபிகள் நாயகம் பிறந்த நாள்" }},
    { date: "07-10", name: { en: "Esala Full Moon Poya", si: "ඇසල පුර පෝය", ta: "ஏசல முழு நிலா பொய" }},
    { date: "08-09", name: { en: "Nikini Full Moon Poya", si: "නිකිණි පුර පෝය", ta: "நிக்கினி முழு நிலா பொய" }},
    { date: "09-07", name: { en: "Binara Full Moon Poya", si: "බිනර පුර පෝය", ta: "பினர முழு நிலா பொய" }},
    { date: "10-07", name: { en: "Vap Full Moon Poya", si: "වප් පුර පෝය", ta: "வப் முழு நிலா பொய" }},
    { date: "10-20", name: { en: "Deepavali", si: "දීපාවලී", ta: "தீபாவளி" }},
    { date: "11-05", name: { en: "Il Full Moon Poya", si: "ඉල් පුර පෝය", ta: "இல் முழு நிலா பொய" }},
    { date: "12-05", name: { en: "Unduvap Full Moon Poya", si: "උන්දුවප් පුර පෝය", ta: "உந்துவப் முழு நிலா பொய" }},
    { date: "12-25", name: { en: "Christmas Day", si: "නත්තල් දිනය", ta: "கிறிஸ்துமஸ் தினம்" }},
];

export type PostOfficeStatus = "open" | "closed" | "counter-only" | "holiday";

interface StatusResult {
    status: PostOfficeStatus;
    label: string;
    holidayName?: string;
}

/**
 * Get the current operating status of a post office.
 * @param locale - Current locale for holiday name display
 * @param is24Hour - Whether this office is a 24-hour office
 * @returns Status result with label and optional holiday info
 */
export function getPostOfficeStatus(locale: string = "en", is24Hour: boolean = false): StatusResult {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday
    const hour = now.getHours();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const date = String(now.getDate()).padStart(2, "0");
    const todayKey = `${month}-${date}`;

    // Check holidays first
    const holiday = holidays2026.find(h => h.date === todayKey);
    if (holiday) {
        const loc = locale as keyof typeof holiday.name;
        return {
            status: "holiday",
            label: holiday.name[loc] || holiday.name.en,
            holidayName: holiday.name[loc] || holiday.name.en,
        };
    }

    // 24 Hour offices are always open, but still respect holidays if they are listed as such
    if (is24Hour) {
        return { status: "open", label: "open24h" };
    }

    // Sunday — closed by default, some major offices offer counter-only
    if (day === 0) {
        return { status: "closed", label: "closed" };
    }

    // Saturday — counter services only (half day, typically 9am-1pm)
    if (day === 6) {
        if (hour >= 9 && hour < 13) {
            return { status: "counter-only", label: "counterOnly" };
        }
        return { status: "closed", label: "closed" };
    }

    // Weekdays — open 8:30 AM to 4:30 PM (approximately)
    if (hour >= 8 && hour < 17) {
        return { status: "open", label: "open" };
    }

    return { status: "closed", label: "closed" };
}

/**
 * Get the next upcoming holiday
 */
export function getNextHoliday(locale: string = "en"): { name: string; date: string; daysUntil: number } | null {
    const now = new Date();
    const year = now.getFullYear();

    for (const holiday of holidays2026) {
        const [month, day] = holiday.date.split("-").map(Number);
        const holidayDate = new Date(year, month - 1, day);
        const diff = Math.ceil((holidayDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (diff > 0 && diff <= 7) {
            const loc = locale as keyof typeof holiday.name;
            return {
                name: holiday.name[loc] || holiday.name.en,
                date: holidayDate.toLocaleDateString(locale === "si" ? "si-LK" : locale === "ta" ? "ta-LK" : "en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                }),
                daysUntil: diff,
            };
        }
    }
    return null;
}
