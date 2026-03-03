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
  // MBW requires JavaScript rendering — static scrape not possible
  console.log("MBW: skipped (JS-rendered, needs headless browser)");
  return [];
}

async function scrapeROSTR() {
  // ROSTR is a Vue.js SPA — static scrape not possible
  console.log("ROSTR: skipped (Vue.js SPA, needs headless browser)");
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
    $("article.listing-item").each((_, el) => {
      const titleEl = $(el).find(".listing-item__title a").first();
      const title = titleEl.text().trim();
      const href = titleEl.attr("href") || "";
      const url = href.startsWith("http") ? href : "https://www.doorsopen.co" + href;
      const company = $(el).find(".media-body .listing-item__info--item").first().text().trim();
      const location = $(el).find(".listing-item__info--item").eq(1).text().trim();
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
    // UMG embeds jobs as a workdayPosts JSON array in the page source
    const match = data.match(/workdayPosts\s*=\s*(\[[\s\S]*?\]);/);
    if (!match) {
      console.log("UMG: could not find workdayPosts JSON in page");
      return [];
    }
    const posts = JSON.parse(match[1]);
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

// ─── Run All Scrapers ─────────────────────────────────────────────────────────
async function scrapeAllJobs() {
  console.log("🎵 Starting job scrape...", new Date().toISOString());
  const [mbw, rostr, doorsOpen, digilogue, umg] = await Promise.all([
    scrapeMBW(), scrapeROSTR(), scrapeDoorsOpen(), scrapeDigilogue(), scrapeUMG()
  ]);
  const allJobs = [...mbw, ...rostr, ...doorsOpen, ...digilogue, ...umg];
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

  // Run initial scrape if cache is empty or old — wrapped in try/catch
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
    }
  } catch (e) {
    console.error("Startup scrape check error (non-fatal):", e.message);
  }
});
