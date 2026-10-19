// @TheTechMargin 2026
// Сессии админки: подписанный JWT (jose) в httpOnly-cookie.
//
// Требования безопасности:
//   - httpOnly + Secure(prod) + SameSite=Lax — токен недоступен из JS
//     и не утекает при кросс-сайтовых запросах;
//   - короткое время жизни (SESSION_TTL_SECONDS) + скользящее обновление:
//     при каждом успешном обращении, если прожито больше половины срока,
//     cookie переиздаётся — активный пользователь не разлогинивается,
//     а брошенная сессия умирает сама;
//   - подпись HS256 секретом из окружения; роль и проект зашиты в токен,
//     но на каждый запрос всё равно сверяются с БД (см. adminAuth.ts) —
//     отозванный/деактивированный доступ перестаёт действовать сразу.
//
// Выход очищает cookie (clearSessionCookie).

import { SignJWT, jwtVerify } from "jose";
import type { NextResponse } from "next/server";

export const SESSION_COOKIE = "el_admin_session";

/** Базовый срок жизни сессии. Активное использование продлевает её. */
export const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 часов

/** Через сколько от начала срока cookie переиздаётся (скользящее обновление). */
const REFRESH_AFTER_SECONDS = 60 * 60 * 1; // 1 час

export interface AdminSession {
  /** admin_users.id */
  sub: string;
  email: string;
  role: "super_admin" | "admin";
  /** Unix-время истечения (secs). */
  exp: number;
}

/**
 * Секрет подписи (HS256) — общий для admin-сессий и guest-токенов галереи.
 * Отдельная переменная SESSION_SECRET; для обратной совместимости
 * допускаем ADMIN_API_SECRET как fallback (одиночный деплой). В проде без
 * явного секрета отказываемся подписывать — слабый дефолт опасен.
 */
export function sessionSecretKey(): Uint8Array {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.ADMIN_API_SECRET ||
    // Последний resort — детерминированный, но слабый: в проде проверяем ниже.
    "eventlens-dev-session-secret";
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.SESSION_SECRET &&
    !process.env.ADMIN_API_SECRET
  ) {
    throw new Error(
      "Set SESSION_SECRET (or ADMIN_API_SECRET) in production — refusing to sign sessions with a weak default.",
    );
  }
  return new TextEncoder().encode(secret);
}

function secretKey(): Uint8Array {
  return sessionSecretKey();
}

/** Подписывает сессию. */
export async function createSession(input: {
  sub: string;
  email: string;
  role: "super_admin" | "admin";
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ email: input.email, role: input.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_TTL_SECONDS)
    .sign(secretKey());
}

/**
 * Проверяет токен. Возвращает сессию или null (просроченная подпись,
 * неверный формат, битый токен — всё одинаково отклоняется).
 */
export async function verifySession(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.email !== "string") return null;
    const role = payload.role;
    if (role !== "super_admin" && role !== "admin") return null;
    return {
      sub: payload.sub,
      email: payload.email,
      role,
      exp: typeof payload.exp === "number" ? payload.exp : 0,
    };
  } catch {
    return null;
  }
}

/** Нужно ли переиздать cookie (скользящее обновление). */
export function shouldRefresh(session: AdminSession): boolean {
  const now = Math.floor(Date.now() / 1000);
  return session.exp - now < SESSION_TTL_SECONDS - REFRESH_AFTER_SECONDS;
}

/** Ставит cookie с подписанным токеном (при входе или обновлении). */
export async function setSessionCookie(
  response: NextResponse,
  input: { sub: string; email: string; role: "super_admin" | "admin" },
): Promise<void> {
  const token = await createSession(input);
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

/** Полностью снимает cookie (выход). */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
