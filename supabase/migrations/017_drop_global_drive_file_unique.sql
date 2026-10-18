-- photos: снять глобальный unique по одному drive_file_id.
--
-- В схеме были ДВА ограничения: инлайновое `unique` из schema.sql
-- (автоимя photos_drive_file_id_key) и photos_drive_file_id_unique из
-- миграции 008. 015_project_scope.sql снял только второе, поэтому
-- уникальность осталась глобальной: два проекта не могли содержать
-- файл с одним и тем же путём (/DSC02231.jpeg и т.п. повторяются
-- между папками Яндекс.Диска) — upsert в другой проект падал 23505.
--
-- Гарантию даёт составной unique photos_project_file_unique
-- (project_key, drive_file_id) из 015. Старый FK
-- face_embeddings_drive_file_id_fkey (schema.sql, ссылался на
-- photos_drive_file_id) снят там же — зависимостей не остаётся.
--
-- Порядок: сначала возможные зависящие FK (IF EXISTS — идемпотентно),
-- затем сами ограничения.
-- @TheTechMargin 2026

ALTER TABLE face_embeddings DROP CONSTRAINT IF EXISTS face_embeddings_drive_file_id_fkey;

ALTER TABLE photos DROP CONSTRAINT IF EXISTS photos_drive_file_id_key;
ALTER TABLE photos DROP CONSTRAINT IF EXISTS photos_drive_file_id_unique;

-- Логический дубль-гард для Яндекс-путей: прежний unique держал
-- корректность, составной (project_key, drive_file_id) сохраняет её
-- в пределах проекта — сознательно.
