# The Unit — Handoff Document

## What It Is

The Unit (flyingunit.com) is a cross-platform social intelligence and automated meme response platform. It monitors social media for mentions of a client's brand/property, identifies memes, matches scenes from the client's own video library (via Narralytica), generates response memes in character voices, and queues them for approval and posting.

## Live URLs

- **Production**: https://flyingunit.com
- **API**: https://flyingunit.com/api/health
- **GitHub**: https://github.com/Erstiv/flyingtheunit
- **Hetzner Server**: 178.156.251.26 (SSH alias: `filou`)

## Architecture

```
NGINX (443) -> flyingunit.com
         |
    +----+----+
    |         |
 Frontend  Backend (FastAPI :8015)
 (Next.js    |
  :3025)     +-- Celery Workers (NLP + collection + meme pipeline)
             +-- Celery Beat (scheduled collection every 15m)
             |
        PostgreSQL 16 (:5435)
        + pgvector (embeddings)
        + Apache AGE (graph)
        + Redis (:6380)
```

## Ports

| Service | Port | Notes |
|---------|------|-------|
| Backend (FastAPI) | 8015 | Ports 8000-8012 occupied by other services |
| Frontend (Next.js) | 3025 | |
| PostgreSQL | 5435 | pgvector + Apache AGE extensions |
| Redis | 6380 | Task queue + cache |
| Narralytica API | 8005 | Scene data source (separate project) |

## Docker Containers

```
flyingtheunit-db        PostgreSQL 16 + pgvector + Apache AGE
flyingtheunit-redis     Redis 7 Alpine
flyingtheunit-backend   FastAPI (Python 3.12)
flyingtheunit-worker    Celery worker + beat scheduler
flyingtheunit-frontend  Next.js 15 + React 19
```

All containers set to `restart: unless-stopped`. Backend and worker have `extra_hosts: host.docker.internal:host-gateway` for accessing Narralytica on the host.

## Environment Variables (.env on Hetzner at /opt/flyingtheunit/.env)

```
POSTGRES_USER=flyingtheunit
POSTGRES_PASSWORD=T5vGaKasZQ37du2eoE41AjnvfY09nEB
POSTGRES_DB=flyingtheunit
SECRET_KEY=[generated]
ENVIRONMENT=production
REDDIT_CLIENT_ID=           # Pending Reddit API approval
REDDIT_CLIENT_SECRET=       # Pending Reddit API approval
REDDIT_USER_AGENT=flyingtheunit:v1.0.0 (by /u/dilettare)
YOUTUBE_API_KEY=AIzaSyClq0MgKjU5uELdeSqTM1rpyEFWle9kkWc
BLUESKY_HANDLE=             # Not configured
BLUESKY_APP_PASSWORD=       # Not configured
GEMINI_API_KEY=AIzaSyBP0Bsyg_MywbA0R7z7rYl2LuIsULGnZnk
```

**CRITICAL**: The docker-compose.yml on the server has `NEXT_PUBLIC_API_URL: ""` — this must stay empty for production. If it gets set to `http://localhost:8015`, the frontend will break because the browser can't reach localhost on the server. The frontend uses relative paths through nginx.

## Database Schema

### Core Tables
- **topics** — tracked keywords with platform scopes, collection interval
- **posts** — normalized content from all platforms (unique on platform + platform_id)
- **post_analysis** — NLP results: sentiment_score, sentiment_label, emotions, entities, embedding vector(384)
- **entities** — canonical people/orgs resolved across platforms
- **entity_identities** — platform-specific identities linked to canonical entities
- **topic_posts** — many-to-many with relevance scores
- **volume_snapshots** — hourly aggregated counts per topic per platform
- **alerts** / **alert_events** — alert rules and triggered events

### Meme Engine Tables
- **meme_templates** — 113 templates from Imgflip with perceptual hashes, panel layouts, context history
- **meme_analysis** — per-post meme identification: template name, humor type, target sentiment
- **meme_queue** — generated memes with approval workflow: draft → pending_review → approved → posted / rejected
- **characters** — posting personas with personality prompts, property links
- **character_accounts** — platform credentials per character

### Known Schema Issues
- `platforms` column on topics table was changed from enum to text[] (manual ALTER was run)
- `posts.platform`, `entity_identities.platform`, `volume_snapshots.platform` also changed from enum to text
- `post_analysis.sentiment_label` changed from enum to text
- The ivfflat index on post_analysis.embedding was created with little data — should be rebuilt once more data exists

## Backend Structure

```
backend/app/
  main.py              FastAPI app, CORS, router registration
  worker.py            Celery app with beat schedule
  core/
    config.py          Pydantic settings from env
    database.py        AsyncSession setup
    rate_limiter.py    TokenBucket + CircuitBreaker per adapter
  api/
    topics.py          CRUD + stats + timeline + posts feed
    posts.py           Text search + semantic search
    dashboard.py       Overview stats
    graph.py           Cytoscape.js graph data from topic
    memes.py           Trending memes, templates, generate, queue CRUD
    characters.py      Character CRUD
    simulate.py        Step-by-step pipeline simulation (7 steps)
  models/              SQLAlchemy models (topic, post, entity, alert, volume)
  schemas/             Pydantic response models
  services/
    meme_db.py         Template ingestion, pHash fingerprinting, matching
    scene_bridge.py    Narralytica API client for scene matching
    meme_compositor.py Pillow image compositing (scenes + text → meme)
    meme_generator.py  Imgflip API integration + popular templates
    character_manager.py  Character selection + Gemini text generation
  adapters/
    base.py            AbstractAdapter + RawPost + UserProfile + Connection
    reddit.py          asyncpraw (pending API approval)
    youtube.py         Google YouTube Data API v3
    bluesky.py         AT Protocol public search (currently 403 — needs auth)
    hackernews.py      Algolia search API
    imgur.py           Imgur gallery search
  nlp/
    sentiment.py       VADER sentiment analysis (lazy-loaded singleton)
    ner.py             spaCy en_core_web_sm entity extraction
    embeddings.py      sentence-transformers all-MiniLM-L6-v2 (384-dim)
    meme_analyzer.py   Gemini Vision meme identification
  tasks/
    collect.py         Collection for all topics, store_posts with upsert
    process.py         NLP pipeline: sentiment + NER + embeddings
    snapshot.py        Hourly volume aggregation
    meme.py            Gemini Vision meme analysis on image posts
    meme_pipeline.py   End-to-end: detect → identify → match → generate → queue
```

## Frontend Structure

```
frontend/src/
  app/
    layout.tsx         Sidebar nav, dark theme
    page.tsx           Dashboard: stats, sentiment gauge, volume chart, activity feed
    topics/
      page.tsx         Topic list + create form
      [id]/page.tsx    Topic detail: posts feed with sentiment/platform filters
    memes/page.tsx     Meme Lab: 7-step simulation pipeline
    queue/page.tsx     Meme queue: pending/approved/posted/rejected tabs
    characters/page.tsx Character management: create, list, delete
    graph/page.tsx     Cytoscape.js graph explorer
    search/page.tsx    Text + semantic search
    entities/page.tsx  Placeholder (Phase 2)
    alerts/page.tsx    Placeholder (Phase 3)
    settings/page.tsx  Placeholder
  lib/
    api.ts             Fetch wrappers for all API endpoints
    platform-colors.ts Platform color map + sentiment colors
```

## Celery Beat Schedule

| Task | Schedule | What It Does |
|------|----------|-------------|
| collect_all_topics | Every 15 min | Collects from YouTube, HN, Imgur for all active topics |
| take_volume_snapshots | Every hour | Aggregates post counts + avg sentiment |
| analyze_memes | Every 20 min | Runs Gemini Vision on posts with images |
| meme_response_pipeline | Every 30 min | Full auto: detect → match → generate → queue |

## Adapters Status

| Adapter | Status | Notes |
|---------|--------|-------|
| YouTube | **Working** | API key configured, collecting videos + comments |
| Hacker News | **Working** | Algolia API, no auth needed |
| Imgur | **Partially working** | Sometimes errors on search, no auth |
| Reddit | **Pending** | API application submitted, awaiting approval |
| Bluesky | **Broken** | Public search now returns 403, needs auth tokens |
| Mastodon | **Not built** | Planned for Phase 3 |
| Twitter/X | **Not built** | Requires $100+/mo API, Tier 2 |
| TikTok | **Not built** | Academic-only API, Tier 2 |
| Instagram/Facebook | **Not built** | Locked down, Tier 2 via data providers |

## Current Data

- **311 posts** collected and analyzed (as of 2026-04-03)
- **4 active topics**: The Wayfinders, The Wayfinders (duplicate), Angel Studios, Wingfeather Saga
- **113 meme templates** fingerprinted with perceptual hashes
- **2 characters**: WayfinderNerd (@wayfinder_nerd), CaliborStan (@calibor_stan)
- **72 posts with embeddings** (remaining 239 have sentiment + NER but no embeddings due to memory)
- All posts have sentiment scores and entity extraction

## Narralytica Integration

The Unit queries Narralytica's API at `http://host.docker.internal:8005` for scene matching.

### Available Shows (Narralytica show_id)
- 7: The Wayfinders (6 episodes, all indexed)
- 8: The Wingfeather Saga (6 episodes, all indexed)
- 6: Homestead: The Series (8 episodes)
- 2: Danger 5 (13 episodes)
- 1: The Simpsons (801 episodes, 1 indexed)

### Scene Search
`POST http://host.docker.internal:8005/api/search/` with `{"query": "...", "show_id": 7, "limit": 3}`
Returns scenes ranked by cosine similarity to query embedding (1536-dim text-embedding-004).

### Scene Thumbnails
`GET http://host.docker.internal:8005/api/media/thumbs/scene_{id}.jpg`
**STATUS**: Thumbnail extraction for Wayfinders is in progress (running in separate Narralytica session). Episodes 1-3 done, 4-6 in progress. Once complete, scene images will automatically appear in the Meme Lab.

The Unit proxies thumbnails through `/api/simulate/scene-thumb/{id}` so the frontend can access them.

### Property ID Mapping (scene_bridge.py)
```python
PROPERTY_MAP = {
    "the wayfinders": 1,   # WRONG — should be 7
    "wayfinders": 1,       # WRONG — should be 7
    "wingfeather": 2,      # WRONG — should be 8
    "wingfeather saga": 2, # WRONG — should be 8
    "homestead": 3,        # WRONG — should be 6
}
```
**BUG**: The PROPERTY_MAP in scene_bridge.py has wrong show_ids. The simulate endpoint hardcodes `show_id: 7` which is correct for Wayfinders, but the scene_bridge.py map is wrong. Needs fixing for the automated pipeline.

## Meme Lab Pipeline (simulate.py)

The 7-step simulation at `/api/simulate/run`:

1. **Post Detected** — shows the triggering post with platform + author
2. **Sentiment Analyzed** — VADER compound score + pos/neg/neutral breakdown
3. **Entities Extracted** — spaCy NER: PERSON, ORG, GPE, PRODUCT, etc.
4. **Meme Identified** — Gemini analyzes post, picks response template, provides explanation links (Know Your Meme + meming.world), shows original post context
5. **Scenes Matched** — generates 2 panel queries via Gemini, searches Narralytica for matching scenes, returns 3 options per panel with similarity scores and mood descriptions
6. **Text Options Generated** — 3 variations in different character voices (snarky superfan, wholesome enthusiast, lore nerd) via Gemini
7. **Ready for Approval** — preview with template + text overlay, approve/reject/regenerate buttons

### Preset Test Posts
4 presets available at `/api/simulate/presets`:
- Positive Fan Post (Reddit)
- Negative Criticism (Reddit)
- Meme Post with Drake template (Reddit)
- YouTube Comment (emotional)

## Queue Workflow

`meme_queue.status` lifecycle:
```
draft → pending_review → approved → posted
                       ↘ rejected

approved → unapproved (back to pending_review)
rejected → reconsidered (back to pending_review)
posted → repost (back to approved)
```

API endpoints:
- `POST /api/memes/queue/{id}/approve`
- `POST /api/memes/queue/{id}/unapprove`
- `POST /api/memes/queue/{id}/reject`
- `POST /api/memes/queue/{id}/repost`
- `GET /api/memes/queue?status=pending_review`

## Known Bugs & Issues

1. **Scene thumbnails not rendering** — Narralytica media extraction in progress. Thumbnails show as broken images in Meme Lab Step 5 and meme preview.

2. **PROPERTY_MAP wrong IDs** in `backend/app/services/scene_bridge.py` — Wayfinders is show_id 7, not 1. Wingfeather is 8, not 2. Homestead is 6, not 3. The simulate endpoint hardcodes 7 so it works for Wayfinders demos, but the automated pipeline will use wrong IDs.

3. **Bluesky adapter 403** — Public search API now requires authentication. Needs BLUESKY_HANDLE and BLUESKY_APP_PASSWORD in .env.

4. **Imgur adapter intermittent** — Uses a public demo client ID that may be rate-limited. Should register own client ID at https://api.imgur.com/oauth2/addclient.

5. **Embeddings OOM risk** — sentence-transformers model uses ~500MB. With all services running, Hetzner (8GB) hits OOM. The Arr stack being stopped frees ~2GB. Server upgrade to CPX41 (16GB) was attempted but Ashburn datacenter had no AMD capacity. Try again or use M4 Mac for heavy ML.

6. **Event loop in Celery** — Fixed with `asyncio.new_event_loop()` per keyword, but if more async adapters are added, consider switching to a proper async task runner.

7. **Meme preview is a mockup** — Step 7 shows Drake template with text overlay as CSS, not a real composited image. The gray areas are where scene thumbnails should go. Need to either: (a) wait for Narralytica thumbnails, or (b) use Pillow compositor to generate a real image server-side.

8. **No actual posting** — The "Approve & Queue for Posting" button saves to the queue but nothing posts to any platform yet. Need: Reddit API approval + platform auth integration + Buffer API or direct posting.

9. **Duplicate Wayfinders topic** — Two topics exist with slightly different IDs. Should clean up.

10. **NEXT_PUBLIC_API_URL** — Must be empty string `""` in docker-compose.yml for production. If set to `http://localhost:8015`, frontend breaks. This has been fixed multiple times and keeps getting overwritten.

## Documents Created

- `/docs/The_Unit_Executive_Summary.docx` — 2-page internal exec summary with 3-year financials
- `/docs/The_Unit_Angel_Studios_Pitch.docx` — 2-page sales pitch for Angel Studios Wayfinders S2

## Pricing Model

| Tier | Monthly | Includes |
|------|---------|---------|
| Scout | $2,500 | Monitoring + sentiment, 2 topics, no meme generation |
| Creator | $7,500 | Full pipeline, 5 topics, 3 characters, 100 memes/mo |
| Command | $15,000 | Unlimited everything, dedicated support, X API included |

Setup fee: $5,000-15,000. Additional properties: $3,000 each.

Angel Studios founding client offer: $82,500/yr (3 months at $5k, 9 months at $7.5k, setup waived) in exchange for case study rights.

## Deployment Commands

```bash
# Pull latest and restart (fast — no rebuild)
ssh filou 'cd /opt/flyingtheunit && git pull && docker compose restart flyingtheunit-backend flyingtheunit-worker flyingtheunit-frontend'

# Full rebuild (slow — rebuilds Docker images)
ssh filou 'cd /opt/flyingtheunit && git pull && docker compose up -d --build'

# Full reset (nuclear — destroys and recreates everything, DATA LOSS on DB)
ssh filou 'cd /opt/flyingtheunit && git pull && docker compose down && docker compose up -d'
# WARNING: This wipes the database unless docker-volumes/pgdata persists

# Check container status
ssh filou 'docker ps --format "table {{.Names}}\t{{.Status}}" | grep flying'

# Check backend logs
ssh filou 'docker logs flyingtheunit-backend --tail 30'

# Check worker logs (collection + NLP)
ssh filou 'docker logs flyingtheunit-worker --tail 30'

# Trigger manual collection
ssh filou 'docker exec flyingtheunit-backend python -c "from app.tasks.collect import collect_all_topics; print(collect_all_topics())"'

# Trigger NLP processing
ssh filou 'docker exec flyingtheunit-backend python -c "from app.tasks.process import process_unanalyzed_posts; print(process_unanalyzed_posts())"'

# Check post counts
ssh filou 'docker exec flyingtheunit-db psql -U flyingtheunit -c "SELECT COUNT(*) FROM posts; SELECT COUNT(*) FROM post_analysis;"'

# Ingest meme templates (if DB was reset)
ssh filou 'docker exec flyingtheunit-backend python -c "
import asyncio
from app.services.meme_db import ingest_imgflip_templates
from app.tasks.collect import get_sync_session
async def run():
    session = get_sync_session()
    count = await ingest_imgflip_templates(session, limit=100)
    print(f\"Ingested {count} templates\")
    session.close()
asyncio.run(run())
"'
```

## What Needs to Happen Next (Priority Order)

### Immediate (POC completion)
1. **Narralytica thumbnails** — verify extraction completed, test scene-thumb proxy endpoint
2. **Fix PROPERTY_MAP** in scene_bridge.py with correct show_ids
3. **Build proper meme composite** — Pillow server-side image generation replacing CSS mockup
4. **Lightbox/modal** for full-size meme preview
5. **Visual polish pass** — loading states, error handling, responsive layout

### Short Term (demo-ready)
6. **Reddit API** — check approval status, configure credentials when ready
7. **Register Imgur client ID** — replace demo client ID
8. **Server upgrade** — retry CPX41 at Hetzner (Ashburn may have capacity now)
9. **Before/after comparison** — show original fan meme next to generated response meme side by side
10. **Reporting page** — engagement stats, meme performance, topic trends

### Medium Term (product)
11. **Posting integration** — Reddit API posting, Buffer API for multi-platform
12. **Character account management** — store platform credentials, connect accounts
13. **M4 Mac processing endpoint** — offload embeddings and CLIP model to Mac
14. **CLIP embeddings** for meme template matching (currently pHash only)
15. **Real-time collection** — WebSocket live feed instead of 15-min polling

### Tier 2 Features
16. X/Twitter adapter ($100/mo+ API)
17. Instagram/TikTok via data providers ($500+/mo)
18. Gemini image generation for complex meme composites
19. ML-powered identity resolution
20. Self-service onboarding for Scout tier

## Memory Notes (Hetzner CPX31 — 8GB)

With all services running, memory is tight:
- The Unit containers: ~1.7GB (worker is heaviest at ~800MB with spaCy loaded)
- Narralytica containers: ~900MB
- Arr stack (when running): ~2.2GB
- Other services: ~1.5GB

The sentence-transformers embedding model needs ~500MB to load. If Arr is running, this causes OOM (exit code 137). Either stop Arr or upgrade server.

Current workaround: Arr stack is stopped. NLP processing works in small batches without embeddings when memory is tight.

## Git History (major commits)

1. Phase 1 foundation — full stack skeleton
2. YouTube adapter
3. Fix topic create button
4. Fix collection task JSON serialization
5. Fix NLP process task JSON serialization
6. Phase 2: Bluesky + HN adapters, richer post cards
7. Graph explorer with Cytoscape.js
8. Meme engine: templates, Imgur, Gemini analyzer, compositor, characters, pipeline
9. Meme Lab simulation: 7-step interactive pipeline
10. Fix Docker networking (host.docker.internal)
11. Queue viewer, enhanced dashboard
12. Fix asyncio event loop in Celery workers
13. Queue polish + meme explanation links + original post context
