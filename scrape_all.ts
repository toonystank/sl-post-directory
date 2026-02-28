import * as cheerio from 'cheerio';
import * as fs from 'fs';

const urls = [
    'https://postalcodeslk.blogspot.com/2013/10/colombo-district.html',
    'https://postalcodeslk.blogspot.com/p/blog-page.html',
    'https://postalcodeslk.blogspot.com/p/ampara-district.html',
    'https://postalcodeslk.blogspot.com/p/blog-page_23.html',
    'https://postalcodeslk.blogspot.com/p/blog-page_553.html',
    'https://postalcodeslk.blogspot.com/p/batticalao-district.html',
    'https://postalcodeslk.blogspot.com/p/blog-page_115.html',
    'https://postalcodeslk.blogspot.com/p/gampaha-district.html',
    'https://postalcodeslk.blogspot.com/p/blog-page_1182.html',
    'https://postalcodeslk.blogspot.com/p/blog-page_7357.html',
    'https://postalcodeslk.blogspot.com/p/blog-page_5620.html',
    'https://postalcodeslk.blogspot.com/p/kegalla-district.html',
    'https://postalcodeslk.blogspot.com/p/kurunegala-district.html',
    'https://postalcodeslk.blogspot.com/p/mannar-district.html',
    'https://postalcodeslk.blogspot.com/p/blog-page_24.html',
    'https://postalcodeslk.blogspot.com/p/blog-page_5915.html',
    'https://postalcodeslk.blogspot.com/p/nuwara-eliya-district.html',
    'https://postalcodeslk.blogspot.com/p/blog-page_8599.html',
    'https://postalcodeslk.blogspot.com/p/puttalam-district.html',
    'https://postalcodeslk.blogspot.com/p/blog-page_4135.html',
    'https://postalcodeslk.blogspot.com/p/blog-page_3222.html',
    'http://postalcodeslk.blogspot.com/2013/10/matale-district.html'
];

async function scrapeAll() {
    const codesMap: Record<string, string> = {};
    let count = 0;

    for (const url of urls) {
        try {
            console.log(`Fetching ${url}...`);
            const res = await fetch(url);
            const html = await res.text();
            const $ = cheerio.load(html);

            // Look for table rows
            $('tr').each((i, row) => {
                const tds = $(row).find('td');
                if (tds.length >= 2) {
                    let text1 = $(tds[0]).text().trim();
                    let text2 = $(tds[1]).text().trim();

                    // Cleanup text: remove non-alphanumeric except spaces for names, and keep digits for codes.
                    // Sometime format is swapped or messy. 
                    let name = "";
                    let code = "";

                    // One cell usually has digits (postal code), the other has letters (name)
                    if (/^\d{5}$/.test(text1)) {
                        code = text1;
                        name = text2;
                    } else if (/^\d{5}$/.test(text2)) {
                        code = text2;
                        name = text1;
                    } else {
                        // Extract embedded codes if any
                        const codeMatch1 = text1.match(/\d{5}/);
                        const codeMatch2 = text2.match(/\d{5}/);
                        if (codeMatch2) {
                            code = codeMatch2[0];
                            name = text1;
                        } else if (codeMatch1) {
                            code = codeMatch1[0];
                            name = text2;
                        }
                    }

                    if (code && name) {
                        name = name.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                        // Normalize the name to uppercase for easier matching later
                        const standardizedName = name.toUpperCase();
                        codesMap[standardizedName] = code;
                        count++;
                    }
                }
            });
        } catch (e) {
            console.error(`Failed to fetch ${url}`, e);
        }
    }

    console.log(`Extracted ${count} postal codes total.`);
    fs.writeFileSync('scraped_codes.json', JSON.stringify(codesMap, null, 2));
    console.log('Saved to scraped_codes.json');
}

scrapeAll().catch(console.error);
