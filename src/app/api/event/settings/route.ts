// @TheTechMargin 2026
// Настройки проекта (мероприятия).
//   GET  без авторизации — только опубликованная версия (нужна публичной
//        странице /p/<key>); с cookie-сессией — черновик, публикация и
//        статус папки. Ключ проекта — параметр ?project=<key>.
//   PUT  сохранить черновик (сессия обязательна; ключ — в теле).

import { NextRequest, NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/adminAuth";
import { SESSION_COOKIE } from "@/lib/session";
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

    // Креды присланы (cookie-сессия или legacy Bearer) — отвечаем строго:
    // полный черновик при успехе, отказ (401/403) как есть — панель должна
    // отличить неудачный вход от успеха и показать «Лицензия истекла» и т.п.
    // Без кредов — публичная версия для /p/<key> (галерея специально
    // ходит с credentials: "omit", поэтому даже залогиненный посетитель
    // получает только опубликованное).
    const hasCredentials =
      Boolean(request.headers.get("authorization")) ||
      request.cookies.has(SESSION_COOKIE);
    if (hasCredentials) {
      const auth = await requireAdminAccess(request, key);
      if (!auth.ok) return auth.response;
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
  try {
    const body = await request.json().catch(() => ({}));
    const key = coerceProjectKey(body?.project);
    if (key === null) {
      return NextResponse.json({ error: "Некорректный ключ проекта" }, { status: 400 });
    }
    const auth = await requireAdminAccess(request, key);
    if (!auth.ok) return auth.response;
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
