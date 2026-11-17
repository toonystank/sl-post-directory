export type SupportedLocale = "en" | "si" | "ta";

export interface ServiceTagline {
    /** Localized full service name */
    name: string;
    /** Localized short service name for cards and badges */
    shortName: string;
    /** Short 2-word badge label shown in the selected card header bar */
    shortTag: string;
    /** Concise 1-line plain-language hint shown on every service card */
    cardHint: string;
    /** Clear explanation shown in the top receipt banner */
    bannerSummary: string;
}

const SERVICE_TAGLINES_EN: Record<string, ServiceTagline> = {
    // International Air Mail
    air_letter: {
        name: "Air Mail Letter",
        shortName: "Air Letter",
        shortTag: "Airmail Letter",
        cardHint: "Standard airmail letter",
        bannerSummary: "Standard international airmail for letters & documents · up to 2 kg",
    },
    air_printed: {
        name: "Printed Matter / Open Packet",
        shortName: "Printed Matter",
        shortTag: "Printed Matter",
        cardHint: "Books & brochures",
        bannerSummary: "Economy airmail for books, magazines & printed papers · up to 2 kg",
    },
    u_packet: {
        name: "U-Packet (Tracked Small Packet)",
        shortName: "U-Packet",
        shortTag: "Tracked Packet",
        cardHint: "Tracked small packet",
        bannerSummary: "UPU tracked e-commerce small packet for lightweight goods · up to 2 kg",
    },
    tds: {
        name: "TDS (Tracked Delivery Service)",
        shortName: "TDS Tracked",
        shortTag: "Priority Tracked",
        cardHint: "Priority tracked delivery",
        bannerSummary: "Tracked Delivery Service (TDS) — priority tracked packet · up to 2 kg",
    },
    air_parcel: {
        name: "Air Mail Parcel",
        shortName: "Air Parcel",
        shortTag: "Air Parcel",
        cardHint: "Standard air parcel",
        bannerSummary: "Standard international air parcel for boxes & goods · up to 20–30 kg",
    },
    ems: {
        name: "EMS Express (Expedited Mail)",
        shortName: "EMS Express",
        shortTag: "Express Courier",
        cardHint: "Express priority courier",
        bannerSummary: "Express priority courier with full tracking · fastest delivery up to 30 kg",
    },

    // International Sea Mail
    sea_letter: {
        name: "Sea Mail Letter",
        shortName: "Sea Letter",
        shortTag: "Surface Letter",
        cardHint: "Economy sea letter",
        bannerSummary: "Economy maritime surface mail for letters & documents · up to 2 kg",
    },
    sea_printed: {
        name: "Sea Printed Matter / Small Packet",
        shortName: "Sea Printed",
        shortTag: "Surface Printed",
        cardHint: "Books & papers by sea",
        bannerSummary: "Economy maritime surface mail for books & brochures · up to 2 kg",
    },
    sea_parcel: {
        name: "Sea Mail Parcel",
        shortName: "Sea Parcel",
        shortTag: "Surface Parcel",
        cardHint: "Economy sea parcel",
        bannerSummary: "Economy maritime container parcel for heavy packages · up to 20–30 kg",
    },

    // Domestic / Local Services
    letter: {
        name: "Ordinary / Business Letter",
        shortName: "Letter",
        shortTag: "Inland Letter",
        cardHint: "Standard local letter",
        bannerSummary: "Ordinary or business inland letter across Sri Lanka · up to 2 kg",
    },
    open_article: {
        name: "Open Article / Printed Matter",
        shortName: "Open Article",
        shortTag: "Open Packet",
        cardHint: "Printed papers & packets",
        bannerSummary: "Unsealed packets, invitations & printed matter · up to 2 kg",
    },
    parcel: {
        name: "Ordinary Parcel",
        shortName: "Parcel",
        shortTag: "Inland Parcel",
        cardHint: "Standard local parcel",
        bannerSummary: "Standard domestic post office parcel across Sri Lanka · up to 20 kg",
    },
    courier: {
        name: "SLP Courier (formerly Speed Post)",
        shortName: "SLP Courier",
        shortTag: "Express Courier",
        cardHint: "Tracked domestic courier",
        bannerSummary: "SLP Courier (formerly Speed Post) — tracked express inland delivery · up to 40 kg",
    },
    speed_post: {
        name: "SLP Courier (formerly Speed Post)",
        shortName: "SLP Courier",
        shortTag: "Express Courier",
        cardHint: "Tracked domestic courier",
        bannerSummary: "SLP Courier (formerly Speed Post) — tracked express inland delivery · up to 40 kg",
    },
    state: {
        name: "On State Service (Official)",
        shortName: "State Service",
        shortTag: "Official Mail",
        cardHint: "Government official mail",
        bannerSummary: "On State Service — official government mail (includes registration) · up to 5 kg",
    },
    newspaper: {
        name: "Registered Newspapers / Periodicals",
        shortName: "Newspaper",
        shortTag: "Periodical",
        cardHint: "Registered newspapers",
        bannerSummary: "Registered newspapers and periodicals tariff · up to 1 kg",
    },
    postcard: {
        name: "Postcard (Flat Rate)",
        shortName: "Postcard",
        shortTag: "Flat Rate",
        cardHint: "Standard inland postcard",
        bannerSummary: "Single flat-rate domestic postcard anywhere in Sri Lanka",
    },

    // COD Mode
    cod: {
        name: "Cash on Delivery (COD)",
        shortName: "SLP Courier COD",
        shortTag: "Cash on Delivery",
        cardHint: "Courier + Money Order",
        bannerSummary: "SLP Courier delivery + PMT Money Order collection from recipient (max Rs. 100,000)",
    },
};

const SERVICE_TAGLINES_SI: Record<string, ServiceTagline> = {
    // International Air Mail
    air_letter: {
        name: "ගුවන් තැපැල් ලිපි (Air Letter)",
        shortName: "ගුවන් ලිපි",
        shortTag: "ගුවන් ලිපි",
        cardHint: "සාමාන්‍ය ගුවන් තැපැල් ලිපි",
        bannerSummary: "ලිපි සහ ලේඛන සඳහා ජාත්‍යන්තර ගුවන් තැපෑල · කි.ග්‍රෑ. 2 දක්වා",
    },
    air_printed: {
        name: "මුද්‍රිත ද්‍රව්‍ය / විවෘත පැකට්",
        shortName: "මුද්‍රිත ද්‍රව්‍ය",
        shortTag: "මුද්‍රිත ද්‍රව්‍ය",
        cardHint: "පොත් සහ අත්පත්‍රිකා",
        bannerSummary: "පොත්, සඟරා සහ මුද්‍රිත පත්‍රිකා සඳහා සහන ගුවන් තැපෑල · කි.ග්‍රෑ. 2 දක්වා",
    },
    u_packet: {
        name: "U-Packet (ලුහුබැඳිය හැකි කුඩා පැකට්)",
        shortName: "U-Packet",
        shortTag: "ලුහුබැඳි පැකට්",
        cardHint: "ලුහුබැඳිය හැකි කුඩා පැකට්",
        bannerSummary: "සැහැල්ලු භාණ්ඩ සඳහා UPU ලුහුබැඳීම සහිත කුඩා පැකට් · කි.ග්‍රෑ. 2 දක්වා",
    },
    tds: {
        name: "TDS (ලුහුබැඳි බෙදාහැරීමේ සේවාව)",
        shortName: "TDS Tracked",
        shortTag: "ප්‍රමුඛතා ලුහුබැඳි",
        cardHint: "ප්‍රමුඛතා ලුහුබැඳි සේවාව",
        bannerSummary: "TDS — ප්‍රමුඛතා ලුහුබැඳීම සහිත විදේශ පැකට් සේවාව · කි.ග්‍රෑ. 2 දක්වා",
    },
    air_parcel: {
        name: "ගුවන් තැපැල් පාර්සල් (Air Parcel)",
        shortName: "ගුවන් පාර්සල්",
        shortTag: "ගුවන් පාර්සල්",
        cardHint: "සාමාන්‍ය ගුවන් පාර්සල්",
        bannerSummary: "භාණ්ඩ සහ පෙට්ටි සඳහා ජාත්‍යන්තර ගුවන් පාර්සල් · කි.ග්‍රෑ. 20–30 දක්වා",
    },
    ems: {
        name: "ජාත්‍යන්තර EMS (අධිවේගී තැපැල්)",
        shortName: "EMS Express",
        shortTag: "අධිවේගී කුරියර්",
        cardHint: "වේගවත් ප්‍රමුඛතා කුරියර්",
        bannerSummary: "පූර්ණ ලුහුබැඳීම සහිත වේගවත්ම ජාත්‍යන්තර කුරියර් සේවාව · කි.ග්‍රෑ. 30 දක්වා",
    },

    // International Sea Mail
    sea_letter: {
        name: "මුහුදු තැපැල් ලිපි (Sea Letter)",
        shortName: "මුහුදු ලිපි",
        shortTag: "මුහුදු ලිපි",
        cardHint: "සහන මිල මුහුදු ලිපි",
        bannerSummary: "ලිපි සහ ලේඛන සඳහා සහන මිල මුහුදු තැපෑල · කි.ග්‍රෑ. 2 දක්වා",
    },
    sea_printed: {
        name: "මුහුදු මුද්‍රිත ද්‍රව්‍ය / කුඩා පැකට්",
        shortName: "මුහුදු මුද්‍රිත",
        shortTag: "මුහුදු මුද්‍රිත",
        cardHint: "මුහුදු මගින් පොත් සහ පත්‍රිකා",
        bannerSummary: "පොත් සහ මුද්‍රිත ද්‍රව්‍ය සඳහා මුහුදු තැපෑල · කි.ග්‍රෑ. 2 දක්වා",
    },
    sea_parcel: {
        name: "මුහුදු තැපැල් පාර්සල් (Sea Parcel)",
        shortName: "මුහුදු පාර්සල්",
        shortTag: "මුහුදු පාර්සල්",
        cardHint: "සහන මිල මුහුදු පාර්සල්",
        bannerSummary: "බර පාර්සල් සඳහා සහන මිල මුහුදු පාර්සල් සේවාව · කි.ග්‍රෑ. 20–30 දක්වා",
    },

    // Domestic / Local Services
    letter: {
        name: "සාමාන්‍ය / ව්‍යාපාරික ලිපි",
        shortName: "ලිපි",
        shortTag: "දේශීය ලිපි",
        cardHint: "සාමාන්‍ය දේශීය ලිපි",
        bannerSummary: "ශ්‍රී ලංකාව තුළ සාමාන්‍ය හෝ ව්‍යාපාරික ලිපි · කි.ග්‍රෑ. 2 දක්වා",
    },
    open_article: {
        name: "විවෘත භාණ්ඩ / මුද්‍රිත ද්‍රව්‍ය",
        shortName: "විවෘත පැකට්",
        shortTag: "විවෘත පැකට්",
        cardHint: "මුද්‍රිත පත්‍රිකා සහ පැකට්",
        bannerSummary: "මුද්‍රා නොතැබූ පැකට්, ආරාධනා පත් සහ මුද්‍රිත ද්‍රව්‍ය · කි.ග්‍රෑ. 2 දක්වා",
    },
    parcel: {
        name: "සාමාන්‍ය පාර්සල්",
        shortName: "පාර්සල්",
        shortTag: "දේශීය පාර්සල්",
        cardHint: "සාමාන්‍ය දේශීය පාර්සල්",
        bannerSummary: "ශ්‍රී ලංකාව තුළ සාමාන්‍ය තැපැල් පාර්සල් · කි.ග්‍රෑ. 20 දක්වා",
    },
    courier: {
        name: "SLP Courier (පෙර Speed Post)",
        shortName: "SLP Courier",
        shortTag: "අධිවේගී කුරියර්",
        cardHint: "ලුහුබැඳි දේශීය කුරියර්",
        bannerSummary: "SLP Courier (Speed Post) — ලුහුබැඳිය හැකි වේගවත් දේශීය කුරියර් · කි.ග්‍රෑ. 40 දක්වා",
    },
    speed_post: {
        name: "SLP Courier (පෙර Speed Post)",
        shortName: "SLP Courier",
        shortTag: "අධිවේගී කුරියර්",
        cardHint: "ලුහුබැඳි දේශීය කුරියර්",
        bannerSummary: "SLP Courier (Speed Post) — ලුහුබැඳිය හැකි වේගවත් දේශීය කුරියර් · කි.ග්‍රෑ. 40 දක්වා",
    },
    state: {
        name: "රාජ්‍ය සේවය පිණිසයි (නිල තැපැල්)",
        shortName: "රාජ්‍ය සේවා",
        shortTag: "නිල තැපැල්",
        cardHint: "රජයේ නිල තැපැල්",
        bannerSummary: "රාජ්‍ය සේවය පිණිසයි — නිල රජයේ තැපැල් (ලියාපදිංචි කිරීම සහිතයි) · කි.ග්‍රෑ. 5 දක්වා",
    },
    newspaper: {
        name: "ලියාපදිංචි පුවත්පත් / වාර ප්‍රකාශන",
        shortName: "පුවත්පත්",
        shortTag: "වාර ප්‍රකාශන",
        cardHint: "ලියාපදිංචි පුවත්පත්",
        bannerSummary: "ලියාපදිංචි පුවත්පත් සහ සඟරා ගාස්තු · කි.ග්‍රෑ. 1 දක්වා",
    },
    postcard: {
        name: "තැපැල් පත (ස්ථාවර ගාස්තු)",
        shortName: "තැපැල් පත",
        shortTag: "ස්ථාවර ගාස්තු",
        cardHint: "සාමාන්‍ය දේශීය තැපැල් පත",
        bannerSummary: "ශ්‍රී ලංකාව තුළ ඕනෑම තැනකට ස්ථාවර ගාස්තු තැපැල් පත",
    },

    // COD Mode
    cod: {
        name: "භාණ්ඩ ලැබීමේදී මුදල් ගෙවීම (COD)",
        shortName: "SLP Courier COD",
        shortTag: "භාණ්ඩ ලැබීමේදී ගෙවීම",
        cardHint: "කුරියර් + මුදල් ඇණවුම",
        bannerSummary: "SLP Courier බෙදාහැරීම + PMT මුදල් ඇණවුම් මගින් මුදල් අයකිරීම (උපරිම රු. 100,000)",
    },
};

const SERVICE_TAGLINES_TA: Record<string, ServiceTagline> = {
    // International Air Mail
    air_letter: {
        name: "வான் அஞ்சல் கடிதம் (Air Letter)",
        shortName: "வான் கடிதம்",
        shortTag: "வான் கடிதம்",
        cardHint: "சாதாரண வான் கடிதம்",
        bannerSummary: "கடிதங்கள் மற்றும் ஆவணங்களுக்கான சர்வதேச வான் அஞ்சல் · 2 கி.கி வரை",
    },
    air_printed: {
        name: "அச்சிடப்பட்டவை / திறந்த பொதி",
        shortName: "அச்சிடப்பட்டவை",
        shortTag: "அச்சிடப்பட்டவை",
        cardHint: "புத்தகங்கள் & பிரசுரங்கள்",
        bannerSummary: "புத்தகங்கள், இதழ்கள் மற்றும் அச்சிடப்பட்ட தாள்களுக்கான வான் அஞ்சல் · 2 கி.கி வரை",
    },
    u_packet: {
        name: "U-Packet (கண்காணிக்கப்படும் சிறு பொதி)",
        shortName: "U-Packet",
        shortTag: "கண்காணிப்பு பொதி",
        cardHint: "கண்காணிப்பு சிறு பொதி",
        bannerSummary: "இலகுவான பொருட்களுக்கான UPU கண்காணிப்பு சிறு பொதி · 2 கி.கி வரை",
    },
    tds: {
        name: "TDS (கண்காணிப்பு விநியோக சேவை)",
        shortName: "TDS Tracked",
        shortTag: "முன்னுரிமை கண்காணிப்பு",
        cardHint: "முன்னுரிமை கண்காணிப்பு",
        bannerSummary: "TDS — முன்னுரிமை கண்காணிப்பு வெளிநாட்டு பொதி சேவை · 2 கி.கி வரை",
    },
    air_parcel: {
        name: "வான் அஞ்சல் பார்சல் (Air Parcel)",
        shortName: "வான் பார்சல்",
        shortTag: "வான் பார்சல்",
        cardHint: "சாதாரண வான் பார்சல்",
        bannerSummary: "பொருட்கள் மற்றும் பெட்டிகளுக்கான சர்வதேச வான் பார்சல் · 20–30 கி.கி வரை",
    },
    ems: {
        name: "சர்வதேச EMS (விரைவு அஞ்சல்)",
        shortName: "EMS Express",
        shortTag: "விரைவு கூரியர்",
        cardHint: "விரைவு முன்னுரிமை கூரியர்",
        bannerSummary: "முழு கண்காணிப்புடன் கூடிய அதிவேக சர்வதேச கூரியர் சேவை · 30 கி.கி வரை",
    },

    // International Sea Mail
    sea_letter: {
        name: "கடல் அஞ்சல் கடிதம் (Sea Letter)",
        shortName: "கடல் கடிதம்",
        shortTag: "கடல் கடிதம்",
        cardHint: "சிக்கன கடல் கடிதம்",
        bannerSummary: "கடிதங்கள் மற்றும் ஆவணங்களுக்கான சிக்கன கடல் அஞ்சல் · 2 கி.கி வரை",
    },
    sea_printed: {
        name: "கடல் அச்சிடப்பட்டவை / சிறு பொதி",
        shortName: "கடல் அச்சு",
        shortTag: "கடல் அச்சு",
        cardHint: "கடல் வழியாக புத்தகங்கள்",
        bannerSummary: "புத்தகங்கள் மற்றும் பிரசுரங்களுக்கான சிக்கன கடல் அஞ்சல் · 2 கி.கி வரை",
    },
    sea_parcel: {
        name: "கடல் அஞ்சல் பார்சல் (Sea Parcel)",
        shortName: "கடல் பார்சல்",
        shortTag: "கடல் பார்சல்",
        cardHint: "சிக்கன கடல் பார்சல்",
        bannerSummary: "கனமான பொதிகளுக்கான சிக்கன கடல் பார்சல் சேவை · 20–30 கி.கி வரை",
    },

    // Domestic / Local Services
    letter: {
        name: "சாதாரண / வணிகக் கடிதம்",
        shortName: "கடிதம்",
        shortTag: "உள்நாட்டுக் கடிதம்",
        cardHint: "சாதாரண உள்நாட்டுக் கடிதம்",
        bannerSummary: "இலங்கை முழுவதும் சாதாரண அல்லது வணிக உள்நாட்டுக் கடிதம் · 2 கி.கி வரை",
    },
    open_article: {
        name: "திறந்த பொருள் / அச்சிடப்பட்டவை",
        shortName: "திறந்த பொதி",
        shortTag: "திறந்த பொதி",
        cardHint: "அச்சிடப்பட்ட தாள்கள் & பொதிகள்",
        bannerSummary: "சீல் செய்யப்படாத பொதிகள், அழைப்பிதழ்கள் மற்றும் அச்சிடப்பட்டவை · 2 கி.கி வரை",
    },
    parcel: {
        name: "சாதாரண பார்சல்",
        shortName: "பார்சல்",
        shortTag: "உள்நாட்டு பார்சல்",
        cardHint: "சாதாரண உள்நாட்டு பார்சல்",
        bannerSummary: "இலங்கை முழுவதும் சாதாரண தபால் நிலைய பார்சல் · 20 கி.கி வரை",
    },
    courier: {
        name: "SLP Courier (முன்னர் Speed Post)",
        shortName: "SLP Courier",
        shortTag: "விரைவு கூரியர்",
        cardHint: "கண்காணிப்பு உள்நாட்டு கூரியர்",
        bannerSummary: "SLP Courier (Speed Post) — கண்காணிப்புடன் கூடிய விரைவு உள்நாட்டு கூரியர் · 40 கி.கி வரை",
    },
    speed_post: {
        name: "SLP Courier (முன்னர் Speed Post)",
        shortName: "SLP Courier",
        shortTag: "விரைவு கூரியர்",
        cardHint: "கண்காணிப்பு உள்நாட்டு கூரியர்",
        bannerSummary: "SLP Courier (Speed Post) — கண்காணிப்புடன் கூடிய விரைவு உள்நாட்டு கூரியர் · 40 கி.கி வரை",
    },
    state: {
        name: "அரச சேவைக்காக (உத்தியோகபூர்வ)",
        shortName: "அரச சேவை",
        shortTag: "அரச அஞ்சல்",
        cardHint: "அரசாங்க உத்தியோகபூர்வ அஞ்சல்",
        bannerSummary: "அரச சேவைக்காக — உத்தியோகபூர்வ அரசாங்க அஞ்சல் (பதிவு உட்பட) · 5 கி.கி வரை",
    },
    newspaper: {
        name: "பதிவுசெய்யப்பட்ட பத்திரிகைகள்",
        shortName: "பத்திரிகை",
        shortTag: "பருவ இதழ்",
        cardHint: "பதிவுசெய்யப்பட்ட பத்திரிகைகள்",
        bannerSummary: "பதிவுசெய்யப்பட்ட செய்தித்தாள்கள் மற்றும் பருவ இதழ்கள் கட்டணம் · 1 கி.கி வரை",
    },
    postcard: {
        name: "தபால் அட்டை (நிலையான கட்டணம்)",
        shortName: "தபால் அட்டை",
        shortTag: "நிலையான கட்டணம்",
        cardHint: "சாதாரண உள்நாட்டு தபால் அட்டை",
        bannerSummary: "இலங்கை முழுவதும் எங்கும் நிலையான கட்டண தபால் அட்டை",
    },

    // COD Mode
    cod: {
        name: "பொருள் பெறும்போது பணம் (COD)",
        shortName: "SLP Courier COD",
        shortTag: "பெறும்போது பணம்",
        cardHint: "கூரியர் + பணக் கட்டளை",
        bannerSummary: "SLP Courier விநியோகம் + PMT பணக் கட்டளை மூலம் பணம் வசூலிப்பு (அதிகபட்சம் ரூ. 100,000)",
    },
};

const DEFAULT_TAGLINES: Record<SupportedLocale, ServiceTagline> = {
    en: {
        name: "Postal Service",
        shortName: "Service",
        shortTag: "Postal Service",
        cardHint: "Official tariff rate",
        bannerSummary: "Official Sri Lanka Post tariff schedule",
    },
    si: {
        name: "තැපැල් සේවාව",
        shortName: "සේවාව",
        shortTag: "තැපැල් සේවාව",
        cardHint: "නිල තැපැල් ගාස්තුව",
        bannerSummary: "ශ්‍රී ලංකා තැපැල් නිල ගාස්තු ලේඛනය",
    },
    ta: {
        name: "தபால் சேவை",
        shortName: "சேவை",
        shortTag: "தபால் சேவை",
        cardHint: "உத்தியோகபூர்வ கட்டணம்",
        bannerSummary: "இலங்கை தபால் உத்தியோகபூர்வ கட்டண அட்டவணை",
    },
};

const COUNTRY_NAMES_SI: Record<string, string> = {
    LK: "ශ්‍රී ලංකාව",
    AU: "ඕස්ට්‍රේලියාව",
    AT: "ඔස්ට්‍රියාව",
    BH: "බහරේනය",
    BD: "බංග්ලාදේශය",
    BE: "බෙල්ජියම",
    BR: "බ්‍රසීලය",
    CA: "කැනඩාව",
    CN: "චීනය",
    CY: "සයිප්‍රසය",
    DK: "ඩෙන්මාර්කය",
    EG: "ඊජිප්තුව",
    FI: "ෆින්ලන්තය",
    FR: "ප්‍රංශය",
    DE: "ජර්මනිය",
    GR: "ග්‍රීසිය",
    HK: "හොංකොං",
    IN: "ඉන්දියාව",
    ID: "ඉන්දුනීසියාව",
    IE: "අයර්ලන්තය",
    IL: "ඊශ්‍රායලය",
    IT: "ඉතාලිය",
    JP: "ජපානය",
    JO: "ජෝර්දානය",
    KE: "කෙන්යාව",
    KW: "කුවේටය",
    LB: "ලෙබනනය",
    MY: "මැලේසියාව",
    MV: "මාලදිවයින",
    NP: "නේපාලය",
    NL: "නෙදර්ලන්තය",
    NZ: "නවසීලන්තය",
    NO: "නෝර්වේ",
    OM: "ඕමානය",
    PK: "පාකිස්තානය",
    PH: "පිලිපීනය",
    PL: "පෝලන්තය",
    PT: "පෘතුගාලය",
    QA: "කටාර්",
    RU: "රුසියාව",
    SA: "සෞදි අරාබිය",
    SG: "සිංගප්පූරුව",
    ZA: "දකුණු අප්‍රිකාව",
    KR: "දකුණු කොරියාව",
    ES: "ස්පාඤ්ඤය",
    SE: "ස්වීඩනය",
    CH: "ස්විට්සර්ලන්තය",
    TW: "තායිවානය",
    TH: "තායිලන්තය",
    TR: "තුර්කිය",
    UA: "යුක්රේනය",
    AE: "එක්සත් අරාබි එමීර් රාජ්‍යය",
    GB: "එක්සත් රාජධානිය",
    US: "ඇමරිකා එක්සත් ජනපදය",
    VN: "වියට්නාමය",
};

const COUNTRY_NAMES_TA: Record<string, string> = {
    LK: "இலங்கை",
    AU: "ஆஸ்திரேலியா",
    AT: "ஆஸ்திரியா",
    BH: "பஹ்ரைன்",
    BD: "பங்களாதேஷ்",
    BE: "பெல்ஜியம்",
    BR: "பிரேசில்",
    CA: "கனடா",
    CN: "சீனா",
    CY: "சைப்ரஸ்",
    DK: "டென்மார்க்",
    EG: "எகிப்து",
    FI: "பின்லாந்து",
    FR: "பிரான்ஸ்",
    DE: "ஜெர்மனி",
    GR: "கிரீஸ்",
    HK: "ஹாங்காங்",
    IN: "இந்தியா",
    ID: "இந்தோனேசியா",
    IE: "அயர்லாந்து",
    IL: "இஸ்ரேல்",
    IT: "இத்தாலி",
    JP: "ஜப்பான்",
    JO: "ஜோர்டான்",
    KE: "கென்யா",
    KW: "குவைத்",
    LB: "லெபனான்",
    MY: "மலேசியா",
    MV: "மாலைதீவு",
    NP: "நேபாளம்",
    NL: "நெதர்லாந்து",
    NZ: "நியூசிலாந்து",
    NO: "நோர்வே",
    OM: "ஓமான்",
    PK: "பாகிஸ்தான்",
    PH: "பிலிப்பைன்ஸ்",
    PL: "போலந்து",
    PT: "போர்த்துக்கல்",
    QA: "கத்தார்",
    RU: "ரஷ்யா",
    SA: "சவூதி அரேபியா",
    SG: "சிங்கப்பூர்",
    ZA: "தென்னாப்பிரிக்கா",
    KR: "தென் கொரியா",
    ES: "ஸ்பெயின்",
    SE: "ஸ்வீடன்",
    CH: "சுவிட்சர்லாந்து",
    TW: "தைவான்",
    TH: "தாய்லாந்து",
    TR: "துருக்கி",
    UA: "உக்ரைன்",
    AE: "ஐக்கிய அரபு அமீரகம்",
    GB: "ஐக்கிய இராச்சியம்",
    US: "அமெரிக்கா",
    VN: "வியட்நாம்",
};

const ZONE_NAMES_SI: Record<string, { full: string; short: string }> = {
    zone_a: { full: "කලාපය A - දකුණු ආසියාව", short: "කලාපය A" },
    zone_b: { full: "කලාපය B - මැදපෙරදිග සහ අග්නිදිග ආසියාව", short: "කලාපය B" },
    zone_c: { full: "කලාපය C - යුරෝපය සහ එක්සත් රාජධානිය", short: "කලාපය C" },
    zone_d: { full: "කලාපය D - ඇමරිකාව, නැගෙනහිර ආසියාව සහ ඕෂනියාව", short: "කලාපය D" },
};

const ZONE_NAMES_TA: Record<string, { full: string; short: string }> = {
    zone_a: { full: "வலயம் A - தெற்காசியா", short: "வலயம் A" },
    zone_b: { full: "வலயம் B - மத்திய கிழக்கு & தென்கிழக்காசியா", short: "வலயம் B" },
    zone_c: { full: "வலயம் C - ஐரோப்பா & ஐக்கிய இராச்சியம்", short: "வலயம் C" },
    zone_d: { full: "வலயம் D - அமெரிக்கா, கிழக்காசியா & ஓசியானியா", short: "வலயம் D" },
};

function normalizeLocale(locale?: string): SupportedLocale {
    if (locale === "si" || locale === "ta") return locale;
    return "en";
}

/**
 * Returns localized plain-language descriptions and names for a given service ID
 * in English ("en"), Sinhala ("si"), or Tamil ("ta").
 */
export function getServiceTagline(
    serviceId: string | undefined,
    locale: string = "en"
): ServiceTagline {
    const lang = normalizeLocale(locale);
    if (!serviceId) return DEFAULT_TAGLINES[lang];
    const table =
        lang === "si"
            ? SERVICE_TAGLINES_SI
            : lang === "ta"
                ? SERVICE_TAGLINES_TA
                : SERVICE_TAGLINES_EN;
    return table[serviceId] ?? SERVICE_TAGLINES_EN[serviceId] ?? DEFAULT_TAGLINES[lang];
}

/**
 * Returns the localized country name for a 2-letter ISO code in Sinhala or Tamil,
 * falling back to the English name.
 */
export function getLocalizedCountryName(
    code: string | undefined,
    fallbackName: string,
    locale: string = "en"
): string {
    if (!code) return fallbackName;
    const upper = code.toUpperCase();
    const lang = normalizeLocale(locale);
    if (lang === "si") return COUNTRY_NAMES_SI[upper] ?? fallbackName;
    if (lang === "ta") return COUNTRY_NAMES_TA[upper] ?? fallbackName;
    return fallbackName;
}

/**
 * Returns the localized EMS zone name (both full and short form).
 */
export function getLocalizedZoneName(
    zoneId: string | undefined,
    fallbackName: string,
    locale: string = "en"
): { full: string; short: string } {
    const defaultShort = fallbackName.split(" - ")[0] || "EMS Zone";
    if (!zoneId) return { full: fallbackName, short: defaultShort };
    const lang = normalizeLocale(locale);
    if (lang === "si" && ZONE_NAMES_SI[zoneId]) return ZONE_NAMES_SI[zoneId];
    if (lang === "ta" && ZONE_NAMES_TA[zoneId]) return ZONE_NAMES_TA[zoneId];
    return { full: fallbackName, short: defaultShort };
}

/**
 * Converts a 2-letter ISO 3166-1 alpha-2 country code (e.g. "GB", "LK", "JP")
 * into its Unicode regional indicator flag emoji.
 */
export function getCountryFlagEmoji(code: string | undefined): string {
    if (!code || typeof code !== "string") return "🌐";
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(normalized)) return "🌐";
    const first = 0x1f1e6 + (normalized.charCodeAt(0) - 65);
    const second = 0x1f1e6 + (normalized.charCodeAt(1) - 65);
    return String.fromCodePoint(first, second);
}

/**
 * Steps weight in grams up or down using ergonomic postal increments:
 * - Below 100g: 10g steps
 * - 100g to 499g: 50g steps
 * - 500g to 1999g: 250g steps
 * - 2000g and above: 500g steps
 */
export function stepWeight(
    currentGrams: number,
    direction: "up" | "down",
    minGrams = 10,
    maxGrams = 40000
): number {
    const safeCurrent = Number.isFinite(currentGrams) && currentGrams > 0 ? Math.round(currentGrams) : 0;

    if (direction === "up") {
        if (safeCurrent <= 0) return minGrams;
        const step =
            safeCurrent < 100
                ? 10
                : safeCurrent < 500
                    ? 50
                    : safeCurrent < 2000
                        ? 250
                        : 500;
        const remainder = safeCurrent % step;
        const next = remainder === 0 ? safeCurrent + step : safeCurrent + (step - remainder);
        return Math.min(maxGrams, Math.max(minGrams, next));
    }

    if (safeCurrent <= minGrams) return minGrams;
    const step =
        safeCurrent <= 100
            ? 10
            : safeCurrent <= 500
                ? 50
                : safeCurrent <= 2000
                    ? 250
                    : 500;
    const remainder = safeCurrent % step;
    const prev = remainder === 0 ? safeCurrent - step : safeCurrent - remainder;
    return Math.min(maxGrams, Math.max(minGrams, prev));
}

/**
 * Steps COD collection amount in LKR up or down in Rs. 500 / Rs. 1,000 / Rs. 5,000 increments.
 */
export function stepCodAmount(
    currentAmount: number,
    direction: "up" | "down",
    minAmount = 500,
    maxAmount = 100000
): number {
    const safeCurrent = Number.isFinite(currentAmount) && currentAmount > 0 ? Math.round(currentAmount) : 0;

    if (direction === "up") {
        if (safeCurrent <= 0) return minAmount;
        const step = safeCurrent < 5000 ? 500 : safeCurrent < 25000 ? 1000 : 5000;
        const remainder = safeCurrent % step;
        const next = remainder === 0 ? safeCurrent + step : safeCurrent + (step - remainder);
        return Math.min(maxAmount, Math.max(minAmount, next));
    }

    if (safeCurrent <= minAmount) return minAmount;
    const step = safeCurrent <= 5000 ? 500 : safeCurrent <= 25000 ? 1000 : 5000;
    const remainder = safeCurrent % step;
    const prev = remainder === 0 ? safeCurrent - step : safeCurrent - remainder;
    return Math.min(maxAmount, Math.max(minAmount, prev));
}
