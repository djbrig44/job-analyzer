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
  { id: "mbw", name: "MBW Jobs", url: "https://www.musicbusinessworldwide.com/jobs/listings/", color: "#E63946" },
  { id: "rostr", name: "ROSTR", url: "https://jobs.rostr.cc/", color: "#2EC4B6" },
  { id: "doorsopen", name: "Doors Open", url: "https://www.doorsopen.co/jobs/", color: "#FF9F1C" },
  { id: "dmn", name: "Digital Music News", url: "https://www.digitalmusicnews.com/jobs/", color: "#8338EC" },
  { id: "a2im", name: "A2IM", url: "https://members.a2im.org/job-board", color: "#06D6A0" },
  { id: "umg", name: "UMG Careers", url: "https://www.umusiccareers.com/", color: "#3A86FF" },
  { id: "wmg", name: "Warner Music", url: "https://wmg.wd1.myworkdayjobs.com/WMGUS/jobs", color: "#FB5607" },
  { id: "sony", name: "Sony Music", url: "https://careers.sonymusic.com/", color: "#FFBE0B" },
  { id: "digilogue", name: "The Digilogue", url: "https://www.thedigilogue.com/career-listings", color: "#FF006E" },
  { id: "spotify", name: "Spotify", url: "https://www.lifeatspotify.com/jobs", color: "#1DB954" },
  { id: "apple", name: "Apple Music", url: "https://jobs.apple.com/en-us/search?product=apple-music-APPMU", color: "#A8A9AD" },
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
- 85-100 = Excellent Match (Strong Pursue)
- 70-84 = Good Match (Pursue)
- 50-69 = Partial Match (Consider)
- Below 50 = Weak Match (Skip)

Focus ONLY on marketing-focused music industry roles. Penalize heavily for:
- Non-marketing roles (engineering, A&R only, finance, legal)
- Non-music industries
- Entry-level roles (< 3 years experience required)

Respond ONLY with valid JSON, no markdown, no explanation:
{
  "score": number,
  "tier": "Excellent Match" | "Good Match" | "Partial Match" | "Weak Match",
  "matchedSkills": ["skill1", "skill2"],
  "gaps": ["gap1", "gap2"],
  "headline": "one sentence summary of fit",
  "recommend": true | false
}`;

function ScoreRing({ score }) {
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const filled = (score / 100) * circ;
  const color = score >= 85 ? "#00FF87" : score >= 70 ? "#2EC4B6" : score >= 50 ? "#FF9F1C" : "#E63946";
  return (
    <div style={{ position: "relative", width: 70, height: 70, flexShrink: 0 }}>
      <svg width="70" height="70" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="35" cy="35" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <circle cx="35" cy="35" r={radius} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'DM Mono', monospace", fontSize: 15, fontWeight: 700, color }}>
        {score}
      </div>
    </div>
  );
}

function JobCard({ job, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  const tierColors = {
    "Excellent Match": "#00FF87", "Good Match": "#2EC4B6",
    "Partial Match": "#FF9F1C", "Weak Match": "#E63946"
  };
  const source = SOURCES.find(s => s.id === job.source);

  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12, padding: "18px 20px", marginBottom: 12,
      transition: "border-color 0.2s", cursor: "pointer",
      borderLeft: `3px solid ${job.result ? tierColors[job.result.tier] : "rgba(255,255,255,0.1)"}`,
    }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {job.result ? <ScoreRing score={job.result.score} /> :
          <div style={{ width: 70, height: 70, borderRadius: "50%", border: "2px dashed rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <div style={{ width: 20, height: 20, border: "2px solid rgba(255,255,255,0.3)",
              borderTopColor: "#00FF87", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, padding: "2px 8px",
              borderRadius: 4, background: source ? source.color + "22" : "rgba(255,255,255,0.1)",
              color: source?.color || "rgba(255,255,255,0.5)", border: `1px solid ${source?.color || "rgba(255,255,255,0.1)"}44` }}>
              {source?.name || job.source}
            </span>
            {job.result && (
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, padding: "2px 8px",
                borderRadius: 4, color: tierColors[job.result.tier],
                background: tierColors[job.result.tier] + "18",
                border: `1px solid ${tierColors[job.result.tier]}33` }}>
                {job.result.tier}
              </span>
            )}
          </div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 600,
            color: "rgba(255,255,255,0.92)", marginBottom: 3, lineHeight: 1.3 }}>
            {job.title}
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
            {job.company} {job.location ? `· ${job.location}` : ""}
          </div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onRemove(job.id); }}
          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)",
            cursor: "pointer", fontSize: 18, padding: 4, lineHeight: 1, flexShrink: 0 }}>×</button>
      </div>

      {expanded && job.result && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.6)",
            marginBottom: 14, lineHeight: 1.6 }}>{job.result.headline}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#00FF87",
                marginBottom: 6, letterSpacing: "0.08em" }}>✓ MATCHED SKILLS</div>
              {job.result.matchedSkills?.map(s => (
                <div key={s} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12,
                  color: "rgba(255,255,255,0.55)", padding: "2px 0" }}>· {s}</div>
              ))}
            </div>
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#FF9F1C",
                marginBottom: 6, letterSpacing: "0.08em" }}>⚠ GAPS</div>
              {job.result.gaps?.length ? job.result.gaps.map(g => (
                <div key={g} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12,
                  color: "rgba(255,255,255,0.55)", padding: "2px 0" }}>· {g}</div>
              )) : <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12,
                color: "rgba(255,255,255,0.35)" }}>None identified</div>}
            </div>
          </div>
          {job.url && (
            <a href={job.url} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ display: "inline-block", marginTop: 14, fontFamily: "'DM Mono', monospace",
                fontSize: 11, color: "#2EC4B6", textDecoration: "none", padding: "6px 14px",
                border: "1px solid #2EC4B633", borderRadius: 6, background: "#2EC4B611" }}>
              View Posting →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [form, setForm] = useState({ title: "", company: "", location: "", source: "mbw", url: "", description: "" });
  const [analyzing, setAnalyzing] = useState(false);
  const [tab, setTab] = useState("tracker");
  const [apiError, setApiError] = useState("");

  const stats = {
    total: jobs.length,
    excellent: jobs.filter(j => j.result?.tier === "Excellent Match").length,
    good: jobs.filter(j => j.result?.tier === "Good Match").length,
    avgScore: jobs.filter(j => j.result).length
      ? Math.round(jobs.filter(j => j.result).reduce((a, b) => a + b.result.score, 0) / jobs.filter(j => j.result).length)
      : 0
  };

  const analyzeJob = useCallback(async (jobData) => {
    const prompt = `Analyze this job posting for fit with the candidate profile:

TITLE: ${jobData.title}
COMPANY: ${jobData.company}
LOCATION: ${jobData.location || "Not specified"}
SOURCE: ${jobData.source}
DESCRIPTION: ${jobData.description || "No description provided — score based on title and company only."}

Return ONLY the JSON object as specified.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "{}";
      const clean = text.replace(/```json|```/g, "").trim();
      return JSON.parse(clean);
    } catch (e) {
      return { score: 0, tier: "Weak Match", matchedSkills: [], gaps: ["Analysis failed"], headline: "Could not analyze posting.", recommend: false };
    }
  }, []);

  const handleSubmit = async () => {
    if (!form.title || !form.company) return;
    setApiError("");
    const newJob = { ...form, id: Date.now(), addedAt: new Date().toISOString(), result: null };
    setJobs(prev => [newJob, ...prev]);
    setForm({ title: "", company: "", location: "", source: "mbw", url: "", description: "" });
    setAnalyzing(true);
    const result = await analyzeJob(newJob);
    setJobs(prev => prev.map(j => j.id === newJob.id ? { ...j, result } : j));
    setAnalyzing(false);
  };

  const removeJob = (id) => setJobs(prev => prev.filter(j => j.id !== id));

  const sorted = [...jobs].sort((a, b) => (b.result?.score || 0) - (a.result?.score || 0));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080C10; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        textarea { resize: vertical; }
        input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#080C10", color: "white", fontFamily: "'DM Sans', sans-serif" }}>
        {/* Header */}
        <div style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "20px 28px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00FF87",
                  boxShadow: "0 0 8px #00FF87" }} />
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em" }}>
                  MUSIC JOB TRACKER
                </span>
              </div>
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800,
                background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.6) 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Brian Gaffey · AI Job Match Analyzer
              </h1>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {["tracker", "sources"].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.08em",
                  padding: "8px 16px", borderRadius: 8, cursor: "pointer", transition: "all 0.2s",
                  background: tab === t ? "rgba(0,255,135,0.12)" : "transparent",
                  border: `1px solid ${tab === t ? "#00FF8744" : "rgba(255,255,255,0.1)"}`,
                  color: tab === t ? "#00FF87" : "rgba(255,255,255,0.5)"
                }}>{t.toUpperCase()}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 28px" }}>

          {tab === "tracker" && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
                {[
                  { label: "TOTAL", value: stats.total, color: "rgba(255,255,255,0.7)" },
                  { label: "EXCELLENT", value: stats.excellent, color: "#00FF87" },
                  { label: "GOOD MATCH", value: stats.good, color: "#2EC4B6" },
                  { label: "AVG SCORE", value: stats.avgScore || "—", color: "#FF9F1C" },
                ].map(s => (
                  <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.35)",
                      letterSpacing: "0.1em", marginBottom: 6 }}>{s.label}</div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Add Job Form */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14, padding: "22px 24px", marginBottom: 28 }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700,
                  color: "rgba(255,255,255,0.7)", marginBottom: 16, letterSpacing: "0.03em" }}>
                  + ADD JOB POSTING
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  {[
                    { key: "title", placeholder: "Job Title *", type: "input" },
                    { key: "company", placeholder: "Company *", type: "input" },
                    { key: "location", placeholder: "Location", type: "input" },
                    { key: "url", placeholder: "Job URL (optional)", type: "input" },
                  ].map(f => (
                    <input key={f.key} value={form[f.key]} placeholder={f.placeholder}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8, padding: "10px 14px", color: "white", fontSize: 13,
                        fontFamily: "'DM Sans', sans-serif", outline: "none", width: "100%" }} />
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 10, marginBottom: 14 }}>
                  <select value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}
                    style={{ background: "#0F1419", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8, padding: "10px 14px", color: "rgba(255,255,255,0.7)",
                      fontSize: 13, fontFamily: "'DM Mono', monospace", outline: "none" }}>
                    {SOURCES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    <option value="other">Other</option>
                  </select>
                  <textarea value={form.description} placeholder="Paste job description here for best matching accuracy (optional but recommended)"
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    rows={3}
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8, padding: "10px 14px", color: "white", fontSize: 13,
                      fontFamily: "'DM Sans', sans-serif", outline: "none", width: "100%" }} />
                </div>
                {apiError && <div style={{ color: "#E63946", fontSize: 12, fontFamily: "'DM Mono', monospace", marginBottom: 10 }}>{apiError}</div>}
                <button onClick={handleSubmit} disabled={!form.title || !form.company || analyzing}
                  style={{ background: form.title && form.company ? "linear-gradient(135deg, #00FF87 0%, #2EC4B6 100%)" : "rgba(255,255,255,0.08)",
                    border: "none", borderRadius: 8, padding: "11px 24px", cursor: form.title && form.company ? "pointer" : "not-allowed",
                    fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700,
                    color: form.title && form.company ? "#080C10" : "rgba(255,255,255,0.3)",
                    transition: "all 0.2s" }}>
                  {analyzing ? "Analyzing..." : "Analyze Match →"}
                </button>
              </div>

              {/* Job List */}
              {sorted.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.2)" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🎵</div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16 }}>No jobs tracked yet</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, marginTop: 6 }}>
                    Add a posting above to get your AI match score
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.3)",
                    letterSpacing: "0.1em", marginBottom: 14 }}>
                    {sorted.length} JOB{sorted.length !== 1 ? "S" : ""} · SORTED BY MATCH SCORE
                  </div>
                  {sorted.map(job => <JobCard key={job.id} job={job} onRemove={removeJob} />)}
                </div>
              )}
            </div>
          )}

          {tab === "sources" && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700,
                marginBottom: 6, color: "rgba(255,255,255,0.85)" }}>Job Board Sources</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)",
                marginBottom: 24 }}>Your tracked music industry job boards and their access status</div>
              {SOURCES.map(s => {
                const statusMap = {
                  mbw: { status: "✓ Scrapable", note: "Publicly accessible, WordPress-based. Also offers weekly email newsletter.", ok: true },
                  rostr: { status: "✓ Scrapable", note: "Built on Niceboard. Publicly accessible, no login required.", ok: true },
                  doorsopen: { status: "✓ Scrapable + Alerts", note: "Has native Job Alerts feature. Publicly accessible listings.", ok: true },
                  dmn: { status: "⚠ Blocked", note: "Returns 403 errors — actively blocks automated access. Check manually.", ok: false },
                  a2im: { status: "⚠ Login Required", note: "Members-only job board. Requires A2IM membership credentials to access.", ok: false },
                  umg: { status: "✓ Scrapable", note: "Filterable by category & location. Use 'Marketing, Streaming & Digital Media' + Los Angeles for best results.", ok: true },
                  wmg: { status: "⚠ JS-Rendered", note: "Workday platform — JavaScript-rendered, blocks standard scraping. Browse manually and paste listings here.", ok: false },
                  sony: { status: "⚠ Blocked", note: "Actively blocks automated access at the site level. Check manually and paste strong listings into the tracker.", ok: false },
                  digilogue: { status: "✓ Scrapable", note: "Webflow-based, publicly accessible. Curated music industry listings filterable by level (Entry/Mid/Senior).", ok: true },
                  spotify: { status: "⚠ JS-Rendered", note: "Next.js app — content loads dynamically. Browse manually at lifeatspotify.com and paste marketing roles here.", ok: false },
                  apple: { status: "⚠ JS-Rendered", note: "Apple Careers requires JavaScript. URL is pre-filtered to Apple Music roles — bookmark and check manually.", ok: false },
                };
                const info = statusMap[s.id];
                return (
                  <div key={s.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                    borderLeft: `3px solid ${s.color}`, borderRadius: 12, padding: "18px 20px", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700, color: s.color }}>{s.name}</div>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, padding: "3px 10px", borderRadius: 6,
                        background: info.ok ? "#00FF8718" : "#E6394618",
                        color: info.ok ? "#00FF87" : "#E63946",
                        border: `1px solid ${info.ok ? "#00FF8733" : "#E6394633"}` }}>{info.status}</span>
                    </div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)",
                      marginBottom: 10 }}>{info.note}</div>
                    <a href={s.url} target="_blank" rel="noopener noreferrer"
                      style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.3)",
                        textDecoration: "none" }}>{s.url}</a>
                  </div>
                );
              })}
              <div style={{ marginTop: 24, background: "rgba(0,255,135,0.05)", border: "1px solid rgba(0,255,135,0.15)",
                borderRadius: 12, padding: "18px 20px" }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: "#00FF87", marginBottom: 8 }}>
                  💡 Pro Tip
                </div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>
                  For best results, paste the full job description when adding a posting. The AI will match against your specific skills in streaming analytics, label marketing, artist development, and campaign strategy — giving you a precise score rather than a title-only estimate.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
