require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");


const app = express();
const PORT = process.env.PORT || 8080;
const CACHE_FILE = path.join(__dirname, "jobs_cache.json");

app.use(cors({ origin: process.env.CLIENT_URL || "*" }));
app.use(express.json());

// Serve built frontend in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../dist")));
}

// ─── Job Cache ───────────────────────────────────────────────────────────────
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    }
  } catch (e) {}
  return { jobs: [], lastUpdated: null };
}

function saveCache(data) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Cache write error:", e.message);
  }
}

// ─── Scrapers ─────────────────────────────────────────────────────────────────
async function scrapeMBW() {
  console.log("MBW: skipped (requires headless browser - upgrade Railway plan to enable)");
  return [];
}

async function scrapeROSTR() {
  console.log("ROSTR: skipped (requires headless browser - upgrade Railway plan to enable)");
  return [];
}

async function scrapeDoorsOpen() {
  try {
    const { data } = await axios.get("https://www.doorsopen.co/jobs/", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JobTracker/1.0)" },
      timeout: 10000,
    });
    const $ = cheerio.load(data);
    const jobs = [];
    $("article.listing-item, .listing-item, article.media").each((_, el) => {
      const titleEl = $(el).find(".listing-item__title a, h3 a, h4 a, .title a").first();
      const title = titleEl.text().trim();
      const href = titleEl.attr("href") || "";
      const url = href.startsWith("http") ? href : "https://www.doorsopen.co" + href;
      const company = $(el).find(".listing-item__info--item, .company, [class*='company']").first().text().trim();
      const location = $(el).find(".listing-item__info--item, [class*='location']").eq(1).text().trim();
      if (title && title.length > 3) {
        jobs.push({ title, company: company || "Unknown", location, url, source: "doorsopen", id: `do-${Buffer.from(title+company).toString("base64").slice(0,12)}` });
      }
    });
    const seen = new Set();
    const unique = jobs.filter(j => { if (seen.has(j.id)) return false; seen.add(j.id); return true; });
    console.log(`Doors Open: scraped ${unique.length} jobs`);
    return unique;
  } catch (e) {
    console.error("Doors Open scrape error:", e.message);
    return [];
  }
}

async function scrapeDigilogue() {
  try {
    const { data } = await axios.get("https://www.thedigilogue.com/career-listings", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JobTracker/1.0)" },
      timeout: 10000,
    });
    const $ = cheerio.load(data);
    const jobs = [];
    $("a[href*='apply'], .w-dyn-item, [class*='job']").each((_, el) => {
      const title = $(el).find("h2, h3, h4, [class*='title']").first().text().trim();
      const company = $(el).find("[class*='company'], strong").first().text().trim();
      const location = $(el).find("[class*='location']").first().text().trim();
      const href = $(el).attr("href") || $(el).find("a").attr("href") || "";
      const url = href.startsWith("http") ? href : "https://www.thedigilogue.com" + href;
      if (title && title.length > 3) {
        jobs.push({ title, company: company || "Unknown", location, url, source: "digilogue", id: `dg-${Buffer.from(title+company).toString("base64").slice(0,12)}` });
      }
    });
    const seen = new Set();
    const unique = jobs.filter(j => { if (seen.has(j.id)) return false; seen.add(j.id); return true; });
    console.log(`Digilogue: scraped ${unique.length} jobs`);
    return unique;
  } catch (e) {
    console.error("Digilogue scrape error:", e.message);
    return [];
  }
}

async function scrapeUMG() {
  try {
    const { data } = await axios.get("https://www.umusiccareers.com/?category=Marketing%2C+Streaming+%26+Digital+Media", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JobTracker/1.0)" },
      timeout: 15000,
    });
    // Find the workdayPosts data — try multiple patterns
    let posts = null;
    const patterns = [
      data.match(/workdayPosts\s*=\s*(\[[\s\S]*?\])\s*;/),
      data.match(/"workdayPosts"\s*:\s*(\[[\s\S]*?\])\s*[,}]/),
      data.match(/workdayPosts\s*=\s*(\[[\s\S]*\])\s*;/),
    ];
    for (const m of patterns) {
      if (m) {
        try { posts = JSON.parse(m[1]); break; } catch {}
      }
    }
    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      console.log("UMG: could not extract job data from page");
      return [];
    }
    const jobs = posts
      .filter((p) => p.title && p.title.length > 3)
      .map((p) => ({
        title: p.title,
        company: p.department || "Universal Music Group",
        location: p.location || "",
        url: p.externalApplyURL || "https://www.umusiccareers.com",
        source: "umg",
        id: `umg-${Buffer.from(p.title + (p.location || "")).toString("base64").slice(0, 12)}`,
      }));
    const seen = new Set();
    const unique = jobs.filter((j) => { if (seen.has(j.id)) return false; seen.add(j.id); return true; });
    console.log(`UMG: scraped ${unique.length} jobs`);
    return unique;
  } catch (e) {
    console.error("UMG scrape error:", e.message);
    return [];
  }
}

async function scrapeConcord() {
  try {
    const { data } = await axios.get("https://careers-concord.icims.com/jobs/search?ss=1&searchKeyword=marketing&in_iframe=1", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JobTracker/1.0)" },
      timeout: 10000,
    });
    const $ = cheerio.load(data);
    const jobs = [];
    $(".iCIMS_JobsTable a[href*='/jobs/']").each((_, el) => {
      const title = $(el).text().trim();
      const href = $(el).attr("href") || "";
      const url = href.startsWith("http") ? href : "https://careers-concord.icims.com" + href;
      // Get the parent row and find location
      const row = $(el).closest("tr, .iCIMS_JobListingRow, div");
      const location = row.find("[class*='location'], [class*='Location']").text().trim()
        || row.text().match(/US-[A-Z]{2}-[\w\s]+/)?.[0] || "";
      if (title && title.length > 3 && !title.match(/^ID\s/)) {
        jobs.push({
          title,
          company: "Concord",
          location: location.replace(/^US-/, "").replace(/-/g, ", "),
          url: url.replace("&in_iframe=1", ""),
          source: "concord",
          id: `con-${Buffer.from(title).toString("base64").slice(0, 12)}`,
        });
      }
    });
    const seen = new Set();
    const unique = jobs.filter(j => { if (seen.has(j.id)) return false; seen.add(j.id); return true; });
    console.log(`Concord: scraped ${unique.length} jobs`);
    return unique;
  } catch (e) {
    console.error("Concord scrape error:", e.message);
    return [];
  }
}

async function scrapeBMG() {
  console.log("BMG: skipped (Next.js app, requires headless browser)");
  return [];
}

async function scrapeLiveNation() {
  console.log("Live Nation: skipped (Workday JS-rendered, requires headless browser)");
  return [];
}

// ─── Run All Scrapers ─────────────────────────────────────────────────────────
async function scrapeAllJobs() {
  console.log("🎵 Starting job scrape...", new Date().toISOString());
  const [mbw, rostr, doorsOpen, digilogue, umg, concord, bmg, liveNation] = await Promise.all([
    scrapeMBW(), scrapeROSTR(), scrapeDoorsOpen(), scrapeDigilogue(), scrapeUMG(),
    scrapeConcord(), scrapeBMG(), scrapeLiveNation()
  ]);
  const allJobs = [...mbw, ...rostr, ...doorsOpen, ...digilogue, ...umg, ...concord, ...bmg, ...liveNation];
  // Filter out junk CTA entries
  const junkPattern = /have an open position|post a job|submit your|sign up|subscribe/i;
  const realJobs = allJobs.filter((j) => !junkPattern.test(j.title));
  // Keep only California jobs
  const caPattern = /\bCA\b|California|Los Angeles|San Francisco|San Diego|Sacramento|Oakland|San Jose|Burbank|Hollywood|Santa Monica|Culver City|Beverly Hills|Calabasas|Irvine|Pasadena|Glendale/i;
  const caJobs = realJobs.filter((j) => j.location && caPattern.test(j.location));
  console.log(`📍 California filter: ${caJobs.length}/${allJobs.length} jobs matched`);
  const cache = { jobs: caJobs, lastUpdated: new Date().toISOString() };
  saveCache(cache);
  console.log(`✅ Total saved: ${caJobs.length} CA jobs`);
  return cache;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Anthropic API proxy (fixes CORS)
app.post("/api/analyze", async (req, res) => {
  try {
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      req.body,
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
      }
    );
    res.json(response.data);
  } catch (e) {
    console.error("Anthropic proxy error:", e.response?.data || e.message);
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

// Get cached jobs
app.get("/api/jobs", (req, res) => {
  const cache = loadCache();
  res.json(cache);
});

// Force refresh scrape
app.post("/api/scrape", async (req, res) => {
  try {
    const cache = await scrapeAllJobs();
    res.json({ success: true, count: cache.jobs.length, lastUpdated: cache.lastUpdated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  const cache = loadCache();
  res.json({ status: "ok", cachedJobs: cache.jobs.length, lastUpdated: cache.lastUpdated });
});

// Catch-all for frontend in production
if (process.env.NODE_ENV === "production") {
  app.get("*splat", (req, res) => {
    res.sendFile(path.join(__dirname, "../dist/index.html"));
  });
}

// ─── Process-level error handlers (keep server alive) ────────────────────────
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception (server staying alive):", err.message);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection (server staying alive):", reason);
});

// ─── Heartbeat (proves process is alive) ─────────────────────────────────────
setInterval(() => {
  console.log("💓 heartbeat", new Date().toISOString());
}, 60000);

// ─── Cron: scrape every 6 hours ───────────────────────────────────────────────
cron.schedule("0 */6 * * *", () => {
  console.log("⏰ Cron: running scheduled scrape");
  scrapeAllJobs().catch((e) => console.error("Cron scrape error:", e.message));
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log("Waiting 30s before initial scrape to let Railway health check pass...");

  // Delay scrape so Railway's health check can confirm the server is alive first
  setTimeout(() => {
    try {
      const cache = loadCache();
      const age = cache.lastUpdated
        ? (Date.now() - new Date(cache.lastUpdated)) / 1000 / 60 / 60
        : 999;
      if (age > 6) {
        console.log("Cache stale or empty — running initial scrape...");
        scrapeAllJobs().catch((e) =>
          console.error("Initial scrape error (non-fatal):", e.message)
        );
      } else {
        console.log(`Cache is ${age.toFixed(1)}h old — skipping scrape.`);
      }
    } catch (e) {
      console.error("Startup scrape check error (non-fatal):", e.message);
    }
  }, 30000);
});
