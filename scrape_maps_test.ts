import puppeteer from 'puppeteer';

async function testMaps() {
    console.log("Launching browser...");
    const browser = await puppeteer.launch({
        headless: true, // we can turn this to false to watch it
        executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const query = "Atulugama Post Office, Sri Lanka";
    const encodedQuery = encodeURIComponent(query);
    const url = `https://www.google.com/maps/search/${encodedQuery}`;

    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2' });

    await new Promise(r => setTimeout(r, 6000));

    let currentUrl = page.url();
    let placeMatch = currentUrl.match(/!3d([-0-9.]+)!4d([-0-9.]+)/);

    if (!placeMatch) {
        console.log("No specific place redirect yet. Searching for place links in the DOM...");
        const firstPlaceHref = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a'));
            const placeLink = anchors.find(a => a.href && a.href.includes('/maps/place/'));
            return placeLink ? placeLink.href : null;
        });

        if (firstPlaceHref) {
            console.log(`Found place link: ${firstPlaceHref}. Navigating...`);
            await page.goto(firstPlaceHref, { waitUntil: 'networkidle2' });
            await new Promise(r => setTimeout(r, 6000));
            currentUrl = page.url();
            placeMatch = currentUrl.match(/!3d([-0-9.]+)!4d([-0-9.]+)/);
        }
    }

    if (placeMatch) {
        const lat = parseFloat(placeMatch[1]);
        const lng = parseFloat(placeMatch[2]);
        console.log(`Successfully found POI Coordinates via !3d!4d: ${lat}, ${lng}`);
    } else {
        console.log("Failed to find POI coordinates.");
    }

    await browser.close();
}

testMaps().catch(console.error);
