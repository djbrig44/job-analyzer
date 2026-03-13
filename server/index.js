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
  try {
    const { data } = await axios.get("https://www.musicbusinessworldwide.com/jobs/", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JobTracker/1.0)" },
      timeout: 15000,
    });
    const $ = cheerio.load(data);
    const jobs = [];
    $("ul li").each((_, el) => {
      const titleEl = $(el).find("a strong").first();
      if (!titleEl.length) return;
      const title = titleEl.text().trim();
      const href = titleEl.closest("a").attr("href") || "";
      const url = href.startsWith("http") ? href : "https://www.musicbusinessworldwide.com" + href;
      // Company and location are sibling <a> tags after the title link
      const links = $(el).find("a");
      let company = "";
      let location = "";
      links.each((i, link) => {
        const text = $(link).text().trim();
        const linkHref = $(link).attr("href") || "";
        if (linkHref.includes("/company/")) company = text;
        if (linkHref.includes("/location/") || linkHref.includes("/jobs/?location")) location = text;
      });
      if (title && title.length > 3) {
        jobs.push({
          title,
          company: company || "Unknown",
          location,
          url,
          source: "mbw",
          id: `mbw-${Buffer.from(title + company).toString("base64").slice(0, 12)}`,
        });
      }
    });
    const seen = new Set();
    const unique = jobs.filter(j => { if (seen.has(j.id)) return false; seen.add(j.id); return true; });
    console.log(`MBW: scraped ${unique.length} jobs`);
    return unique;
  } catch (e) {
    console.error("MBW scrape error:", e.message);
    return [];
  }
}

async function scrapeROSTR() {
  let browser = null;
  try {
    browser = await getBrowser();
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    });
    const page = await context.newPage();
    await page.goto("https://jobs.rostr.cc/", {
      waitUntil: "networkidle",
      timeout: 45000,
    });
    await page.waitForTimeout(5000);
    const jobs = [];
    const jobCards = await page.$$('a[href^="/job/"]');
    for (const card of jobCards) {
      const title = await card.$eval(".position", el => el.textContent.trim()).catch(() => "");
      const company = await card.$eval(".company", el => el.textContent.trim()).catch(() => "");
      const location = await card.$eval(".location, .meta span:not(.position):not(.company)", el => el.textContent.trim()).catch(() => "");
      const href = await card.getAttribute("href") || "";
      const url = href.startsWith("http") ? href : `https://jobs.rostr.cc${href}`;
      if (title && title.length > 3 && title.length < 200) {
        jobs.push({ title, company: company || "Unknown", location, url, source: "rostr" });
      }
    }
    const withIds = jobs.map((j) => ({
      ...j,
      id: `ros-${Buffer.from(j.title + j.company).toString("base64").slice(0, 12)}`,
    }));
    const seen = new Set();
    const unique = withIds.filter((j) => { if (seen.has(j.id)) return false; seen.add(j.id); return true; });
    console.log(`ROSTR: scraped ${unique.length} jobs`);
    return unique;
  } catch (e) {
    console.error("ROSTR scrape error:", e.message);
    return [];
  } finally {
    if (browser) await browser.close().catch(() => {});
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

async function scrapeSony() {
  try {
    const { data } = await axios.get("https://boards-api.greenhouse.io/v1/boards/sonymusicentertainment/jobs", {
      headers: { "Accept": "application/json" },
      timeout: 15000,
    });
    const jobs = (data.jobs || [])
      .filter(j => j.title && j.title.length > 3)
      .map(j => {
        const location = j.location?.name || "";
        // Extract label from title suffix: "Director, Marketing - AWAL" → "AWAL"
        const labelMatch = j.title.match(/\s*-\s*([A-Za-z\s&']+)$/);
        const company = labelMatch ? `Sony Music / ${labelMatch[1].trim()}` : "Sony Music Entertainment";
        return {
          title: j.title,
          company,
          location: location.replace(/^United States,?\s*/i, "").replace(/,?\s*Remote$/i, ", Remote").trim(),
          url: j.absolute_url || "https://job-boards.greenhouse.io/sonymusicentertainment",
          source: "sony",
          id: `sony-${Buffer.from(j.title + location).toString("base64").slice(0, 12)}`,
        };
      });
    const seen = new Set();
    const unique = jobs.filter(j => { if (seen.has(j.id)) return false; seen.add(j.id); return true; });
    console.log(`Sony Music: ${unique.length} jobs via Greenhouse API`);
    return unique;
  } catch (e) {
    console.error("Sony Music Greenhouse API error:", e.message);
    return [];
  }
}

// ─── Shared Workday CXS API scraper (paginated) ─────────────────────────────
async function scrapeWorkdayAPI({ apiUrl, portalBase, source, company, idPrefix }) {
  const LIMIT = 20;
  let offset = 0;
  let total = 0;
  const allJobs = [];
  try {
    while (true) {
      const { data } = await axios.post(apiUrl, {
        limit: LIMIT, offset, appliedFacets: {}, searchText: "",
      }, {
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        timeout: 15000,
      });
      if (offset === 0) total = data.total || 0;
      const postings = data.jobPostings || [];
      for (const p of postings) {
        const title = p.title || "";
        let location = p.locationsText || "";
        // Clean Workday location formats:
        // "USA - Los Angeles - 777 S. Santa Fe Ave" → "Los Angeles"
        // "Los Angeles, CA, USA" → "Los Angeles, CA, USA"
        location = location
          .replace(/^locations?/i, "")
          .replace(/USA\s*-\s*/i, "")
          .replace(/\s*-\s*\d+.*$/, "")
          .trim();
        const extPath = p.externalPath || "";
        const url = extPath ? `${portalBase}${extPath}` : portalBase;
        if (title && title.length > 5) {
          allJobs.push({
            title, company, location, url, source,
            id: `${idPrefix}-${Buffer.from(title + location).toString("base64").slice(0, 12)}`,
          });
        }
      }
      offset += LIMIT;
      if (postings.length < LIMIT || offset >= total) break;
      await new Promise(r => setTimeout(r, 300));
    }
    const seen = new Set();
    const unique = allJobs.filter(j => { if (seen.has(j.id)) return false; seen.add(j.id); return true; });
    console.log(`${company}: ${unique.length} jobs via Workday API (${total} total in portal)`);
    return unique;
  } catch (e) {
    console.error(`${company} Workday API error:`, e.message);
    return [];
  }
}

async function scrapeUMG() {
  return scrapeWorkdayAPI({
    apiUrl: "https://umusic.wd5.myworkdayjobs.com/wday/cxs/umusic/UMGUS/jobs",
    portalBase: "https://umusic.wd5.myworkdayjobs.com",
    source: "umg", company: "Universal Music Group", idPrefix: "umg",
  });
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
  return scrapeWorkdayAPI({
    apiUrl: "https://livenation.wd503.myworkdayjobs.com/wday/cxs/livenation/LNExternalSite/jobs",
    portalBase: "https://livenation.wd503.myworkdayjobs.com",
    source: "livenation", company: "Live Nation", idPrefix: "ln",
  });
}

async function scrapeWMG() {
  return scrapeWorkdayAPI({
    apiUrl: "https://wmg.wd1.myworkdayjobs.com/wday/cxs/wmg/WMGUS/jobs",
    portalBase: "https://wmg.wd1.myworkdayjobs.com",
    source: "wmg", company: "Warner Music Group", idPrefix: "wmg",
  });
}

// ─── JD Fetching & Scoring ────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a music industry recruiter AI scoring job postings against a candidate profile.

CANDIDATE: Brian Gaffey
TITLE: Music Industry Executive | Data-Driven Marketing & Artist Growth Strategy
EXPERIENCE: 15+ years in music industry
EDUCATION: MBA Marketing Analytics & AI Strategy (UC Davis 2026)
LOCATION: Los Angeles, CA

CORE SKILLS: artist development, brand positioning, marketing analytics, streaming strategy, algorithm strategy, ai strategy, campaign strategy, influencer partnerships, cultural partnerships, radio promotion, budget leadership, performance optimization, playlist strategy, tiktok, instagram, chartmetric, luminate, mediabase, spotify, youtube analytics, meta ads, predictive modeling, business intelligence, data analytics, kpi, label marketing, promotional strategy, a&r adjacent, sync licensing, distribution strategy, roster management, executive reporting, stakeholder alignment, cross-platform marketing, release strategy, tour marketing, audience growth, chart performance, grammy, interscope, def jam, independent
TARGET TITLES: marketing director, marketing manager, vp marketing, director of marketing, promotions director, brand director, growth director, head of marketing, artist marketing, label marketing, digital marketing, music marketing, marketing strategy, campaign director, managing director

SCORING RULES:
- Score 0-100 based on fit
- 85-100 = Excellent Match: Director/VP level music label marketing, streaming analytics, artist marketing campaigns at major or indie labels. These are dream roles.
- 70-84 = Good Match: Manager level digital marketing at music companies, streaming platforms, music tech. Strong alignment with candidate skills.
- 50-69 = Partial Match: Marketing roles tangentially related to music industry — adjacent companies, junior-mid roles at relevant companies.
- 25-49 = Weak Match: Some music industry connection but wrong function or seniority.
- Below 25 = No Match: Non-music roles (HR, design, admin, tech intern, warehouse, engineering). These should score very low.

IMPORTANT: Weight heavily toward music industry + marketing alignment. A Manager or Director of Digital Marketing at a major music label (BMG, UMG, Sony, Warner, Interscope, Def Jam, Republic, Atlantic, Columbia) should score 85 or higher — these are exact-fit roles. A "Director of Marketing" or "VP Marketing" at any music company should score 90+. Marketing manager roles at music tech/streaming companies (Spotify, Apple Music, YouTube Music, SoundCloud, DistroKid, UnitedMasters) should score 75+. Non-marketing roles at music companies (admin, HR, engineering, design) should score below 30. Non-music companies should score below 25 regardless of title.

Respond ONLY with valid JSON, no markdown:
{
  "score": number,
  "tier": "Excellent Match" | "Good Match" | "Partial Match" | "Weak Match",
  "matchedSkills": ["skill1", "skill2"],
  "gaps": ["gap1"],
  "headline": "one sentence summary of fit",
  "recommend": true | false
}`;

async function fetchJobDescription(url) {
  try {
    const { data } = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JobTracker/1.0)" },
      timeout: 10000,
    });
    const $ = cheerio.load(data);
    $("nav, footer, script, style, header, [class*='nav'], [class*='footer'], [class*='cookie'], [class*='banner']").remove();
    const selectors = [
      "[class*='description']", "[class*='job-detail']", "[class*='posting']",
      "[class*='content']", "article", "main", ".job-body", "#job-description",
    ];
    for (const sel of selectors) {
      const text = $(sel).first().text().replace(/\s+/g, " ").trim();
      if (text && text.length > 100) return text.substring(0, 3000);
    }
    const bodyText = $("body").text().replace(/\s+/g, " ").trim();
    return bodyText.length > 100 ? bodyText.substring(0, 3000) : "";
  } catch (e) {
    return "";
  }
}

async function scoreJob(job) {
  const prompt = `Analyze this job posting:\nTITLE: ${job.title}\nCOMPANY: ${job.company}\nLOCATION: ${job.location || "Not specified"}\nDESCRIPTION: ${job.description || "No description — score based on title and company only."}\nReturn ONLY the JSON object.`;
  try {
    const res = await axios.post("https://api.anthropic.com/v1/messages", {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      timeout: 30000,
    });
    const text = res.data.content?.find(b => b.type === "text")?.text || "{}";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (e) {
    console.error(`Score error for "${job.title}":`, e.message);
    return null;
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
    const [mbw, rostr, doorsOpen, digilogue, umg, concord, bmg, liveNation, wmg, sony] = await Promise.all([
      scrapeMBW(), scrapeROSTR(), scrapeDoorsOpen(), scrapeDigilogue(), scrapeUMG(),
      scrapeConcord(), scrapeBMG(), scrapeLiveNation(), scrapeWMG(), scrapeSony()
    ]);
    const allJobs = [...mbw, ...rostr, ...doorsOpen, ...digilogue, ...umg, ...concord, ...bmg, ...liveNation, ...wmg, ...sony];
    // Filter out junk CTA entries
    const junkPattern = /have an open position|post a job|submit your|sign up|subscribe/i;
    const realJobs = allJobs.filter((j) => !junkPattern.test(j.title));
    // Keep only California jobs — exclude Canadian "XX, CA" (province, country) false positives
    const caPattern = /\bCA\b|California|Los Angeles|San Francisco|San Diego|Sacramento|Oakland|San Jose|Burbank|Hollywood|Santa Monica|Culver City|Beverly Hills|Calabasas|Irvine|Pasadena|Glendale|Remote|United States/i;
    const canadaPattern = /,\s*(?:ON|BC|AB|QC|MB|SK|NS|NB|NL|PE|YT|NT|NU),\s*CA\b/i;
    const caJobs = realJobs.filter((j) => j.location && caPattern.test(j.location) && !canadaPattern.test(j.location));
    console.log(`📍 California filter: ${caJobs.length}/${allJobs.length} jobs matched`);

    // Preserve existing scores from cache
    const existingCache = loadCache();
    const scoredMap = new Map();
    for (const j of existingCache.jobs || []) {
      if (j.result || j.status) scoredMap.set(j.id, { description: j.description, result: j.result, status: j.status });
    }

    // Identify new/unscored jobs
    const enrichedJobs = [];
    const toScore = [];
    for (const job of caJobs) {
      const existing = scoredMap.get(job.id);
      if (existing) {
        enrichedJobs.push({ ...job, description: existing.description, result: existing.result, status: existing.status });
      } else {
        enrichedJobs.push(job);
        toScore.push(job);
      }
    }

    // Fetch JDs and score new jobs
    if (toScore.length > 0 && process.env.ANTHROPIC_API_KEY) {
      console.log(`📝 Fetching JDs for ${toScore.length} new jobs...`);
      for (const job of toScore) {
        job.description = await fetchJobDescription(job.url);
        await new Promise(r => setTimeout(r, 300));
      }
      const withJD = toScore.filter(j => j.description).length;
      console.log(`📄 JDs fetched: ${withJD}/${toScore.length} had extractable descriptions`);

      console.log(`🤖 Scoring ${toScore.length} new jobs...`);
      for (let i = 0; i < toScore.length; i += 3) {
        const batch = toScore.slice(i, i + 3);
        const results = await Promise.all(batch.map(j => scoreJob(j)));
        for (let k = 0; k < batch.length; k++) {
          const job = batch[k];
          job.result = results[k];
          // Update in enrichedJobs array
          const idx = enrichedJobs.findIndex(j => j.id === job.id);
          if (idx !== -1) enrichedJobs[idx] = job;
        }
        console.log(`  Scored ${Math.min(i + 3, toScore.length)}/${toScore.length}`);
      }
    }

    const cache = { jobs: enrichedJobs, lastUpdated: new Date().toISOString() };
    saveCache(cache);
    const scored = enrichedJobs.filter(j => j.result).length;
    console.log(`✅ Total saved: ${caJobs.length} CA jobs (${scored} scored)`);
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
    const scored = cache.jobs.filter(j => j.result).length;
    res.json({ success: true, count: cache.jobs.length, scored, lastUpdated: cache.lastUpdated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update job pipeline status
app.post("/api/job-status", (req, res) => {
  const { jobId, status } = req.body;
  const cache = loadCache();
  const job = cache.jobs.find(j => j.id === jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  job.status = status || null;
  saveCache(cache);
  res.json({ success: true });
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
