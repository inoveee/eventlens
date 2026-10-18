// @TheTechMargin 2026
// Phase: SYNC — Reconcile source state (Drive/Яндекс.Диск) with Supabase.
// Detects renames, moves, and deletions.

import { SupabaseStore } from "../supabase-store";
import type { PipelineSource } from "../source";
import type { PhaseResult } from "../types";

export async function phaseSync(
  source: PipelineSource,
  projectKey = "default",
): Promise<PhaseResult> {
  const store = new SupabaseStore(projectKey);
  const errors: string[] = [];

  // Строим карты источника: по id (канон) и по имени (для переименований).
  const byId = new Map<string, { name: string; folder: string }>();
  const byName = new Map<string, { id: string; folder: string }>();
  for (const f of await source.listImages()) {
    byId.set(f.id, { name: f.name, folder: f.folder });
    if (!byName.has(f.name)) byName.set(f.name, { id: f.id, folder: f.folder });
  }

  const allPhotos = await store.getAllPhotos();
  if (!allPhotos.length) {
    return { phase: "sync", processed: 0, remaining: 0, done: true, errors: [] };
  }

  let updated = 0;
  let reconnected = 0;
  let orphaned = 0;

  for (const photo of allPhotos) {
    try {
      const fid = photo.drive_file_id;
      const sname = photo.filename || "";
      const sfolder = photo.folder || "";
      const entry = byId.get(fid);

      if (entry) {
        // Файл на месте — фиксируем переименования/переезды.
        const changes: Record<string, string> = {};
        if (entry.name !== sname) changes.filename = entry.name;
        if (entry.folder !== sfolder) changes.folder = entry.folder;

        if (Object.keys(changes).length > 0) {
          await store.updatePhotoMetadata(fid, changes);
          await store.nullDescriptionEmbedding(fid);
          await store.updateFaceEmbeddingMetadata(fid, changes);
          updated++;
        }
      } else {
        // Нет по id — пробуем переподключить по имени файла.
        const match = byName.get(sname);
        if (match && match.id !== fid) {
          await store.reconnectPhoto(
            fid,
            match.id,
            sname,
            match.folder,
            source.publicUrl(match.id),
          );
          reconnected++;
        } else {
          await store.deletePhoto(fid);
          orphaned++;
        }
      }
    } catch (err) {
      errors.push(`${photo.filename}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const processed = updated + reconnected + orphaned;
  console.log(
    `[sync:${source.provider}] ${updated} updated, ${reconnected} reconnected, ${orphaned} orphaned`,
  );

  return { phase: "sync", processed, remaining: 0, done: true, errors };
}
