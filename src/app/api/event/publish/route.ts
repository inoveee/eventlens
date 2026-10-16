// @TheTechMargin 2026
// Публикация: черновик становится видимым посетителям /p/<key>.
// Можно передать текущий черновик в теле — тогда сохранение и публикация
// происходят за один шаг. Ключ проекта — в теле или ?project=.

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
  writeRecord,
} from "@/lib/eventSettingsStore";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const key =
      coerceProjectKey(body?.project) ??
      coerceProjectKey(request.nextUrl.searchParams.get("project"));
    if (key === null) {
      return NextResponse.json({ error: "Некорректный ключ проекта" }, { status: 400 });
    }
    const record = await readRecord(key);
    const draft = body?.draft
      ? normalizeEventSettings(body.draft, record.draft)
      : record.draft;
    const next = await writeRecord(key, { draft, published: draft });
    return NextResponse.json({
      draft: next.draft,
      published: next.published,
      updatedAt: next.updatedAt,
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
    console.error("[event/publish] failed:", err);
    return NextResponse.json(
      { error: "Не удалось опубликовать настройки" },
      { status: 500 },
    );
  }
}
