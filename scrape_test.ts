import * as cheerio from 'cheerio';

async function fetchKandy() {
    const res = await fetch('https://postalcodeslk.blogspot.com/p/blog-page.html');
    const html = await res.text();
    const $ = cheerio.load(html);

    // Try to find the postal codes table or list
    const tableText = $('table').first().text();
    const innerHtml = $('table').first().html();

    if (innerHtml) {
        console.log("Found table!");
        console.log("First 500 chars of HTML:", innerHtml.substring(0, 500));
    } else {
        console.log("No table found.");
        console.log("Main content:", $('.post-body').text().substring(0, 500));
    }
}

fetchKandy().catch(console.error);
