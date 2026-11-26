/**
 * Sri Lankan Public Holidays & Post Office Operating Hours Engine
 * Always evaluates time in Asia/Colombo (UTC+05:30) regardless of server/client timezone.
 */

interface Holiday {
    date: string; // MM-DD format
    name: { en: string; si: string; ta: string };
}

const holidays2026: Holiday[] = [
    { date: "01-14", name: { en: "Tamil Thai Pongal", si: "තමිල් තෛපොංගල්", ta: "தமிழ் தைப்பொங்கல்" } },
    { date: "01-15", name: { en: "Duruthu Full Moon Poya", si: "දුරුතු පුර පෝය", ta: "துருத்து முழு நிலா பொய" } },
    { date: "02-04", name: { en: "Independence Day", si: "නිදහස් දිනය", ta: "சுதந்திர தினம்" } },
    { date: "02-14", name: { en: "Navam Full Moon Poya", si: "නවම් පුර පෝය", ta: "நவம் முழு நிலா பொய" } },
    { date: "03-14", name: { en: "Maha Shivaratri", si: "මහා ශිවරාත්‍රී", ta: "மகா சிவராத்திரி" } },
    { date: "03-15", name: { en: "Medin Full Moon Poya", si: "මැදින් පුර පෝය", ta: "மேதின் முழு நிலா பொய" } },
    { date: "03-31", name: { en: "Id-Ul-Fitr (Ramazan)", si: "ඊද්-උල්-ෆිත්ර්", ta: "ரமலான் பெருநாள்" } },
    { date: "04-02", name: { en: "Good Friday", si: "මහ සිකුරාදා", ta: "புனித வெள்ளி" } },
    { date: "04-13", name: { en: "Day prior to Sinhala & Tamil New Year", si: "සිංහල හා දෙමළ අලුත් අවුරුදු පෙර දිනය", ta: "சிங்கள, தமிழ் புத்தாண்டு முன்தினம்" } },
    { date: "04-14", name: { en: "Sinhala & Tamil New Year", si: "සිංහල හා දෙමළ අලුත් අවුරුද්ද", ta: "சிங்கள, தமிழ் புத்தாண்டு" } },
    { date: "04-14", name: { en: "Bak Full Moon Poya", si: "බක් පුර පෝය", ta: "பக் முழு நிலா பொய" } },
    { date: "05-01", name: { en: "May Day", si: "මැයි දිනය", ta: "மே தினம்" } },
    { date: "05-12", name: { en: "Vesak Full Moon Poya", si: "වෙසක් පුර පෝය", ta: "வெசாக் முழு நிலா பொய" } },
    { date: "05-13", name: { en: "Day after Vesak", si: "වෙසක් පුර පෝයට පසු දිනය", ta: "வெசாக் அடுத்த நாள்" } },
    { date: "06-07", name: { en: "Id-Ul-Alha (Hajj)", si: "ඊද්-උල්-අල්හා", ta: "ஹஜ் பெருநாள்" } },
    { date: "06-11", name: { en: "Poson Full Moon Poya", si: "පොසොන් පුර පෝය", ta: "போசன் முழு நிலா பொய" } },
    { date: "07-07", name: { en: "Milad-Un-Nabi (Prophet's Birthday)", si: "මිලාද්-උන්-නබි", ta: "நபிகள் நாயகம் பிறந்த நாள்" } },
    { date: "07-10", name: { en: "Esala Full Moon Poya", si: "ඇසල පුර පෝය", ta: "ஏசல முழு நிலா பொய" } },
    { date: "08-09", name: { en: "Nikini Full Moon Poya", si: "නිකිණි පුර පෝය", ta: "நிக்கினி முழு நிலா பொய" } },
    { date: "09-07", name: { en: "Binara Full Moon Poya", si: "බිනර පුර පෝය", ta: "பினர முழு நிலா பொய" } },
    { date: "10-07", name: { en: "Vap Full Moon Poya", si: "වප් පුර පෝය", ta: "வப் முழு நிலா பொய" } },
    { date: "10-20", name: { en: "Deepavali", si: "දීපාවලී", ta: "தீபாவளி" } },
    { date: "11-05", name: { en: "Il Full Moon Poya", si: "ඉල් පුර පෝය", ta: "இல் முழு நிலா பொய" } },
    { date: "12-05", name: { en: "Unduvap Full Moon Poya", si: "උන්දුවප් පුර පෝය", ta: "உந்துவப் முழு நிலா பொய" } },
    { date: "12-25", name: { en: "Christmas Day", si: "නත්තල් දිනය", ta: "கிறிஸ்துமஸ் தினம்" } },
];

export type PostOfficeStatus = "open" | "closed" | "counter-only" | "holiday";

interface StatusResult {
    status: PostOfficeStatus;
    label: string;
    holidayName?: string;
}

export interface TimeWindow {
    openMinutes: number;
    closeMinutes: number;
    open24h: string; // HH:mm
    close24h: string; // HH:mm
    label: string;
}

export interface ParsedOperatingHours {
    is24Hour: boolean;
    weekday: TimeWindow | null;
    saturday: TimeWindow | null;
    sunday: TimeWindow | null;
    saturdayCounterOnly: boolean;
    summary: string;
}

export interface ColomboTimeParts {
    year: number;
    month: string;
    dayOfMonth: string;
    todayKey: string; // MM-DD
    dayOfWeek: number; // 0 = Sun .. 6 = Sat
    hour: number;
    minute: number;
    minutesSinceMidnight: number;
}

const WEEKDAY_MAP: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
};

export function getColomboTimeParts(now: Date = new Date()): ColomboTimeParts {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Colombo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    });

    const parts = formatter.formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
    const year = Number(get("year")) || now.getUTCFullYear();
    const month = get("month").padStart(2, "0");
    const dayOfMonth = get("day").padStart(2, "0");
    const weekdayShort = get("weekday");
    const hour = Number(get("hour")) % 24;
    const minute = Number(get("minute"));

    return {
        year,
        month,
        dayOfMonth,
        todayKey: `${month}-${dayOfMonth}`,
        dayOfWeek: WEEKDAY_MAP[weekdayShort] ?? 0,
        hour,
        minute,
        minutesSinceMidnight: hour * 60 + minute,
    };
}

function to24hString(minutes: number): string {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function to12hLabel(minutes: number): string {
    const h24 = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    const period = h24 >= 12 ? "PM" : "AM";
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function makeWindow(openMin: number, closeMin: number): TimeWindow {
    return {
        openMinutes: openMin,
        closeMinutes: closeMin,
        open24h: to24hString(openMin),
        close24h: to24hString(closeMin),
        label: `${to12hLabel(openMin)} – ${to12hLabel(closeMin)}`,
    };
}

function parseTimeToken(raw: string): number | null {
    const match = raw.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2] || "0");
    const ampm = match[3]?.toUpperCase();
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    if (hour > 23 || minute > 59) return null;
    return hour * 60 + minute;
}

function parseRangeSegment(segment: string): TimeWindow | null {
    const match = segment.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*[–\-to]+\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i);
    if (!match) return null;
    const start = parseTimeToken(match[1]);
    const end = parseTimeToken(match[2]);
    if (start === null || end === null || end <= start) return null;
    return makeWindow(start, end);
}

/**
 * Parses an office's operatingHours text into structured weekday / Saturday / Sunday windows.
 */
export function parseOperatingHours(
    hoursStr?: string | null,
    is24Hour: boolean = false,
    officeType?: string | null
): ParsedOperatingHours {
    const raw = (hoursStr || "").trim();
    if (is24Hour || /\b24\s*hours?\b/i.test(raw)) {
        const w = makeWindow(0, 24 * 60 - 1);
        return {
            is24Hour: true,
            weekday: w,
            saturday: w,
            sunday: w,
            saturdayCounterOnly: false,
            summary: raw || "Open 24 Hours",
        };
    }

    const isSub = /sub\s*post/i.test(officeType || "");
    const defaultWeekday = isSub ? makeWindow(8 * 60 + 30, 16 * 60) : makeWindow(8 * 60 + 30, 16 * 60 + 30);
    const defaultSaturday = isSub ? makeWindow(8 * 60 + 30, 12 * 60 + 30) : makeWindow(8 * 60 + 30, 13 * 60);

    if (!raw) {
        return {
            is24Hour: false,
            weekday: defaultWeekday,
            saturday: defaultSaturday,
            sunday: null,
            saturdayCounterOnly: true,
            summary: isSub
                ? "Mon–Fri 8:30 AM – 4:00 PM · Sat 8:30 AM – 12:30 PM"
                : "Mon–Fri 8:30 AM – 4:30 PM · Sat 8:30 AM – 1:00 PM",
        };
    }

    let weekday: TimeWindow | null = null;
    let saturday: TimeWindow | null = null;
    let sunday: TimeWindow | null = null;
    let saturdayCounterOnly = true;

    const segments = raw.split(/[·|;]/).map((s) => s.trim()).filter(Boolean);
    for (const seg of segments) {
        const win = parseRangeSegment(seg);
        if (!win) continue;

        if (/mon\s*[–\-]\s*sun|daily|everyday/i.test(seg)) {
            weekday = win;
            saturday = win;
            sunday = win;
            saturdayCounterOnly = false;
        } else if (/mon\s*[–\-]\s*sat/i.test(seg)) {
            weekday = win;
            saturday = win;
            saturdayCounterOnly = false;
        } else if (/sat\s*[–\-]\s*sun|weekend/i.test(seg)) {
            saturday = win;
            sunday = win;
            saturdayCounterOnly = false;
        } else if (/\bmon|weekday|tue|wed|thu|fri/i.test(seg)) {
            weekday = win;
        } else if (/\bsat/i.test(seg)) {
            saturday = win;
        } else if (/\bsun/i.test(seg)) {
            sunday = win;
        } else if (!weekday) {
            weekday = win;
        }
    }

    // Legacy "8:00 AM - 4:00 PM (Weekdays)" or plain time range without day prefixes
    if (!weekday) {
        weekday = parseRangeSegment(raw) || defaultWeekday;
    }
    if (!saturday && !/weekdays?\s*only/i.test(raw)) {
        saturday = defaultSaturday;
    }

    return {
        is24Hour: false,
        weekday,
        saturday,
        sunday,
        saturdayCounterOnly,
        summary: raw,
    };
}

/**
 * Get the current operating status of a post office in Asia/Colombo time.
 * @param locale - Current locale for holiday name display
 * @param is24Hour - Whether this office is a 24-hour office
 * @param operatingHours - Optional per-office operatingHours string
 * @param now - Optional Date override for testing
 */
export function getPostOfficeStatus(
    locale: string = "en",
    is24Hour: boolean = false,
    operatingHours?: string | null,
    now: Date = new Date()
): StatusResult {
    const colombo = getColomboTimeParts(now);

    // Check holidays first
    const holiday = holidays2026.find((h) => h.date === colombo.todayKey);
    if (holiday) {
        const loc = locale as keyof typeof holiday.name;
        return {
            status: "holiday",
            label: holiday.name[loc] || holiday.name.en,
            holidayName: holiday.name[loc] || holiday.name.en,
        };
    }

    const parsed = parseOperatingHours(operatingHours, is24Hour);

    if (parsed.is24Hour) {
        return { status: "open", label: "open24h" };
    }

    const mins = colombo.minutesSinceMidnight;

    if (colombo.dayOfWeek === 0) {
        if (parsed.sunday && mins >= parsed.sunday.openMinutes && mins < parsed.sunday.closeMinutes) {
            return { status: "open", label: "open" };
        }
        return { status: "closed", label: "closed" };
    }

    if (colombo.dayOfWeek === 6) {
        if (parsed.saturday && mins >= parsed.saturday.openMinutes && mins < parsed.saturday.closeMinutes) {
            return parsed.saturdayCounterOnly
                ? { status: "counter-only", label: "counterOnly" }
                : { status: "open", label: "open" };
        }
        return { status: "closed", label: "closed" };
    }

    if (parsed.weekday && mins >= parsed.weekday.openMinutes && mins < parsed.weekday.closeMinutes) {
        return { status: "open", label: "open" };
    }

    return { status: "closed", label: "closed" };
}

/**
 * Get the next upcoming holiday in Asia/Colombo time.
 */
export function getNextHoliday(locale: string = "en"): { name: string; date: string; daysUntil: number } | null {
    const now = new Date();
    const colombo = getColomboTimeParts(now);
    const year = colombo.year;

    for (const holiday of holidays2026) {
        const [month, day] = holiday.date.split("-").map(Number);
        const holidayDate = new Date(Date.UTC(year, month - 1, day));
        const colomboTodayUtc = new Date(Date.UTC(year, Number(colombo.month) - 1, Number(colombo.dayOfMonth)));
        const diff = Math.round((holidayDate.getTime() - colomboTodayUtc.getTime()) / (1000 * 60 * 60 * 24));

        if (diff > 0 && diff <= 7) {
            const loc = locale as keyof typeof holiday.name;
            return {
                name: holiday.name[loc] || holiday.name.en,
                date: holidayDate.toLocaleDateString(locale === "si" ? "si-LK" : locale === "ta" ? "ta-LK" : "en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    timeZone: "UTC",
                }),
                daysUntil: diff,
            };
        }
    }
    return null;
}
