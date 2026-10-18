-- photos.mime_type: колонка используется пайплайном (scan шлёт её в upsert,
-- фазы фильтруют видео), но не была создана ни в одной миграции — upsert
-- падал с PGRST204 "Could not find the 'mime_type' column". Листинг диска
-- (Drive/Яндекс) всегда знает mime-тип файла, заполняется при инжесте.
-- @TheTechMargin 2026

ALTER TABLE photos
  ADD COLUMN IF NOT EXISTS mime_type text;

