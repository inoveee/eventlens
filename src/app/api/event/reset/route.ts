// @TheTechMargin 2026
// Сброс оформления к стандартному виду (значения из окружения проекта).
// Черновик и опубликованная версия заменяются одновременно — после
// сброса публичная страница сразу возвращается к исходному дизайну.

import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { defaultEventSettings } from "@/lib/eventSettings";
import {
  StorageUnavailableError,
  writeRecord,
} from "@/lib/eventSettingsStore";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const defaults = defaultEventSettings();
    const next = await writeRecord({ draft: defaults, published: defaults });
    return NextResponse.json({
      draft: next.draft,
      published: next.published,
      updatedAt: next.updatedAt,
    });
  } catch (err) {
    if (err instanceof StorageUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("[event/reset] failed:", err);
    return NextResponse.json(
      { error: "Не удалось сбросить оформление" },
      { status: 500 },
    );
  }
}
