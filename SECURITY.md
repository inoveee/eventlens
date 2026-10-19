# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it privately via [GitHub Security Advisories](https://github.com/binaryLady/eventlens/security/advisories/new) rather than opening a public issue.

## Architecture Security Model

EventLens processes event photos through external AI services and stores metadata in Supabase. The security model is designed around a single-event deployment where one organizer controls the pipeline and attendees consume the gallery.

### Authentication

- **Gallery access** — per-project password, stored in `event_settings.gallery_password_hash` (argon2id) and set from the admin panel. `/api/auth/login` verifies it and sets a signed guest cookie (`el_gallery_access`, HS256 JWT) listing the unlocked projects. `APP_PASSWORD` is only a fallback for the legacy `default` project. The gate is enforced server-side on `/p/<key>`.
- **Admin access** — email/password login at `/api/admin/auth/login` (argon2id, short-lived signed JWT session cookie `el_admin_session` with an hourly sliding refresh, `/admin/login` UI). Role, active flag, and license are re-read from the DB on **every** request; an `admin` gets its one licensed project from `admin_project_access`, never from the request. `Authorization: Bearer <ADMIN_API_SECRET>` is still accepted for scripts/CI and is treated as `super_admin`.
- **Login rate limiting** — failed attempts are throttled per IP and per login (temporary lockout) via the `login_attempts` table; IPs are stored hashed (with `IP_HASH_SALT`), never in plaintext.
- **Face-API service** — authenticated via `FACE_API_SECRET` bearer token between the Next.js backend and the InsightFace microservice.

### Data Handling

- **No selfie storage.** When an attendee uploads a selfie for face matching, it is embedded into a 512-dim vector in memory, compared against indexed face embeddings, and discarded. The image is never written to disk or database. Only the embedding vector is optionally stored in `match_sessions` for analytics.
- **No PII in the database.** The `match_sessions` table stores face embedding vectors (not images), match counts, and matched photo IDs. There are no names, or user accounts beyond admin emails.
- **Privacy-first analytics.** The `analytics_events` table records anonymous events (page views, searches, downloads, collages). It stores a random rotating `session_id`, never raw IPs, selfies, face vectors, or full search query text (only query length). Events are written server-side (fire-and-forget) and aggregated via SQL functions.
- **Photos stay in Google Drive.** EventLens reads photo metadata and thumbnails via the Drive API. Original files are never copied to the application server or database.

### API Keys and Secrets

All secrets are loaded from environment variables at runtime. The `.env.example` file documents required variables without values. The `.gitignore` excludes `.env`, `.env.local`, and `.env.*.local` files.

| Secret | Scope | Purpose |
|---|---|---|
| `GOOGLE_API_KEY` | Server-side only | Drive API read access |
| `GEMINI_API_KEY` | Server-side only | Vision analysis and text embeddings |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side only | Database operations (bypasses RLS) |
| `ADMIN_API_SECRET` | Server-side only | Deprecated for UI auth; still a Bearer token for scripts/CI and a fallback for `SESSION_SECRET` |
| `SESSION_SECRET` | Server-side only | Signs admin session JWTs and the gallery guest cookie (HS256) |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | Server-side only | Bootstrap the first super admin via `npm run create-super-admin` |
| `IP_HASH_SALT` | Server-side only | Hashes IPs in `login_attempts` for rate limiting |
| `APP_PASSWORD` | Server-side only | Fallback gallery password for the legacy `default` project |
| `FACE_API_SECRET` | Server-side only | InsightFace service authentication |

No secrets are exposed to the client. Gallery passwords and whitelabel flags live in the DB (`event_settings`), not in `NEXT_PUBLIC_` env vars. The only `NEXT_PUBLIC_` variables are the Supabase URL (public by design) and cosmetic branding defaults.

### Server-Side Protections

- **Admin routes** validate the bearer token before executing any pipeline or moderation action.
- **Auth middleware** (`src/middleware.ts`) intercepts requests to protected routes and redirects unauthenticated users.
- **Video proxy** (`/api/video`) streams Drive content through the server to avoid exposing the Google API key to the client.
- **ZIP downloads** are capped at 50 photos per request to prevent resource exhaustion.

### Known Limitations

- **Row cleanup needs a cron.** `login_attempts` and `analytics_events` grow over time. Old rows (expired attempts, events past the retention window) should be pruned by a scheduled job (e.g. a Supabase cron / pg_cron job). Until one is configured, tables grow unbounded.
- **Supabase service role key bypasses RLS.** All database access goes through server-side API routes using the service role key. The auth/analytics tables (018/019) enable RLS with no policies so anon/public keys are denied; per-user policies are unnecessary because the service role is the only reader/writer.
- **HTTP-only cookie, no CSRF token.** Both the admin session and gallery guest cookies are HTTP-only and SameSite=Lax. State-changing operations use POST with JSON bodies, which provides baseline CSRF protection. A dedicated CSRF token would strengthen this.
- **ADMIN_API_SECRET is still honored.** For backward compatibility with scripts/CI, presenting this secret as a Bearer token grants `super_admin` access. Remove or rotate it if you want session-only admin auth.

## Dependencies

Security updates for dependencies are tracked via [Dependabot](https://github.com/binaryLady/eventlens/security/dependabot). Review and merge dependency PRs promptly.
