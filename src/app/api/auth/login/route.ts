// @TheTechMargin 2026
// Вход посетителя в пароль-защищённую галерею.
//
// Пароль — per-project: он хранится в event_settings.gallery_password_hash
// (argon2id) и задаётся организатором. Глобальный APP_PASSWORD остаётся
// ТОЛЬКО дефолтом для легаси-проекта «default» (одно мероприятие на деплой)
// и не действует на остальные проекты — чужие галереи им не откроются.
//
// Успех кладёт подписанный guest-cookie (список разблокированных проектов),
// см. galleryAuth.ts. Ошибка всегда одинаковая — не раскрываем, какой пароль
// ожидается и есть ли он вообще.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { verifyPassword } from "@/lib/password";
import { readProjectAccess } from "@/lib/eventSettingsStore";
import { isProjectKey } from "@/lib/eventSettings";
import {
  GALLERY_COOKIE,
  setGalleryAccessCookie,
  verifyGalleryAccess,
} from "@/lib/galleryAuth";

export const dynamic = "force-dynamic";

const GENERIC_ERROR = "Неверный пароль";

/** Извлекает project_key из тела (?project=) с валидацией формата. */
function resolveProjectKey(body: unknown, request: NextRequest): string | null {
  const fromBody = (body as { project?: unknown })?.project;
  const raw =
    typeof fromBody === "string" && fromBody
      ? fromBody
      : request.nextUrl.searchParams.get("project");
  if (!raw) return "default";
  return isProjectKey(raw) ? raw : null;
}

/**
 * Сверяет присланный пароль с ожидаемым для проекта. Для default-проекта
 * без заданного в БД пароля — fallback на APP_PASSWORD (timing-safe).
 */
async function verifyProjectPassword(
  projectKey: string,
  password: string,
): Promise<boolean> {
  const access = await readProjectAccess(projectKey);

  if (access.galleryPasswordHash) {
    return verifyPassword(access.galleryPasswordHash, password);
  }

  // Легаси: только «default» и только если в БД пароль не задан.
  if (projectKey === "default") {
    const appPassword = process.env.APP_PASSWORD;
    if (!appPassword) return false;
    const a = Buffer.from(password);
    const b = Buffer.from(appPassword);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  // Проект без пароля вообще — вход не нужен, но и пустой пароль не пускаем.
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const projectKey = resolveProjectKey(body, request);
    if (!projectKey) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    const password = typeof body?.password === "string" ? body.password : "";
    if (!password) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    const valid = await verifyProjectPassword(projectKey, password);
    if (!valid) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    // Уже разблокированные проекты из текущего cookie — не теряем их.
    const existingToken = request.cookies.get(GALLERY_COOKIE)?.value;
    const existing = existingToken ? await verifyGalleryAccess(existingToken) : null;
    const projects = existing?.projects ?? [];

    const response = NextResponse.json({ success: true, project: projectKey });
    await setGalleryAccessCookie(response, [...projects, projectKey]);
    return response;
  } catch {
    return NextResponse.json(
      { error: "Не удалось войти — попробуйте позже" },
      { status: 500 },
    );
  }
}
