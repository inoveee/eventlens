// @TheTechMargin 2026
// Phase: SCAN — Discover new images in the source (Drive/Яндекс.Диск)
// that aren't yet in Supabase.

import { SupabaseStore } from "../supabase-store";
import type { PipelineSource } from "../source";
import type { PhaseResult } from "../types";

export async function phaseScan(
  source: PipelineSource,
  projectKey = "default",
): Promise<PhaseResult> {
  const store = new SupabaseStore(projectKey);
  const errors: string[] = [];

  let discovered = 0;
  try {
    const files = await source.listImages();
    for (const f of files) {
      await store.upsertPhoto({
        drive_file_id: f.id,
        filename: f.name,
        drive_url: source.publicUrl(f.id),
        folder: f.folder,
        mime_type: f.mimeType,
        status: "pending",
      });
      discovered++;
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  console.log(`[scan:${source.provider}] ${discovered} photos discovered`);
  return { phase: "scan", processed: discovered, remaining: 0, done: true, errors };
}
