<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UC Job Board (Archive)</title>
    <style>
        body { font-family: -apple-system, system-ui, sans-serif; background: #f4f7f6; max-width: 900px; margin: 0 auto; padding: 2rem; color: #333; }
        header { text-align: center; margin-bottom: 2rem; }
        h1 { color: #005596; margin-bottom: 0.5rem; }
        
        .controls { display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px; margin-bottom: 2rem; background: white; padding: 1rem; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
        input, select { padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem; }
        
        .job-card { background: white; padding: 1rem; margin-bottom: 0.8rem; border-radius: 6px; border: 1px solid #eee; text-decoration: none; color: inherit; display: block; }
        .job-card:hover { border-color: #005596; transform: translateY(-2px); transition: 0.2s; }
        .job-title { font-weight: bold; color: #005596; margin-bottom: 4px; }
        .job-meta { display: flex; justify-content: space-between; font-size: 0.85rem; color: #666; }
        
        .last-updated { font-size: 0.8rem; color: #888; margin-top: 10px; text-align: center; }
    </style>
</head>
<body>

    <header>
        <h1>UC Job Board</h1>
        <div class="subtitle">Rolling 30-Day Archive</div>
        <div id="lastUpdated" class="last-updated"></div>
    </header>

    <div class="controls">
        <input type="text" id="searchInput" placeholder="Search titles (e.g. Manager)..." oninput="filterJobs()">
        <select id="campusFilter" onchange="filterJobs()">
            <option value="">All Campuses</option>
            <option value="Davis">UC Davis</option>
            <option value="San Francisco">UC San Francisco</option>
            <option value="Berkeley">UC Berkeley</option>
            <option value="Los Angeles">UCLA</option>
            <option value="San Diego">UC San Diego</option>
        </select>
        <button onclick="loadJobs()">🔄</button>
    </div>

    <main id="app"></main>

    <script>
        let allJobs = [];

        async function loadJobs() {
            const app = document.getElementById('app');
            app.innerHTML = 'Loading archive...';
            try {
                const res = await fetch('jobs.json?v=' + Date.now());
                const data = await res.json();
                allJobs = data.results;
                document.getElementById('lastUpdated').textContent = `Updated: ${new Date(data.updated_at).toLocaleString()}`;
                filterJobs();
            } catch (e) {
                app.innerHTML = 'Error loading data. Run scraper first.';
            }
        }

        function filterJobs() {
            const query = document.getElementById('searchInput').value.toLowerCase();
            const campus = document.getElementById('campusFilter').value;
            const app = document.getElementById('app');

            const filtered = allJobs.filter(j => {
                const matchesSearch = j.title.toLowerCase().includes(query);
                const matchesCampus = campus === "" || j.location.includes(campus);
                return matchesSearch && matchesCampus;
            });

            app.innerHTML = filtered.map(j => `
                <a href="${j.url}" target="_blank" class="job-card">
                    <div class="job-title">${j.title}</div>
                    <div class="job-meta">
                        <span>📍 ${j.location}</span>
                        <span>📅 ${j.date}</span>
                    </div>
                </a>
            `).join('');
            
            if (filtered.length === 0) app.innerHTML = '<p style="text-align:center">No matching jobs found.</p>';
        }

        loadJobs();
    </script>
</body>
</html>
