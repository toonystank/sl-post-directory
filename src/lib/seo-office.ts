import { DEFAULT_SITE_URL, normalizePostalCode } from "./site";

export type OfficeSitemapTier = 1 | 2 | 3;

export interface OfficeTierClassification {
    tier: OfficeSitemapTier;
    priority: number;
    changeFrequency: "weekly" | "monthly";
}

const MAJOR_OFFICE_TYPE_RE = /^(?:post office|main post office|rmsc|sorting|agency post office)/i;

/**
 * Classifies a Sri Lanka post office into a search-value tier for sitemap ordering
 * and hreflang prioritization:
 * - Tier 1: Main Post Offices, RMSC/Sorting Hubs, Agency Post Offices (~670 high-demand hubs)
 * - Tier 2: Sub Post Offices with their own 5-digit postal code (~1,865 offices)
 * - Tier 3: Sub Post Offices without an individual postal code (~1,500 offices)
 */
export function classifyOfficeSitemapTier(input: {
    type?: string | null;
    postalCode?: string | null;
}): OfficeTierClassification {
    const type = (input.type ?? "").trim();
    const code = normalizePostalCode(input.postalCode);

    if (type && MAJOR_OFFICE_TYPE_RE.test(type)) {
        return { tier: 1, priority: 0.85, changeFrequency: "weekly" };
    }
    if (code) {
        return { tier: 2, priority: 0.7, changeFrequency: "monthly" };
    }
    return { tier: 3, priority: 0.55, changeFrequency: "monthly" };
}

export function sortOfficesForSitemap<
    T extends {
        slug: string;
        name?: string | null;
        type?: string | null;
        postalCode?: string | null;
    },
>(offices: T[]): T[] {
    return [...offices].sort((a, b) => {
        const tierA = classifyOfficeSitemapTier(a).tier;
        const tierB = classifyOfficeSitemapTier(b).tier;
        if (tierA !== tierB) return tierA - tierB;
        const labelA = (a.name || a.slug).toLowerCase();
        const labelB = (b.name || b.slug).toLowerCase();
        return labelA.localeCompare(labelB);
    });
}

export interface DivisionSiblingCandidate {
    slug: string;
    name: string;
    postalCode: string;
    type?: string;
}

/**
 * Builds a deterministic, well-connected set of related post offices in the same division.
 * Combines top Main Post Offices in the division with circular alphabetical neighbors of
 * `currentSlug` so every office in a division participates in an unbroken internal link graph.
 */
export function selectRelatedDivisionOffices(
    currentSlug: string,
    divisionOffices: DivisionSiblingCandidate[],
    limit: number = 8
): DivisionSiblingCandidate[] {
    const sorted = [...divisionOffices]
        .filter((o) => Boolean(o.slug))
        .sort((a, b) => a.name.localeCompare(b.name));

    const currentIdx = sorted.findIndex((o) => o.slug === currentSlug);
    const others = sorted.filter((o) => o.slug !== currentSlug);
    if (others.length <= limit) return others;

    const picked: DivisionSiblingCandidate[] = [];
    const seen = new Set<string>([currentSlug]);

    const add = (candidate: DivisionSiblingCandidate | undefined) => {
        if (!candidate || seen.has(candidate.slug) || picked.length >= limit) return;
        seen.add(candidate.slug);
        picked.push(candidate);
    };

    // 1. Immediate circular alphabetical neighbors (guarantees every SPO has incoming & outgoing links)
    const neighborTarget = Math.min(4, Math.floor(limit / 2));
    if (currentIdx !== -1 && sorted.length > 1) {
        for (let step = 1; step <= neighborTarget; step++) {
            add(sorted[(currentIdx + step) % sorted.length]);
            if (picked.length >= neighborTarget) break;
            add(sorted[(currentIdx - step + sorted.length) % sorted.length]);
        }
    }

    // 2. Top Main Post Offices / coded offices in the same division for high-utility navigation
    const majorOffices = others.filter((o) => classifyOfficeSitemapTier(o).tier === 1);
    for (const office of majorOffices) {
        if (picked.length >= limit) break;
        add(office);
    }

    // 3. Fill remaining slots with coded offices, then any remaining division offices
    const codedOffices = others.filter((o) => Boolean(normalizePostalCode(o.postalCode)));
    for (const office of codedOffices) {
        if (picked.length >= limit) break;
        add(office);
    }
    for (const office of others) {
        if (picked.length >= limit) break;
        add(office);
    }

    return picked;
}

export interface OfficeSeoInput {
    name: string;
    postalCode: string;
    type: string;
    grade?: string;
    shortCode?: string;
    division?: string;
    dpmg?: string;
    rmsc?: string;
    phoneNumbers: string[];
    fax?: string;
    hoursSummary: string;
    is24Hour: boolean;
    weekdayHours?: string;
    saturdayHours?: string;
    sundayHours?: string;
    isDeliveryOffice: boolean;
    isNonDeliveryOffice: boolean;
    controllingOffice?: {
        name: string;
        postalCode: string;
        phone?: string;
    } | null;
    controlledCount: number;
}

function normalizeSeoLocale(locale: string): "en" | "si" | "ta" {
    if (locale === "si" || locale === "ta") return locale;
    return "en";
}

/**
 * Generates localized, intent-rich `<title>` and `<meta name="description">` copy for
 * post office pages, explicitly addressing offices whose postal code is inherited from
 * their controlling post office.
 */
export function buildOfficeMetadataCopy(
    input: OfficeSeoInput,
    locale: string = "en"
): { title: string; description: string } {
    const lang = normalizeSeoLocale(locale);
    const code = normalizePostalCode(input.postalCode);
    const ctrlCode = normalizePostalCode(input.controllingOffice?.postalCode);
    const primaryPhone = input.phoneNumbers[0] || "";
    const division = input.division?.trim() || "";
    const type = input.type?.trim() || "Post Office";

    if (lang === "si") {
        const title = code
            ? `${input.name} තැපැල් කාර්යාලය — තැපැල් කේතය ${code}, දුරකථන සහ වේලාවන්`
            : ctrlCode
              ? `${input.name} (${type}) — ${division ? `${division} · ` : ""}තැපැල් කේතය ${ctrlCode} සහ දුරකථන`
              : `${input.name} (${type})${division ? ` — ${division}` : ""} | දුරකථන සහ වේලාවන්`;

        const parts: string[] = [];
        parts.push(
            `${input.name} (${type}${division ? `, ${division}` : ""}) තැපැල් කාර්යාලයේ තොරතුරු.`
        );
        if (code) {
            parts.push(`තැපැල් කේතය: ${code}.`);
        } else if (input.controllingOffice && ctrlCode) {
            parts.push(
                `පාලන තැපැල් කාර්යාලය: ${input.controllingOffice.name} (තැපැල් කේතය ${ctrlCode}).`
            );
        }
        if (primaryPhone) parts.push(`දුරකථන: ${primaryPhone}.`);
        parts.push(`විවෘත වේලාවන්: ${input.hoursSummary}.`);

        return { title, description: parts.join(" ") };
    }

    if (lang === "ta") {
        const title = code
            ? `${input.name} அஞ்சல் நிலையம் — அஞ்சல் குறியீடு ${code}, தொலைபேசி & நேரங்கள்`
            : ctrlCode
              ? `${input.name} (${type}) — ${division ? `${division} · ` : ""}அஞ்சல் குறியீடு ${ctrlCode} & தொலைபேசி`
              : `${input.name} (${type})${division ? ` — ${division}` : ""} | தொலைபேசி & நேரங்கள்`;

        const parts: string[] = [];
        parts.push(
            `${input.name} (${type}${division ? `, ${division}` : ""}) அஞ்சல் நிலைய விவரங்கள்.`
        );
        if (code) {
            parts.push(`அஞ்சல் குறியீடு: ${code}.`);
        } else if (input.controllingOffice && ctrlCode) {
            parts.push(
                `கட்டுப்பாட்டு அஞ்சல் நிலையம்: ${input.controllingOffice.name} (அஞ்சல் குறியீடு ${ctrlCode}).`
            );
        }
        if (primaryPhone) parts.push(`தொலைபேசி: ${primaryPhone}.`);
        parts.push(`வேலை நேரம்: ${input.hoursSummary}.`);

        return { title, description: parts.join(" ") };
    }

    // English
    const hasPostOfficeWord = /post office|rmsc|hub|gpo|cme/i.test(input.name);
    const displayName = hasPostOfficeWord ? input.name : `${input.name} ${type}`;

    const title = code
        ? `${displayName} — Postal Code ${code}, Phone & Hours`
        : ctrlCode && input.controllingOffice
          ? `${displayName}${division ? ` (${division})` : ""} — Phone, Hours & Postal Code ${ctrlCode}`
          : `${displayName}${division ? ` (${division})` : ""} — Phone Number, Hours & Routing`;

    const descParts: string[] = [];
    if (code) {
        descParts.push(
            `${input.name} is a ${type}${division ? ` in the ${division} postal division` : ""} of Sri Lanka with 5-digit postal code ${code}.`
        );
    } else if (input.controllingOffice && ctrlCode) {
        descParts.push(
            `${input.name} is a ${type}${division ? ` in ${division}` : ""}, Sri Lanka, operating under ${input.controllingOffice.name} (Postal Code ${ctrlCode}).`
        );
    } else {
        descParts.push(
            `${input.name} is a ${type}${division ? ` in ${division}` : ""}, Sri Lanka.`
        );
    }
    if (primaryPhone) {
        descParts.push(`Telephone: ${primaryPhone}.`);
    }
    if (input.shortCode) {
        descParts.push(`Short code: ${input.shortCode}.`);
    }
    descParts.push(`Opening hours: ${input.hoursSummary}.`);

    return {
        title,
        description: descParts.join(" "),
    };
}

export interface OfficeSeoFaq {
    question: string;
    answer: string;
}

export interface OfficeSeoContent {
    overviewHeading: string;
    overviewParagraph: string;
    faqHeading: string;
    faqs: OfficeSeoFaq[];
    faqJsonLd: Record<string, unknown>;
}

/**
 * Generates unique, data-backed summary prose and FAQ items (plus matching FAQPage JSON-LD)
 * for each post office page so every office page carries genuine search value and answers
 * common Sri Lankan postal lookup questions.
 */
export function buildOfficeSeoContent(
    input: OfficeSeoInput,
    locale: string = "en"
): OfficeSeoContent {
    const lang = normalizeSeoLocale(locale);
    const code = normalizePostalCode(input.postalCode);
    const ctrl = input.controllingOffice;
    const ctrlCode = normalizePostalCode(ctrl?.postalCode);
    const division = input.division?.trim() || "";
    const province = input.dpmg?.trim() || "";
    const rmsc = input.rmsc?.trim() || "";
    const phones = input.phoneNumbers.join(" / ");

    if (lang === "si") {
        const overviewParts: string[] = [
            `${input.name} යනු ශ්‍රී ලංකාවේ ${division ? `${division} තැපැල් කොට්ඨාසයට` : "ශ්‍රී ලංකා තැපැල් ජාලයට"}${province ? ` (${province} පළාත)` : ""} අයත් ${input.type} කාර්යාලයකි.`,
        ];
        if (code) {
            overviewParts.push(`මෙම කාර්යාලයේ 5-ඉලක්කම් තැපැල් කේතය ${code} වේ.`);
        } else if (ctrl && ctrlCode) {
            overviewParts.push(
                `මෙම උප තැපැල් කාර්යාලය ${ctrl.name} පාලන කාර්යාලය (තැපැල් කේතය ${ctrlCode}) යටතේ ක්‍රියාත්මක වේ.`
            );
        }
        if (input.isDeliveryOffice) {
            overviewParts.push("මෙම කාර්යාලය මගින් ලිපි හා පාර්සල් සෘජුවම බෙදාහැරීම සිදු කරයි.");
        } else if (input.isNonDeliveryOffice) {
            overviewParts.push(
                ctrl
                    ? `මෙය කවුන්ටර සේවා පමණක් සපයන කාර්යාලයක් වන අතර බෙදාහැරීම් ${ctrl.name} හරහා සිදු කෙරේ.`
                    : "මෙය කවුන්ටර සේවා පමණක් සපයන බෙදාහැරීම් නොකරන කාර්යාලයකි."
            );
        }
        if (input.controlledCount > 0) {
            overviewParts.push(
                `එමෙන්ම මෙම කාර්යාලය යටතේ උප තැපැල් කාර්යාල ${input.controlledCount} ක් පාලනය වේ.`
            );
        }

        const faqs: OfficeSeoFaq[] = [
            {
                question: `${input.name} තැපැල් කේතය කුමක්ද?`,
                answer: code
                    ? `${input.name} තැපැල් කාර්යාලයේ තැපැල් කේතය ${code} වේ. ශ්‍රී ලංකාව තුළ හෝ විදේශයෙන් ලිපි හා පාර්සල් යැවීමේදී මෙම ඉලක්කම් 5 කේතය භාවිතා කරන්න.`
                    : ctrl && ctrlCode
                      ? `${input.name} උප තැපැල් කාර්යාලය සඳහා වෙනම තැපැල් කේතයක් නොමැති බැවින් එහි පාලන කාර්යාලය වන ${ctrl.name} හි තැපැල් කේතය (${ctrlCode}) භාවිතා කරන්න.`
                      : `${input.name} සඳහා තනි තැපැල් කේතයක් ලැයිස්තුගත කර නොමැත.${division ? ` ${division} කොට්ඨාසයේ ප්‍රධාන තැපැල් කාර්යාලය හරහා තහවුරු කර ගන්න.` : ""}`,
            },
            {
                question: `${input.name} තැපැල් කාර්යාලය විවෘත වේලාවන් මොනවාද?`,
                answer: input.is24Hour
                    ? `${input.name} දිනපතා පැය 24 පුරාම විවෘතව පවතී.`
                    : `${input.name} සාමාන්‍යයෙන් ${input.hoursSummary} දක්වා විවෘතව පවතී. ඉරිදා සහ ශ්‍රී ලංකා රජයේ / පොහොය නිවාඩු දිනවල වේලාවන් වෙනස් විය හැක.`,
            },
            {
                question: `${input.name} තැපැල් කාර්යාලයේ දුරකථන අංකය කුමක්ද?`,
                answer: phones
                    ? `${input.name} තැපැල් කාර්යාලය ${phones} දුරකථන අංකයෙන්${input.fax ? ` (ෆැක්ස්: ${input.fax})` : ""} සම්බන්ධ කර ගත හැක.`
                    : ctrl?.phone
                      ? `${input.name} සඳහා සෘජු දුරකථන අංකයක් ලැයිස්තුගත කර නැත. විමසීම් සඳහා පාලන කාර්යාලය වන ${ctrl.name} (${ctrl.phone}) අමතන්න.`
                      : `${input.name} සඳහා සෘජු දුරකථන අංකයක් දැනට නාමාවලියේ සඳහන් නොවේ.`,
            },
        ];

        return {
            overviewHeading: `${input.name} පිළිබඳ විස්තර`,
            overviewParagraph: overviewParts.join(" "),
            faqHeading: "නිතර අසන ප්‍රශ්න",
            faqs,
            faqJsonLd: {
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: faqs.map((faq) => ({
                    "@type": "Question",
                    name: faq.question,
                    acceptedAnswer: { "@type": "Answer", text: faq.answer },
                })),
            },
        };
    }

    if (lang === "ta") {
        const overviewParts: string[] = [
            `${input.name} என்பது இலங்கையின் ${division ? `${division} அஞ்சல் கோட்டத்தில்` : "அஞ்சல் வலையமைப்பில்"}${province ? ` (${province} மாகாணம்)` : ""} அமைந்துள்ள ${input.type} ஆகும்.`,
        ];
        if (code) {
            overviewParts.push(`இதன் 5 இலக்க அஞ்சல் குறியீடு ${code} ஆகும்.`);
        } else if (ctrl && ctrlCode) {
            overviewParts.push(
                `இந்த உப அஞ்சல் நிலையம் ${ctrl.name} கட்டுப்பாட்டு நிலையத்தின் (அஞ்சல் குறியீடு ${ctrlCode}) கீழ் இயங்குகிறது.`
            );
        }
        if (input.isDeliveryOffice) {
            overviewParts.push("இங்கு நேரடி கடித மற்றும் பொதி விநியோக சேவை உள்ளது.");
        } else if (input.isNonDeliveryOffice) {
            overviewParts.push(
                ctrl
                    ? `இது கவுண்டர் சேவை மட்டும் வழங்கும் நிலையம்; விநியோகம் ${ctrl.name} வழியாக நடைபெறுகிறது.`
                    : "இது கவுண்டர் சேவை மட்டும் வழங்கும் விநியோகமற்ற நிலையமாகும்."
            );
        }
        if (input.controlledCount > 0) {
            overviewParts.push(
                `இந்த நிலையம் ${input.controlledCount} உப அஞ்சல் நிலையங்களைக் கட்டுப்படுத்துகிறது.`
            );
        }

        const faqs: OfficeSeoFaq[] = [
            {
                question: `${input.name} அஞ்சல் குறியீடு என்ன?`,
                answer: code
                    ? `${input.name} அஞ்சல் நிலையத்தின் 5 இலக்க அஞ்சல் குறியீடு ${code} ஆகும்.`
                    : ctrl && ctrlCode
                      ? `${input.name} தனி அஞ்சல் குறியீடு கொண்டிருக்கவில்லை; இதன் கட்டுப்பாட்டு நிலையமான ${ctrl.name} அஞ்சல் குறியீட்டை (${ctrlCode}) பயன்படுத்தவும்.`
                      : `${input.name} நிலையத்திற்கு தனி அஞ்சல் குறியீடு பட்டியலிடப்படவில்லை.${division ? ` ${division} கோட்டத்தின் பிரதான அஞ்சல் நிலையத்தைத் தொடர்பு கொள்ளவும்.` : ""}`,
            },
            {
                question: `${input.name} அஞ்சல் நிலையம் திறக்கும் நேரம் என்ன?`,
                answer: input.is24Hour
                    ? `${input.name} தினமும் 24 மணி நேரமும் திறந்திருக்கும்.`
                    : `${input.name} பொதுவாக ${input.hoursSummary} வரை திறந்திருக்கும். ஞாயிறு மற்றும் இலங்கை பொது / பௌர்ணமி விடுமுறை நாட்களில் நேரங்கள் மாறுபடலாம்.`,
            },
            {
                question: `${input.name} அஞ்சல் நிலையத்தை எவ்வாறு தொடர்பு கொள்வது?`,
                answer: phones
                    ? `${input.name} அஞ்சல் நிலையத்தை ${phones} என்ற தொலைபேசி எண்ணில்${input.fax ? ` (தொலைநகல்: ${input.fax})` : ""} தொடர்பு கொள்ளலாம்.`
                    : ctrl?.phone
                      ? `${input.name} நிலையத்திற்கு நேரடி தொலைபேசி எண் பட்டியலிடப்படவில்லை. கட்டுப்பாட்டு நிலையமான ${ctrl.name} (${ctrl.phone}) ஐ அழைக்கவும்.`
                      : `${input.name} நிலையத்திற்கு நேரடி தொலைபேசி எண் தற்போது பட்டியலில் இல்லை.`,
            },
        ];

        return {
            overviewHeading: `${input.name} பற்றிய தகவல்`,
            overviewParagraph: overviewParts.join(" "),
            faqHeading: "அடிக்கடி கேட்கப்படும் கேள்விகள்",
            faqs,
            faqJsonLd: {
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: faqs.map((faq) => ({
                    "@type": "Question",
                    name: faq.question,
                    acceptedAnswer: { "@type": "Answer", text: faq.answer },
                })),
            },
        };
    }

    // English
    const overviewParts: string[] = [
        `${input.name} is a ${input.type}${input.grade ? ` (${input.grade})` : ""}${division ? ` located in the ${division} postal division` : " in Sri Lanka"}${province ? ` of ${province} Province` : ""}.`,
    ];
    if (code) {
        overviewParts.push(
            `Its official 5-digit Sri Lanka postal code is ${code}${input.shortCode ? ` (internal short code: ${input.shortCode})` : ""}.`
        );
    } else if (ctrl && ctrlCode) {
        overviewParts.push(
            `This sub post office operates under controlling post office ${ctrl.name}, which uses postal code ${ctrlCode}.`
        );
    }
    if (input.isDeliveryOffice) {
        overviewParts.push(
            `It functions as a direct delivery office handling local letters, registered mail, and parcels${rmsc ? ` routed through ${rmsc}` : ""}.`
        );
    } else if (input.isNonDeliveryOffice) {
        overviewParts.push(
            ctrl
                ? `It operates as a counter-only (non-delivery) office; street-addressed mail is forwarded via ${ctrl.name}${rmsc ? ` and ${rmsc}` : ""}.`
                : `It operates as a counter-only (non-delivery) office${rmsc ? ` connected to ${rmsc}` : ""}.`
        );
    } else if (rmsc) {
        overviewParts.push(`Inbound mail for this office routes through ${rmsc}.`);
    }
    if (input.controlledCount > 0) {
        overviewParts.push(
            `${input.name} serves as a controlling hub supervising ${input.controlledCount} sub post office${input.controlledCount === 1 ? "" : "s"} in the area.`
        );
    }

    const faqs: OfficeSeoFaq[] = [
        {
            question: `What is the postal code for ${input.name}?`,
            answer: code
                ? `The 5-digit Sri Lanka postal code for ${input.name} is ${code}. Use ${code} when addressing domestic or international letters, EMS items, and online shopping parcels to this area.`
                : ctrl && ctrlCode
                  ? `${input.name} does not have a standalone postal code in the Sri Lanka Post directory. Address mail using its controlling post office ${ctrl.name} (Postal Code ${ctrlCode}) along with the local area name.`
                  : `A separate 5-digit postal code is not listed for ${input.name}.${division ? ` Check the controlling main post office in the ${division} postal division when addressing parcels.` : ""}`,
        },
        {
            question: `What are the opening hours of ${input.name}?`,
            answer: input.is24Hour
                ? `${input.name} operates 24 hours a day.`
                : `${input.name} is normally open ${input.hoursSummary}${input.weekdayHours ? ` (Weekdays: ${input.weekdayHours}${input.saturdayHours ? `; Saturday: ${input.saturdayHours}` : ""}${input.sundayHours ? `; Sunday: ${input.sundayHours}` : "; Closed Sundays"})` : ""}. Hours may vary on Sri Lankan Poya days and mercantile/public holidays.`,
        },
        {
            question: `What is the telephone number for ${input.name}?`,
            answer: phones
                ? `You can contact ${input.name} by telephone at ${phones}${input.fax ? ` (Fax: ${input.fax})` : ""}.`
                : ctrl?.phone
                  ? `No direct telephone number is currently listed for ${input.name}. For postal inquiries, contact its controlling office ${ctrl.name} at ${ctrl.phone}.`
                  : `No direct telephone number is currently recorded for ${input.name} in our directory. You can suggest an update if you have the current number.`,
        },
        {
            question: `Does ${input.name} provide home delivery?`,
            answer: input.isDeliveryOffice
                ? `Yes — ${input.name} is listed as a Delivery Office and handles direct local delivery of letters and parcels${rmsc ? ` via ${rmsc}` : ""}.`
                : input.isNonDeliveryOffice
                  ? `No — ${input.name} is a Non-Delivery (counter-only) office. Counter services are available on site, while street delivery is handled through ${ctrl ? ctrl.name : "the controlling post office"}.`
                  : `Delivery classification is not specified for ${input.name}. Confirm delivery coverage directly with the office${ctrl ? ` or ${ctrl.name}` : ""}.`,
        },
    ];

    return {
        overviewHeading: `About ${input.name}`,
        overviewParagraph: overviewParts.join(" "),
        faqHeading: `Frequently Asked Questions — ${input.name}`,
        faqs,
        faqJsonLd: {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((faq) => ({
                "@type": "Question",
                name: faq.question,
                acceptedAnswer: { "@type": "Answer", text: faq.answer },
            })),
        },
    };
}

export type LocalizedCorePageKey = "calculator" | "track" | "browse" | "blog" | "privacy";

const CORE_PAGE_METADATA: Record<
    LocalizedCorePageKey,
    Record<"en" | "si" | "ta", { title: string; description: string }>
> = {
    calculator: {
        en: {
            title: "Sri Lanka Post Postage Calculator 2026 — Local, COD & International EMS",
            description:
                "Calculate official 2026 Sri Lanka Post shipping costs for domestic letters, parcels, SLP Courier (Speed Post), COD net payouts, and international EMS, Air Mail, U-Packet, TDS, and Sea Mail.",
        },
        si: {
            title: "2026 ශ්‍රී ලංකා තැපැල් ගාස්තු ගණකය — දේශීය, COD සහ විදේශීය EMS",
            description:
                "2026 නිල ශ්‍රී ලංකා තැපැල් ගාස්තු — දේශීය ලිපි, ලියාපදිංචි තැපැල්, පාර්සල්, SLP කුරියර්, COD සහ විදේශීය EMS, ගුවන් හා මුහුදු තැපැල් ගාස්තු ක්ෂණිකව ගණනය කරන්න.",
        },
        ta: {
            title: "2026 இலங்கை தபால் கட்டணக் கணிப்பான் — உள்நாட்டு, COD & வெளிநாட்டு EMS",
            description:
                "உள்நாட்டு கடிதங்கள், பதிவுத் தபால், பொதிகள், SLP கூரியர், COD மற்றும் வெளிநாட்டு EMS, வான்வழி & கடல்வழி தபால் கட்டணங்களை உடனடியாகக் கணக்கிடுங்கள்.",
        },
    },
    track: {
        en: {
            title: "Track Sri Lanka Post Parcel · COD, SLP Courier & Registered Mail",
            description:
                "Track Sri Lanka Post COD (BD), SLP Mail Courier (NA, BF), Registered Post (RA, BG), and international EMS articles in one place.",
        },
        si: {
            title: "ශ්‍රී ලංකා තැපැල් පාර්සල් ලුහුබැඳීම · COD, SLP කුරියර් සහ ලියාපදිංචි තැපැල්",
            description:
                "ශ්‍රී ලංකා තැපැල් COD (BD), SLP කුරියර් (NA, BF), ලියාපදිංචි තැපැල් (RA, BG) සහ විදේශීය EMS පාර්සල් එකම තැනකින් සජීවීව පරීක්ෂා කරන්න.",
        },
        ta: {
            title: "இலங்கை தபால் பொதி கண்காணிப்பு · COD, SLP கூரியர் & பதிவுத் தபால்",
            description:
                "இலங்கை தபால் COD (BD), SLP கூரியர் (NA, BF), பதிவுத் தபால் (RA, BG) மற்றும் வெளிநாட்டு EMS பொதிகளை ஒரே இடத்தில் கண்காணிக்கவும்.",
        },
    },
    browse: {
        en: {
            title: "Browse Sri Lanka Post Offices & Postal Codes Directory (A–Z)",
            description:
                "Search and browse 4,000+ Sri Lanka post offices alphabetically, by 5-digit postal code, division, office type, or postal service.",
        },
        si: {
            title: "ශ්‍රී ලංකා තැපැල් කාර්යාල සහ තැපැල් කේත නාමාවලිය (A–Z)",
            description:
                "ශ්‍රී ලංකාවේ තැපැල් කාර්යාල 4,000+ ක් නම, 5-ඉලක්කම් තැපැල් කේතය, කොට්ඨාසය හෝ සේවාව අනුව පිරික්සන්න.",
        },
        ta: {
            title: "இலங்கை அஞ்சல் நிலையங்கள் & அஞ்சல் குறியீடுகள் அடைவு (A–Z)",
            description:
                "இலங்கையின் 4,000+ அஞ்சல் நிலையங்களை அகரவரிசை, 5 இலக்க அஞ்சல் குறியீடு, கோட்டம் அல்லது சேவை வாரியாகத் தேடுங்கள்.",
        },
    },
    blog: {
        en: {
            title: "Sri Lanka Postal News, Service Alerts & Shipping Guides",
            description:
                "Latest Sri Lanka Post news updates, service alerts, postage tariff revisions, and helpful domestic & international shipping guides.",
        },
        si: {
            title: "ශ්‍රී ලංකා තැපැල් පුවත්, සේවා නිවේදන සහ මාර්ගෝපදේශ",
            description:
                "නවතම ශ්‍රී ලංකා තැපැල් පුවත්, සේවා නිවේදන, තැපැල් ගාස්තු සංශෝධන සහ ප්‍රයෝජනවත් මාර්ගෝපදේශ.",
        },
        ta: {
            title: "இலங்கை தபால் செய்திகள், சேவை அறிவிப்புகள் & வழிகாட்டிகள்",
            description:
                "புதிய இலங்கை தபால் செய்திகள், சேவை அறிவிப்புகள், கட்டண மாற்றங்கள் மற்றும் அனுப்புதல் வழிகாட்டிகள்.",
        },
    },
    privacy: {
        en: {
            title: "Privacy Policy",
            description:
                "Privacy Policy for Lanka Post Directory web and Android app, covering contributor submissions, camera/OCR scanning, offline storage, analytics, cookies, data deletion, and Google Ads.",
        },
        si: {
            title: "රහස්‍යතා ප්‍රතිපත්තිය",
            description:
                "ලංකා තැපැල් නාමාවලිය වෙබ් සහ Android යෙදුම සඳහා රහස්‍යතා ප්‍රතිපත්තිය — දත්ත භාවිතය, කැමරා/OCR, නොබැඳි ගබඩා සහ කුකීස් විස්තර.",
        },
        ta: {
            title: "தனியுரிமைக் கொள்கை",
            description:
                "இலங்கை அஞ்சல் அடைவு இணைய மற்றும் Android செயலிக்கான தனியுரிமைக் கொள்கை.",
        },
    },
};

export function getLocalizedPageMetadata(
    key: LocalizedCorePageKey,
    locale: string = "en"
): { title: string; description: string } {
    return CORE_PAGE_METADATA[key][normalizeSeoLocale(locale)];
}

/**
 * When a custom domain (e.g., `https://thapal.lk`) is configured in `NEXT_PUBLIC_SITE_URL`,
 * returns a permanent 301 redirect target for public page requests that still arrive on
 * the legacy `lankapost.vercel.app` host so Google consolidates all rankings onto one domain.
 * Returns `null` when no custom domain is configured or for non-page/local requests.
 */
export function resolveLegacyHostRedirect(input: {
    host: string | null | undefined;
    canonicalOrigin: string;
    pathname: string;
    search: string;
    method: string;
}): string | null {
    if (input.method !== "GET" && input.method !== "HEAD") return null;
    const rawHost = (input.host ?? "").trim().toLowerCase().split(":")[0];
    if (!rawHost) return null;

    let defaultHost: string;
    let canonicalUrl: URL;
    try {
        defaultHost = new URL(DEFAULT_SITE_URL).hostname.toLowerCase();
        canonicalUrl = new URL(input.canonicalOrigin);
    } catch {
        return null;
    }

    const targetHost = canonicalUrl.hostname.toLowerCase();
    // Only redirect the legacy vercel.app host once a real custom domain is configured
    if (rawHost !== defaultHost) return null;
    if (targetHost === defaultHost || targetHost === "localhost" || targetHost === "127.0.0.1") {
        return null;
    }

    const origin = canonicalUrl.origin.replace(/\/+$/, "");
    const path = input.pathname.startsWith("/") ? input.pathname : `/${input.pathname}`;
    return `${origin}${path}${input.search || ""}`;
}
