// @TheTechMargin 2026
// Настройки мероприятия.
//   GET  без авторизации — только опубликованная версия (нужна публичной
//        странице); с авторизацией — черновик, публикация и статус папки.
//   PUT  сохранить черновик (авторизация обязательна).

import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import {
  SettingsValidationError,
  normalizeEventSettings,
} from "@/lib/eventSettings";
import {
  StorageUnavailableError,
  readRecord,
  storageEngine,
  writeRecord,
} from "@/lib/eventSettingsStore";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Присланный, но неверный токен — это 401, а не публичный ответ:
    // иначе панель организатора не отличит неудачный вход от успеха.
    if (request.headers.get("authorization")) {
      if (!verifyAuth(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const record = await readRecord();
      return NextResponse.json({
        draft: record.draft,
        published: record.published,
        photos: record.photos,
        updatedAt: record.updatedAt,
        storage: storageEngine(),
      });
    }
    const record = await readRecord();
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
    const draft = normalizeEventSettings(body?.draft);
    const record = await writeRecord({ draft });
    return NextResponse.json({
      draft: record.draft,
      published: record.published,
      photos: record.photos,
      updatedAt: record.updatedAt,
    });
  } catch (err) {
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
