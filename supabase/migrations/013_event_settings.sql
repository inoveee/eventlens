-- 013: настройки мероприятия организатором (черновик + публикация).
-- Одна строка на развёртывание (single-event архитектура); поле
-- event_key оставлено, чтобы переход к мульти-ивентам не потребовал
-- смены структуры. Доступ только через service role (RLS без политик),
-- секреты и ключи в таблицу не сохраняются.

create table if not exists event_settings (
  event_key text primary key,
  -- оформление и тексты, которые организатор редактирует
  draft jsonb not null,
  -- версия, которую видят посетители; null — страница не опубликована
  published jsonb,
  -- подключённая папка с фотографиями и статус синхронизации
  photos jsonb,
  updated_at timestamptz not null default now()
);

alter table event_settings enable row level security;
