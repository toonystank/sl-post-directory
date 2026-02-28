import * as fs from 'fs';

const JSON_PATH = 'E:\\mm\\sl-post-tracker\\public\\post-offices.json';
const SCRAPED_PATH = 'scraped_codes.json';

const rawData = fs.readFileSync(JSON_PATH, 'utf8');
const postOffices = JSON.parse(rawData);

const scrapedRaw = fs.readFileSync(SCRAPED_PATH, 'utf8');
const scrapedCodes = JSON.parse(scrapedRaw);

// Levenshtein distance
function editDistance(s1: string, s2: string) {
    const costs: number[] = [];
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i == 0) costs[j] = j;
            else {
                if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) != s2.charAt(j - 1))
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}

let totalMissingBefore = 0;
let filledCount = 0;

for (const po of postOffices) {
    if (!po.postcode || po.postcode === 'N/A' || po.postcode.trim() === '') {
        totalMissingBefore++;

        const searchName = po.name.toUpperCase().trim();
        let matched = false;

        // 1. Exact match
        if (scrapedCodes[searchName]) {
            po.postcode = scrapedCodes[searchName];
            filledCount++;
            continue;
        }

        // 2. Simplified match
        let simplifiedName = searchName.replace(/ (BAZAAR|NORTH|SOUTH|EAST|WEST|TOWN|CITY|JUNCTION)$/g, '').trim();
        if (scrapedCodes[simplifiedName]) {
            po.postcode = scrapedCodes[simplifiedName];
            filledCount++;
            continue;
        }

        // 3. Partial match
        const partialMatch = Object.keys(scrapedCodes).find(k =>
            k === searchName + ' BAZAAR' ||
            k === searchName + ' TOWN' ||
            k.startsWith(searchName + ' ') ||
            searchName.startsWith(k + ' ') ||
            k === searchName.replace(/[-_]/g, ' ') ||
            k.replace(/\s+/g, '') === searchName.replace(/\s+/g, '')
        );

        if (partialMatch) {
            po.postcode = scrapedCodes[partialMatch];
            filledCount++;
            continue;
        }

        // 4. Fuzzy match (Edit distance <= 2 for words longer than 5 chars)
        let bestMatch = null;
        let bestDist = 3; // Max allowed distance is 2
        for (const [k, v] of Object.entries(scrapedCodes)) {
            // Compare simplified versions
            const kSimp = k.replace(/ (BAZAAR|NORTH|SOUTH|EAST|WEST|TOWN|CITY|JUNCTION)$/g, '').trim();
            const sSimp = simplifiedName;

            if (Math.abs(kSimp.length - sSimp.length) > 2) continue; // Skip if too different in length

            const dist = editDistance(kSimp, sSimp);
            if (dist < bestDist && sSimp.length > 5) {
                bestDist = dist;
                bestMatch = v;
            }
        }

        if (bestMatch) {
            po.postcode = bestMatch;
            filledCount++;
            continue;
        }
    }
}

console.log(`Missing initially: ${totalMissingBefore}`);
console.log(`Filled this run: ${filledCount}`);
console.log(`Remaining missing: ${totalMissingBefore - filledCount}`);

fs.writeFileSync(JSON_PATH, JSON.stringify(postOffices, null, 2));
console.log('Saved updated post-offices.json');
