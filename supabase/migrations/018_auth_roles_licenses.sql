-- 018: вход по логину/паролю, роли, лицензии и защита входа.
--
-- Идентификатор проекта остаётся event_settings.event_key (text) — вся
-- кодовая база уже работает на project_key (см. 015). Поэтому «таблица
-- проектов» из ТЗ — это расширенная event_settings: сюда добавляются
-- пароль галереи, флаг whitelabel и активность проекта. Бренд/тексты уже
-- лежат в JSONB-колонках draft/published и не дублируются.
--
-- Доступ везде — только через service role (RLS включён, политик нет).
-- Пароли хранятся исключительно в виде argon2id-хеша (@node-rs/argon2).
-- @TheTechMargin 2026

-- ============================================================
-- 1. Проекты: расширяем event_settings
-- ============================================================

-- Пароль галереи для посетителей (argon2id). null — пароль не задан
-- (для легаси-проекта «default» берётся APP_PASSWORD из окружения).
alter table event_settings
  add column if not exists gallery_password_hash text;

-- Whitelabel: true — показывать кастомный логотип/footer-credit проекта;
-- false — фирменный брендинг EventLens. Переключает только super_admin.
alter table event_settings
  add column if not exists whitelabel_enabled boolean not null default false;

-- Активен ли проект: неактивный проект не отдаёт галерею и блокирует
-- доступ админа к нему.
alter table event_settings
  add column if not exists is_active boolean not null default true;

-- Дата создания проекта (у существующих строк заполняется текущим
-- моментом — точное историческое значение неизвестно и не критично).
alter table event_settings
  add column if not exists created_at timestamptz not null default now();

-- ============================================================
-- 2. Пользователи админки
-- ============================================================

do $$ begin
  create type admin_role as enum ('super_admin', 'admin');
exception
  when duplicate_object then null;
end $$;

create table if not exists admin_users (
  id             uuid primary key default gen_random_uuid(),
  -- логин — email, всегда в нижнем регистре
  email          text not null,
  -- только argon2id-хеш; открытый пароль никогда не хранится
  password_hash  text not null,
  role           admin_role not null default 'admin',
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  last_login_at  timestamptz,
  constraint admin_users_email_chk
    check (email = lower(email) and position('@' in email) > 1)
);

-- Уникальность по нижнему регистру (email и так хранится lower).
create unique index if not exists admin_users_email_uq
  on admin_users (email);

-- ============================================================
-- 3. Лицензия: доступ админа к проекту
-- ============================================================
-- user_id unique = ровно один проект на админа (ограничение на БД).
-- project_key ссылается на event_settings(event_key): удаление проекта
-- каскадом убирает его лицензии.
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

-- ============================================================
-- 4. Действующий ли доступ у пользователя к проекту
-- ============================================================
-- super_admin (активный) проходит всегда. Для admin — активный проект,
-- не отозванная лицензия и непросроченный интервал [starts_at, expires_at).
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

-- ============================================================
-- 5. Защита входа (serverless: счётчики в БД, а не в памяти)
-- ============================================================
create table if not exists login_attempts (
  id          bigint generated always as identity primary key,
  -- lower(email); «unknown» для попыток с несуществующим логином,
  -- чтобы rate limit работал и по выдуманным адресам
  login_key   text not null,
  -- хеш IP с серверной солью; сырой IP не хранится
  ip_hash     text not null,
  success     boolean not null,
  created_at  timestamptz not null default now()
);

create index if not exists login_attempts_login_idx
  on login_attempts (login_key, created_at desc);
create index if not exists login_attempts_ip_idx
  on login_attempts (ip_hash, created_at desc);
-- Записи старше 7 дней чистит фоновая задача (Vercel Cron) — см. SECURITY.md.

-- ============================================================
-- 6. Приглашения и сброс пароля
-- ============================================================

do $$ begin
  create type invite_purpose as enum ('invite', 'password_reset');
exception
  when duplicate_object then null;
end $$;

create table if not exists admin_invites (
  id                 uuid primary key default gen_random_uuid(),
  purpose            invite_purpose not null default 'invite',
  email              text not null,
  -- для purpose='invite'; каскадом удаляется вместе с проектом
  project_key        text references event_settings(event_key) on delete cascade,
  -- для password_reset и заполняется после принятия приглашения
  user_id            uuid references admin_users(id) on delete cascade,
  -- sha256 от токена; сам токен в БД не хранится
  token_hash         text not null unique,
  -- до какой даты действует лицензия после принятия приглашения
  license_expires_at timestamptz,
  -- срок жизни самой ссылки (например, 72 часа)
  invite_expires_at  timestamptz not null,
  invited_by         uuid not null references admin_users(id) on delete cascade,
  accepted_at        timestamptz,
  revoked_at         timestamptz,
  created_at         timestamptz not null default now(),
  constraint admin_invites_email_chk check (email = lower(email)),
  -- приглашение привязано к проекту и сроку лицензии
  constraint admin_invites_invite_chk
    check (purpose <> 'invite' or (project_key is not null and license_expires_at is not null)),
  -- сброс пароля привязан к существующему пользователю
  constraint admin_invites_reset_chk
    check (purpose <> 'password_reset' or user_id is not null)
);

-- Одно активное приглашение на email и проект.
create unique index if not exists admin_invites_pending_uq
  on admin_invites (email, project_key)
  where purpose = 'invite' and accepted_at is null and revoked_at is null;

create index if not exists admin_invites_project_idx
  on admin_invites (project_key, created_at desc);

-- ============================================================
-- 7. RLS: доступ только с сервера (service role)
-- ============================================================
alter table admin_users           enable row level security;
alter table admin_project_access  enable row level security;
alter table login_attempts        enable row level security;
alter table admin_invites         enable row level security;
-- Политик не создаём: anon/authenticated получают отказ, service role
-- обходит RLS на сервере.

-- Запрещаем прямое исполнение функций ролям без service key.
revoke execute on function has_project_access(uuid, text)
  from public, anon, authenticated;
