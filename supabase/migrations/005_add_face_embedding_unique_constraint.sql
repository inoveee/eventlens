-- Add unique constraint to face_embeddings table for upsert operations
-- Ensures no duplicate (drive_file_id, face_index) pairs
-- @TheTechMargin 2026
--
-- Idempotent: schema.sql-бутстрап уже содержит этот constraint на свежем
-- проекте, повторное применение не должно падать.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'face_embeddings_drive_file_id_face_index_key'
      AND conrelid = 'face_embeddings'::regclass
  ) THEN
    ALTER TABLE face_embeddings
    ADD CONSTRAINT face_embeddings_drive_file_id_face_index_key
    UNIQUE (drive_file_id, face_index);
  END IF;
END $$;