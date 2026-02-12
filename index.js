const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const TARGET_URL = 'https://jobs.universityofcalifornia.edu/site/advancedsearch?page=1&keywords=&job_type=Full+Time&Category%5Bcategory_id%5D=&Campus%5Bcampus_id%5D=&multiple_locations=0&search=Search';

async function scrape() {
    console.log("Starting scraper...");
    
    try {
        const { data } = await axios.get(TARGET_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const $ = cheerio.load(data);
        const jobs = [];

        $('.jobspot').each((index, element) => {
            if (jobs.length >= 20) return false;

            const titleElement = $(element).find('.jtitle');
            const locationElement = $(element).find('.jloc');
            const dateElement = $(element).find('.jclose');

            if (titleElement.length > 0) {
                const title = titleElement.text().trim();
                const link = titleElement.attr('href');
                let date = dateElement.text().trim().replace('Posting Date:', '').trim();
                const fullLink = link.startsWith('http') ? link : `https://jobs.universityofcalifornia.edu${link}`;

                jobs.push({
                    title: title,
                    location: locationElement.text().trim(),
                    date: date,
                    url: fullLink
                });
            }
        });

        const output = {
            // We save as an ISO string so the browser can parse it locally
            updated_at: new Date().toISOString(),
            count: jobs.length,
            results: jobs
        };

        fs.writeFileSync('jobs.json', JSON.stringify(output, null, 2));
        console.log(`Success! Saved ${jobs.length} jobs to jobs.json`);

    } catch (error) {
        console.error("Error scraping:", error.message);
        process.exit(1);
    }
}

scrape();
