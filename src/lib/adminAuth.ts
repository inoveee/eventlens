// @TheTechMargin 2026
// Единая точка авторизации для админских роутов и серверных действий.
//
// Главное правило: роль и доступ к проекту проверяются на СЕРВЕРЕ в
// КАЖДОМ запросе — не только в интерфейсе. JWT из cookie доказывает
// личность, но свежесть роли/активности/лицензии всегда перечитывается
// из БД: отозванный доступ или деактивированный аккаунт перестаёт
// действовать сразу, а не через 8 часов истечения токена.
//
// Паттерн использования в роуте:
//   const auth = await requireProjectAccess(request, projectKey);
//   if (!auth.ok) return auth.response;
//   // auth.ctx.userId / .role / .projectKey
//
// Админ не может получить чужие данные подбором project_key: для роли
// admin проект берётся из его лицензии в БД, а не из запроса.

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "./supabase";
import { SESSION_COOKIE, verifySession } from "./session";
import { verifyAuth } from "./auth";

export type AdminRole = "super_admin" | "admin";

export interface AdminContext {
  userId: string;
  email: string;
  role: AdminRole;
  /** Для admin — проект из его действующей лицензии.
   *  Для super_admin — запрошенный проект (или null, если не нужен). */
  projectKey: string | null;
}

export type AuthResult =
  | { ok: true; ctx: AdminContext }
  | { ok: false; response: NextResponse };

function unauthorized(message = "Требуется вход"): AuthResult {
  return { ok: false, response: NextResponse.json({ error: message }, { status: 401 }) };
}

function forbidden(message: string): AuthResult {
  return { ok: false, response: NextResponse.json({ error: message }, { status: 403 }) };
}

/** Лицензия админа к проекту с причиной отказа, если она есть. */
interface AccessRow {
  project_key: string;
  starts_at: string;
  expires_at: string;
  is_revoked: boolean;
}

/** Результат проверки окна действия лицензии. */
export type LicenseStatus = "active" | "revoked" | "not_started" | "expired" | "missing";

/**
 * Чистая проверка лицензии — вынесена из requireProjectAccess, чтобы
 * тестировать решение о доступе без БД и NextRequest.
 *
 * @param row   строка admin_project_access (или null — лицензии нет)
 * @param nowMs текущее время (мс); внедряется для детерминизма тестов
 */
export function evaluateLicense(row: AccessRow | null, nowMs: number): LicenseStatus {
  if (!row) return "missing";
  if (row.is_revoked) return "revoked";
  const starts = new Date(row.starts_at).getTime();
  const expires = new Date(row.expires_at).getTime();
  if (nowMs < starts) return "not_started";
  if (nowMs >= expires) return "expired";
  return "active";
}

/** Решение о доступе админа к запрошенному проекту — чистая логика. */
export interface ProjectScopeDecision {
  allowed: boolean;
  /** Фактический проект (из лицензии для admin, из запроса для super_admin). */
  projectKey: string | null;
  /** Человекочитаемая причина отказа (для 403). */
  reason?: string;
}

/**
 * Чистое решение: какой проект разрешён и допущен ли запрос.
 *
 * super_admin — доступ ко всем проектам; requestedKey становится проектом.
 * admin — ровно один проект из лицензии; requestedKey, если задан и чужой,
 * отклоняется (админ не может подставить чужой project_key в запросе).
 */
export function resolveProjectScope(
  role: AdminRole,
  licenseProjectKey: string | null,
  requestedKey: string | null | undefined,
): ProjectScopeDecision {
  if (role === "super_admin") {
    return { allowed: true, projectKey: requestedKey ?? null };
  }
  if (!licenseProjectKey) {
    return { allowed: false, projectKey: null, reason: "У вас нет доступа к этому проекту" };
  }
  if (requestedKey && requestedKey !== licenseProjectKey) {
    // Админ лезет в чужой проект — даже при действующей лицензии на свой.
    return { allowed: false, projectKey: null, reason: "У вас нет доступа к этому проекту" };
  }
  return { allowed: true, projectKey: licenseProjectKey };
}

/**
 * Читает и проверяет сессию из cookie. Кросс-проверяет с БД: пользователь
 * активен, роль берётся из БД (не из токена — чтобы деградация роли действовала
 * сразу). Возвращает context или null.
 */
export async function getSession(request: NextRequest): Promise<AdminContext | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("admin_users")
    .select("id, email, role, is_active")
    .eq("id", session.sub)
    .maybeSingle();
  if (error || !data) return null;
  if (!data.is_active) return null;

  return {
    userId: data.id,
    email: data.email,
    role: data.role as AdminRole,
    projectKey: null,
  };
}

/**
 * Требует, чтобы сессия принадлежала одной из указанных ролей.
 * Не привязывает к конкретному проекту (списки, обзоры, super_admin-роуты).
 */
export async function requireRole(
  request: NextRequest,
  ...roles: AdminRole[]
): Promise<AuthResult> {
  const ctx = await getSession(request);
  if (!ctx) return unauthorized();
  if (roles.length > 0 && !roles.includes(ctx.role)) {
    return forbidden("Недостаточно прав");
  }
  return { ok: true, ctx };
}

/**
 * Требует доступ к конкретному проекту.
 *
 *  - super_admin — доступ ко всем проектам; requestedKey попадает в ctx.
 *  - admin — ровно один проект по его действующей лицензии. requestedKey
 *    ИГНОРИРУЕТСЯ в пользу проекта из БД, если они различаются: админ не
 *    может подставить чужой project_key в запросе.
 *
 * Отказы различаются сообщением: «Лицензия истекла», «Доступ отозван»,
 * «Доступ ещё не начался», «Проект деактивирован».
 */
export async function requireProjectAccess(
  request: NextRequest,
  requestedKey?: string | null,
): Promise<AuthResult> {
  const ctx = await getSession(request);
  if (!ctx) return unauthorized();

  if (ctx.role === "super_admin") {
    return { ok: true, ctx: { ...ctx, projectKey: requestedKey ?? null } };
  }

  // Роль admin: проект строго из её лицензии.
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("admin_project_access")
    .select("project_key, starts_at, expires_at, is_revoked")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (error) {
    console.error("[adminAuth] access query failed:", error);
    return forbidden("Не удалось проверить доступ");
  }

  const row = (data ?? null) as AccessRow | null;
  const status = evaluateLicense(row, Date.now());

  switch (status) {
    case "missing":
      return forbidden("У вас нет доступа к этому проекту");
    case "revoked":
      return forbidden("Доступ отозван");
    case "not_started":
      return forbidden("Доступ ещё не начался");
    case "expired":
      return forbidden("Лицензия истекла — продлите её у организатора");
    case "active":
      break;
  }

  // row не-null в ветке active (evaluateLicense вернул бы "missing" иначе).
  const accessRow = row!;

  if (requestedKey && requestedKey !== accessRow.project_key) {
    // Админ лезет в чужой проект — даже при действующей лицензии на свой.
    return forbidden("У вас нет доступа к этому проекту");
  }

  // Проект должен быть активным.
  const { data: project } = await supabase
    .from("event_settings")
    .select("is_active")
    .eq("event_key", accessRow.project_key)
    .maybeSingle();
  if (!project || !project.is_active) return forbidden("Проект деактивирован");

  return { ok: true, ctx: { ...ctx, projectKey: accessRow.project_key } };
}

/**
 * Комбинированный гард для админских API (пайплайн, статус, модерация…).
 *
 * Сначала — сессия из cookie (штатный вход через /admin/login). Если живой
 * сессии нет, допускаем legacy Bearer `ADMIN_API_SECRET` — для скриптов и
 * CI (помечен deprecated для UI). Такой вызов получает роль super_admin
 * и запрошенный проект, минуя лицензию: токен — уровень доверия деплоя.
 *
 * requestedKey используется как ограничение для сессионного админа; для
 * Bearer-вызова проект берётся из него же (скрипту важно указать проект).
 */
export async function requireAdminAccess(
  request: NextRequest,
  requestedKey?: string | null,
): Promise<AuthResult> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (session) {
    // Живая сессия — полная проверка ролей/лицензии с БД.
    return requireProjectAccess(request, requestedKey);
  }

  // Нет сессии — legacy Bearer для скриптов/CI.
  if (verifyAuth(request)) {
    return {
      ok: true,
      ctx: { userId: "script", email: "script", role: "super_admin", projectKey: requestedKey ?? null },
    };
  }

  return unauthorized();
}
