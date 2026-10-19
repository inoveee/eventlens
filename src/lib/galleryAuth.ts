// @TheTechMargin 2026
// Guest-доступ к паролю-защищённым галереям.
//
// Это ОТДЕЛЬНЫЙ от admin-сессии механизм для посетителей: пароль галереи —
// per-project (лежит в event_settings.gallery_password_hash, argon2id),
// а не глобальный APP_PASSWORD. Успешный ввод разблокирует конкретный
// проект, и список разблокированных проектов хранится в подписанном
// httpOnly-cookie как JWT (jose, HS256).
//
// Почему JWT, а не «auth=true»: старый cookie был просто булевым флагом,
// который посетитель мог выставить сам в devtools и обойти пароль. Здесь
// значение подписывается секретом сервера — подделать список проектов
// без знания SESSION_SECRET невозможно.

import { SignJWT, jwtVerify } from "jose";
import type { NextResponse } from "next/server";
import { sessionSecretKey } from "./session";

export const GALLERY_COOKIE = "el_gallery_access";

/** Срок жизни guest-доступа: посетитель надолго запоминается на устройстве. */
export const GALLERY_ACCESS_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 дней

/** Полезная нагрузка guest-токена: проекты, чей пароль посетитель ввёл. */
export interface GalleryAccess {
  /** Массив разблокированных project_key. */
  projects: string[];
  exp: number;
}

/** Подписывает guest-токен с обновлённым списком разблокированных проектов. */
export async function signGalleryAccess(projects: string[]): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  // Дедупликация + ограничение размера: больше 50 проектов на устройстве
  // не понадобится, и токен не раздувается.
  const unique = [...new Set(projects.filter(Boolean))].slice(-50);
  return new SignJWT({ projects: unique })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + GALLERY_ACCESS_TTL_SECONDS)
    .sign(sessionSecretKey());
}

/** Проверяет guest-токен. Битый/просроченный/чужой → null. */
export async function verifyGalleryAccess(token: string): Promise<GalleryAccess | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecretKey(), {
      algorithms: ["HS256"],
    });
    const projects = Array.isArray(payload.projects)
      ? payload.projects.filter((p): p is string => typeof p === "string")
      : [];
    return { projects, exp: typeof payload.exp === "number" ? payload.exp : 0 };
  } catch {
    return null;
  }
}

/** Разблокирован ли проект по текущему cookie (или вообще не защищён). */
export function isProjectUnlocked(
  access: GalleryAccess | null,
  projectKey: string,
): boolean {
  return !!access && access.projects.includes(projectKey);
}

/**
 * Ставит обновлённый guest-cookie: добавляет проект в список разблокированных.
 * httpOnly + Secure(prod) + SameSite=Lax — тот же профиль, что у admin-сессии.
 */
export async function setGalleryAccessCookie(
  response: NextResponse,
  projects: string[],
): Promise<void> {
  const token = await signGalleryAccess(projects);
  response.cookies.set(GALLERY_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GALLERY_ACCESS_TTL_SECONDS,
  });
}

/** Полностью снимает guest-cookie. */
export function clearGalleryAccessCookie(response: NextResponse): void {
  response.cookies.set(GALLERY_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
