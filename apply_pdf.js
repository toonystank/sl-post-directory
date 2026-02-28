const fs = require('fs');

const JSON_PATH = 'E:\\mm\\sl-post-tracker\\public\\post-offices.json';
const PDF_PATH = 'C:\\Users\\hakee\\Downloads\\Documents\\pdf_codes.json';

const rawData = fs.readFileSync(JSON_PATH, 'utf8');
const postOffices = JSON.parse(rawData);

const pdfRaw = fs.readFileSync(PDF_PATH, 'utf8');
const pdfCodes = JSON.parse(pdfRaw);

// Helper function to calculate Levenshtein distance
function editDistance(s1, s2) {
    const costs = [];
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

let newlyFilledCodes = 0;
let distCodeAdded = 0;

for (const po of postOffices) {
    const searchName = po.name.toUpperCase().trim();
    const searchSimp = searchName.replace(/ (BAZAAR|NORTH|SOUTH|EAST|WEST|TOWN|CITY|JUNCTION)$/g, '').replace(/[-_]/g, ' ').trim();

    let bestMatch = null;
    let bestDist = 3;

    // We try to match each post office to the PDF codes
    for (const pdf of pdfCodes) {
        const pName = pdf.name.toUpperCase().trim();
        const pSimp = pName.replace(/ (BAZAAR|NORTH|SOUTH|EAST|WEST|TOWN|CITY|JUNCTION)$/g, '').replace(/[-_]/g, ' ').trim();

        // Exact match
        if (pName === searchName || pSimp === searchSimp) {
            bestMatch = pdf;
            break;
        }

        // Fuzzy match
        if (Math.abs(pSimp.length - searchSimp.length) <= 2) {
            let dist = editDistance(pSimp, searchSimp);
            if (dist < bestDist && searchSimp.length > 5) {
                bestDist = dist;
                bestMatch = pdf;
            }
        }
    }

    if (bestMatch) {
        // Fill postal code if missing and present in PDF
        if ((!po.postcode || po.postcode === 'N/A' || po.postcode.trim() === '') && bestMatch.postcode !== '*') {
            po.postcode = bestMatch.postcode;
            newlyFilledCodes++;
        }

        // The user refers to DistCode as the short code. Let's save it.
        // Some post offices already have a shortCode (e.g. ATG, AGN). Let's append DistCode as a different property to be robust, 
        // or if the user meant replace `shortCode` we can just ensure it goes into the database fields.
        po.distCode = bestMatch.distCode;
        distCodeAdded++;
    }
}

console.log(`Newly filled postal codes: ${newlyFilledCodes}`);
console.log(`DistCodes added: ${distCodeAdded}`);

fs.writeFileSync(JSON_PATH, JSON.stringify(postOffices, null, 2));
console.log('Saved updated post-offices.json');
