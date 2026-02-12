const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const BASE_URL = 'https://jobs.universityofcalifornia.edu/site/advancedsearch';
const SEARCH_PARAMS = 'keywords=&job_type=Full+Time&Category%5Bcategory_id%5D=&Campus%5Bcampus_id%5D=&multiple_locations=0&search=Search';

async function scrapeIncremental() {
    console.log("Starting incremental scrape...");
    
    let existingJobs = [];
    if (fs.existsSync('jobs.json')) {
        try {
            existingJobs = JSON.parse(fs.readFileSync('jobs.json')).results || [];
        } catch (e) {
            console.log("Starting fresh archive.");
        }
    }

    const existingUrls = new Set(existingJobs.map(j => j.url));
    const newJobs = [];
    let page = 1;
    let foundOldJob = false;

    while (!foundOldJob) {
        console.log(`Checking page ${page}...`);
        try {
            const { data } = await axios.get(`${BASE_URL}?page=${page}&${SEARCH_PARAMS}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
            });
            const $ = cheerio.load(data);
            const pageJobSpots = $('.jobspot');

            if (pageJobSpots.length === 0) break;

            for (let i = 0; i < pageJobSpots.length; i++) {
                const el = pageJobSpots[i];
                const titleEl = $(el).find('.jtitle');
                const link = titleEl.attr('href');
                const url = link.startsWith('http') ? link : `https://jobs.universityofcalifornia.edu${link}`;

                if (existingUrls.has(url)) {
                    console.log("Reached previously scraped data. Stopping.");
                    foundOldJob = true;
                    break;
                }

                // Extract the actual "Posting Date" string (e.g., "2/11/2026")
                const postingDate = $(el).find('.jclose').text().replace('Posting Date:', '').trim();
                // Extract the job category or add "N/A" when it doesn't exist
                const category = $(el).find('.jfamily').text().replace('Category:', '').trim(); || "N/A";

                newJobs.push({
                    title: titleEl.text().trim(),
                    location: $(el).find('.jloc').text().trim(),
                    category: category,
                    date: postingDate, // This is the original UC date
                    url: url
                });
            }

            page++;
            if (page > 250) break; 

        } catch (error) {
            console.error("Scrape error:", error.message);
            break;
        }
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Merge and filter by 30-day window
    const mergedList = [...newJobs, ...existingJobs].filter(job => {
        const postDate = new Date(job.date);
        return isNaN(postDate) || postDate >= thirtyDaysAgo;
    });

    // Final Sort: strictly newest posting date to oldest
    mergedList.sort((a, b) => new Date(b.date) - new Date(a.date));

    const output = {
        updated_at: new Date().toISOString(), // Keep this for the "Last Scraped" header
        count: mergedList.length,
        results: mergedList
    };

    fs.writeFileSync('jobs.json', JSON.stringify(output, null, 2));
    console.log(`Done! Added ${newJobs.length} new jobs. Total archive: ${mergedList.length}`);
}

scrapeIncremental();
