const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const BASE_URL = 'https://jobs.universityofcalifornia.edu/site/advancedsearch';
const SEARCH_PARAMS = 'keywords=&job_type=Full+Time&Category%5Bcategory_id%5D=&Campus%5Bcampus_id%5D=&multiple_locations=0&search=Search';

async function scrapeIncremental() {
    console.log("Starting incremental scrape...");
    
    // 1. Load existing data
    let existingJobs = [];
    if (fs.existsSync('jobs.json')) {
        try {
            existingJobs = JSON.parse(fs.readFileSync('jobs.json')).results || [];
        } catch (e) {
            console.log("Starting fresh archive.");
        }
    }

    // Create a set of URLs for O(1) lookups
    const existingUrls = new Set(existingJobs.map(j => j.url));
    const newJobs = [];
    let page = 1;
    let foundOldJob = false;

    // 2. Scrape until we hit a duplicate
    while (!foundOldJob) {
        console.log(`Checking page ${page}...`);
        try {
            const { data } = await axios.get(`${BASE_URL}?page=${page}&${SEARCH_PARAMS}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const $ = cheerio.load(data);
            const pageJobSpots = $('.jobspot');

            if (pageJobSpots.length === 0) break;

            for (let i = 0; i < pageJobSpots.length; i++) {
                const el = pageJobSpots[i];
                const titleEl = $(el).find('.jtitle');
                const link = titleEl.attr('href');
                const url = link.startsWith('http') ? link : `https://jobs.universityofcalifornia.edu${link}`;

                // THE STOPPING CONDITION
                if (existingUrls.has(url)) {
                    console.log("Reached previously scraped data. Stopping.");
                    foundOldJob = true;
                    break;
                }

                newJobs.push({
                    title: titleEl.text().trim(),
                    location: $(el).find('.jloc').text().trim(),
                    date: $(el).find('.jclose').text().replace('Posting Date:', '').trim(),
                    scraped_at: new Date().toISOString(),
                    url: url
                });
            }

            page++;
            // Safety cap: don't loop forever if UC changes their site structure
            if (page > 250) break; 

        } catch (error) {
            console.error("Scrape error:", error.message);
            break;
        }
    }

    // 3. Merge and Filter (Remove jobs older than 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const mergedList = [...newJobs, ...existingJobs].filter(job => {
        const postDate = new Date(job.date);
        return isNaN(postDate) || postDate >= thirtyDaysAgo;
    });

    // 4. Save
    const output = {
        updated_at: new Date().toISOString(),
        count: mergedList.length,
        results: mergedList.sort((a, b) => new Date(b.date) - new Date(a.date))
    };

    fs.writeFileSync('jobs.json', JSON.stringify(output, null, 2));
    console.log(`Done! Added ${newJobs.length} new jobs. Total archive: ${mergedList.length}`);
}

scrapeIncremental();
