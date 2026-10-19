// @TheTechMargin 2026
// Pipeline orchestrator: accepts phase + project, dispatches native
// TypeScript work. Источник (Google Drive / Яндекс.Диск) берётся из
// подключённой папки проекта, а не из глобального PHOTO_SOURCE.

import { NextRequest, NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/adminAuth";
import { coerceProjectKey } from "@/lib/eventSettings";
import { resolvePhotoSource } from "@/lib/eventSettingsStore";
import { driveSource, yandexSource, type PipelineSource } from "@/lib/pipeline/source";
import { phaseSync } from "@/lib/pipeline/phases/sync";
import { phaseScan } from "@/lib/pipeline/phases/scan";
import { phaseDescribe } from "@/lib/pipeline/phases/describe";
import { phaseEmbed } from "@/lib/pipeline/phases/embed";
import { phaseFaceEmbed } from "@/lib/pipeline/phases/face-embed";
import { phasePhash } from "@/lib/pipeline/phases/phash";
import type { PhaseResult } from "@/lib/pipeline/types";

export const maxDuration = 300;

const VALID_PHASES = [
  "sync",
  "scan",
  "describe",
  "embeddings",
  "face-embed",
  "phash",
  "full",
] as const;

type Phase = (typeof VALID_PHASES)[number];

function getEnvOrThrow(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env var: ${name}`);
  return val;
}

/** Источник фото проекта: подключённая папка, иначе env-фолбэк default. */
async function resolvePipelineSource(project: string): Promise<PipelineSource> {
  const source = await resolvePhotoSource(project);
  if (!source.configured || !source.value) {
    throw new Error(
      `У проекта «${project}» не подключена папка с фотографиями — подключите ссылку на диске.`,
    );
  }
  if (source.provider === "yandex") {
    return yandexSource(source.value);
  }
  const apiKey = getEnvOrThrow("GOOGLE_API_KEY");
  return driveSource(apiKey, source.value);
}

async function runPhase(
  phase: Phase,
  project: string,
  retryErrors = false,
): Promise<PhaseResult> {
  const source = await resolvePipelineSource(project);

  switch (phase) {
    case "sync":
      return phaseSync(source, project);

    case "scan":
      return phaseScan(source, project);

    case "describe": {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        return {
          phase: "describe",
          processed: 0,
          remaining: 0,
          done: true,
          errors: [],
        };
      }
      return phaseDescribe(source, geminiKey, retryErrors, project);
    }

    case "embeddings": {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        return { phase: "embed", processed: 0, remaining: 0, done: true, errors: [] };
      }
      return phaseEmbed(geminiKey, project);
    }

    case "face-embed": {
      const faceApiUrl = getEnvOrThrow("FACE_API_URL");
      const faceApiSecret = process.env.FACE_API_SECRET || "";
      return phaseFaceEmbed(source, faceApiUrl, faceApiSecret, project);
    }

    case "phash":
      return phasePhash(source, project);

    case "full": {
      // Последовательность: синхронизация → скан → (текст: Gemini,
      // если настроен) → перцептуальные хэши → вектора лиц. Останавливаемся
      // на первой незавершённой фазе, клиент повторяет вызов.
      const geminiKey = process.env.GEMINI_API_KEY;
      const phases: Array<() => Promise<PhaseResult>> = [
        () => phaseSync(source, project),
        () => phaseScan(source, project),
      ];

      if (geminiKey) {
        phases.push(
          () => phaseDescribe(source, geminiKey, retryErrors, project),
          () => phaseEmbed(geminiKey, project),
        );
      }

      phases.push(() => phasePhash(source, project));

      if (process.env.FACE_API_URL) {
        const faceUrl = process.env.FACE_API_URL;
        const faceApiSecret = process.env.FACE_API_SECRET || "";
        phases.push(() => phaseFaceEmbed(source, faceUrl, faceApiSecret, project));
      }

      let lastResult: PhaseResult = {
        phase: "full",
        processed: 0,
        remaining: 0,
        done: true,
        errors: [],
      };

      for (const phaseFn of phases) {
        const result = await phaseFn();
        lastResult = {
          phase: result.phase,
          processed: lastResult.processed + result.processed,
          remaining: result.remaining,
          done: result.done,
          errors: [...lastResult.errors, ...result.errors],
        };

        // If this phase isn't done, stop here and let the client re-call
        if (!result.done) {
          lastResult.phase = `full (paused at ${result.phase})`;
          break;
        }
      }

      return lastResult;
    }

    default:
      throw new Error(`Unknown phase: ${phase}`);
  }
}

export async function POST(request: NextRequest) {
  let body: { phase?: string; retryErrors?: boolean; project?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const project =
    coerceProjectKey(body.project) ??
    coerceProjectKey(request.nextUrl.searchParams.get("project")) ??
    "default";

  // Проект из запроса — только ограничение; для admin фактический проект
  // берётся из его лицензии в requireProjectAccess (чужой ключ не сработает).
  const auth = await requireAdminAccess(request, project);
  if (!auth.ok) return auth.response;

  const phase = body.phase as Phase;
  if (!phase || !VALID_PHASES.includes(phase)) {
    return NextResponse.json(
      { error: `Invalid phase. Must be one of: ${VALID_PHASES.join(", ")}` },
      { status: 400 },
    );
  }

  const activeProject = auth.ctx.projectKey ?? "default";

  try {
    const result = await runPhase(phase, activeProject, body.retryErrors);
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pipeline] Phase ${phase} failed:`, message);
    return NextResponse.json(
      { error: `Pipeline ${phase} failed: ${message}` },
      { status: 500 },
    );
  }
}
