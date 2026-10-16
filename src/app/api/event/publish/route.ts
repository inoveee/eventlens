// @TheTechMargin 2026
// Публикация: черновик становится видимым посетителям.
// Можно передать текущий черновик в теле — тогда сохранение и публикация
// происходят за один шаг.

import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import {
  SettingsValidationError,
  normalizeEventSettings,
} from "@/lib/eventSettings";
import {
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
    const record = await readRecord();
    const draft = body?.draft
      ? normalizeEventSettings(body.draft, record.draft)
      : record.draft;
    const next = await writeRecord({ draft, published: draft });
    return NextResponse.json({
      draft: next.draft,
      published: next.published,
      updatedAt: next.updatedAt,
    });
  } catch (err) {
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
