# Music Job Tracker

Scrapes music-industry job boards every 6 hours, scores each role against a
candidate profile with the Anthropic API, tracks application pipeline status,
and emails a digest of new strong matches. React/Vite frontend, Express
backend, deployed on Railway.

## Deployment (Railway)

**A persistent volume is required.** The job cache (`jobs_cache.json`) holds
scores, pipeline statuses and notes. Without a volume it lives on the
container filesystem and **every deploy wipes it** back to the seeded
entries. Mount a Railway volume at `/data` and set `DATA_DIR=/data`.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | yes | Job scoring (`/v1/messages`) |
| `DATA_DIR` | yes in prod | Directory for `jobs_cache.json`; point at the mounted volume (`/data`) |
| `RESEND_API_KEY` | for digest | Resend HTTP API key (Railway blocks SMTP) |
| `DIGEST_TO` | for digest | Recipient address |
| `DIGEST_FROM` | no | Sender; defaults to `Job Tracker <onboarding@resend.dev>` until a domain is verified in Resend |
| `SCORING_MODEL` | no | Override the scoring model |
| `SCRAPER_DEBUG` | no | `0` silences per-scrape element dumps |

### Useful endpoints

- `GET /api/health` — cache size, scored count, source count
- `GET /api/score-health` — last scoring run, failures, last error
- `POST /api/scrape` — force a scrape
- `POST /api/rescore` — score only unscored jobs (async)
- `POST /api/digest/test` — send the digest now, ignoring recency
- `POST /api/clear-lock` — release a stuck scrape lock
- `PATCH /api/jobs/:id` — update `status` / `statusDate` / `notes`

## Local development

```bash
npm install
npm run dev        # vite frontend + node server (see package.json)
```
