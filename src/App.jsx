import { useState, useEffect, useCallback } from "react";

const BRIAN_PROFILE = {
  name: "Brian Gaffey",
  title: "Music Industry Executive | Data-Driven Marketing & Artist Growth Strategy",
  coreSkills: [
    "artist development", "brand positioning", "marketing analytics", "streaming strategy",
    "algorithm strategy", "ai strategy", "campaign strategy", "influencer partnerships",
    "cultural partnerships", "radio promotion", "budget leadership", "performance optimization",
    "playlist strategy", "tiktok", "instagram", "chartmetric", "luminate", "mediabase",
    "spotify", "youtube analytics", "meta ads", "predictive modeling", "business intelligence",
    "data analytics", "kpi", "label marketing", "promotional strategy", "a&r adjacent",
    "sync licensing", "distribution strategy", "roster management", "executive reporting",
    "stakeholder alignment", "cross-platform marketing", "release strategy", "tour marketing",
    "audience growth", "chart performance", "grammy", "interscope", "def jam", "independent"
  ],
  titles: [
    "marketing director", "marketing manager", "vp marketing", "director of marketing",
    "promotions director", "brand director", "growth director", "head of marketing",
    "artist marketing", "label marketing", "digital marketing", "music marketing",
    "marketing strategy", "campaign director", "managing director"
  ],
  experience: 15,
  education: "MBA Marketing Analytics & AI Strategy (UC Davis 2026)",
  location: "Los Angeles, CA"
};

const SOURCES = [
  { id: "mbw",       name: "MBW Jobs",          url: "https://www.musicbusinessworldwide.com/jobs/listings/", color: "#E63946" },
  { id: "rostr",     name: "ROSTR",              url: "https://jobs.rostr.cc/",                                color: "#2EC4B6" },
  { id: "doorsopen", name: "Doors Open",         url: "https://www.doorsopen.co/jobs/",                        color: "#FF9F1C" },
  { id: "dmn",       name: "Digital Music News", url: "https://www.digitalmusicnews.com/jobs/",                color: "#8338EC" },
  { id: "a2im",      name: "A2IM",               url: "https://members.a2im.org/job-board",                    color: "#06D6A0" },
  { id: "umg",       name: "UMG Careers",        url: "https://umusic.wd5.myworkdayjobs.com/en-US/UMGUS",      color: "#3A86FF" },
  { id: "wmg",       name: "Warner Music",       url: "https://wmg.wd1.myworkdayjobs.com/WMGUS/jobs",          color: "#FB5607" },
  { id: "sony",      name: "Sony Music",         url: "https://job-boards.greenhouse.io/sonymusicentertainment", color: "#FFBE0B" },
  { id: "digilogue", name: "The Digilogue",      url: "https://www.thedigilogue.com/career-listings",          color: "#FF006E" },
  { id: "concord",   name: "Concord",            url: "https://careers-concord.icims.com/jobs/search",          color: "#9B5DE5" },
  { id: "bmg",       name: "BMG Careers",        url: "https://www.bmg.com/us/careers/",                       color: "#F15BB5" },
  { id: "livenation",name: "Live Nation",         url: "https://livenation.wd503.myworkdayjobs.com/en-US/LNExternalSite", color: "#FEE440" },
  { id: "spotify",   name: "Spotify",            url: "https://www.lifeatspotify.com/jobs",                    color: "#1DB954" },
  { id: "apple",     name: "Apple Music",        url: "https://jobs.apple.com/en-us/search?product=apple-music-APPMU", color: "#A8A9AD" },
  { id: "suno",      name: "Suno",               url: "https://suno.com/careers",                              color: "#FF5CAA" },
  { id: "hybe",      name: "HYBE America",       url: "https://hybecorp.com/eng/career",                       color: "#7B2CBF" },
  { id: "createmusic", name: "Create Music Group", url: "https://createmusicgroup.com/careers",                color: "#40916C" },
  { id: "audiomack", name: "Audiomack",          url: "https://audiomack.com/about/jobs",                      color: "#FFA62B" },
  { id: "redbull",   name: "Red Bull",           url: "https://jobs.redbull.com/us-en",                        color: "#DB0A40" },
  { id: "elevenlabs", name: "ElevenLabs",        url: "https://elevenlabs.io/careers",                         color: "#5BC0EB" },
  { id: "runway",    name: "Runway",             url: "https://runway.com/careers",                            color: "#9EF01A" },
  { id: "higgsfield", name: "Higgsfield AI",     url: "https://higgsfield.ai",                                 color: "#F72585" },
  { id: "circle",    name: "Circle",             url: "https://circle.so/careers",                             color: "#4CC9F0" },
  { id: "lumaai",    name: "Luma AI",            url: "https://lumalabs.ai/careers",                           color: "#B5179E" },
  { id: "tubi",      name: "Tubi",               url: "https://tubitv.com/careers",                            color: "#FFBA08" },
  { id: "builtinla", name: "Built In LA",        url: "https://www.builtinla.com/jobs/marketing",              color: "#4895EF" },
  { id: "netflix",   name: "Netflix",            url: "https://explore.jobs.netflix.net/careers",              color: "#E50914" },
  { id: "aihumanjobs", name: "AI Human Jobs",    url: "https://aihumanjobs.com/",                              color: "#80ED99" },
  { id: "aijobsai", name: "AIJobs.ai",           url: "https://aijobs.ai/marketing",                           color: "#F4A261" },
  { id: "manual",    name: "Manual",             url: "",                                                      color: "#CDB4DB" },
];

const SYSTEM_PROMPT = `You are a music industry recruiter AI scoring job postings against a candidate profile.

CANDIDATE: ${BRIAN_PROFILE.name}
TITLE: ${BRIAN_PROFILE.title}
EXPERIENCE: ${BRIAN_PROFILE.experience}+ years in music industry
EDUCATION: ${BRIAN_PROFILE.education}
LOCATION: ${BRIAN_PROFILE.location}

CORE SKILLS: ${BRIAN_PROFILE.coreSkills.join(", ")}
TARGET TITLES: ${BRIAN_PROFILE.titles.join(", ")}

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

const DIRECTOR_PLUS = /\b(director|vp|vice president|svp|evp|head of|chief)\b/i;
const TRACKS = [
  { key: "all", label: "All", color: "rgba(255,255,255,0.6)" },
  { key: "label", label: "Label", color: "#FF9F1C" },
  { key: "entertainment-ai", label: "Ent+AI", color: "#4CC9F0" },
];
const trackOf = (job) => (job.track === "entertainment-ai" ? "entertainment-ai" : "label");
const NEW_WINDOW_MS = 24 * 60 * 60 * 1000;

const tierColors = {
  "Excellent Match": "#00FF87",
  "Good Match": "#2EC4B6",
  "Partial Match": "#FF9F1C",
  "Weak Match": "#E63946"
};

function ScoreRing({ score }) {
  const r = 28, circ = 2 * Math.PI * r;
  const color = score >= 85 ? "#00FF87" : score >= 70 ? "#2EC4B6" : score >= 50 ? "#FF9F1C" : "#E63946";
  return (
    <div style={{ position: "relative", width: 70, height: 70, flexShrink: 0 }}>
      <svg width="70" height="70" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="35" cy="35" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <circle cx="35" cy="35" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${(score / 100) * circ} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center",
        justifyContent: "center", fontFamily: "'DM Mono',monospace", fontSize: 15, fontWeight: 700, color }}>
        {score}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ width: 70, height: 70, borderRadius: "50%", border: "2px dashed rgba(255,255,255,0.2)",
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <div style={{ width: 20, height: 20, border: "2px solid rgba(255,255,255,0.3)",
        borderTopColor: "#00FF87", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    </div>
  );
}

const STATUS_OPTIONS = [
  { value: "none", label: "— status —" },
  { value: "saved", label: "Saved" },
  { value: "applied", label: "Applied" },
  { value: "screen", label: "Screen" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "rejected", label: "Rejected" },
  { value: "closed", label: "Closed" },
];
// Active pipeline = anything with a status outside none/closed/rejected
const ACTIVE_STATUSES = ["saved", "applied", "screen", "interview", "offer"];
const statusColors = {
  saved: "#3A86FF", applied: "#00FF87", screen: "#FF9F1C", interview: "#8338EC",
  offer: "#06D6A0", rejected: "#E63946", closed: "#666", dismissed: "#666",
};
const statusLabels = {
  saved: "SAVED", applied: "APPLIED", screen: "SCREEN", interview: "INTERVIEW",
  offer: "OFFER", rejected: "REJECTED", closed: "CLOSED", dismissed: "CLOSED",
};
const todayISO = () => new Date().toISOString().slice(0, 10);

function JobCard({ job, onRemove, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const source = SOURCES.find(s => s.id === job.source);
  return (
    <div onClick={() => setExpanded(!expanded)} style={{
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
      borderLeft: `3px solid ${job.result ? tierColors[job.result.tier] : "rgba(255,255,255,0.1)"}`,
      borderRadius: 12, padding: "18px 20px", marginBottom: 12, cursor: "pointer",
      animation: "fadeIn 0.3s ease"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {job.result ? <ScoreRing score={job.result.score} /> : <Spinner />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, padding: "2px 8px",
              borderRadius: 4, background: source ? source.color + "22" : "rgba(255,255,255,0.1)",
              color: source?.color || "rgba(255,255,255,0.5)", border: `1px solid ${source?.color || "rgba(255,255,255,0.1)"}44` }}>
              {source?.name || job.source}
            </span>
            {job.result && (
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, padding: "2px 8px", borderRadius: 4,
                color: tierColors[job.result.tier], background: tierColors[job.result.tier] + "18",
                border: `1px solid ${tierColors[job.result.tier]}33` }}>
                {job.result.tier}
              </span>
            )}
            {job.status && (
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, padding: "2px 8px", borderRadius: 4,
                color: statusColors[job.status], background: statusColors[job.status] + "18",
                border: `1px solid ${statusColors[job.status]}33` }}>
                {statusLabels[job.status]}
              </span>
            )}
            {!job.status && job.auto && (
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, padding: "2px 8px", borderRadius: 4,
                color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.1)" }}>AUTO</span>
            )}
            {job.firstSeen && Date.now() - new Date(job.firstSeen).getTime() < NEW_WINDOW_MS && (
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, padding: "2px 8px", borderRadius: 4,
                color: "#00FF87", background: "#00FF8722", border: "1px solid #00FF8755" }}>NEW</span>
            )}
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, padding: "2px 8px", borderRadius: 4,
              color: job.track === "entertainment-ai" ? "#4CC9F0" : "#FF9F1C",
              border: `1px solid ${job.track === "entertainment-ai" ? "#4CC9F055" : "#FF9F1C55"}` }}>
              {job.track === "entertainment-ai" ? "ENT+AI" : "LABEL"}
            </span>
          </div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 600,
            color: "rgba(255,255,255,0.92)", marginBottom: 3 }}>{job.title}</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
            {job.company}{job.location ? ` · ${job.location}` : ""}
          </div>
        </div>
        <button onClick={e => { e.stopPropagation(); onRemove(job.id); }}
          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)",
            cursor: "pointer", fontSize: 18, padding: 4, flexShrink: 0 }}>×</button>
      </div>
      {expanded && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {job.result && <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "rgba(255,255,255,0.6)",
            marginBottom: 14, lineHeight: 1.6 }}>{job.result.headline}</p>}
          {job.result && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "#00FF87",
                marginBottom: 6, letterSpacing: "0.08em" }}>MATCHED SKILLS</div>
              {job.result.matchedSkills?.map(s => (
                <div key={s} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12,
                  color: "rgba(255,255,255,0.55)", padding: "2px 0" }}>· {s}</div>
              ))}
            </div>
            <div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "#FF9F1C",
                marginBottom: 6, letterSpacing: "0.08em" }}>GAPS</div>
              {job.result.gaps?.length ? job.result.gaps.map(g => (
                <div key={g} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12,
                  color: "rgba(255,255,255,0.55)", padding: "2px 0" }}>· {g}</div>
              )) : <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans',sans-serif" }}>None identified</div>}
            </div>
          </div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {job.url && (
              <a href={job.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                style={{ display: "inline-block", fontFamily: "'DM Mono',monospace", fontSize: 11,
                  color: "#2EC4B6", textDecoration: "none", padding: "6px 14px",
                  border: "1px solid #2EC4B633", borderRadius: 6, background: "#2EC4B611" }}>
                View Posting
              </a>
            )}
            <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)", margin: "0 4px" }} />
            <select value={job.status || "none"}
              onClick={e => e.stopPropagation()}
              onChange={e => { e.stopPropagation(); onUpdate(job.id, { status: e.target.value, statusDate: todayISO() }); }}
              style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, padding: "5px 8px", borderRadius: 6,
                background: "#0F1419", color: job.status ? (statusColors[job.status] || "white") : "rgba(255,255,255,0.5)",
                border: `1px solid ${job.status ? (statusColors[job.status] || "#444") + "66" : "rgba(255,255,255,0.15)"}`, cursor: "pointer" }}>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {job.statusDate && job.status && (
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{job.statusDate.slice(0, 10)}</span>
            )}
            <input key={`${job.id}-notes`} defaultValue={job.notes || ""} placeholder="notes…"
              onClick={e => e.stopPropagation()}
              onBlur={e => { if (e.target.value !== (job.notes || "")) onUpdate(job.id, { notes: e.target.value }); }}
              style={{ flex: 1, minWidth: 140, fontFamily: "'DM Sans',sans-serif", fontSize: 12, padding: "6px 10px",
                borderRadius: 6, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.75)",
                border: "1px solid rgba(255,255,255,0.1)", outline: "none" }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [jobs, setJobs] = useState([]);
  const emptyForm = { title: "", company: "", location: "", url: "", description: "", status: "none", statusDate: todayISO(), notes: "" };
  const [form, setForm] = useState(emptyForm);
  const [tab, setTab] = useState("tracker");
  const [scraping, setScraping] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [filter, setFilter] = useState("all");
  const [trackFilter, setTrackFilter] = useState("all");
  const [health, setHealth] = useState(null);
  const [scoreHealth, setScoreHealth] = useState(null);

  const refreshHealth = useCallback(() => {
    fetch("/api/health").then(r => r.json()).then(setHealth).catch(() => {});
    fetch("/api/score-health").then(r => r.json()).then(setScoreHealth).catch(() => {});
  }, []);

  // Load cached/scored jobs on mount
  useEffect(() => {
    fetch("/api/jobs").then(r => r.json()).then(cache => {
      if (cache.jobs?.length) {
        setJobs(cache.jobs.map(j => ({ ...j, auto: true })));
        setLastUpdated(cache.lastUpdated);
      }
    }).catch(() => {});
    refreshHealth();
  }, [refreshHealth]);

  const visibleJobs = jobs.filter(j => j.status !== "dismissed" && j.status !== "closed");
  const relevantJobs = visibleJobs.filter(j => !j.result || j.result.score >= 25);
  const scoredRelevant = relevantJobs.filter(j => j.result);
  const stats = {
    total: relevantJobs.length,
    excellent: visibleJobs.filter(j => j.result?.tier === "Excellent Match").length,
    good: visibleJobs.filter(j => j.result?.tier === "Good Match").length,
    pipeline: jobs.filter(j => ACTIVE_STATUSES.includes(j.status)).length,
    avgScore: scoredRelevant.length
      ? Math.round(scoredRelevant.reduce((a, b) => a + b.result.score, 0) / scoredRelevant.length)
      : 0
  };

  const analyzeJob = useCallback(async (jobData) => {
    const prompt = `Analyze this job posting:
TITLE: ${jobData.title}
COMPANY: ${jobData.company}
LOCATION: ${jobData.location || "Not specified"}
DESCRIPTION: ${jobData.description || "No description — score based on title and company only."}
Return ONLY the JSON object.`;
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // model is set server-side (SCORING_MODEL) by the /api/analyze proxy
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "{}";
      return JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch (e) {
      return { score: 0, tier: "Weak Match", matchedSkills: [], gaps: ["Analysis failed"], headline: "Could not analyze.", recommend: false };
    }
  }, []);

  const handleManualAdd = async () => {
    if (!form.title || !form.company) return;
    const payload = { ...form };
    setForm(emptyForm);
    // Score like any scraped job when a JD was pasted
    const result = payload.description ? await analyzeJob(payload) : null;
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, result }),
      });
      const data = await res.json();
      if (data.job) {
        setJobs(prev => [{ ...data.job, auto: false }, ...prev]);
      } else {
        setScrapeStatus(`❌ ${data.error || "Could not save entry"}`);
        setTimeout(() => setScrapeStatus(""), 5000);
      }
    } catch (e) {
      setScrapeStatus("❌ Could not save entry — is the server running?");
      setTimeout(() => setScrapeStatus(""), 5000);
    }
  };

  const handleFetchJobs = async () => {
    setScraping(true);
    setScrapeStatus("Scraping job boards & scoring with full JDs...");
    try {
      const res = await fetch("/api/scrape", { method: "POST" });
      const data = await res.json();
      // Reload scored jobs from server cache
      const cacheRes = await fetch("/api/jobs");
      const cache = await cacheRes.json();
      setLastUpdated(cache.lastUpdated);
      setJobs(cache.jobs.map(j => ({ ...j, auto: true })));
      setScrapeStatus(`✅ Done! ${data.count} jobs found, ${data.scored} scored.`);
      refreshHealth();
    } catch (e) {
      setScrapeStatus("❌ Scrape failed — is the server running?");
    }
    setScraping(false);
    setTimeout(() => setScrapeStatus(""), 5000);
  };

  const removeJob = (id) => setJobs(prev => prev.filter(j => j.id !== id));

  const handleUpdate = async (jobId, fields) => {
    const applied = { ...fields };
    if (applied.status === "none") applied.status = null;
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...applied } : j));
    await fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    }).catch(() => {});
  };

  const filtered = [...jobs]
    .filter(j => j.status !== "dismissed" && j.status !== "closed") // hide closed-out entries
    .filter(j => !j.result || j.result.score >= 25) // hide scored jobs below 25
    .filter(j => trackFilter === "all" || trackOf(j) === trackFilter)
    .filter(j => {
      if (filter === "all") return true;
      if (filter === "applied") return j.status === "applied";
      if (filter === "screen") return j.status === "screen";
      if (filter === "interview") return j.status === "interview";
      if (filter === "pipeline") return ACTIVE_STATUSES.includes(j.status);
      if (filter === "director+") return DIRECTOR_PLUS.test(j.title);
      return j.result?.tier === filter;
    })
    .sort((a, b) => (b.result?.score || 0) - (a.result?.score || 0));

  const inputStyle = {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, padding: "10px 14px", color: "white", fontSize: 13,
    fontFamily: "'DM Sans',sans-serif", outline: "none", width: "100%"
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080C10; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.2); }
        textarea { resize: vertical; }
        select option { background: #0F1419; }
      `}</style>
      <div style={{ minHeight: "100vh", background: "#080C10", color: "white", fontFamily: "'DM Sans',sans-serif" }}>

        {/* Header */}
        <div style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "20px 28px" }}>
          <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00FF87", boxShadow: "0 0 8px #00FF87" }} />
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em" }}>MUSIC JOB TRACKER</span>
              </div>
              <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800,
                background: "linear-gradient(135deg,#fff 0%,rgba(255,255,255,0.6) 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Brian Gaffey · AI Job Match Analyzer
              </h1>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {["tracker", "sources"].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: "0.08em",
                  padding: "8px 16px", borderRadius: 8, cursor: "pointer",
                  background: tab === t ? "rgba(0,255,135,0.12)" : "transparent",
                  border: `1px solid ${tab === t ? "#00FF8744" : "rgba(255,255,255,0.1)"}`,
                  color: tab === t ? "#00FF87" : "rgba(255,255,255,0.5)"
                }}>{t.toUpperCase()}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px" }}>

          {tab === "tracker" && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>

              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 24 }}>
                {[
                  { label: "TOTAL", value: stats.total, color: "rgba(255,255,255,0.7)",
                    sub: `${relevantJobs.filter(j => trackOf(j) === "label").length} label · ${relevantJobs.filter(j => trackOf(j) === "entertainment-ai").length} ent-AI`,
                    subColor: "rgba(255,255,255,0.35)" },
                  { label: "EXCELLENT", value: stats.excellent, color: "#00FF87" },
                  { label: "GOOD MATCH", value: stats.good, color: "#2EC4B6" },
                  { label: "PIPELINE", value: stats.pipeline, color: "#00FF87" },
                  { label: "AVG SCORE", value: stats.avgScore || "—", color: "#FF9F1C",
                    sub: health ? `Scored ${health.scoredJobs}/${health.cachedJobs}` : null,
                    subColor: scoreHealth?.failureCount > 0 ? "#E63946" : "rgba(255,255,255,0.35)" },
                ].map(s => (
                  <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", marginBottom: 6 }}>{s.label}</div>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
                    {s.sub && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, marginTop: 4, color: s.subColor }}>{s.sub}</div>}
                  </div>
                ))}
              </div>

              {/* Auto Fetch */}
              <div style={{ background: "rgba(0,255,135,0.04)", border: "1px solid rgba(0,255,135,0.15)", borderRadius: 14, padding: "20px 24px", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: "#00FF87", marginBottom: 4 }}>
                      🎵 Auto-Fetch Live Jobs
                    </div>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
                      Scrapes {health?.sources ?? "all"} sources — scores all matches automatically
                      {lastUpdated && <span style={{ marginLeft: 8, color: "rgba(255,255,255,0.25)" }}>
                        · Last updated {new Date(lastUpdated).toLocaleTimeString()}
                      </span>}
                    </div>
                    {scrapeStatus && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#00FF87", marginTop: 6 }}>{scrapeStatus}</div>}
                  </div>
                  <button onClick={handleFetchJobs} disabled={scraping} style={{
                    background: scraping ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg,#00FF87,#2EC4B6)",
                    border: "none", borderRadius: 8, padding: "12px 24px", cursor: scraping ? "not-allowed" : "pointer",
                    fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
                    color: scraping ? "rgba(255,255,255,0.3)" : "#080C10", whiteSpace: "nowrap"
                  }}>
                    {scraping ? "Fetching..." : "Fetch New Jobs →"}
                  </button>
                </div>
              </div>

              {/* Manual Add */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "20px 24px", marginBottom: 24 }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 14, letterSpacing: "0.05em" }}>
                  + ADD JOB MANUALLY
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <input value={form.title} placeholder="Job Title *" onChange={e => setForm(p => ({ ...p, title: e.target.value }))} style={inputStyle} />
                  <input value={form.company} placeholder="Company *" onChange={e => setForm(p => ({ ...p, company: e.target.value }))} style={inputStyle} />
                  <input value={form.location} placeholder="Location" onChange={e => setForm(p => ({ ...p, location: e.target.value }))} style={inputStyle} />
                  <input value={form.url} placeholder="Job URL (optional)" onChange={e => setForm(p => ({ ...p, url: e.target.value }))} style={inputStyle} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 10, marginBottom: 10 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                      style={{ ...inputStyle, fontFamily: "'DM Mono',monospace", background: "#0F1419" }}>
                      {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <input type="date" value={form.statusDate} onChange={e => setForm(p => ({ ...p, statusDate: e.target.value }))}
                      style={{ ...inputStyle, fontFamily: "'DM Mono',monospace", colorScheme: "dark" }} />
                  </div>
                  <textarea value={form.description} placeholder="Paste job description for best accuracy (optional but recommended)"
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} style={inputStyle} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <input value={form.notes} placeholder="Notes (recruiter, referral, next step…)"
                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={inputStyle} />
                </div>
                <button onClick={handleManualAdd} disabled={!form.title || !form.company} style={{
                  background: form.title && form.company ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${form.title && form.company ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)"}`,
                  borderRadius: 8, padding: "10px 20px", cursor: form.title && form.company ? "pointer" : "not-allowed",
                  fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 600,
                  color: form.title && form.company ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)"
                }}>
                  Analyze Match →
                </button>
              </div>

              {/* Track pills */}
              {jobs.length > 0 && (
                <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>TRACK</span>
                  {TRACKS.map(t => (
                    <button key={t.key} onClick={() => setTrackFilter(t.key)} style={{
                      fontFamily: "'DM Mono',monospace", fontSize: 11, padding: "6px 14px", borderRadius: 20,
                      cursor: "pointer", border: "1px solid",
                      background: trackFilter === t.key ? t.color + "22" : "transparent",
                      borderColor: trackFilter === t.key ? t.color : "rgba(255,255,255,0.1)",
                      color: trackFilter === t.key ? t.color : "rgba(255,255,255,0.4)"
                    }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Filter Bar */}
              {jobs.length > 0 && (
                <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
                  {["all", "Excellent Match", "Good Match", "Partial Match", "Weak Match"].map(f => {
                    const filterColor = tierColors[f] || "rgba(255,255,255,0.12)";
                    return (
                      <button key={f} onClick={() => setFilter(f)} style={{
                        fontFamily: "'DM Mono',monospace", fontSize: 11, padding: "6px 14px", borderRadius: 20,
                        cursor: "pointer", border: "1px solid",
                        background: filter === f ? filterColor + "22" : "transparent",
                        borderColor: filter === f ? (tierColors[f] || "rgba(255,255,255,0.4)") : "rgba(255,255,255,0.1)",
                        color: filter === f ? (tierColors[f] || "rgba(255,255,255,0.9)") : "rgba(255,255,255,0.4)"
                      }}>
                        {f === "all" ? `All (${visibleJobs.filter(j => !j.result || j.result.score >= 25).length})` : f}
                      </button>
                    );
                  })}
                  <button onClick={() => setFilter("director+")} style={{
                    fontFamily: "'DM Mono',monospace", fontSize: 11, padding: "6px 14px", borderRadius: 20,
                    cursor: "pointer", border: "1px solid",
                    background: filter === "director+" ? "#8338EC22" : "transparent",
                    borderColor: filter === "director+" ? "#8338EC" : "rgba(255,255,255,0.1)",
                    color: filter === "director+" ? "#8338EC" : "rgba(255,255,255,0.4)"
                  }}>
                    Director+
                  </button>
                  <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)", margin: "0 4px" }} />
                  {[
                    { key: "pipeline", label: "Pipeline", color: "#06D6A0" },
                    { key: "applied", label: "Applied", color: "#00FF87" },
                    { key: "screen", label: "Screen", color: "#FF9F1C" },
                    { key: "interview", label: "Interview", color: "#8338EC" },
                  ].map(f => (
                    <button key={f.key} onClick={() => setFilter(f.key)} style={{
                      fontFamily: "'DM Mono',monospace", fontSize: 11, padding: "6px 14px", borderRadius: 20,
                      cursor: "pointer", border: "1px solid",
                      background: filter === f.key ? f.color + "22" : "transparent",
                      borderColor: filter === f.key ? f.color : "rgba(255,255,255,0.1)",
                      color: filter === f.key ? f.color : "rgba(255,255,255,0.4)"
                    }}>
                      {f.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Job List */}
              {filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.2)" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🎵</div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16 }}>
                    {jobs.length === 0 ? "No jobs tracked yet" : "No jobs match this filter"}
                  </div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, marginTop: 6 }}>
                    {jobs.length === 0 ? "Hit 'Fetch New Jobs' or add one manually above" : "Try a different filter"}
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", marginBottom: 14 }}>
                    {filtered.length} JOB{filtered.length !== 1 ? "S" : ""} · SORTED BY MATCH SCORE
                  </div>
                  {filtered.map(job => <JobCard key={job.id} job={job} onRemove={removeJob} onUpdate={handleUpdate} />)}
                </div>
              )}
            </div>
          )}

          {tab === "sources" && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 6, color: "rgba(255,255,255,0.85)" }}>Job Board Sources</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 24 }}>
                All {SOURCES.length} tracked music industry job boards and their access status
              </div>
              {SOURCES.map(s => {
                const info = {
                  mbw:       { status: "✓ Auto-Scraped",        note: "WordPress-based, publicly accessible. Scraped automatically every 6 hours.", ok: true },
                  rostr:     { status: "✓ Auto-Scraped",        note: "Niceboard platform. Publicly accessible, no login required.", ok: true },
                  doorsopen: { status: "✓ Auto-Scraped",        note: "Has native Job Alerts too. Scraped automatically every 6 hours.", ok: true },
                  dmn:       { status: "⚠ Blocked",             note: "Returns 403 — actively blocks scraping. Add manually.", ok: false },
                  a2im:      { status: "⚠ Login Required",      note: "Members-only. Requires A2IM membership to access.", ok: false },
                  umg:       { status: "✓ Auto-Scraped",        note: "Workday API — all 131 US jobs paginated, CA filter applied.", ok: true },
                  wmg:       { status: "✓ Auto-Scraped",        note: "Workday API — all 53 US jobs paginated, CA filter applied.", ok: true },
                  sony:      { status: "✓ Auto-Scraped",        note: "Greenhouse API — all 137 jobs, CA filter applied. Big 3 complete.", ok: true },
                  digilogue: { status: "✓ Auto-Scraped",        note: "Webflow-based, curated music industry listings.", ok: true },
                  concord:   { status: "✓ Auto-Scraped",        note: "iCIMS platform, filtered to marketing roles.", ok: true },
                  bmg:       { status: "✓ Auto-Scraped",        note: "Playwright scraper with city-pattern splitter.", ok: true },
                  livenation:{ status: "✓ Auto-Scraped",        note: "Workday API (wd503) — 1,441 jobs paginated, CA filter applied.", ok: true },
                  spotify:   { status: "⚠ Own Platform",        note: "lifeatspotify.com runs its own API with no documented feed. Check manually.", ok: false },
                  apple:     { status: "⚠ JS-Rendered",         note: "Pre-filtered to Apple Music roles. Bookmark and check manually.", ok: false },
                  suno:      { status: "✓ Auto-Scraped",        note: "Ashby API board (jobs.ashbyhq.com/suno).", ok: true },
                  hybe:      { status: "⚠ Own Portal",          note: "HYBE runs its own Offercent portal at careers.hybecorp.com. Check manually.", ok: false },
                  createmusic: { status: "⚠ No Public Board",   note: "No public ATS board found. Check createmusicgroup.com/careers manually.", ok: false },
                  audiomack: { status: "⚠ No Public Board",     note: "No public ATS board; roles appear on Wellfound/aggregators. Check manually.", ok: false },
                  redbull:   { status: "⚠ Own Platform",        note: "jobs.redbull.com is Red Bull's own platform, no documented feed. Check manually.", ok: false },
                  elevenlabs: { status: "✓ Auto-Scraped",       note: "Ashby API board (jobs.ashbyhq.com/elevenlabs). Entertainment-AI lane.", ok: true },
                  runway:    { status: "✓ Auto-Scraped",        note: "Ashby API board (jobs.ashbyhq.com/runway-ml). Entertainment-AI lane.", ok: true },
                  higgsfield: { status: "✓ Auto-Scraped",       note: "Ashby API board (jobs.ashbyhq.com/higgsfieldai). Entertainment-AI lane.", ok: true },
                  circle:    { status: "✓ Auto-Scraped",        note: "Ashby API board (jobs.ashbyhq.com/circle); migrating off Greenhouse circleso.", ok: true },
                  lumaai:    { status: "✓ Auto-Scraped",        note: "Ashby API board (jobs.ashbyhq.com/lumaai). Entertainment-AI lane.", ok: true },
                  tubi:      { status: "✓ Auto-Scraped",        note: "Greenhouse board \"tubitv\" (corporate roles, not just campus).", ok: true },
                  builtinla: { status: "✓ Auto-Scraped",        note: "Aggregator list pages (marketing × entertainment/AI). ATS copies win dedup.", ok: true },
                  netflix:   { status: "⚠ No Public Feed",      note: "Eightfold portal; jobs API needs OAuth. Check explore.jobs.netflix.net manually.", ok: false },
                  aihumanjobs: { status: "✓ Auto-Scraped",      note: "Public JSON of non-engineering roles from ~33 AI companies' ATS boards. Global; filters cut hard.", ok: true },
                  aijobsai:  { status: "✓ Auto-Scraped",        note: "Server-rendered marketing tag, paginated. ATS copies win dedup.", ok: true },
                  manual:    { status: "✎ Manual",              note: "Recruiter and direct-outreach applications entered by hand.", ok: true },
                }[s.id] || { status: "—", note: "", ok: false };
                return (
                  <div key={s.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                    borderLeft: `3px solid ${s.color}`, borderRadius: 12, padding: "18px 20px", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700, color: s.color }}>{s.name}</div>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, padding: "3px 10px", borderRadius: 6,
                        background: info.ok ? "#00FF8718" : "#E6394618",
                        color: info.ok ? "#00FF87" : "#E63946",
                        border: `1px solid ${info.ok ? "#00FF8733" : "#E6394633"}` }}>{info.status}</span>
                    </div>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>{info.note}</div>
                    <a href={s.url} target="_blank" rel="noopener noreferrer"
                      style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "rgba(255,255,255,0.25)", textDecoration: "none" }}>{s.url}</a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
