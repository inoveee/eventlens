// @TheTechMargin 2026
// Подключение и синхронизация папки с фотографиями.
//   POST { action: "connect", url }   — проверить ссылку и сохранить источник
//   POST { action: "sync" }           — перепроверить сохранённую ссылку
// Проверка реальная: ссылка резолвится через API провайдера, ошибки
// доступа/поиска возвращаются как понятные сообщения.

import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { classifyPhotoUrl, probePhotoSource, readProcessingStats } from "@/lib/photoSource";
import { coerceProjectKey } from "@/lib/eventSettings";
import {
  ProjectNotFoundError,
  StorageUnavailableError,
  readRecord,
  writeRecord,
} from "@/lib/eventSettingsStore";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      url?: string;
      project?: string;
    };
    const key =
      coerceProjectKey(body.project) ??
      coerceProjectKey(request.nextUrl.searchParams.get("project"));
    if (key === null) {
      return NextResponse.json({ error: "Некорректный ключ проекта" }, { status: 400 });
    }
    const record = await readRecord(key);

    let target = (body.url || "").trim();
    // Живые счётчики обработки: страница фотографий опрашивает их во время
    // инжеста, чтобы прогресс двигался без повторного пробы листинга.
    if (body.action === "stats") {
      return NextResponse.json({ processed: await readProcessingStats(key) });
    }
    if (body.action === "sync") {
      target = record.photos?.url || "";
      if (!target) {
        return NextResponse.json(
          { error: "Папка ещё не подключена — вставьте ссылку на папку." },
          { status: 400 },
        );
      }
    } else if (body.action !== "connect") {
      return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
    }

    const probe = await probePhotoSource(target);

    if (!probe.ok) {
      const previous = record.photos;
      const attempted = classifyPhotoUrl(target || previous?.url || "");
      const hadWorkingConnection =
        previous?.status === "connected" && previous.url && attempted.url === previous.url;

      if (hadWorkingConnection) {
        // Синхронизация той же папки не удалась — прежнее подключение
        // остаётся рабочим, но ошибка показывается организатору.
        const next = await writeRecord(key, {
          photos: { ...previous, error: probe.error },
        });
        return NextResponse.json(
          { photos: next.photos, error: probe.error },
          { status: 422 },
        );
      }

      if (previous?.status === "connected" && attempted.url !== previous.url) {
        // Новая ссылка не работает — не ломаем уже подключённую папку.
        return NextResponse.json(
          {
            photos: previous,
            error: `${probe.error} Активной остаётся прежняя папка.`,
            keptPrevious: true,
          },
          { status: 422 },
        );
      }

      const next = await writeRecord(key, {
        photos: {
          provider:
            probe.provider === "unknown"
              ? previous?.provider ?? "yandex"
              : probe.provider,
          url: target || previous?.url || "",
          status: "error",
          photoCount: previous?.photoCount ?? 0,
          folderCount: previous?.folderCount ?? 0,
          processed: previous?.processed ?? null,
          connectedAt: previous?.connectedAt ?? new Date().toISOString(),
          lastSyncAt: previous?.lastSyncAt ?? null,
          error: probe.error,
        },
      });
      return NextResponse.json({ photos: next.photos, error: probe.error }, { status: 422 });
    }

    const processed = await readProcessingStats(key);
    const now = new Date().toISOString();
    const next = await writeRecord(key, {
      photos: {
        provider: probe.provider,
        url: probe.url,
        status: "connected",
        photoCount: probe.photoCount,
        folderCount: probe.folderCount,
        processed,
        connectedAt: record.photos?.connectedAt ?? now,
        lastSyncAt: now,
        error: null,
      },
    });

    return NextResponse.json({
      photos: next.photos,
      truncated: probe.truncated === true,
      detected: classifyPhotoUrl(target).provider,
    });
  } catch (err) {
    if (err instanceof ProjectNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof StorageUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("[event/photos] failed:", err);
    return NextResponse.json(
      { error: "Не удалось подключить папку — попробуйте ещё раз." },
      { status: 500 },
    );
  }
}
