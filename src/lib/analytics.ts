// @TheTechMargin 2026
// Server-side аналитика посещений и действий посетителей.
//
// Приватность — приоритет (тема биометрии):
//   - никаких селфи и векторов лиц;
//   - никакого сырого IP (аналитика его вообще не читает);
//   - полный текст поискового запроса НЕ сохраняется — только длина;
//   - session_id — случайный анонимный идентификатор из cookie, не
//     привязанный к личности, ротируется раз в 30 дней.
//
// Запись — fire-and-forget: ошибка/задержка записи события никогда не
// ломает и не задерживает основной ответ роута. Срок хранения чистит
// фоновая задача (см. SECURITY.md / migrations 019).

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

export const ANALYTICS_SESSION_COOKIE = "el_ga_sid";
export const ANALYTICS_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 дней

export type AnalyticsEventType =
  | "page_view"
  | "search_text"
  | "search_semantic"
  | "search_face"
  | "photo_view"
  | "download_single"
  | "download_zip"
  | "collage_create";

export interface TrackInput {
  projectKey: string;
  eventType: AnalyticsEventType;
  /** Только для photo_view / download_single (id как у photos.drive_file_id). */
  photoId?: string;
  /** Для download_zip / collage_create — сколько фото в действии. */
  photoCount?: number;
  /** Метаданные: query_len, results_count, match_tier и т.п. Приватные
   *  поля (query, selfie, embedding) сюда класть нельзя — см. sanitize. */
  metadata?: Record<string, unknown>;
}

/** Ключи metadata, которые запрещено сохранять (приватность). */
const FORBIDDEN_METADATA_KEYS = [
  "query",
  "q",
  "text",
  "selfie",
  "embedding",
  "image",
  "ip",
  "email",
];

/** Приводит metadata к приватному виду: вырезает запрещённые ключи,
 *  усекает значения, оставляет только примитивы. Экспортируется для тестов. */
export function sanitizeMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!metadata) return {};
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (FORBIDDEN_METADATA_KEYS.includes(key.toLowerCase())) continue;
    if (value == null) continue;
    if (typeof value === "number" || typeof value === "boolean") {
      clean[key] = value;
    } else if (typeof value === "string") {
      clean[key] = value.slice(0, 100);
    }
    // Массивы/объекты не сохраняем — только примитивы.
  }
  return clean;
}

/**
 * Читает (или создаёт) анонимный session_id. Возвращает id для использования
 * в событии и, если он был создан заново, — значение для cookie, которое
 * роут должен поставить на свой ответ. Если cookie уже есть — возвращает
 * null (менять нечего).
 */
export function resolveAnalyticsSession(
  request: NextRequest,
): { sessionId: string; newCookie: string | null } {
  const existing = request.cookies.get(ANALYTICS_SESSION_COOKIE)?.value;
  // Валидируем формат: только наш hex- id длиной 32 — чужие значения
  // (подделанные cookie) не принимаются, генерируем свежие.
  if (existing && /^[a-f0-9]{32}$/.test(existing)) {
    return { sessionId: existing, newCookie: null };
  }
  const sessionId = randomBytes(16).toString("hex");
  return { sessionId, newCookie: sessionId };
}

/** Ставит cookie анонимной сессии на ответ (если она только что создана). */
export function setAnalyticsSessionCookie(
  response: NextResponse,
  sessionId: string | null,
): void {
  if (!sessionId) return;
  response.cookies.set(ANALYTICS_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ANALYTICS_SESSION_TTL_SECONDS,
  });
}

/**
 * Записывает событие. Fire-and-forget: возвращает Promise, который никогда
 * не реджектится наружу — вызывающий может делать `void trackEvent(...)`
 * и не оборачивать в try/catch. Ошибки логируются, но не влияют на ответ.
 */
export function trackEvent(
  request: NextRequest,
  input: TrackInput,
  sessionIdOverride?: string,
): void {
  // Двигаемся дальше синхронно; вся работа — внутри promise.
  void (async () => {
    try {
      const { sessionId } = resolveAnalyticsSession(request);
      const finalSessionId = sessionIdOverride ?? sessionId;
      const { createServerClient } = await import("./supabase");
      const supabase = createServerClient();
      const { error } = await supabase.from("analytics_events").insert({
        project_key: input.projectKey,
        event_type: input.eventType,
        session_id: finalSessionId,
        photo_id: input.photoId ?? null,
        photo_count: input.photoCount ?? null,
        metadata: sanitizeMetadata(input.metadata),
      });
      if (error) {
        // Таблицы ещё нет (миграция 019 не применена) — не шумим на каждый
        // запрос; остальные ошибки логируем.
        if (error.code !== "42P01") {
          console.error("[analytics] trackEvent failed:", error.message);
        }
      }
    } catch (err) {
      console.error("[analytics] trackEvent failed:", err);
    }
  })();
}

/** Длина запроса — вместо самого текста (приватность). */
export function queryLengthMetadata(query: string): Record<string, unknown> {
  return { query_len: query.length };
}
