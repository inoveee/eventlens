-- 019: аналитика посещений и действий посетителей.
--
-- Приватность — приоритет (тема биометрии): в события НЕ попадают селфи,
-- векторы лиц, сырые IP и полные тексты поисковых запросов. session_id —
-- случайный идентификатор из cookie, не привязанный к личности. Для
-- запросов хранится только длина, не текст.
--
-- Запись идёт с сервера (service role) в соответствующих роутах,
-- fire-and-forget: ошибка записи события не должна ломать основной ответ.
-- Срок хранения: события старше 12 месяцев чистит фоновая задача.
-- @TheTechMargin 2026

create table if not exists analytics_events (
  id          bigint generated always as identity primary key,
  project_key text not null references event_settings(event_key) on delete cascade,
  event_type  text not null,
  -- случайный id из cookie; не содержит личности посетителя
  session_id  text not null,
  -- для photo_view / download_single (тип как у photos.drive_file_id)
  photo_id    text,
  -- для download_zip и collage_create
  photo_count int,
  -- метаданные: query_len, results_count, match_tier и т.п.
  metadata    jsonb not null default '{}'::jsonb,
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

-- RLS без политик: только service role.
alter table analytics_events enable row level security;

-- ============================================================
-- Агрегации для графиков.
-- p_project_key = null → все проекты. Роль super_admin может так запросить;
-- для admin сервер всегда подставляет его project_key из сессии, а не из
-- запроса, поэтому чужие данные недоступны даже при подмене параметра.
-- ============================================================

-- Сводка по типам событий: сколько событий и сколько уникальных
-- посетителей (distinct session_id) за период.
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

-- Временной ряд для графика «заходы по дням» (или по часам).
-- Бакет считается в указанной таймзоне: timestamptz → timestamp в p_tz →
-- date_trunc → обратно отдаём как timestamp (локальное время бакета).
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

-- Активность по часам суток (для heatmap/столбцов).
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

-- Топ просматриваемых и скачиваемых фото.
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

-- Сводная таблица по всем проектам (только super_admin). Все проекты
-- попадают в результат, даже без событий (left join).
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

-- Запрещаем прямое исполнение функций ролям без service key.
revoke execute on function
  analytics_summary(text, timestamptz, timestamptz),
  analytics_timeseries(text, timestamptz, timestamptz, text, text),
  analytics_hourly(text, timestamptz, timestamptz, text),
  analytics_top_photos(text, timestamptz, timestamptz, int),
  analytics_by_project(timestamptz, timestamptz)
  from public, anon, authenticated;
