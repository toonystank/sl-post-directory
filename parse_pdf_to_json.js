const fs = require('fs');

const text = fs.readFileSync('C:\\Users\\hakee\\Downloads\\Documents\\extracted_pdf.txt', 'utf8');
const lines = text.split('\n');

const results = [];
let matchedCount = 0;

for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // Standard row regex: Name (anything) + DistCode (2-3 caps) + SP (S/P) + Postcode (5 digits or *)
    const match = line.match(/^(.+?)\s+([A-Z]{2,3})\s+(S|P)\s+(\d{5}|\*)$/);
    if (match) {
        let name = match[1].trim();
        let distCode = match[2];
        let sp = match[3];
        let postcode = match[4];

        results.push({ name, distCode, sp, postcode });
        matchedCount++;
    }
}

fs.writeFileSync('C:\\Users\\hakee\\Downloads\\Documents\\pdf_codes.json', JSON.stringify(results, null, 2));
console.log(`Parsed ${matchedCount} valid rows from the PDF.`);
