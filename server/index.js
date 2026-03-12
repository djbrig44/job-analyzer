require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const { chromium: pwChromium } = require("playwright");

async function getBrowser() {
  return pwChromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}


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
  let browser = null;
  try {
    browser = await getBrowser();
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    });
    const page = await context.newPage();
    await page.goto("https://www.bmg.com/us/careers/", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.waitForTimeout(5000);
    // Debug: dump outerHTML of first 5 job-like elements so we can see the DOM structure
    const debugEls = await page.evaluate(() => {
      const els = document.querySelectorAll(
        "a[href*='career'], a[href*='job'], [class*='job'] a, [class*='career'] a, [class*='position'], [class*='listing']"
      );
      return Array.from(els).slice(0, 8).map(el => ({
        outerHTML: el.outerHTML.substring(0, 400),
        children: Array.from(el.children).map(c => `<${c.tagName} class="${c.className}"> ${c.textContent?.trim().substring(0, 80)}`)
      }));
    });
    console.log("BMG DEBUG elements:", JSON.stringify(debugEls, null, 2));
    const jobs = await page.evaluate(() => {
      const results = [];
      const cityPattern = /(?:Los Angeles|New York|Nashville|Berlin|London|Sydney|Toronto|Paris|Amsterdam|Stockholm|Hamburg|Munich|Copenhagen|Madrid|Milan|Seoul|Tokyo|São Paulo|Mexico City|Buenos Aires|Singapore|Melbourne|Miami|Atlanta|Chicago|Austin|Denver|Portland|Seattle|Phoenix|San Francisco|San Diego|San Jose|Sacramento)(,\s*[\w\s]+)?/i;
      const cards = document.querySelectorAll(
        "a[href*='career'], a[href*='job'], [class*='job'] a, [class*='career'] a, [class*='position'], [class*='listing'], li a[href*='greenhouse'], li a[href*='workday']"
      );
      cards.forEach((el) => {
        const fullText = el.textContent?.trim() || "";
        const url = el.href || "";
        if (!url.includes("http") || fullText.length < 10 || fullText.length > 300) return;
        // Split concatenated title+location using city pattern
        const cityMatch = fullText.match(cityPattern);
        const location = cityMatch ? cityMatch[0].trim() : "";
        const title = cityMatch ? fullText.replace(cityMatch[0], "").trim() : fullText;
        if (title && title.length > 10) {
          results.push({ title, location, url, source: "bmg" });
        }
      });
      return results;
    });
    const junk = /^careers$|^here$|^apply|^learn more|^view|^see all|^back/i;
    const filtered = jobs.filter(j => !junk.test(j.title));
    const withIds = filtered.map((j) => ({
      ...j,
      company: "BMG",
      id: `bmg-${Buffer.from(j.title).toString("base64").slice(0, 12)}`,
    }));
    const seen = new Set();
    const unique = withIds.filter((j) => { if (seen.has(j.id)) return false; seen.add(j.id); return true; });
    console.log(`BMG: scraped ${unique.length} jobs`);
    return unique;
  } catch (e) {
    console.error("BMG scrape error:", e.message);
    return [];
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function scrapeLiveNation() {
  let browser = null;
  try {
    browser = await getBrowser();
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    });
    const page = await context.newPage();
    // Try Live Nation careers search page
    await page.goto("https://www.livenation.com/careers/search", {
      waitUntil: "networkidle",
      timeout: 45000,
    });
    await page.waitForTimeout(5000);
    // Debug: log where we actually landed and what the page looks like
    const debugInfo = await page.evaluate(() => ({
      url: document.location.href,
      title: document.title,
      bodyPreview: document.body.innerText.substring(0, 500),
    }));
    console.log("LN DEBUG page:", debugInfo.url, "title:", debugInfo.title);
    console.log("LN DEBUG body preview:", debugInfo.bodyPreview.substring(0, 300));
    // Debug: dump outerHTML of first 3 job-like elements
    const debugEls = await page.evaluate(() => {
      const els = document.querySelectorAll(
        "[data-testid='job-card'], .job-listing, .job-card, li[class*='job'], a[href*='/job'], a[href*='workday'], [class*='position'], [class*='career'] li, [class*='opening']"
      );
      return Array.from(els).slice(0, 3).map(el => el.outerHTML.substring(0, 400));
    });
    console.log("LN DEBUG elements:", JSON.stringify(debugEls));
    const jobs = await page.evaluate(() => {
      const results = [];
      // Try multiple selector strategies
      const cards = document.querySelectorAll(
        "[data-testid='job-card'], .job-listing, .job-card, li[class*='job'], [class*='position'], [class*='opening'], [class*='career'] li a"
      );
      cards.forEach((el) => {
        const titleEl = el.querySelector("h2, h3, h4, [class*='title'], a") || el;
        const title = titleEl.textContent?.trim() || "";
        const locEl = el.querySelector("[class*='location']");
        const location = locEl ? locEl.textContent.trim() : "";
        const linkEl = el.tagName === "A" ? el : el.querySelector("a[href]");
        const url = linkEl?.href || "";
        if (title && title.length > 5 && title.length < 200) {
          results.push({ title, location, url: url || "https://www.livenation.com/careers/search", source: "livenation" });
        }
      });
      // Fallback: try any links with /job/ in href
      if (results.length === 0) {
        document.querySelectorAll("a[href*='/job'], a[href*='workday']").forEach((el) => {
          const title = el.textContent?.trim() || "";
          const url = el.href || "";
          if (title && title.length > 5 && title.length < 200) {
            results.push({ title, location: "", url, source: "livenation" });
          }
        });
      }
      return results;
    });
    const junk = /^search|^sign in|^view all|^back|^next|^previous/i;
    const filtered = jobs.filter(j => !junk.test(j.title));
    const withIds = filtered.map((j) => ({
      ...j,
      company: "Live Nation",
      id: `ln-${Buffer.from(j.title).toString("base64").slice(0, 12)}`,
    }));
    const seen = new Set();
    const unique = withIds.filter((j) => { if (seen.has(j.id)) return false; seen.add(j.id); return true; });
    console.log(`Live Nation: scraped ${unique.length} jobs`);
    return unique;
  } catch (e) {
    console.error("Live Nation scrape error:", e.message);
    return [];
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// ─── Run All Scrapers ─────────────────────────────────────────────────────────
let _scrapeInProgress = false;

async function scrapeAllJobs() {
  if (_scrapeInProgress) {
    console.log("⏳ Scrape already in progress, skipping...");
    return loadCache();
  }
  _scrapeInProgress = true;
  try {
    console.log("🎵 Starting job scrape...", new Date().toISOString());
    const [mbw, rostr, doorsOpen, digilogue, umg, concord, bmg, liveNation] = await Promise.all([
      scrapeMBW(), scrapeROSTR(), scrapeDoorsOpen(), scrapeDigilogue(), scrapeUMG(),
      scrapeConcord(), scrapeBMG(), scrapeLiveNation()
    ]);
    const allJobs = [...mbw, ...rostr, ...doorsOpen, ...digilogue, ...umg, ...concord, ...bmg, ...liveNation];
    // Debug: log raw BMG and Live Nation jobs before filtering
    if (bmg.length) console.log("BMG raw jobs:", bmg.map(j => `${j.title} | loc="${j.location}"`));
    if (liveNation.length) console.log("LN raw jobs:", liveNation.map(j => `${j.title} | loc="${j.location}"`));
    // Filter out junk CTA entries
    const junkPattern = /have an open position|post a job|submit your|sign up|subscribe/i;
    const realJobs = allJobs.filter((j) => !junkPattern.test(j.title));
    // Keep only California jobs
    const caPattern = /\bCA\b|California|Los Angeles|San Francisco|San Diego|Sacramento|Oakland|San Jose|Burbank|Hollywood|Santa Monica|Culver City|Beverly Hills|Calabasas|Irvine|Pasadena|Glendale|Remote|United States/i;
    const caJobs = realJobs.filter((j) => j.location && caPattern.test(j.location));
    console.log(`📍 California filter: ${caJobs.length}/${allJobs.length} jobs matched`);
    const cache = { jobs: caJobs, lastUpdated: new Date().toISOString() };
    saveCache(cache);
    console.log(`✅ Total saved: ${caJobs.length} CA jobs`);
    return cache;
  } finally {
    _scrapeInProgress = false;
  }
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
