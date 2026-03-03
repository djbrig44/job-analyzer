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
  try {
    const { data } = await axios.get("https://www.musicbusinessworldwide.com/jobs/listings/", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JobTracker/1.0)" },
      timeout: 10000,
    });
    const $ = cheerio.load(data);
    const jobs = [];
    $(".job_listing").each((_, el) => {
      const title = $(el).find(".position h3").text().trim();
      const company = $(el).find(".company strong").text().trim();
      const location = $(el).find(".location").text().trim();
      const url = $(el).find("a").attr("href") || "";
      if (title && company) {
        jobs.push({ title, company, location, url, source: "mbw", id: `mbw-${Buffer.from(title+company).toString("base64").slice(0,12)}` });
      }
    });
    console.log(`MBW: scraped ${jobs.length} jobs`);
    return jobs;
  } catch (e) {
    console.error("MBW scrape error:", e.message);
    return [];
  }
}

async function scrapeROSTR() {
  try {
    const { data } = await axios.get("https://jobs.rostr.cc/", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JobTracker/1.0)" },
      timeout: 10000,
    });
    const $ = cheerio.load(data);
    const jobs = [];
    $("a[href*='/jobs/']").each((_, el) => {
      const title = $(el).find("h2, h3, .title, [class*='title']").first().text().trim();
      const company = $(el).find("[class*='company'], [class*='employer']").first().text().trim();
      const location = $(el).find("[class*='location']").first().text().trim();
      const url = "https://jobs.rostr.cc" + ($(el).attr("href") || "");
      if (title && title.length > 3) {
        jobs.push({ title, company: company || "Unknown", location, url, source: "rostr", id: `rostr-${Buffer.from(title+company).toString("base64").slice(0,12)}` });
      }
    });
    // Deduplicate by id
    const seen = new Set();
    const unique = jobs.filter(j => { if (seen.has(j.id)) return false; seen.add(j.id); return true; });
    console.log(`ROSTR: scraped ${unique.length} jobs`);
    return unique;
  } catch (e) {
    console.error("ROSTR scrape error:", e.message);
    return [];
  }
}

async function scrapeDoorsOpen() {
  try {
    const { data } = await axios.get("https://www.doorsopen.co/jobs/", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JobTracker/1.0)" },
      timeout: 10000,
    });
    const $ = cheerio.load(data);
    const jobs = [];
    $(".listing-item, .job-listing, article").each((_, el) => {
      const title = $(el).find("h2, h3, .title").first().text().trim();
      const company = $(el).find(".company, .employer, [class*='company']").first().text().trim();
      const location = $(el).find(".location, [class*='location']").first().text().trim();
      const href = $(el).find("a").first().attr("href") || "";
      const url = href.startsWith("http") ? href : "https://www.doorsopen.co" + href;
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
      timeout: 10000,
    });
    const $ = cheerio.load(data);
    const jobs = [];
    $(".job, [class*='listing'], li").each((_, el) => {
      const title = $(el).find("h3, h4, .title, [class*='title']").first().text().trim();
      const location = $(el).find("[class*='location'], .location").first().text().trim();
      const href = $(el).find("a").first().attr("href") || "";
      const url = href.startsWith("http") ? href : "https://www.umusiccareers.com" + href;
      if (title && title.length > 3) {
        jobs.push({ title, company: "Universal Music Group", location, url, source: "umg", id: `umg-${Buffer.from(title+location).toString("base64").slice(0,12)}` });
      }
    });
    const seen = new Set();
    const unique = jobs.filter(j => { if (seen.has(j.id)) return false; seen.add(j.id); return true; });
    console.log(`UMG: scraped ${unique.length} jobs`);
    return unique;
  } catch (e) {
    console.error("UMG scrape error:", e.message);
    return [];
  }
}

// ─── Run All Scrapers ─────────────────────────────────────────────────────────
async function scrapeAllJobs() {
  console.log("🎵 Starting job scrape...", new Date().toISOString());
  const [mbw, rostr, doorsOpen, digilogue, umg] = await Promise.all([
    scrapeMBW(), scrapeROSTR(), scrapeDoorsOpen(), scrapeDigilogue(), scrapeUMG()
  ]);
  const allJobs = [...mbw, ...rostr, ...doorsOpen, ...digilogue, ...umg];
  const cache = { jobs: allJobs, lastUpdated: new Date().toISOString() };
  saveCache(cache);
  console.log(`✅ Total scraped: ${allJobs.length} jobs`);
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

// ─── Cron: scrape every 6 hours ───────────────────────────────────────────────
cron.schedule("0 */6 * * *", () => {
  console.log("⏰ Cron: running scheduled scrape");
  scrapeAllJobs();
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  // Run initial scrape if cache is empty or old
  const cache = loadCache();
  const age = cache.lastUpdated ? (Date.now() - new Date(cache.lastUpdated)) / 1000 / 60 / 60 : 999;
  if (age > 6) {
    console.log("Cache stale or empty — running initial scrape...");
    scrapeAllJobs();
  }
});
