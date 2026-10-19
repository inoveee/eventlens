// @TheTechMargin 2026
// Вход админа по email и паролю.
//
// Защита:
//   - rate limit по логину и по IP-хешу (временная блокировка после N
//     неудач) — см. loginRateLimit;
//   - единый текст ошибки «Неверный email или пароль» для несуществующего
//     пользователя и неверного пароля — не раскрываем, какие логины есть;
//   - пароль сверяется с argon2id-хешем; при неудаче тратится одинаковое
//     время (verify по фиктивному хешу), чтобы не выдавать существование
//     аккаунта по скорости ответа;
//   - при успехе: подписанный JWT в httpOnly-cookie + обновление last_login_at.
//
// Старый ADMIN_API_SECRET (Bearer) остаётся для скриптов/CI и помечен
// deprecated для UI — этот роут ему не нужен.

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { verifyPassword } from "@/lib/password";
import {
  checkLoginAllowed,
  pruneLoginAttempts,
  recordLoginAttempt,
} from "@/lib/loginRateLimit";
import { setSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

const GENERIC_ERROR = "Неверный email или пароль";

/** Фиктивный argon2id-хеш для несуществующего пользователя: сверка с ним
 *  занимает столько же времени, сколько реальная, — нельзя засечь по
 *  задержке, есть ли логин. Сгенерирован заранее для пароля-заглушки. */
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$NrmlSN7fZkTTht9M43x+FQ$ZbB1h9M4EivRQknoqLc+coK2hpEiD5mWQXW406C9OGQ";

function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const ip = clientIp(request);
  const loginKey = email;

  const limit = await checkLoginAllowed(loginKey, ip);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "Слишком много попыток входа. Попробуйте позже.",
        retryAfterSeconds: limit.retryAfterSeconds ?? 60,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds ?? 60) } },
    );
  }

  const supabase = createServerClient();
  const { data: user } = await supabase
    .from("admin_users")
    .select("id, email, password_hash, role, is_active")
    .eq("email", email)
    .maybeSingle();

  // Одинаковая ветка проверки для «нет пользователя» и «неверный пароль».
  const valid = user
    ? await verifyPassword(user.password_hash as string, password)
    : await verifyPassword(DUMMY_HASH, password);

  if (!user || !user.is_active || !valid) {
    await recordLoginAttempt(loginKey, ip, false);
    // фоновая чистка старых попыток — не блокирует ответ
    void pruneLoginAttempts();
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  await recordLoginAttempt(loginKey, ip, true);
  await supabase
    .from("admin_users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", user.id);

  const response = NextResponse.json({
    user: { id: user.id, email: user.email, role: user.role },
  });
  await setSessionCookie(response, {
    sub: user.id as string,
    email: user.email as string,
    role: user.role as "super_admin" | "admin",
  });
  return response;
}
