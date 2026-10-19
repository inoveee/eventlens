// @TheTechMargin 2026
// Защита входа: rate limit и временная блокировка.
//
// Счётчики живут в БД (таблица login_attempts), а не в памяти процесса —
// serverless-инстансы Vercel не сохраняют состояние между вызовами,
// поэтому in-memory rate limiter здесь бесполезен.
//
// Политика:
//   - по логину: не более MAX_PER_LOGIN неудач за окно — защита от
//     перебора пароля к одному аккаунту;
//   - по IP-хешу: не более MAX_PER_IP неудач за окно — защита от
//     перебора многих логинов с одного адреса;
//   - IP хешируется с солью — сырой адрес в БД не хранится (приватность).
//
// Одинаковый текст ошибки для «нет пользователя» и «неверный пароль» —
// вызывающая сторона не должна раскрывать, какие логины существуют.

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { createServerClient } from "./supabase";

const WINDOW_SECONDS = 15 * 60; // окно 15 минут
const MAX_PER_LOGIN = 5; // неудач на логин за окно
const MAX_PER_IP = 20; // неудач на IP-хеш за окно
const TABLE = "login_attempts";

/** Соль для хеширования IP. Из окружения, чтобы хеш не был тривиально
 *  обратимым перебором известных адресов. */
function ipSalt(): string {
  return process.env.IP_HASH_SALT || process.env.SESSION_SECRET || "eventlens-ip-salt";
}

/** Стабильный хеш IP: не сырой адрес, а детерминированный digest. */
export function hashIp(ip: string): string {
  return createHash("sha256").update(`${ipSalt()}:${ip}`).digest("hex");
}

/** Ошибки, не связанные с БД: лимит считаем «мягким» — при сбое хранилища
 *  пускаем попытку, но логируем. Блокировать вход из-за упавшего счётчика
 *  нельзя. */
function logSoftFailure(context: string, err: unknown): void {
  console.error(`[loginRateLimit] ${context}:`, err);
}

export interface RateLimitStatus {
  allowed: boolean;
  /** Сколько секунд до снятия блокировки (если blocked). */
  retryAfterSeconds?: number;
}

/**
 * Чистое решение о блокировке по недавним неудачам — вынесено отдельно от
 * запроса к БД, чтобы тестировать логику без базы.
 *
 * @param rows         недавние НЕУДАЧНЫЕ попытки (success=false) за окно
 * @param loginKey     проверяемый логин
 * @param ipHash       хеш IP проверяемого
 * @param nowMs        текущее время (мс) — внедряется для детерминизма
 * @param limits       пороги: неудач на логин / на IP
 */
export function evaluateRateLimit(
  rows: Array<{ login_key: string; ip_hash: string; created_at: string }>,
  loginKey: string,
  ipHash: string,
  nowMs: number,
  limits: { maxPerLogin: number; maxPerIp: number; windowSeconds: number },
): RateLimitStatus {
  const loginFailures = rows.filter((r) => r.login_key === loginKey).length;
  const ipFailures = rows.filter((r) => r.ip_hash === ipHash).length;

  if (loginFailures < limits.maxPerLogin && ipFailures < limits.maxPerIp) {
    return { allowed: true };
  }
  // Ближайшая истекающая неудача определяет, когда можно снова.
  const oldest = rows
    .map((r) => new Date(r.created_at).getTime())
    .sort((a, b) => a - b)[0];
  const retryAfter = Math.max(
    1,
    Math.ceil((oldest + limits.windowSeconds * 1000 - nowMs) / 1000),
  );
  return { allowed: false, retryAfterSeconds: retryAfter };
}

/**
 * Проверяет, разрешена ли попытка входа. Смотрит на недавние неудачи по
 * логину и по IP-хешу. Ошибка хранилища → разрешаем (fail-open по
 * доступности, но не по секретности: пароль всё равно сверяется).
 */
export async function checkLoginAllowed(
  loginKey: string,
  ip: string,
): Promise<RateLimitStatus> {
  const ipHash = hashIp(ip);
  const since = new Date(Date.now() - WINDOW_SECONDS * 1000).toISOString();
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("login_key, ip_hash, created_at")
      .eq("success", false)
      .gte("created_at", since);
    if (error) {
      logSoftFailure("checkLoginAllowed select", error);
      return { allowed: true };
    }
    const rows = (data ?? []) as Array<{ login_key: string; ip_hash: string; created_at: string }>;
    return evaluateRateLimit(rows, loginKey, ipHash, Date.now(), {
      maxPerLogin: MAX_PER_LOGIN,
      maxPerIp: MAX_PER_IP,
      windowSeconds: WINDOW_SECONDS,
    });
  } catch (err) {
    logSoftFailure("checkLoginAllowed", err);
    return { allowed: true };
  }
}

/**
 * Записывает исход попытки. fire-and-forget: сбой записи не должен ломать
 * ответ роута (успех входа и так решает проверка пароля).
 */
export async function recordLoginAttempt(
  loginKey: string,
  ip: string,
  success: boolean,
): Promise<void> {
  try {
    const supabase = createServerClient();
    const { error } = await supabase.from(TABLE).insert({
      login_key: loginKey,
      ip_hash: hashIp(ip),
      success,
    });
    if (error) logSoftFailure("recordLoginAttempt insert", error);
  } catch (err) {
    logSoftFailure("recordLoginAttempt", err);
  }
}

/** Удаляет записи старше окна. Вызывается фоном из роута входа. */
export async function pruneLoginAttempts(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - WINDOW_SECONDS * 1000).toISOString();
    const supabase = createServerClient();
    const { error } = await supabase.from(TABLE).delete().lt("created_at", cutoff);
    if (error) logSoftFailure("pruneLoginAttempts", error);
  } catch (err) {
    logSoftFailure("pruneLoginAttempts", err);
  }
}

/** Сравнение строк без утечки через timing (используется в тестах/хелперах). */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Случайный анонимный идентификатор (для analytics session_id). */
export function randomId(bytes = 16): string {
  return randomBytes(bytes).toString("hex");
}
