require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const crypto = require("crypto");

function jobId(prefix, text) {
  return `${prefix}-${crypto.createHash("md5").update(text).digest("hex").slice(0, 12)}`;
}
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
          id: jobId("mbw", title + company),
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
      id: jobId("ros", j.title + j.company),
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
        jobs.push({ title, company: company || "Unknown", location, url, source: "doorsopen", id: jobId("do", title + company) });
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
        jobs.push({ title, company: company || "Unknown", location, url, source: "digilogue", id: jobId("dg", title + company) });
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
          id: jobId("sony", j.title + location),
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
async function scrapeWorkdayAPI({ apiUrl, portalBase, source, company, idPrefix, searchTerms }) {
  const LIMIT = 20;
  const allJobs = [];
  const seenIds = new Set();
  // Run blank search + any supplementary keyword searches
  const searches = ["", ...(searchTerms || [])];
  try {
    for (const searchText of searches) {
      let offset = 0;
      let total = 0;
      while (true) {
        const { data } = await axios.post(apiUrl, {
          limit: LIMIT, offset, appliedFacets: {}, searchText,
        }, {
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
          },
          timeout: 15000,
        });
        if (offset === 0) total = data.total || 0;
        const postings = data.jobPostings || [];
        for (const p of postings) {
          const title = p.title || "";
          let location = p.locationsText || "";
          location = location
            .replace(/^locations?/i, "")
            .replace(/USA\s*-\s*/i, "")
            .replace(/\s*-\s*\d+.*$/, "")
            .trim();
          const extPath = p.externalPath || "";
          const url = extPath ? `${portalBase}${extPath}` : portalBase;
          const id = jobId(idPrefix, title + location);
          if (title && title.length > 5 && !seenIds.has(id)) {
            seenIds.add(id);
            allJobs.push({ title, company, location, url, source, id });
          }
        }
        offset += LIMIT;
        if (postings.length < LIMIT || offset >= total) break;
        await new Promise(r => setTimeout(r, 300));
      }
      if (searchText) console.log(`  ${company} +search "${searchText}": ${total} results`);
    }
    console.log(`${company}: ${allJobs.length} unique jobs via Workday API`);
    return allJobs;
  } catch (e) {
    console.error(`${company} Workday API error:`, e.message);
    return [];
  }
}

async function scrapeUMG() {
  // Primary: Workday CXS API (paginated, may be IP-filtered on server)
  const apiJobs = await scrapeWorkdayAPI({
    apiUrl: "https://umusic.wd5.myworkdayjobs.com/wday/cxs/umusic/UMGUS/jobs",
    portalBase: "https://umusic.wd5.myworkdayjobs.com",
    source: "umg", company: "Universal Music Group", idPrefix: "umg",
  });
  // Supplementary: umusiccareers.com __NEXT_DATA__ (has department names, not IP-filtered)
  let siteJobs = [];
  try {
    const { data } = await axios.get("https://www.umusiccareers.com/", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JobTracker/1.0)" },
      timeout: 15000,
    });
    const m = data.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (m) {
      const nextData = JSON.parse(m[1]);
      const posts = nextData.props?.pageProps?.data?.workdayPosts || [];
      siteJobs = posts
        .filter(p => p.title && p.title.length > 3)
        .map(p => ({
          title: p.title,
          company: p.department || "Universal Music Group",
          location: p.location || "",
          url: p.externalApplyURL || "https://www.umusiccareers.com",
          source: "umg",
          id: jobId("umg", p.title + (p.location || "")),
        }));
      console.log(`  UMG microsite: ${siteJobs.length} jobs from __NEXT_DATA__`);
    }
  } catch (e) {
    console.error("UMG microsite error:", e.message);
  }
  // Merge and deduplicate (microsite jobs fill gaps from IP-filtered API)
  const seen = new Set(apiJobs.map(j => j.id));
  const merged = [...apiJobs];
  for (const j of siteJobs) {
    if (!seen.has(j.id)) { seen.add(j.id); merged.push(j); }
  }
  if (siteJobs.length > 0) console.log(`  UMG merged: ${merged.length} unique (${merged.length - apiJobs.length} from microsite)`);
  return merged;
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
          id: jobId("con", title),
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
      id: jobId("bmg", j.title),
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
    console.warn(`JD fetch failed for ${url} [${e.response?.status || "no-status"}]: ${e.message}`);
    return "";
  }
}

// Model used for auto-scoring. Pinned dated models get retired over time — a
// retired model 404s and every score comes back null (all jobs show a spinner).
// Overridable via env so a model swap doesn't need a code deploy.
const SCORING_MODEL = process.env.SCORING_MODEL || "claude-sonnet-5-5";

// Rolling health of the scoring pipeline, exposed at /api/score-health.
// Counters cover the current/most recent scoring run (reset at run start).
const _scoreHealth = {
  lastAttemptAt: null,
  successCount: 0,
  failureCount: 0,
  lastError: null,
};
function resetScoreHealthRun() {
  _scoreHealth.successCount = 0;
  _scoreHealth.failureCount = 0;
  _scoreHealth.lastError = null;
}

async function scoreJob(job) {
  const prompt = `Analyze this job posting:\nTITLE: ${job.title}\nCOMPANY: ${job.company}\nLOCATION: ${job.location || "Not specified"}\nDESCRIPTION: ${job.description || "No description — score based on title and company only."}\nReturn ONLY the JSON object.`;
  try {
    const res = await axios.post("https://api.anthropic.com/v1/messages", {
      model: SCORING_MODEL,
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
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    _scoreHealth.lastAttemptAt = new Date().toISOString();
    _scoreHealth.successCount++;
    return parsed;
  } catch (e) {
    const status = e.response?.status;
    const apiErr = JSON.stringify(e.response?.data?.error || e.response?.data) || e.message;
    _scoreHealth.lastAttemptAt = new Date().toISOString();
    _scoreHealth.failureCount++;
    _scoreHealth.lastError = `[${status || "no-status"}] ${e.response?.data?.error?.message || e.message}`;
    console.error(`Score error for "${job.title}" [${status || "no-status"}]: ${apiErr}`);
    return null;
  }
}

// ─── Location filter (two-stage) ──────────────────────────────────────────────
// Stage 1 rejects anything that names a non-California place, regardless of
// what else the string says. Stage 2 then requires a positive California
// signal, or a bare country-wide "Remote" with no location qualifier.

// Full names of the other 49 US states (plus DC)
const NON_CA_STATE_NAMES = /\b(Alabama|Alaska|Arizona|Arkansas|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|District of Columbia)\b/i;
// State abbreviations only when comma-prefixed ("Nashville, TN") so that
// standalone "LA" (Los Angeles), "OR"/"IN"/"HI" as words, etc. don't false-hit
const NON_CA_STATE_ABBRS = /,\s*(AL|AK|AZ|AR|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/;
const NON_US_PLACES = /\b(UK|United Kingdom|England|Scotland|Wales|Ireland|EU|Europe|London|Italy|France|Germany|Spain|Portugal|Netherlands|Belgium|Austria|Switzerland|Sweden|Norway|Denmark|Finland|Poland|Czechia|Czech Republic|Hungary|Romania|Greece|Malaysia|Philippines|Singapore|Indonesia|Thailand|Vietnam|India|China|Japan|Korea|Taiwan|Hong Kong|Australia|New Zealand|Brazil|Mexico|Argentina|Chile|Colombia|Peru|Canada|South Africa|Nigeria|Egypt|Israel|Turkey|UAE|Dubai|Saudi Arabia)\b/i;
// Canadian "City, XX, CA" (province, country) false positives
const CANADA_PATTERN = /,\s*(?:ON|BC|AB|QC|MB|SK|NS|NB|NL|PE|YT|NT|NU),\s*CA\b/i;

// Positive California signal
const CA_PATTERN = /\bCA\b|California|Los Angeles|San Francisco|San Diego|Sacramento|Oakland|San Jose|Burbank|Hollywood|Santa Monica|Culver City|Beverly Hills|Calabasas|Irvine|Pasadena|Glendale/i;
// Country-wide remote with no narrower qualifier: "Remote", "Remote, Remote",
// "Remote - US", "United States", "Remote - United States"
const BARE_REMOTE_PATTERN = /^\s*(remote([\s,\/–—-]+(remote|us|usa|u\.s\.a?\.?|united states))?|(us|usa|united states)([\s,\/–—-]+remote)?)\s*$/i;

// TODO: set to false (or delete the sampling) once the filter rules have been
// verified against real scrapes — kept on for the first few deploys.
const LOG_REJECTED_LOCATIONS = true;

function filterByLocation(jobs) {
  const kept = [];
  const rejected = [];
  for (const j of jobs) {
    const loc = j.location || "";
    const stage1Reject =
      !loc ||
      NON_CA_STATE_NAMES.test(loc) ||
      NON_CA_STATE_ABBRS.test(loc) ||
      NON_US_PLACES.test(loc) ||
      CANADA_PATTERN.test(loc);
    const stage2Accept = CA_PATTERN.test(loc) || BARE_REMOTE_PATTERN.test(loc);
    if (!stage1Reject && stage2Accept) kept.push(j);
    else rejected.push(j);
  }
  return { kept, rejected };
}

// ─── Run All Scrapers ─────────────────────────────────────────────────────────
// Lock auto-releases after this long, so a hung/crashed scrape can't block
// future runs forever (the stuck-lock bug that froze the tracker).
const SCRAPE_LOCK_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
let _scrapeStartedAt = null;

async function scrapeAllJobs() {
  if (_scrapeStartedAt) {
    const heldMs = Date.now() - _scrapeStartedAt;
    if (heldMs < SCRAPE_LOCK_TIMEOUT_MS) {
      console.log(`⏳ Scrape already in progress (started ${Math.round(heldMs / 1000)}s ago), skipping...`);
      return loadCache();
    }
    console.warn(`⚠️ Stale scrape lock held for ${Math.round(heldMs / 60000)}m — auto-releasing and continuing.`);
  }
  _scrapeStartedAt = Date.now();
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

    // Title pre-filter: drop hourly venue/crew roles (bulk of Live Nation's
    // feed) and sub-manager titles before location filtering and scoring.
    // Excluded jobs are not stored at all.
    const venueCrewPattern = /\b(security|bartender|barback|server|cook|chef|usher|ticket (taker|seller|agent)|stagehand|stage hand|janitorial|porter|cleaning|custodial|parking|dispatcher|merch(andise)? (staff|seller|cashier)|concessions|seasonal|intern(ship)?|runner|loader|maintenance|box office|guest services|hospitality|catering|food (runner|and beverage|& beverage))\b/i;
    const juniorTitlePattern = /^\s*(coordinator|assistant|analyst|specialist|associate)\b/i;
    const titleKept = realJobs.filter(
      (j) => !venueCrewPattern.test(j.title) && !juniorTitlePattern.test(j.title)
    );
    console.log(`Title filter: ${realJobs.length - titleKept.length} excluded, ${titleKept.length} remaining`);

    // Two-stage location filter: reject anything naming a non-CA place, then
    // require a positive CA signal or a bare country-wide Remote
    const { kept: caJobs, rejected: locRejected } = filterByLocation(titleKept);
    console.log(`📍 Location filter: ${caJobs.length}/${titleKept.length} jobs kept`);
    if (LOG_REJECTED_LOCATIONS && locRejected.length) {
      const sample = locRejected.slice(0, 10).map((j) => JSON.stringify(j.location || ""));
      console.log(`📍 Rejected location samples (${locRejected.length} total): ${sample.join(", ")}`);
    }

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
    if (toScore.length > 0 && !process.env.ANTHROPIC_API_KEY) {
      console.warn(`⚠️ ${toScore.length} new jobs need scoring but ANTHROPIC_API_KEY is not set — leaving them unscored.`);
    }
    if (toScore.length > 0 && process.env.ANTHROPIC_API_KEY) {
      console.log(`📝 Fetching JDs for ${toScore.length} new jobs...`);
      for (const job of toScore) {
        job.description = await fetchJobDescription(job.url);
        await new Promise(r => setTimeout(r, 300));
      }
      const withJD = toScore.filter(j => j.description).length;
      console.log(`📄 JDs fetched: ${withJD}/${toScore.length} had extractable descriptions`);

      resetScoreHealthRun();
      console.log(`🤖 Scoring ${toScore.length} new jobs with ${SCORING_MODEL}...`);
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
    _scrapeStartedAt = null;
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

// Clear cache (forces full rescore on next scrape)
app.post("/api/clear-cache", (req, res) => {
  try {
    if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE);
    res.json({ success: true, message: "Cache cleared." });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Manually release a stuck scrape lock (without redeploying)
app.post("/api/clear-lock", (req, res) => {
  const wasHeld = _scrapeStartedAt !== null;
  const heldMs = wasHeld ? Date.now() - _scrapeStartedAt : 0;
  _scrapeStartedAt = null;
  console.log(`🔓 Scrape lock cleared via /api/clear-lock (was ${wasHeld ? `held ${Math.round(heldMs / 1000)}s` : "not held"})`);
  res.json({ success: true, wasHeld, heldSeconds: Math.round(heldMs / 1000) });
});

// Debug: inspect raw UMG jobs before CA filter
app.get("/api/debug-umg", async (req, res) => {
  try {
    const raw = await scrapeUMG();
    const marketing = raw.filter(j => /market|catalog|artist|promo|brand/i.test(j.title));
    res.json({
      total: raw.length,
      marketingCount: marketing.length,
      marketingJobs: marketing.map(j => ({ title: j.title, location: j.location })),
      allJobs: raw.map(j => ({ title: j.title, location: j.location })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Health check
app.get("/api/health", (req, res) => {
  const cache = loadCache();
  res.json({
    status: "ok",
    cachedJobs: cache.jobs.length,
    scoredJobs: cache.jobs.filter(j => j.result).length,
    lastUpdated: cache.lastUpdated,
  });
});

// Scoring pipeline health: last attempt, success/failure counts for the most
// recent run, and the last error seen
app.get("/api/score-health", (req, res) => {
  const cache = loadCache();
  res.json({
    model: SCORING_MODEL,
    lastAttemptAt: _scoreHealth.lastAttemptAt,
    successCount: _scoreHealth.successCount,
    failureCount: _scoreHealth.failureCount,
    lastError: _scoreHealth.lastError,
    unscoredJobs: cache.jobs.filter(j => !j.result).length,
  });
});

// Re-score only jobs with result: null — avoids a full re-scrape when scoring
// was broken but the scrape data is fine. Runs async; poll /api/score-health.
app.post("/api/rescore", (req, res) => {
  if (_scrapeStartedAt) {
    return res.status(409).json({ error: "A scrape/rescore is already in progress." });
  }
  const cache = loadCache();
  const toScore = cache.jobs.filter(j => !j.result);
  if (toScore.length === 0) {
    return res.json({ started: false, message: "All jobs already scored." });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set — cannot score." });
  }
  res.json({ started: true, toScore: toScore.length, model: SCORING_MODEL });
  // Run in background under the scrape lock so a cron scrape can't collide
  _scrapeStartedAt = Date.now();
  (async () => {
    try {
      resetScoreHealthRun();
      console.log(`🔁 Rescore: ${toScore.length} unscored jobs with ${SCORING_MODEL}...`);
      for (const job of toScore) {
        if (!job.description) {
          job.description = await fetchJobDescription(job.url);
          await new Promise(r => setTimeout(r, 300));
        }
      }
      for (let i = 0; i < toScore.length; i += 3) {
        const batch = toScore.slice(i, i + 3);
        const results = await Promise.all(batch.map(j => scoreJob(j)));
        for (let k = 0; k < batch.length; k++) batch[k].result = results[k];
        if ((i / 3) % 10 === 0) console.log(`  Rescored ${Math.min(i + 3, toScore.length)}/${toScore.length}`);
      }
      // toScore entries reference the same objects as cache.jobs, so saving
      // the cache persists the new results
      cache.lastUpdated = new Date().toISOString();
      saveCache(cache);
      console.log(`🔁 Rescore done: ${_scoreHealth.successCount} scored, ${_scoreHealth.failureCount} failed`);
    } catch (e) {
      console.error("Rescore error:", e.message);
    } finally {
      _scrapeStartedAt = null;
    }
  })();
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
  console.log(`🤖 Scoring model: ${SCORING_MODEL}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("🚨 ANTHROPIC_API_KEY IS NOT SET — jobs will be scraped but NEVER scored. Set it in Railway variables.");
  } else {
    // Probe the key + model once so auth/model problems are visible at boot
    axios.post("https://api.anthropic.com/v1/messages", {
      model: SCORING_MODEL, max_tokens: 1, messages: [{ role: "user", content: "ping" }],
    }, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      timeout: 15000,
    }).then(() => {
      console.log(`✅ Anthropic API key + model "${SCORING_MODEL}" verified`);
    }).catch((e) => {
      const status = e.response?.status;
      const msg = e.response?.data?.error?.message || e.message;
      if (status === 401 || status === 403) {
        console.error(`🚨 ANTHROPIC_API_KEY IS INVALID [${status}]: ${msg} — scoring will fail until the key is fixed.`);
      } else {
        console.error(`🚨 Scoring probe failed [${status || "no-status"}]: ${msg}`);
      }
    });
  }
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
