-- 020: агрегат статуса пайплайна для технической панели /admin.
--
-- Было: роут /api/admin/status делал 6 count(*)-запросов по одной колонке,
-- тянул до 10 000 строк face_embeddings только чтобы посчитать distinct
-- и выгружал все строки photos, чтобы сгруппировать папки в JS. На 1 000
-- фото это секунды на каждый запрос, а панель опрашивает роут каждые 5с.
--
-- Стало: один вызов функции — считает всё одним проходом и отдаёт готовый
-- jsonb. Панель получает те же поля, но без выгрузки строк в приложение.
--
-- p_project_key = null → сводка по всем проектам (super_admin); для admin
-- сервер всегда подставляет его project_key из лицензии, а не из запроса.
-- @TheTechMargin 2026

-- Составной индекс: без него каждый count(*) по статусу читает всю
-- таблицу целиком. Проект + статус — ровно тот фильтр, что в функции.
create index if not exists idx_photos_project_status
  on photos (project_key, status);

create or replace function admin_photo_status(p_project_key text default null)
returns jsonb
language sql stable security definer set search_path = public as $$
  with scoped as (
    select status,
           description_embedding is not null as has_embedding,
           coalesce(folder, '') as folder,
           processed_at,
           created_at,
           filename,
           error_message
    from photos
    where p_project_key is null or project_key = p_project_key
  )
  select jsonb_build_object(
    'total',          (select count(*) from scoped),
    'completed',      (select count(*) from scoped where status = 'completed'),
    'pending',        (select count(*) from scoped where status = 'pending'),
    'processing',     (select count(*) from scoped where status = 'processing'),
    'errors',         (select count(*) from scoped where status = 'error'),
    'withEmbeddings', (select count(*) from scoped where has_embedding),

    -- Только реальные вектора лиц: строки-сентинелы (face_index = -1,
    -- embedding is null) означают «лиц не найдено» и не являются
    -- эмбеддингами.
    'faceEmbeddings', (
      select count(distinct fe.drive_file_id)
      from face_embeddings fe
      where fe.embedding is not null
        and (p_project_key is null or fe.project_key = p_project_key)
    ),

    'lastProcessed', (select max(processed_at) from scoped where status = 'completed'),

    'folders', coalesce((
      select jsonb_agg(jsonb_build_object('name', f.folder, 'count', f.cnt)
                       order by f.cnt desc)
      from (select folder, count(*) as cnt from scoped group by folder) f
    ), '[]'::jsonb),

    'recentErrors', coalesce((
      select jsonb_agg(jsonb_build_object('filename', e.filename, 'error', e.error_message)
                       order by e.created_at desc)
      from (select filename, error_message, created_at
            from scoped
            where status = 'error'
            order by created_at desc
            limit 10) e
    ), '[]'::jsonb)
  );
$$;

-- Запрещаем прямое исполнение функции ролям без service key.
revoke execute on function admin_photo_status(text) from public, anon, authenticated;
