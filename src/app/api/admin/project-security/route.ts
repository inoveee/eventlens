// @TheTechMargin 2026
// Настройки доступа и брендинга проекта (миграция 018).
//   GET  /api/admin/project-security?project=<key> — текущие значения
//   POST /api/admin/project-security               — изменить
//
// POST-действия:
//   { action: "set-gallery-password",    password }    — argon2id-хеш в БД
//   { action: "clear-gallery-password" }               — пароль снят
//   { action: "set-whitelabel",          enabled }     — только super_admin
//   { action: "set-active",              active }      — только super_admin
//
// Доступ — через requireProjectAccess: super_admin видит любой проект,
// admin — только свой (по лицензии). Whitelabel и активность переключает
// исключительно super_admin.

import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/adminAuth";
import { hashPassword } from "@/lib/password";
import {
  StorageUnavailableError,
  readProjectAccess,
  writeProjectAccess,
} from "@/lib/eventSettingsStore";

export const dynamic = "force-dynamic";

/** Минимальная длина пароля галереи. */
const GALLERY_PASSWORD_MIN = 6;

export async function GET(request: NextRequest) {
  const auth = await requireProjectAccess(
    request,
    request.nextUrl.searchParams.get("project"),
  );
  if (!auth.ok) return auth.response;

  const projectKey = auth.ctx.projectKey;
  if (!projectKey) {
    return NextResponse.json({ error: "Проект не выбран" }, { status: 400 });
  }

  const access = await readProjectAccess(projectKey);
  return NextResponse.json({
    project: projectKey,
    hasGalleryPassword: access.galleryPasswordHash !== null,
    whitelabelEnabled: access.whitelabelEnabled,
    isActive: access.isActive,
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  // Проект из тела запроса — только ограничение; для admin фактический
  // проект берётся из лицензии в requireProjectAccess.
  const requested =
    typeof body.project === "string" && body.project
      ? body.project
      : request.nextUrl.searchParams.get("project");
  const auth = await requireProjectAccess(request, requested);
  if (!auth.ok) return auth.response;

  const projectKey = auth.ctx.projectKey;
  if (!projectKey) {
    return NextResponse.json({ error: "Проект не выбран" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";

  try {
    if (action === "set-gallery-password") {
      const password = typeof body.password === "string" ? body.password : "";
      if (password.length < GALLERY_PASSWORD_MIN) {
        return NextResponse.json(
          { error: `Пароль — не короче ${GALLERY_PASSWORD_MIN} символов` },
          { status: 400 },
        );
      }
      const hash = await hashPassword(password);
      await writeProjectAccess(projectKey, { galleryPasswordHash: hash });
      return NextResponse.json({ project: projectKey, hasGalleryPassword: true });
    }

    if (action === "clear-gallery-password") {
      await writeProjectAccess(projectKey, { galleryPasswordHash: null });
      return NextResponse.json({ project: projectKey, hasGalleryPassword: false });
    }

    if (action === "set-whitelabel") {
      if (auth.ctx.role !== "super_admin") {
        return NextResponse.json(
          { error: "Whitelabel переключает только суперадмин" },
          { status: 403 },
        );
      }
      const enabled = body.enabled === true;
      await writeProjectAccess(projectKey, { whitelabelEnabled: enabled });
      return NextResponse.json({ project: projectKey, whitelabelEnabled: enabled });
    }

    if (action === "set-active") {
      if (auth.ctx.role !== "super_admin") {
        return NextResponse.json(
          { error: "Активность проекта меняет только суперадмин" },
          { status: 403 },
        );
      }
      const active = body.active !== false;
      await writeProjectAccess(projectKey, { isActive: active });
      return NextResponse.json({ project: projectKey, isActive: active });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (err) {
    if (err instanceof StorageUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("[admin/project-security] POST failed:", err);
    return NextResponse.json(
      { error: "Не удалось сохранить настройки доступа" },
      { status: 500 },
    );
  }
}
