// @TheTechMargin 2026
// Настройки проекта (мероприятия).
//   GET  без авторизации — только опубликованная версия (нужна публичной
//        странице /p/<key>); с авторизацией — черновик, публикация и
//        статус папки. Ключ проекта — параметр ?project=<key>.
//   PUT  сохранить черновик (авторизация обязательна; ключ — в теле).

import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import {
  SettingsValidationError,
  coerceProjectKey,
  normalizeEventSettings,
} from "@/lib/eventSettings";
import {
  ProjectNotFoundError,
  StorageUnavailableError,
  readRecord,
  storageEngine,
  writeRecord,
} from "@/lib/eventSettingsStore";

export const dynamic = "force-dynamic";

function keyFromQuery(request: NextRequest): string | null {
  return coerceProjectKey(request.nextUrl.searchParams.get("project"));
}

export async function GET(request: NextRequest) {
  try {
    const key = keyFromQuery(request);
    if (key === null) {
      return NextResponse.json({ error: "Некорректный ключ проекта" }, { status: 400 });
    }

    // Присланный, но неверный токен — это 401, а не публичный ответ:
    // иначе панель организатора не отличит неудачный вход от успеха.
    if (request.headers.get("authorization")) {
      if (!verifyAuth(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const record = await readRecord(key);
      return NextResponse.json({
        draft: record.draft,
        published: record.published,
        photos: record.photos,
        meta: record.meta,
        updatedAt: record.updatedAt,
        storage: storageEngine(),
      });
    }
    const record = await readRecord(key);
    return NextResponse.json({ published: record.published });
  } catch (err) {
    if (err instanceof StorageUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("[event/settings] GET failed:", err);
    return NextResponse.json(
      { error: "Не удалось прочитать настройки мероприятия" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const key = coerceProjectKey(body?.project);
    if (key === null) {
      return NextResponse.json({ error: "Некорректный ключ проекта" }, { status: 400 });
    }
    const draft = normalizeEventSettings(body?.draft);
    const record = await writeRecord(key, { draft });
    return NextResponse.json({
      draft: record.draft,
      published: record.published,
      photos: record.photos,
      meta: record.meta,
      updatedAt: record.updatedAt,
    });
  } catch (err) {
    if (err instanceof ProjectNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof SettingsValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof StorageUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("[event/settings] PUT failed:", err);
    return NextResponse.json(
      { error: "Не удалось сохранить настройки" },
      { status: 500 },
    );
  }
}
