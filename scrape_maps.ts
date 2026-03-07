import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer';

const prisma = new PrismaClient();

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeGoogleMaps() {
    console.log("Connecting to database...");
    const offices = await prisma.postOffice.findMany({
        where: {
            // Uncomment next lines if we only want to fetch ones that haven't been scraped yet
            // latitude: null,
            // longitude: null
        }
    });

    if (offices.length === 0) {
        console.log("No offices need scraping. (Or all have latitudes)");
        return;
    }

    console.log(`Found ${offices.length} offices to scrape.`);
    console.log("Launching browser...");
    // Use headless mode to avoid popping up a browser instance in the user's view unless needed
    const browser = await puppeteer.launch({
        headless: true,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    });
    const page = await browser.newPage();

    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    for (const office of offices) {
        console.log(`\nScraping [${office.id}] ${office.name}...`);

        // Multi-step fallback for search queries (now including "Sub Post Office" variant first for accuracy per user tip)
        const searchQueries = [
            `${office.name} Post Office, Sri Lanka`,
            `${office.name} Sub Post Office, Sri Lanka`,
            `${office.name}, Sri Lanka`,
            `Sri Lanka Post - ${office.name}`
        ];

        let found = false;
        let lat: number | null = null;
        let lng: number | null = null;
        let formatHours: string | null = null;

        for (const query of searchQueries) {
            console.log(`  Trying query: "${query}"`);
            try {
                const encodedQuery = encodeURIComponent(query);
                await page.goto(`https://www.google.com/maps/search/${encodedQuery}`, { waitUntil: 'networkidle2' });

                // Wait for it to process search or redirect. We need the final URL with place data.
                await delay(5000);

                let url = page.url();
                let placeMatch = url.match(/!3d([-0-9.]+)!4d([-0-9.]+)/);

                // If it didn't redirect automatically, see if it showed a list of places and click the first one
                if (!placeMatch) {
                    const firstPlaceHref = await page.evaluate(() => {
                        const anchors = Array.from(document.querySelectorAll('a'));
                        const placeLink = anchors.find(a => a.href && a.href.includes('/maps/place/'));
                        return placeLink ? placeLink.href : null;
                    });

                    if (firstPlaceHref) {
                        console.log(`  -> Found a place link in search results, navigating...`);
                        await page.goto(firstPlaceHref, { waitUntil: 'networkidle2' });
                        await delay(5000);
                        url = page.url();
                        placeMatch = url.match(/!3d([-0-9.]+)!4d([-0-9.]+)/);
                    }
                }

                // Pattern 2: Fallback to the @(lat),(lng) map view coordinates
                const atMatch = url.match(/@([-0-9.]+),([-0-9.]+),/);

                if (placeMatch || atMatch) {
                    if (placeMatch) {
                        lat = parseFloat(placeMatch[1]);
                        lng = parseFloat(placeMatch[2]);
                        console.log(`  -> Found Exact POI Coordinates (!3d!4d): ${lat}, ${lng}`);
                    } else if (atMatch) {
                        lat = parseFloat(atMatch[1]);
                        lng = parseFloat(atMatch[2]);
                        console.log(`  -> Found Fallback Coordinates (@lat,lng): ${lat}, ${lng} (Warning: Might be general area)`);
                    }

                    // Sanity check: is it in SL? Lat 5-10, Lng 79-82 roughly
                    if (lat !== null && lng !== null && lat > 5 && lat < 10 && lng > 79 && lng < 82) {
                        found = true;

                        try {
                            const hoursText = await page.evaluate(() => {
                                // Google Maps often puts opening hours into div with aria-label containing day words
                                const containers = Array.from(document.querySelectorAll('div[aria-label]'));
                                const hoursContainer = containers.find(el => {
                                    const label = el.getAttribute('aria-label');
                                    return label && (label.includes('Monday') || label.includes('Tuesday') || label.includes('Sunday'));
                                });
                                if (hoursContainer) return hoursContainer.getAttribute('aria-label');
                                return null;
                            });

                            if (hoursText) {
                                formatHours = hoursText;
                                console.log(`  -> Found Hours: ${formatHours.substring(0, 50)}...`);
                            } else {
                                console.log(`  -> No hours found via aria-label heuristic.`);
                            }
                        } catch (e) {
                            console.log("  -> Failed to parse hours.");
                        }

                        break; // Stop trying queries if we found it
                    } else {
                        console.log(`  -> Coordinates out of bounds for SL or null: ${lat}, ${lng}`);
                    }
                } else {
                    console.log(`  -> Could not find coordinates in URL: ${url}`);
                }
            } catch (err: any) {
                console.log(`  -> Error with query: ${query} - ${err.message}`);
            }
        }

        if (found) {
            let retries = 3;
            while (retries > 0) {
                try {
                    await prisma.postOffice.update({
                        where: { id: office.id },
                        data: {
                            latitude: lat,
                            longitude: lng,
                            operatingHours: formatHours ? formatHours.substring(0, 255) : null
                        }
                    });
                    console.log(`  Saved to DB.`);
                    break;
                } catch (dbErr: any) {
                    console.error(`  -> DB Update Error: ${dbErr.message}`);
                    retries--;
                    if (retries === 0) {
                        console.error(`  -> Exhausted retries for saving ${office.name}.`);
                    } else {
                        console.log(`  -> Retrying in 10 seconds... (${retries} retries left)`);
                        await delay(10000); // 10s wait to allow DB connection to recover
                    }
                }
            }
        } else {
            console.log(`  Failed to find valid SL coordinates for ${office.name}.`);
        }

        await delay(2000); // Friendly delay between offices
    }

    await browser.close();
    console.log("Batch complete.");
    process.exit(0);
}

scrapeGoogleMaps().catch(e => {
    console.error(e);
    process.exit(1);
});
