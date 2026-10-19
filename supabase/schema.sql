-- EventLens: Complete Database Schema
-- Run this file once to bootstrap a fresh Supabase project.
-- For incremental updates, use the numbered migrations in ./migrations/
--
-- Prerequisites:
--   1. Create a Supabase project at https://supabase.com
--   2. Enable the pgvector extension (Database → Extensions → vector)
--   3. Run this file in the SQL Editor
--
-- @TheTechMargin 2026

-- ============================================================
-- Extensions
-- ============================================================
create extension if not exists vector;    -- pgvector for embeddings
create extension if not exists pg_trgm;   -- trigram fuzzy text matching

-- ============================================================
-- Core Tables
-- ============================================================

-- Photos: one row per Google Drive/Yandex image, scoped to a project
-- (project_key = event_settings.event_key). One deploy can host several
-- events; a file path may repeat across projects, so uniqueness is the
-- composite (project_key, drive_file_id).
create table if not exists photos (
  id                    uuid default gen_random_uuid() primary key,
  project_key           text not null default 'default',  -- event_settings.event_key
  drive_file_id         text not null,              -- stable Drive/Yandex ID
  mime_type             text,                        -- set by pipeline scan
  filename              text,
  drive_url             text,
  folder                text,
  visible_text          text,                        -- OCR / text in image
  people_descriptions   text,                        -- Gemini-generated people descriptions
  scene_description     text,                        -- Gemini-generated scene description
  face_count            int,
  status                text default 'pending',      -- pending | completed | error
  error_message         text,
  processed_at          timestamptz,
  created_at            timestamptz default now(),

  -- Semantic search: 768-dim Gemini text-embedding-004
  description_embedding vector(768),

  -- Perceptual hash for near-duplicate detection
  phash                 bigint,

  -- Soft-delete for duplicate hiding
  hidden                boolean default false,

  -- Auto-generated thematic tag
  auto_tag              text,

  -- Full-text search (generated column)
  search_vector         tsvector generated always as (
    to_tsvector('english',
      coalesce(visible_text, '') || ' ' ||
      coalesce(people_descriptions, '') || ' ' ||
      coalesce(scene_description, '') || ' ' ||
      coalesce(filename, '') || ' ' ||
      coalesce(folder, '')
    )
  ) stored,

  -- Composite uniqueness: the same file path may exist in different projects.
  constraint photos_project_file_unique unique (project_key, drive_file_id)
);

-- Face embeddings: one row per detected face (or sentinel for faceless photos).
-- Composite FK keeps CASCADE delete within the same project.
create table if not exists face_embeddings (
  id            uuid default gen_random_uuid() primary key,
  project_key   text not null default 'default',
  drive_file_id text not null,
  filename      text,
  folder        text,
  face_index    int,                      -- -1 = sentinel (no faces detected)
  embedding     vector(512),              -- NULL for sentinel rows
  bbox_x1       float8,
  bbox_y1       float8,
  bbox_x2       float8,
  bbox_y2       float8,
  created_at    timestamptz default now(),

  constraint face_embeddings_project_file_face_key
    unique (project_key, drive_file_id, face_index),
  constraint face_embeddings_project_file_fkey
    foreign key (project_key, drive_file_id)
    references photos (project_key, drive_file_id)
    on delete cascade on update cascade
);

-- Match sessions: analytics for every face-search query (no PII stored)
create table if not exists match_sessions (
  id                uuid default gen_random_uuid() primary key,
  project_key       text not null default 'default',
  created_at        timestamptz default now() not null,
  tier              text not null,                -- vector | text | visual | both
  match_count       int not null default 0,
  top_confidence    int,
  query_embedding   vector(512),                  -- face embedding (not the selfie)
  matched_photo_ids text[] default '{}'
);

-- ============================================================
-- Indexes
-- ============================================================

-- Photos
create index if not exists idx_photos_search_vector
  on photos using gin(search_vector);
create index if not exists idx_photos_project
  on photos (project_key);
create index if not exists idx_photos_visible_text_trgm
  on photos using gin(visible_text gin_trgm_ops);
create index if not exists idx_photos_people_desc_trgm
  on photos using gin(people_descriptions gin_trgm_ops);
create index if not exists idx_photos_scene_desc_trgm
  on photos using gin(scene_description gin_trgm_ops);
create index if not exists idx_photos_description_embedding
  on photos using hnsw (description_embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);
create index if not exists idx_photos_phash
  on photos (phash) where phash is not null;
create index if not exists idx_photos_hidden
  on photos (hidden) where hidden = true;
create index if not exists idx_photos_auto_tag
  on photos (auto_tag) where auto_tag is not null;

-- Face embeddings (partial index — excludes NULL sentinel embeddings)
create index if not exists idx_face_embeddings_hnsw
  on face_embeddings using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64)
  where embedding is not null;
create index if not exists idx_face_embeddings_project
  on face_embeddings (project_key);

-- Match sessions
create index if not exists idx_match_sessions_created
  on match_sessions (created_at desc);
create index if not exists idx_match_sessions_photo_ids
  on match_sessions using gin (matched_photo_ids);
create index if not exists idx_match_sessions_project
  on match_sessions (project_key);

-- ============================================================
-- RPC Functions
-- ============================================================

-- Face matching: cosine similarity over 512-dim InsightFace embeddings.
-- p_project_key = null → искать везде (обратная совместимость для
-- одного мероприятия), иначе только в указанном проекте.
create or replace function match_faces(
  query_embedding vector(512),
  match_threshold float default 0.6,
  match_count int default 20,
  p_project_key text default null
)
returns table (
  drive_file_id text,
  filename text,
  folder text,
  face_index int,
  similarity float,
  bbox_x1 float8,
  bbox_y1 float8,
  bbox_x2 float8,
  bbox_y2 float8
)
language plpgsql as $$
begin
  return query
    select
      fe.drive_file_id, fe.filename, fe.folder, fe.face_index,
      1 - (fe.embedding <=> query_embedding) as similarity,
      fe.bbox_x1, fe.bbox_y1, fe.bbox_x2, fe.bbox_y2
    from face_embeddings fe
    where fe.embedding is not null
      and (p_project_key is null or fe.project_key = p_project_key)
      and 1 - (fe.embedding <=> query_embedding) > match_threshold
    order by fe.embedding <=> query_embedding
    limit match_count;
end;
$$;

-- Hybrid text search: full-text (ts_rank) + trigram fuzzy matching.
-- p_project_key = null → искать везде, иначе только проект.
create or replace function search_photos(
  query_text text,
  result_limit int default 50,
  p_project_key text default null
)
returns table (
  id uuid, drive_file_id text, filename text, drive_url text, folder text,
  visible_text text, people_descriptions text, scene_description text,
  face_count int, processed_at timestamptz, created_at timestamptz, rank float
)
language plpgsql as $$
declare
  tsquery_val tsquery;
begin
  tsquery_val := plainto_tsquery('english', query_text);
  return query
    select
      p.id, p.drive_file_id, p.filename, p.drive_url, p.folder,
      p.visible_text, p.people_descriptions, p.scene_description,
      p.face_count, p.processed_at, p.created_at,
      (
        coalesce(ts_rank_cd(p.search_vector, tsquery_val, 32), 0) * 10 +
        greatest(
          similarity(p.visible_text, query_text),
          similarity(p.people_descriptions, query_text),
          similarity(p.scene_description, query_text),
          similarity(p.filename, query_text)
        ) * 5
      )::float as rank
    from photos p
    where p.status = 'completed'
      and (p.hidden is not true)
      and (p_project_key is null or p.project_key = p_project_key)
      and (
        p.search_vector @@ tsquery_val
        or similarity(p.visible_text, query_text) > 0.1
        or similarity(p.people_descriptions, query_text) > 0.1
        or similarity(p.scene_description, query_text) > 0.1
        or similarity(p.filename, query_text) > 0.15
        or p.visible_text ilike '%' || query_text || '%'
        or p.people_descriptions ilike '%' || query_text || '%'
        or p.scene_description ilike '%' || query_text || '%'
      )
    order by rank desc
    limit result_limit;
end;
$$;

-- Semantic search: cosine similarity over 768-dim Gemini embeddings.
-- p_project_key = null → искать везде, иначе только проект.
create or replace function search_photos_semantic(
  query_embedding vector(768),
  match_threshold float default 0.5,
  match_count int default 30,
  p_project_key text default null
)
returns table (
  id uuid, drive_file_id text, filename text, drive_url text, folder text,
  visible_text text, people_descriptions text, scene_description text,
  face_count int, similarity float
)
language plpgsql as $$
begin
  return query
    select
      p.id, p.drive_file_id, p.filename, p.drive_url, p.folder,
      p.visible_text, p.people_descriptions, p.scene_description,
      p.face_count,
      1 - (p.description_embedding <=> query_embedding) as similarity
    from photos p
    where p.description_embedding is not null
      and p.status = 'completed'
      and (p.hidden is not true)
      and (p_project_key is null or p.project_key = p_project_key)
      and 1 - (p.description_embedding <=> query_embedding) > match_threshold
    order by p.description_embedding <=> query_embedding
    limit match_count;
end;
$$;

-- Analytics: recent match activity
create or replace function get_recent_match_activity(
  hours_back int default 24,
  max_results int default 20
)
returns table (
  id uuid, created_at timestamptz, tier text, match_count int, top_confidence int
)
language sql stable as $$
  select ms.id, ms.created_at, ms.tier, ms.match_count, ms.top_confidence
  from match_sessions ms
  where ms.created_at > now() - make_interval(hours => hours_back)
  order by ms.created_at desc
  limit max_results;
$$;

-- Analytics: most-matched photos
create or replace function get_hot_photo_ids(
  top_n int default 10,
  hours_back int default 168
)
returns table (photo_id text, match_hit_count bigint)
language sql stable as $$
  select pid as photo_id, count(*) as match_hit_count
  from match_sessions ms, unnest(ms.matched_photo_ids) as pid
  where ms.created_at > now() - make_interval(hours => hours_back)
    and ms.match_count > 0
  group by pid
  order by match_hit_count desc
  limit top_n;
$$;

-- Analytics: unique face-search users
create or replace function get_unique_operatives_count()
returns bigint
language sql stable as $$
  select count(*) from match_sessions where query_embedding is not null;
$$;

-- Analytics: find similar past sessions by face embedding
create or replace function find_similar_sessions(
  probe_embedding vector(512),
  threshold float default 0.7,
  max_results int default 5
)
returns table (
  id uuid, created_at timestamptz, tier text, match_count int,
  top_confidence int, matched_photo_ids text[], similarity float
)
language sql stable as $$
  select
    ms.id, ms.created_at, ms.tier, ms.match_count, ms.top_confidence,
    ms.matched_photo_ids,
    1 - (ms.query_embedding <=> probe_embedding) as similarity
  from match_sessions ms
  where ms.query_embedding is not null
    and 1 - (ms.query_embedding <=> probe_embedding) > threshold
    and ms.match_count > 0
  order by ms.query_embedding <=> probe_embedding
  limit max_results;
$$;

-- Analytics: co-occurrence recommendations
create or replace function get_cooccurrence_recommendations(
  user_photo_ids text[],
  exclude_photo_ids text[] default '{}',
  max_results int default 8
)
returns table (photo_id text, cooccurrence_count bigint)
language sql stable as $$
  select pid as photo_id, count(*) as cooccurrence_count
  from match_sessions ms, unnest(ms.matched_photo_ids) as pid
  where ms.matched_photo_ids && user_photo_ids
    and pid != all(user_photo_ids)
    and pid != all(exclude_photo_ids)
    and ms.match_count > 0
  group by pid
  order by cooccurrence_count desc
  limit max_results;
$$;

-- Dedup: find near-duplicate clusters by perceptual hash Hamming distance
create or replace function find_duplicate_clusters(
  hamming_threshold int default 10
)
returns table (
  group_id bigint, photo_id uuid, drive_file_id text, filename text,
  folder text, phash bigint, hamming_distance int, hidden boolean
)
language sql as $$
  with pairs as (
    select
      a.id as id_a, b.id as id_b,
      a.phash as phash_a, b.phash as phash_b,
      a.drive_file_id as drive_file_id_a, a.filename as filename_a,
      a.folder as folder_a, a.hidden as hidden_a,
      b.drive_file_id as drive_file_id_b, b.filename as filename_b,
      b.folder as folder_b, b.hidden as hidden_b,
      bit_count((a.phash # b.phash)::bit(64))::int as dist
    from photos a
    join photos b on a.id < b.id
    where a.phash is not null and b.phash is not null
      and a.status = 'completed' and b.status = 'completed'
      and bit_count((a.phash # b.phash)::bit(64))::int <= hamming_threshold
  )
  select dense_rank() over (order by least(id_a, id_b)) as group_id,
    id_a as photo_id, drive_file_id_a as drive_file_id, filename_a as filename,
    folder_a as folder, phash_a as phash, dist as hamming_distance, hidden_a as hidden
  from pairs
  union all
  select dense_rank() over (order by least(id_a, id_b)) as group_id,
    id_b as photo_id, drive_file_id_b as drive_file_id, filename_b as filename,
    folder_b as folder, phash_b as phash, dist as hamming_distance, hidden_b as hidden
  from pairs
  order by group_id, hamming_distance;
$$;

-- ============================================================
-- Event settings / Projects (migration 013, 014, 018)
-- ============================================================
-- One row per project (event). event_key is the public slug used in /p/<key>
-- and as project_key across photos / face_embeddings / match_sessions.
-- draft/published hold page text + branding; photos holds the connected
-- source folder. Access is service-role only (RLS on, no policies).
create table if not exists event_settings (
  event_key              text primary key,
  draft                  jsonb not null,
  published              jsonb,
  photos                 jsonb,
  meta                   jsonb not null default '{}'::jsonb,
  updated_at             timestamptz not null default now(),
  -- Visitor gallery password (argon2id). null = not set (legacy "default"
  -- project falls back to APP_PASSWORD from the environment).
  gallery_password_hash  text,
  -- White-label: true = show the project's custom logo/footer credit;
  -- false = show EventLens branding. Toggled by super_admin only.
  whitelabel_enabled     boolean not null default false,
  -- Inactive projects serve no gallery and block admin access to them.
  is_active              boolean not null default true,
  created_at             timestamptz not null default now()
);

alter table event_settings enable row level security;

-- ============================================================
-- Admin users, licenses, login protection (migration 018)
-- ============================================================

do $$ begin
  create type admin_role as enum ('super_admin', 'admin');
exception
  when duplicate_object then null;
end $$;

create table if not exists admin_users (
  id             uuid primary key default gen_random_uuid(),
  email          text not null,                     -- login, always lowercase
  password_hash  text not null,                     -- argon2id only
  role           admin_role not null default 'admin',
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  last_login_at  timestamptz,
  constraint admin_users_email_chk
    check (email = lower(email) and position('@' in email) > 1)
);

create unique index if not exists admin_users_email_uq on admin_users (email);

-- Exactly one project per admin (unique user_id) — a time-bounded license.
create table if not exists admin_project_access (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references admin_users(id) on delete cascade,
  project_key text not null references event_settings(event_key) on delete cascade,
  starts_at   timestamptz not null default now(),
  expires_at  timestamptz not null,
  is_revoked  boolean not null default false,
  granted_by  uuid references admin_users(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint admin_project_access_window_chk check (expires_at > starts_at)
);

create index if not exists admin_project_access_project_idx
  on admin_project_access (project_key);

-- Active access for a user to a project. super_admin (active) always passes.
create or replace function has_project_access(p_user uuid, p_project_key text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from admin_users u
    where u.id = p_user
      and u.is_active
      and (
        u.role = 'super_admin'
        or exists (
          select 1
          from admin_project_access a
          join event_settings es on es.event_key = a.project_key and es.is_active
          where a.user_id = u.id
            and a.project_key = p_project_key
            and not a.is_revoked
            and now() >= a.starts_at
            and now() <  a.expires_at
        )
      )
  );
$$;

-- Login throttling counters (serverless-safe: state in DB, not memory).
create table if not exists login_attempts (
  id          bigint generated always as identity primary key,
  login_key   text not null,                        -- lower(email) or 'unknown'
  ip_hash     text not null,                        -- salted hash, never raw IP
  success     boolean not null,
  created_at  timestamptz not null default now()
);

create index if not exists login_attempts_login_idx
  on login_attempts (login_key, created_at desc);
create index if not exists login_attempts_ip_idx
  on login_attempts (ip_hash, created_at desc);

do $$ begin
  create type invite_purpose as enum ('invite', 'password_reset');
exception
  when duplicate_object then null;
end $$;

create table if not exists admin_invites (
  id                 uuid primary key default gen_random_uuid(),
  purpose            invite_purpose not null default 'invite',
  email              text not null,
  project_key        text references event_settings(event_key) on delete cascade,
  user_id            uuid references admin_users(id) on delete cascade,
  token_hash         text not null unique,          -- sha256(token); token never stored
  license_expires_at timestamptz,
  invite_expires_at  timestamptz not null,
  invited_by         uuid not null references admin_users(id) on delete cascade,
  accepted_at        timestamptz,
  revoked_at         timestamptz,
  created_at         timestamptz not null default now(),
  constraint admin_invites_email_chk check (email = lower(email)),
  constraint admin_invites_invite_chk
    check (purpose <> 'invite' or (project_key is not null and license_expires_at is not null)),
  constraint admin_invites_reset_chk
    check (purpose <> 'password_reset' or user_id is not null)
);

create unique index if not exists admin_invites_pending_uq
  on admin_invites (email, project_key)
  where purpose = 'invite' and accepted_at is null and revoked_at is null;

create index if not exists admin_invites_project_idx
  on admin_invites (project_key, created_at desc);

-- ============================================================
-- Analytics (migration 019)
-- ============================================================
-- Privacy-first (biometrics domain): never store selfies, face vectors, raw
-- IPs, or full search query text. session_id is a random cookie value that
-- is not tied to a person. For queries only the length is kept.
create table if not exists analytics_events (
  id          bigint generated always as identity primary key,
  project_key text not null references event_settings(event_key) on delete cascade,
  event_type  text not null,
  session_id  text not null,
  photo_id    text,                                 -- photo_view / download_single
  photo_count int,                                  -- download_zip / collage_create
  metadata    jsonb not null default '{}'::jsonb,   -- query_len, results_count, …
  created_at  timestamptz not null default now(),
  constraint analytics_events_type_chk check (event_type in (
    'page_view', 'search_text', 'search_semantic', 'search_face',
    'photo_view', 'download_single', 'download_zip', 'collage_create'
  ))
);

create index if not exists analytics_project_time_idx
  on analytics_events (project_key, created_at desc);
create index if not exists analytics_project_type_idx
  on analytics_events (project_key, event_type, created_at desc);
create index if not exists analytics_photo_idx
  on analytics_events (project_key, photo_id)
  where photo_id is not null;

-- p_project_key = null → all projects (super_admin only; the server always
-- injects an admin's own project_key from the session, never from the request).
create or replace function analytics_summary(
  p_project_key text, p_from timestamptz, p_to timestamptz)
returns table (event_type text, events bigint, unique_visitors bigint)
language sql stable security definer set search_path = public as $$
  select e.event_type, count(*), count(distinct e.session_id)
  from analytics_events e
  where e.created_at >= p_from and e.created_at < p_to
    and (p_project_key is null or e.project_key = p_project_key)
  group by e.event_type;
$$;

create or replace function analytics_timeseries(
  p_project_key text, p_from timestamptz, p_to timestamptz,
  p_bucket text default 'day', p_tz text default 'UTC')
returns table (bucket timestamp, event_type text, events bigint, unique_visitors bigint)
language sql stable security definer set search_path = public as $$
  select date_trunc(p_bucket, e.created_at at time zone p_tz), e.event_type,
         count(*), count(distinct e.session_id)
  from analytics_events e
  where e.created_at >= p_from and e.created_at < p_to
    and (p_project_key is null or e.project_key = p_project_key)
  group by 1, 2
  order by 1;
$$;

create or replace function analytics_hourly(
  p_project_key text, p_from timestamptz, p_to timestamptz, p_tz text default 'UTC')
returns table (hour int, events bigint)
language sql stable security definer set search_path = public as $$
  select extract(hour from e.created_at at time zone p_tz)::int, count(*)
  from analytics_events e
  where e.created_at >= p_from and e.created_at < p_to
    and (p_project_key is null or e.project_key = p_project_key)
  group by 1
  order by 1;
$$;

create or replace function analytics_top_photos(
  p_project_key text, p_from timestamptz, p_to timestamptz, p_limit int default 10)
returns table (photo_id text, views bigint, downloads bigint)
language sql stable security definer set search_path = public as $$
  select e.photo_id,
         count(*) filter (where e.event_type = 'photo_view'),
         count(*) filter (where e.event_type = 'download_single')
  from analytics_events e
  where e.photo_id is not null
    and e.created_at >= p_from and e.created_at < p_to
    and (p_project_key is null or e.project_key = p_project_key)
  group by e.photo_id
  order by 3 desc, 2 desc
  limit p_limit;
$$;

create or replace function analytics_by_project(p_from timestamptz, p_to timestamptz)
returns table (project_key text, project_name text, page_views bigint,
               visitors bigint, searches bigint, face_searches bigint, downloads bigint)
language sql stable security definer set search_path = public as $$
  select es.event_key, es.draft->'text'->>'name',
    count(*) filter (where e.event_type = 'page_view'),
    count(distinct e.session_id),
    count(*) filter (where e.event_type in ('search_text','search_semantic')),
    count(*) filter (where e.event_type = 'search_face'),
    count(*) filter (where e.event_type in ('download_single','download_zip'))
  from event_settings es
  left join analytics_events e
    on e.project_key = es.event_key
    and e.created_at >= p_from and e.created_at < p_to
  group by es.event_key, es.draft->'text'->>'name'
  order by 3 desc;
$$;

-- ============================================================
-- Lock down: RLS on with no policies; revoke function execution from
-- public roles. Service role bypasses RLS and is the only caller.
-- ============================================================
alter table admin_users           enable row level security;
alter table admin_project_access  enable row level security;
alter table login_attempts        enable row level security;
alter table admin_invites         enable row level security;
alter table analytics_events      enable row level security;

revoke execute on function has_project_access(uuid, text)
  from public, anon, authenticated;
revoke execute on function
  analytics_summary(text, timestamptz, timestamptz),
  analytics_timeseries(text, timestamptz, timestamptz, text, text),
  analytics_hourly(text, timestamptz, timestamptz, text),
  analytics_top_photos(text, timestamptz, timestamptz, int),
  analytics_by_project(timestamptz, timestamptz)
  from public, anon, authenticated;
