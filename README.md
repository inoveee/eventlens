# EventLens

AI-powered event photo gallery. Point it at a Google Drive folder, run the processing pipeline, and give your attendees a searchable gallery with face matching, semantic search, and batch downloads.

Built with Next.js 15, React 19, Supabase (pgvector), Gemini AI, and InsightFace.

---

## What It Does

EventLens turns a Google Drive folder of event photos into a fully interactive gallery where attendees can find their own photos by uploading a selfie, searching natural language descriptions, or browsing by folder and tag. Organizers get an admin dashboard to run AI processing, monitor pipeline status, and manage content.

### Attendee Features

- **Face matching** — Upload a selfie to find every photo you appear in. Uses InsightFace 512-dim face embeddings with pgvector cosine similarity, tiered by confidence.
- **Semantic search** — Natural language queries like "people near the stage" or "outdoor group photo." Powered by Gemini 768-dim text embeddings with vector similarity search.
- **Text search** — Search visible text (banners, badges, slides), people descriptions, scene descriptions, filenames, and folders. Full-text + trigram matching with ranked results.
- **Browse by folder** — Filter tabs for each Drive subfolder (day, session, photographer, etc.) with album preview cards on the home view.
- **Auto-tags** — AI-generated tags per photo (e.g. "keynote," "networking," "outdoor") with tag-based filtering.
- **Lightbox viewer** — Full-resolution photos with metadata panel, keyboard/swipe navigation, direct Drive link, and download button.
- **Batch download** — Select multiple photos and download as ZIP (up to 50 at once).
- **Collage maker** — Select photos and generate a collage in configurable aspect ratios (1:1, 4:3, 16:9, story).
- **Video playback** — Stream event videos directly from Drive with range request proxy support.
- **Activity ticker** — Live feed showing recent face match activity across the gallery.
- **Progressive rendering** — IntersectionObserver-based lazy rendering in batches of 40 for smooth scrolling through large galleries.
- **Password-protected access** — Simple password gate for private events.

### Organizer Features

- **Admin dashboard** (`/admin`) — Pipeline status, folder breakdown, error logs, duplicate detection, and content moderation (hide photos).
- **Admin accounts & roles** — Email/password login (argon2id, signed session cookie) at `/admin/login`. Two roles:
  - **super_admin** — sees and manages all projects, admins, licenses, whitelabel, and per-project analytics.
  - **admin** — bound to exactly one project (enforced at the DB); sees only that project, never others'.
- **Multi-project** — Each event is a project (`event_settings`): its own gallery page `/p/<key>`, folder, branding, and gallery password. RPCs (`match_faces`, `search_photos`, `search_photos_semantic`) are project-scoped, so one project can never read another's photos.
- **Per-project gallery password & whitelabel** — Password (argon2id) and the whitelabel flag are stored in the DB and set from the admin panel (`/api/admin/project-security`). `APP_PASSWORD`/`NEXT_PUBLIC_*` are only defaults.
- **Analytics** (`/admin/analytics`) — Privacy-first visitor stats: page views, unique visitors, searches, face searches, downloads, collages. Aggregated via SQL functions; no selfies, face vectors, raw IPs, or full query text are stored. KPI cards, charts, sortable all-projects table, CSV export.
- **Processing pipeline** — Six-phase AI pipeline running as native TypeScript on Vercel serverless:
  - **Sync** — Reconcile Drive ↔ Supabase (detect renames, moves, deletions)
  - **Scan** — Discover new photos from Drive folders
  - **Describe** — Gemini Vision analysis: visible text, people descriptions, scene description, face count, auto-tags
  - **Embeddings** — Generate 768-dim text embeddings for semantic search (batch of 100 via Gemini)
  - **Face embed** — 512-dim face embeddings via external InsightFace microservice
  - **Phash** — 64-bit perceptual dHash for duplicate detection
- **Error retry** — Re-process failed photos without redoing successful ones.
- **Duplicate detection** — Find near-duplicate photos using Hamming distance on perceptual hashes.
- **Auto-tagging** — Batch-apply AI-generated tags to all photos.

---

## Design Decisions

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for a full RFC-style design document covering:

- Why Google Drive is the storage layer (not S3, not a database)
- Why pgvector over a dedicated vector database (Pinecone, Weaviate)
- Why face and text embeddings use separate vector spaces
- How the pipeline handles Vercel's 300s serverless timeout
- How hybrid search merges vector, full-text, and trigram results
- Tradeoffs acknowledged and what we'd improve

---

## Development Process

EventLens was built at the MIT HardMode hackathon in March 2026. The development workflow:

1. **Prototype fast** — get features working in a single component
2. **Verify UX** — test interactions, iterate on behavior
3. **Decompose** — identify extraction boundaries, split into hooks and components
4. **Document decisions** — capture the "why" behind architectural choices

The architect's role is knowing *where to cut* — which abstractions reflect real domain boundaries vs. arbitrary file splits. The 8 custom hooks and 15+ gallery components emerged from this iterative process, not from upfront design.

---

## Architecture

```
Google Drive (photos + videos in folders)
       │
       ▼
Processing Pipeline (TypeScript, Vercel serverless, 300s max)
  ├── Gemini 2.5 Flash Lite → scene/text/people analysis + auto-tags
  ├── Gemini Embedding (gemini-embedding-001) → 768-dim description vectors
  ├── InsightFace (buffalo_l via Flask service) → 512-dim face vectors
  └── Sharp → 64-bit dHash perceptual hashes
       │
       ▼
Supabase (PostgreSQL + pgvector)
  ├── photos table — metadata, description embeddings, tsvector, phash
  ├── face_embeddings table — face vectors + bounding boxes
  ├── match_sessions table — face match analytics
  └── RPC functions — match_faces, search_photos, search_photos_semantic
       │
       ▼
Next.js 15 App (Vercel)
  ├── Gallery — search, browse, match, download, collage
  ├── Admin — pipeline control, status, moderation
  └── API routes — photos, search, match, video proxy, ZIP, auth, admin
```

---

## Setup

### Quick Start

```bash
git clone <repo-url>
cd eventlens
./scripts/setup.sh
```

The setup script checks prerequisites, installs dependencies, creates your `.env` file, validates required keys, and prints next steps.

### Database

Create a [Supabase](https://supabase.com) project with the pgvector extension enabled, then run the bootstrap schema:

```sql
-- Paste into Supabase SQL Editor → Run
-- File: supabase/schema.sql
```

This single file creates all tables, indexes, and RPC functions. It's the consolidated equivalent of the 12 incremental migrations in `supabase/migrations/` — use those if you need to apply changes to an existing deployment.

### Face Matching (Optional)

The InsightFace microservice lives in `services/face-api/`. Deploy to Railway, Render, or Fly.io:

```bash
cd services/face-api
docker build -t face-api .
# Deploy to your platform of choice
```

Uses InsightFace's `buffalo_l` model (512-dim embeddings). Needs ~2GB RAM, 30-60s cold start for model download.

#### Local run (no Docker)

For development the service runs directly with `venv` (macOS, Python ≥ 3.13):

```bash
cd services/face-api
./run-local.sh            # http://localhost:8090, model buffalo_l
```

The script creates `.venv` from `requirements-local.txt` on first run and downloads
the model weights to `~/.insightface/models/buffalo_l` (~300MB, one-time). Then point
the app at it:

```bash
FACE_API_URL="http://localhost:8090"
FACE_API_SECRET="<any random string, e.g. openssl rand -hex 24>"
```

Verify: `curl -H "Authorization: Bearer <secret>" http://localhost:8090/health`

### Environment

```bash
cp .env.example .env
```

Fill in the values:

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_API_KEY` | Yes | Google Cloud API key with Drive API enabled |
| `GOOGLE_DRIVE_FOLDER_ID` | Yes | Root Drive folder ID (from the folder URL) |
| `GEMINI_API_KEY` | Yes | Gemini API key for vision analysis and embeddings |
| `APP_PASSWORD` | No | **Default** gallery password for the legacy `default` project only (per-project passwords are set in the admin panel and stored in the DB) |
| `SESSION_SECRET` | Yes (prod) | Secret (HS256) signing admin sessions + gallery guest cookie. Generate: `openssl rand -base64 48` |
| `SUPER_ADMIN_EMAIL` | No | Email of the first super admin, created via `npm run create-super-admin` |
| `SUPER_ADMIN_PASSWORD` | No | Password for the first super admin (prompted interactively if empty) |
| `IP_HASH_SALT` | No | Salt for hashing IPs in `login_attempts` (login rate limiting) |
| `ADMIN_API_SECRET` | No | Deprecated for UI. Still used as a Bearer token by scripts/CI and as a fallback for `SESSION_SECRET` |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only) |
| `FACE_API_URL` | No | URL of deployed InsightFace microservice |
| `FACE_API_SECRET` | No | Bearer token for face-api authentication |
| `NEXT_PUBLIC_EVENT_NAME` | No | Event title displayed in the gallery header (default: `Фотогалерея`) |
| `NEXT_PUBLIC_EVENT_TAGLINE` | No | Subtitle in the page title and on the login screen |
| `NEXT_PUBLIC_HERO_STATEMENT` | No | Two-tone hero line: first sentence light, the rest in the event color (default: `Вся съёмка с мероприятия. И ваши кадры в ней`) |
| `NEXT_PUBLIC_EVENT_DESCRIPTION` | No | Supporting line under the hero statement (default: `Сделайте селфи — найдём ваши фото. Или просто листайте галерею по альбомам`) |
| `NEXT_PUBLIC_DEFAULT_ALBUM_NAME` | No | Title of the general album on the home grid (default: `Общий альбом`) |
| `NEXT_PUBLIC_EVENT_YEAR` | No | Year shown next to the event name |
| `NEXT_PUBLIC_LOGO_URL` | No | Organizer logo (SVG/PNG). Empty = text-only header |
| `NEXT_PUBLIC_THEME` | No | `dark` (default) or `light` — default color scheme. Visitors can switch it in the footer |
| `NEXT_PUBLIC_PRIMARY_COLOR` | No | Brand color — buttons, headings, borders (default: `#fd8d2c`) |
| `NEXT_PUBLIC_ACCENT_COLOR` | No | Secondary brand color — hover, highlights (default: `#ff00ff`) |
| `NEXT_PUBLIC_BG_COLOR` | No | Page background. Defaults to the theme's background |
| `NEXT_PUBLIC_SURFACE_COLOR` | No | Card/panel background. Defaults to the theme's surface |
| `NEXT_PUBLIC_TEXT_COLOR` | No | Default text color. Defaults to the theme's text color |
| `NEXT_PUBLIC_FOOTER_CREDIT_TEXT` | No | Footer credit line. Empty = hidden |
| `NEXT_PUBLIC_FOOTER_CREDIT_URL` | No | Link target for the footer credit line |

### White-label theming

All UI color is driven by five CSS custom properties in `src/app/globals.css`:
`--el-primary`, `--el-accent`, `--el-bg`, `--el-surface`, `--el-text`.
Every other token (borders, badges, hovers, glows, overlays) is derived from
them with `color-mix()`, so changing the brand colors recolors the whole app —
not just the header.

Two extra token families exist for a reason:

- `--el-brand-text` / `--el-t-*` — text painted in the brand color. In light
  theme it is automatically darkened, because pure neon hues are unreadable on
  white, while backgrounds and borders keep the original brand color.
- `--el-overlay-*` — modal scrims derived from the page background.

Set `NEXT_PUBLIC_THEME=light` for daylight/projector-friendly galleries.
It is only the *default*: every visitor can switch between dark and light
backgrounds with the selector in the footer (the choice is saved per browser).
Explicit `NEXT_PUBLIC_BG_COLOR` / `SURFACE_COLOR` / `TEXT_COLOR` pin those
values for both themes — the switcher then changes everything else except the
pinned colors.
Never hardcode hex values in components — use the tokens.

### 5. Process photos

Start the dev server, then trigger the pipeline from the admin dashboard or via API:

```bash
npm run dev
# Visit /admin and click "Full Pipeline"
```

Or call the API directly:

```bash
# Run all phases sequentially (re-call until done: true)
curl -X POST http://localhost:3000/api/admin/pipeline \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phase": "full"}'

# Run a specific phase
curl -X POST http://localhost:3000/api/admin/pipeline \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phase": "describe"}'

# Retry failed photos
curl -X POST http://localhost:3000/api/admin/pipeline \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phase": "describe", "retryErrors": true}'
```

The pipeline runs within Vercel's 300s function timeout. Long phases (describe, face-embed) process photos in a loop with a wall-clock guard and return `{ processed, remaining, done }`. Call repeatedly until `done: true`.

### 6. Deploy

```bash
# Vercel (recommended)
vercel --prod

# Or build locally
npm run build && npm start
```

Set all environment variables in the Vercel dashboard. The pipeline route is configured with `maxDuration = 300` (requires Vercel Pro plan for the full 300s; Hobby plan caps at 60s).

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                        # Gallery entry (Suspense + ErrorBoundary)
│   ├── login/page.tsx                  # Password login page
│   ├── admin/page.tsx                  # Admin dashboard
│   ├── layout.tsx                      # Root layout with fonts + theme
│   ├── globals.css                     # Tailwind + CSS custom properties
│   └── api/
│       ├── photos/route.ts             # Photo list with pagination
│       ├── search/route.ts             # Semantic + full-text hybrid search
│       ├── match/route.ts              # Face matching via pgvector
│       ├── stats/route.ts              # Gallery analytics + activity feed
│       ├── video/route.ts              # Drive video streaming proxy
│       ├── download-zip/route.ts       # Batch ZIP export
│       ├── collage/route.ts            # Server-side collage generation
│       ├── auth/
│       │   ├── login/route.ts          # Cookie-based login
│       │   └── logout/route.ts         # Cookie clear
│       └── admin/
│           ├── pipeline/route.ts       # Pipeline orchestrator (6 phases)
│           ├── status/route.ts         # Pipeline status + folder stats
│           ├── scan/route.ts           # Quick Drive scan
│           ├── autotag/route.ts        # Batch auto-tagging
│           ├── duplicates/route.ts     # Phash duplicate detection
│           └── photos/hide/route.ts    # Content moderation
│
├── components/
│   ├── gallery/
│   │   ├── PhotoGallery.tsx            # Main orchestrator (~340 lines)
│   │   ├── GalleryHeader.tsx           # Search bar + title + actions
│   │   ├── FolderTabs.tsx              # Folder filter pills
│   │   ├── TagTabs.tsx                 # Tag filter pills
│   │   ├── FilterSortBar.tsx           # Filter trigger + active badges
│   │   ├── FilterSortSheet.tsx         # Full filter/sort panel
│   │   ├── PhotoGrid.tsx              # CSS grid + photo cards
│   │   ├── PhotoCard.tsx               # Individual photo card
│   │   ├── AlbumGrid.tsx              # Folder preview cards
│   │   ├── HeroSection.tsx            # Featured photo display
│   │   ├── SearchStatus.tsx           # Search result info bar
│   │   ├── RecommendationsBar.tsx     # AI search suggestions
│   │   ├── EmptyState.tsx             # Zero results messaging
│   │   ├── TerminalLoader.tsx         # Boot animation
│   │   └── GridSkeleton.tsx           # Loading skeleton
│   ├── ActivityTicker.tsx              # Live match activity feed
│   ├── CollagePreview.tsx              # Collage result viewer
│   ├── CollageRatioModal.tsx           # Aspect ratio picker
│   ├── ErrorBoundary.tsx               # React error boundary
│   ├── FloatingActionBar.tsx           # Selection toolbar
│   ├── Footer.tsx                      # Gallery footer
│   ├── Lightbox.tsx                    # Full-screen photo viewer
│   ├── PhotoUpload.tsx                 # Selfie upload for face matching
│   └── Toast.tsx                       # Toast notifications
│
├── hooks/
│   ├── usePhotos.ts                    # Photo fetching + polling
│   ├── useSearch.ts                    # Search input + debounce + server search
│   ├── useFilters.ts                   # Folder/tag/type/sort filtering
│   ├── useSelection.ts                # Multi-select mode
│   ├── useCollage.ts                   # Collage creation flow
│   ├── useStats.ts                     # Stats polling
│   ├── useProgressiveRender.ts         # IntersectionObserver lazy rendering
│   └── useUrlSync.ts                   # URL query param sync
│
├── lib/
│   ├── photos.ts                       # Photo fetching + Supabase metadata merge
│   ├── drive.ts                        # Google Drive API client
│   ├── gemini.ts                       # Gemini API (search-time)
│   ├── supabase.ts                     # Supabase client setup
│   ├── auth.ts                         # Auth utilities
│   ├── config.ts                       # Environment config
│   ├── types.ts                        # TypeScript interfaces
│   ├── utils.ts                        # Shared utilities
│   └── pipeline/
│       ├── rate-limiter.ts             # Sliding-window rate limiter
│       ├── retry.ts                    # Exponential backoff retry
│       ├── drive-client.ts             # Drive ops for pipeline
│       ├── gemini-client.ts            # Gemini vision + batch embeddings
│       ├── face-api-client.ts          # InsightFace API client
│       ├── supabase-store.ts           # Pipeline Supabase CRUD
│       ├── phash.ts                    # dHash perceptual hashing (sharp)
│       ├── types.ts                    # Pipeline-specific types
│       └── phases/
│           ├── sync.ts                 # Drive ↔ Supabase reconciliation
│           ├── scan.ts                 # New photo discovery
│           ├── describe.ts             # Gemini vision analysis
│           ├── embed.ts                # Embedding backfill
│           ├── face-embed.ts           # InsightFace face embeddings
│           └── phash.ts                # Perceptual hash generation
│
├── middleware.ts                        # Auth middleware
│
services/face-api/                       # InsightFace microservice (Flask + Docker)
│   ├── app.py
│   ├── Dockerfile
│   └── requirements.txt
│
scripts/setup.sh                         # Guided local setup
│
supabase/
│   ├── schema.sql                       # Bootstrap: full schema in one file
│   └── migrations/                      # 12 incremental migrations
```

---

## Tech Stack

- **Framework**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **Database**: Supabase (PostgreSQL + pgvector for vector similarity search)
- **AI — Vision**: Gemini 2.5 Flash Lite (structured photo analysis)
- **AI — Embeddings**: Gemini Embedding 001 (768-dim text embeddings, batch API)
- **AI — Face**: InsightFace buffalo_l via Flask microservice (512-dim face embeddings)
- **Image Processing**: Sharp (perceptual hashing, collage generation)
- **Storage**: Google Drive REST API v3 (CDN thumbnails via `lh3.googleusercontent.com`)
- **Deployment**: Vercel (app + serverless pipeline), Railway/Render/Fly.io (face-api)

---

## API Reference

Authentication model:

- **Public routes** (`/api/photos`, `/api/search`, `/api/match`, …) — no auth; scoped by `project`/`project_key` so one project can never read another's data.
- **Gallery password** — per-project, set in the admin panel (`event_settings.gallery_password_hash`, argon2id). `/api/auth/login` verifies it and sets a signed guest cookie (`el_gallery_access`) listing the unlocked projects. `APP_PASSWORD` is only the fallback for the legacy `default` project.
- **Admin routes** (`/api/admin/*`) — session cookie set by `/api/admin/auth/login` (argon2id + short-lived signed JWT, `/admin/login` UI). `Authorization: Bearer <ADMIN_API_SECRET>` is still accepted for scripts/CI and is treated as `super_admin`. Role, active flag, and license are re-read from the DB on every request; an `admin` always gets its one licensed project from `admin_project_access`, never from the request.

| Endpoint | Method | Description |
|---|---|---|
| `/api/photos` | GET | Photo list with `limit`/`offset` pagination |
| `/api/search?q=` | GET | Hybrid semantic + full-text search (logs a `search_*` analytics event) |
| `/api/match` | POST | Face matching (accepts base64 selfie; logs `search_face`) |
| `/api/stats` | GET | Gallery analytics, recent activity, hot photos (scoped by `project_key`) |
| `/api/video?id=` | GET | Drive video streaming proxy with range support |
| `/api/download-zip` | POST | Batch ZIP download (up to 50 photos; logs `download_zip`) |
| `/api/collage` | POST | Generate photo collage with configurable ratio (logs `collage_create`) |
| `/api/analytics` | POST | Anonymous `page_view` beacon; sets the analytics session cookie |
| `/api/auth/login` | POST | Visitor gallery password login (per-project), sets guest cookie |
| `/api/auth/logout` | POST | Clears the guest cookie |
| `/api/admin/auth/login` | POST | Admin login → session cookie (rate-limited by IP) |
| `/api/admin/auth/logout` | POST | Clears the admin session cookie |
| `/api/admin/auth/me` | GET | Current session: email, role, project, license status |
| `/api/admin/analytics` | GET | Aggregated KPI, time series, top photos (role-scoped) |
| `/api/admin/project-security` | GET/POST | Gallery password + whitelabel/active toggles |
| `/api/admin/pipeline` | POST | Run pipeline phase (`sync`, `scan`, `describe`, `embeddings`, `face-embed`, `phash`, `full`) |
| `/api/admin/status` | GET | Pipeline status + folder breakdown |
| `/api/admin/scan` | POST | Quick Drive folder scan |
| `/api/admin/autotag` | POST | Batch auto-tag all photos |
| `/api/admin/duplicates` | GET | Find duplicate photos by phash |
| `/api/admin/photos/hide` | POST | Hide/unhide photos |

---

## Tests and CI

153 tests covering the embedding pipeline, auth/roles, gallery guest access, and analytics privacy — the most complex and externally-dependent parts of the codebase. Tests are co-located with source files (`gemini-client.ts` → `gemini-client.test.ts`).

```bash
# Run tests
npm test

# Run in watch mode
npm run test:watch
```

**What's tested:** Gemini JSON parser (3-level recovery for truncated AI output), InsightFace client (health check retries, auth), exponential backoff with jitter, sliding-window rate limiter, face-embed and embed phase orchestration.

**CI:** GitHub Actions runs tests, type checking, linting, and build on every push/PR to `main`. Slack notifications on failure via `SLACK_WEBHOOK_URL` repository secret (optional — CI works without it).

All tests use mocked `fetch` — no API keys, databases, or external services needed.

---

## License

MIT
