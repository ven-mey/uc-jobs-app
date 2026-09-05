const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const BASE_URL = 'https://jobs.universityofcalifornia.edu/site/advancedsearch';
const SEARCH_PARAMS = 'keywords=&job_type=Full+Time&Category%5Bcategory_id%5D=&Campus%5Bcampus_id%5D=&multiple_locations=0&search=Search';
const CONSECUTIVE_SEEN_LIMIT = 10;

function normalizeJobUrl(url) {
    if (!url) return url;
    if (url.includes('jobs.ucsd.edu/bulletin/job.aspx')) {
        const match = url.match(/jobnum_in=(\d+)/i);
        if (match && match[1]) {
            return `https://employment.ucsd.edu/jobs?keyword=${match[1]}`;
        }
    }
    return url;
}

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
    let consecutiveSeenCount = 0;
    let reachedLimit = false;

    while (!reachedLimit) {
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
                let rawUrl = link.startsWith('http') ? link : `https://jobs.universityofcalifornia.edu${link}`;
                const url = normalizeJobUrl(rawUrl);

                if (existingUrls.has(url)) {
                    consecutiveSeenCount++;
                    if (consecutiveSeenCount >= CONSECUTIVE_SEEN_LIMIT) {
                        console.log(`Encountered ${CONSECUTIVE_SEEN_LIMIT} consecutive known jobs. Stopping.`);
                        reachedLimit = true;
                        break;
                    }
                    continue;
                }

                // Reset consecutive streak whenever a brand-new job is found
                consecutiveSeenCount = 0;

                const postingDate = $(el).find('.jclose').text().replace('Posting Date:', '').trim();
                const category = $(el).find('.jfamily').text().replace('Category:', '').trim() || "N/A";

                newJobs.push({
                    title: titleEl.text().trim(),
                    location: $(el).find('.jloc').text().trim(),
                    category: category,
                    date: postingDate,
                    url: url,
                    scraped_at: new Date().toISOString()
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

    const mergedList = [...newJobs, ...existingJobs].filter(job => {
        const postDate = new Date(job.date);
        return isNaN(postDate) || postDate >= thirtyDaysAgo;
    });

    mergedList.sort((a, b) => new Date(b.date) - new Date(a.date));

    const output = {
        updated_at: new Date().toISOString(),
        count: mergedList.length,
        results: mergedList
    };

    fs.writeFileSync('jobs.json', JSON.stringify(output, null, 2));
    console.log(`Done! Added ${newJobs.length} new jobs. Total archive: ${mergedList.length}`);
}

scrapeIncremental();
