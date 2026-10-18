-- Индекс фото привязывается к проекту.
--   photos:      уникальность (project_key, drive_file_id) вместо drive_file_id
--   face_embeddings: составной FK и уникальность (project_key, drive_file_id, face_index)
--   match_faces: дополнительный параметр p_project_key — фильтр по проекту
-- Без этого два проекта с одинаковыми именами файлов перезаписывают друг
-- друга строки, а поиск по лицу возвращает чужие фото чужих событий.
-- @TheTechMargin 2026

-- Шаг 1: колонки. Дефолт 'default' — для новых/легаси-строк без проекта.
ALTER TABLE photos
  ADD COLUMN IF NOT EXISTS project_key text NOT NULL DEFAULT 'default';

ALTER TABLE face_embeddings
  ADD COLUMN IF NOT EXISTS project_key text NOT NULL DEFAULT 'default';

-- Шаг 2: бэкфилл. Все существующие строки (995 фото /IMG_*.jpg, 2940
-- векторов) принадлежат единственному проингестенному проекту test-noveee —
-- сверено по листингу его папки (995/999 совпадений, с testdemo — 0).
UPDATE photos SET project_key = 'test-noveee' WHERE project_key = 'default';
UPDATE face_embeddings SET project_key = 'test-noveee' WHERE project_key = 'default';

-- Шаг 3: снять старые ограничения (в порядке зависимостей).
ALTER TABLE face_embeddings DROP CONSTRAINT IF EXISTS face_embeddings_drive_file_id_fkey;
ALTER TABLE face_embeddings DROP CONSTRAINT IF EXISTS face_embeddings_drive_file_id_face_index_key;
ALTER TABLE photos DROP CONSTRAINT IF EXISTS photos_drive_file_id_unique;

-- Шаг 4: новые составные ограничения. DROP IF EXISTS перед ADD — миграция
-- повторнобезопасна: прогон 11:48 уже создал ограничения, но не записал
-- версию (сломанный jq в CI), и повторный запуск падал на 42P07.
ALTER TABLE photos DROP CONSTRAINT IF EXISTS photos_project_file_unique;
ALTER TABLE photos
  ADD CONSTRAINT photos_project_file_unique UNIQUE (project_key, drive_file_id);

ALTER TABLE face_embeddings DROP CONSTRAINT IF EXISTS face_embeddings_project_file_face_key;
ALTER TABLE face_embeddings
  ADD CONSTRAINT face_embeddings_project_file_face_key
    UNIQUE (project_key, drive_file_id, face_index);

-- Шаг 5: составной FK — каскадное удаление векторов при удалении фото
-- сохраняется, но только внутри того же проекта. ON UPDATE CASCADE —
-- при смене алиаса проекта (rekeyProject) векторы следуют за фото.
ALTER TABLE face_embeddings DROP CONSTRAINT IF EXISTS face_embeddings_project_file_fkey;
ALTER TABLE face_embeddings
  ADD CONSTRAINT face_embeddings_project_file_fkey
    FOREIGN KEY (project_key, drive_file_id)
    REFERENCES photos (project_key, drive_file_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- Шаг 6: индекс для фильтрации векторов по проекту.
CREATE INDEX IF NOT EXISTS idx_face_embeddings_project
  ON face_embeddings (project_key);

-- Шаг 6b: сессии поиска тоже привязываются к проекту — при архивации или
-- удалении проекта из БД удаляется всё, включая вектора лиц из сессий.
-- project_key заполняется новым кодом; строки без него — легаси.
ALTER TABLE match_sessions
  ADD COLUMN IF NOT EXISTS project_key text NOT NULL DEFAULT 'default';

CREATE INDEX IF NOT EXISTS idx_match_sessions_project
  ON match_sessions (project_key);

-- Шаг 7: project-aware match_faces. p_project_key = null — искать везде
-- (обратная совместимость), иначе только в указанном проекте.
DROP FUNCTION IF EXISTS match_faces(vector, double precision, integer);

CREATE OR REPLACE FUNCTION match_faces(
  query_embedding vector(512),
  match_threshold float DEFAULT 0.6,
  match_count int DEFAULT 20,
  p_project_key text DEFAULT NULL
)
RETURNS TABLE (
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
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
    SELECT
      fe.drive_file_id,
      fe.filename,
      fe.folder,
      fe.face_index,
      1 - (fe.embedding <=> query_embedding) AS similarity,
      fe.bbox_x1,
      fe.bbox_y1,
      fe.bbox_x2,
      fe.bbox_y2
    FROM face_embeddings fe
    WHERE fe.embedding IS NOT NULL
      AND (p_project_key IS NULL OR fe.project_key = p_project_key)
      AND 1 - (fe.embedding <=> query_embedding) > match_threshold
    ORDER BY fe.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Шаг 8: текстовый и семантический поиск тоже фильтруются по проекту.
-- p_project_key = null — искать везде (обратная совместимость).
DROP FUNCTION IF EXISTS search_photos(text, int);
DROP FUNCTION IF EXISTS search_photos_semantic(vector, float, int);

CREATE OR REPLACE FUNCTION search_photos(
  query_text text,
  result_limit int DEFAULT 50,
  p_project_key text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  drive_file_id text,
  filename text,
  drive_url text,
  folder text,
  visible_text text,
  people_descriptions text,
  scene_description text,
  face_count int,
  processed_at timestamptz,
  created_at timestamptz,
  rank float
)
LANGUAGE plpgsql
AS $$
DECLARE
  tsquery_val tsquery;
BEGIN
  tsquery_val := plainto_tsquery('english', query_text);

  RETURN QUERY
    SELECT
      p.id,
      p.drive_file_id,
      p.filename,
      p.drive_url,
      p.folder,
      p.visible_text,
      p.people_descriptions,
      p.scene_description,
      p.face_count,
      p.processed_at,
      p.created_at,
      (
        coalesce(ts_rank_cd(p.search_vector, tsquery_val, 32), 0) * 10 +
        greatest(
          similarity(p.visible_text, query_text),
          similarity(p.people_descriptions, query_text),
          similarity(p.scene_description, query_text),
          similarity(p.filename, query_text)
        ) * 5
      )::float AS rank
    FROM photos p
    WHERE p.status = 'completed'
      AND (p_project_key IS NULL OR p.project_key = p_project_key)
      AND (
        p.search_vector @@ tsquery_val
        OR similarity(p.visible_text, query_text) > 0.1
        OR similarity(p.people_descriptions, query_text) > 0.1
        OR similarity(p.scene_description, query_text) > 0.1
        OR similarity(p.filename, query_text) > 0.15
        OR p.visible_text ILIKE '%' || query_text || '%'
        OR p.people_descriptions ILIKE '%' || query_text || '%'
        OR p.scene_description ILIKE '%' || query_text || '%'
      )
    ORDER BY rank DESC
    LIMIT result_limit;
END;
$$;

CREATE OR REPLACE FUNCTION search_photos_semantic(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 30,
  p_project_key text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  drive_file_id text,
  filename text,
  drive_url text,
  folder text,
  visible_text text,
  people_descriptions text,
  scene_description text,
  face_count int,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
    SELECT
      p.id,
      p.drive_file_id,
      p.filename,
      p.drive_url,
      p.folder,
      p.visible_text,
      p.people_descriptions,
      p.scene_description,
      p.face_count,
      1 - (p.description_embedding <=> query_embedding) AS similarity
    FROM photos p
    WHERE p.description_embedding IS NOT NULL
      AND p.status = 'completed'
      AND (p_project_key IS NULL OR p.project_key = p_project_key)
      AND 1 - (p.description_embedding <=> query_embedding) > match_threshold
    ORDER BY p.description_embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
