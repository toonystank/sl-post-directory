/**
 * Multi-source Sri Lanka Post data harvester (resumable, cached in scripts/cache/).
 * Sources:
 *   1. Official Department of Posts (slpost.gov.lk): Main Offices, Sub Post Part 01/02, HQ Directorate
 *   2. Postage.lk full directory (sitemap.xml -> /location/* pages)
 *   3. OpenStreetMap Overpass API (amenity=post_office in Sri Lanka)
 *
 * Run with: npx tsx scripts/harvest-postal-data.ts
 */
import * as fs from "fs";
import * as path from "path";
import * as cheerio from "cheerio";

const CACHE_DIR = path.join(process.cwd(), "scripts", "cache");

export interface SlpostOfficeContact {
    name: string;
    phones: string[];
    faxes: string[];
    source: "main" | "sub-01" | "sub-02" | "hq";
}

export interface PostageLkLocation {
    url: string;
    slugId: string;
    name: string;
    type: string;
    postalCode: string;
    shortCode: string;
    grade: string;
    delivery: string;
    dsDivision: string;
    dpmgDivision: string;
    controllingOffice: string;
    controllingUrl: string;
    subPostOffices: string[];
}

export interface OsmPostOffice {
    osmType: string;
    osmId: number;
    name: string;
    nameEn: string;
    postcode: string;
    phone: string;
    openingHours: string;
    operator: string;
    lat: number;
    lon: number;
}

function ensureCacheDir() {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
}

async function fetchWithRetry(url: string, init?: RequestInit, retries = 3): Promise<string> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const res = await fetch(url, {
                ...init,
                headers: {
                    "User-Agent": "LankaPostDirectory/1.0 (+https://github.com/toonystank/sl-post-directory)",
                    ...(init?.headers || {}),
                },
                signal: AbortSignal.timeout(20000),
            });
            if (res.status === 429 || res.status >= 500) {
                throw new Error(`HTTP ${res.status} for ${url}`);
            }
            if (!res.ok) {
                throw new Error(`HTTP ${res.status} for ${url}`);
            }
            return await res.text();
        } catch (err) {
            lastError = err;
            if (attempt < retries) {
                await new Promise((r) => setTimeout(r, 400 * attempt));
            }
        }
    }
    throw lastError;
}

function cleanPhoneRaw(raw: string): string {
    return raw.replace(/\s+/g, " ").trim();
}

const SUB_ROW_LABELS = new Set([
    "post office",
    "counter",
    "fax",
    "telegrams",
    "telegram",
    "telegraphs",
    "telegraph",
    "public booth",
    "sorting",
    "delivery",
    "ems",
    "customs",
    "parcels",
    "parcel",
    "enquiries",
    "inquiry",
    "inquiries",
    "general",
    "night mail",
    "post master",
    "postmaster",
    "sub post office",
    "registrar",
    "telephone",
]);

function isGenericSubRow(label: string): boolean {
    const low = label.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
    if (SUB_ROW_LABELS.has(low)) return true;
    if (/^(fax|counter|telegram|post office|telephone|ext|booth)/i.test(low)) return true;
    return false;
}

async function harvestSlpostGovLk(): Promise<SlpostOfficeContact[]> {
    const cacheFile = path.join(CACHE_DIR, "slpost-gov-lk.json");
    if (fs.existsSync(cacheFile)) {
        const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8")) as SlpostOfficeContact[];
        if (Array.isArray(cached) && cached.length > 1000) {
            console.log(`[slpost.gov.lk] Loaded ${cached.length} cached entries`);
            return cached;
        }
    }

    const results: SlpostOfficeContact[] = [];

    // 1. Main Offices Directorate
    console.log("[slpost.gov.lk] Fetching main-offices...");
    const mainHtml = await fetchWithRetry("https://slpost.gov.lk/main-offices/");
    const $main = cheerio.load(mainHtml);
    const mainByName = new Map<string, SlpostOfficeContact>();
    let currentOffice = "";

    $main("table tr").each((_, tr) => {
        const cells = $main(tr)
            .find("th, td")
            .map((__, td) => $main(td).text().replace(/\s+/g, " ").trim())
            .get()
            .filter(Boolean);
        if (cells.length === 0) return;

        // Handle 1-cell phone continuation row
        if (cells.length === 1) {
            const val = cells[0];
            if (currentOffice && /\d{3}/.test(val)) {
                const rec = mainByName.get(currentOffice);
                if (rec) rec.phones.push(cleanPhoneRaw(val));
            }
            return;
        }

        const label = cells[0];
        const number = cells.slice(1).join(" / ");
        const isFaxRow = /\bfax\b/i.test(label);

        let officeName = currentOffice;
        if (/^post\s*master\b/i.test(label)) {
            officeName = label
                .replace(/^post\s*master\s*/i, "")
                .replace(/\(\s*fax\s*\)/gi, "")
                .replace(/\s+/g, " ")
                .trim();
            if (officeName) {
                currentOffice = officeName;
            }
        } else if (!isGenericSubRow(label) && label.length > 2 && !/^\d+$/.test(label)) {
            // Standalone named entry (e.g. "Colombo GPO", "Central Mail Exchange")
            officeName = label
                .replace(/\(\s*fax\s*\)/gi, "")
                .replace(/\s+/g, " ")
                .trim();
            currentOffice = officeName;
        }

        if (!officeName) return;

        let rec = mainByName.get(officeName);
        if (!rec) {
            rec = { name: officeName, phones: [], faxes: [], source: "main" };
            mainByName.set(officeName, rec);
        }

        if (number && /\d{3}/.test(number)) {
            if (isFaxRow) rec.faxes.push(cleanPhoneRaw(number));
            else rec.phones.push(cleanPhoneRaw(number));
        }
    });

    results.push(...mainByName.values());
    console.log(`[slpost.gov.lk] Parsed ${mainByName.size} main offices`);

    // 2. Sub Post Directorate Part 01 & Part 02
    for (const [part, url] of [
        ["sub-01", "https://slpost.gov.lk/sub-post-directorate-part-01/"],
        ["sub-02", "https://slpost.gov.lk/sub-post-directorate-part-02/"],
    ] as const) {
        console.log(`[slpost.gov.lk] Fetching ${part}...`);
        const html = await fetchWithRetry(url);
        const $ = cheerio.load(html);
        let count = 0;
        $("table tr").each((_, tr) => {
            const cells = $(tr)
                .find("th, td")
                .map((__, td) => $(td).text().replace(/\s+/g, " ").trim())
                .get();
            if (cells.length >= 2) {
                const name = cells[0].trim();
                const phone = cleanPhoneRaw(cells[1]);
                if (name && phone && /\d{3}/.test(phone) && !/^name$/i.test(name)) {
                    results.push({ name, phones: [phone], faxes: [], source: part });
                    count++;
                }
            }
        });
        console.log(`[slpost.gov.lk] Parsed ${count} rows from ${part}`);
    }

    fs.writeFileSync(cacheFile, JSON.stringify(results, null, 2));
    return results;
}

function parsePostageLocationPage(url: string, html: string): PostageLkLocation | null {
    const $ = cheerio.load(html);
    const h1 = $("h1").first().text().replace(/\s+/g, " ").trim();
    if (!h1) return null;

    // Extract name and type from H1 e.g. "Agalawatta Post office" or "Abanwala Sub Post office"
    let name = h1;
    let type = "Post Office";
    const typeMatch = h1.match(/\s+(Sub Post office|Post office|Agency Post office|Rural Agency Post office)$/i);
    if (typeMatch) {
        name = h1.slice(0, h1.length - typeMatch[0].length).trim();
        type = typeMatch[1].trim();
    } else {
        const breadcrumbLeaf = $("main p a, p a").last().parent().text().split("›").pop()?.trim();
        if (breadcrumbLeaf && h1.toLowerCase().startsWith(breadcrumbLeaf.toLowerCase())) {
            name = breadcrumbLeaf;
            type = h1.slice(breadcrumbLeaf.length).trim() || "Post Office";
        }
    }

    const dlMap: Record<string, string> = {};
    $("dl dt").each((_, dt) => {
        const key = $(dt).text().replace(/\s+/g, " ").trim().toLowerCase();
        const val = $(dt).next("dd").text().replace(/\s+/g, " ").trim();
        if (key) dlMap[key] = val;
    });

    const cleanVal = (v?: string) => {
        if (!v) return "";
        const t = v.trim();
        return /^(n\/?a|none|null|-)$/i.test(t) ? "" : t;
    };

    let controllingOffice = "";
    let controllingUrl = "";
    const subPostOffices: string[] = [];

    $("h2").each((_, h2) => {
        const heading = $(h2).text().trim().toLowerCase();
        if (heading.includes("controlling office")) {
            const a = $(h2).next("p").find("a").first();
            controllingOffice = a.text().replace(/\s+/g, " ").trim();
            controllingUrl = a.attr("href") || "";
        } else if (heading.includes("sub post offices")) {
            $(h2)
                .next("ul")
                .find("li a")
                .each((__, a) => {
                    const subName = $(a).text().replace(/\s+/g, " ").trim();
                    if (subName) subPostOffices.push(subName);
                });
        }
    });

    const slugId = url.split("/location/")[1] || "";

    return {
        url,
        slugId,
        name,
        type,
        postalCode: cleanVal(dlMap["post code"]),
        shortCode: cleanVal(dlMap["short code"]),
        grade: cleanVal(dlMap["grade"]),
        delivery: cleanVal(dlMap["delivery"]),
        dsDivision: cleanVal(dlMap["ds division"]),
        dpmgDivision: cleanVal(dlMap["dpmg division"]),
        controllingOffice,
        controllingUrl,
        subPostOffices,
    };
}

async function harvestPostageLk(): Promise<PostageLkLocation[]> {
    const cacheFile = path.join(CACHE_DIR, "postage-lk-locations.json");
    const existingMap = new Map<string, PostageLkLocation>();

    if (fs.existsSync(cacheFile)) {
        try {
            const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8")) as PostageLkLocation[];
            for (const item of cached) {
                if (item?.url) existingMap.set(item.url, item);
            }
            console.log(`[postage.lk] Loaded ${existingMap.size} cached location pages`);
        } catch {
            // ignore corrupted cache
        }
    }

    console.log("[postage.lk] Fetching sitemap.xml...");
    const sitemapXml = await fetchWithRetry("https://postage.lk/sitemap.xml");
    const allUrls = [...sitemapXml.matchAll(/<loc>(.*?)<\/loc>/g)]
        .map((m) => m[1].trim())
        .filter((u) => u.includes("/location/"));

    const pending = allUrls.filter((u) => !existingMap.has(u));
    console.log(`[postage.lk] Total location URLs: ${allUrls.length}, remaining to fetch: ${pending.length}`);

    if (pending.length > 0) {
        const CONCURRENCY = 16;
        let idx = 0;
        let fetchedCount = 0;
        let failedCount = 0;

        const worker = async () => {
            while (idx < pending.length) {
                const current = pending[idx++];
                try {
                    const html = await fetchWithRetry(current, undefined, 3);
                    const parsed = parsePostageLocationPage(current, html);
                    if (parsed) {
                        existingMap.set(current, parsed);
                    }
                    fetchedCount++;
                } catch {
                    failedCount++;
                }

                if ((fetchedCount + failedCount) % 250 === 0) {
                    console.log(
                        `[postage.lk] Progress: ${fetchedCount + failedCount}/${pending.length} (ok=${fetchedCount}, fail=${failedCount})`
                    );
                    fs.writeFileSync(cacheFile, JSON.stringify([...existingMap.values()], null, 2));
                }
            }
        };

        await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
        fs.writeFileSync(cacheFile, JSON.stringify([...existingMap.values()], null, 2));
        console.log(`[postage.lk] Completed: total cached=${existingMap.size}, failed=${failedCount}`);
    }

    return [...existingMap.values()];
}

async function harvestOsmPostOffices(): Promise<OsmPostOffice[]> {
    const cacheFile = path.join(CACHE_DIR, "osm-post-offices.json");
    if (fs.existsSync(cacheFile)) {
        const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8")) as OsmPostOffice[];
        if (Array.isArray(cached) && cached.length > 50) {
            console.log(`[OSM] Loaded ${cached.length} cached OSM post offices`);
            return cached;
        }
    }

    const query = `
[out:json][timeout:60];
area["ISO3166-1"="LK"]->.lk;
(
  node["amenity"="post_office"](area.lk);
  way["amenity"="post_office"](area.lk);
  relation["amenity"="post_office"](area.lk);
);
out center tags;
`.trim();

    const endpoints = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
    ];

    let rawJson: { elements?: Array<Record<string, unknown>> } | null = null;
    for (const endpoint of endpoints) {
        try {
            console.log(`[OSM] Querying ${endpoint}...`);
            const text = await fetchWithRetry(
                endpoint,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: `data=${encodeURIComponent(query)}`,
                },
                2
            );
            rawJson = JSON.parse(text) as { elements?: Array<Record<string, unknown>> };
            if (rawJson?.elements?.length) break;
        } catch (err) {
            console.warn(`[OSM] Endpoint ${endpoint} failed:`, (err as Error).message);
        }
    }

    const elements = rawJson?.elements || [];
    const offices: OsmPostOffice[] = [];

    for (const el of elements) {
        const tags = (el.tags || {}) as Record<string, string>;
        const center = el.center as { lat?: number; lon?: number } | undefined;
        const lat = typeof el.lat === "number" ? el.lat : center?.lat;
        const lon = typeof el.lon === "number" ? el.lon : center?.lon;
        if (typeof lat !== "number" || typeof lon !== "number") continue;

        const name = (tags["name:en"] || tags.name || "").trim();
        if (!name) continue;

        offices.push({
            osmType: String(el.type || "node"),
            osmId: Number(el.id || 0),
            name,
            nameEn: (tags["name:en"] || "").trim(),
            postcode: (tags["addr:postcode"] || "").trim(),
            phone: (tags.phone || tags["contact:phone"] || "").trim(),
            openingHours: (tags.opening_hours || "").trim(),
            operator: (tags.operator || "").trim(),
            lat,
            lon,
        });
    }

    fs.writeFileSync(cacheFile, JSON.stringify(offices, null, 2));
    console.log(`[OSM] Saved ${offices.length} OSM post offices`);
    return offices;
}

async function main() {
    ensureCacheDir();
    const [slpost, postageLk, osm] = await Promise.all([
        harvestSlpostGovLk(),
        harvestPostageLk(),
        harvestOsmPostOffices(),
    ]);

    console.log("\n=== Harvest Summary ===");
    console.log(`slpost.gov.lk entries: ${slpost.length}`);
    console.log(`postage.lk entries:    ${postageLk.length}`);
    console.log(`OSM coordinates:       ${osm.length}`);
}

main().catch((err) => {
    console.error("Harvest failed:", err);
    process.exit(1);
});
