// @TheTechMargin 2026
// Создание первого super_admin (или добавление нового) из переменных
// окружения — НЕ через публичный интерфейс.
//
// Использование:
//   SUPER_ADMIN_EMAIL="you@example.com" SUPER_ADMIN_PASSWORD="strong-pass" \
//     npm run create-super-admin
//
// Пароль хешируется argon2id и сохраняется только в виде хеша.
// Повторный запуск с тем же email обновляет пароль и реактивирует
// аккаунт — удобно для восстановления доступа.

import { createServerClient } from "../src/lib/supabase";
import { hashPassword } from "../src/lib/password";

async function main(): Promise<void> {
  const email = (process.env.SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD || "";

  if (!email || !email.includes("@")) {
    fail("SUPER_ADMIN_EMAIL must be a valid email address.");
  }
  if (password.length < 10) {
    fail("SUPER_ADMIN_PASSWORD must be at least 10 characters long.");
  }

  const supabase = createServerClient();
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("admin_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("admin_users")
      .update({ password_hash: passwordHash, role: "super_admin", is_active: true })
      .eq("id", existing.id);
    if (error) fail(`Update failed: ${error.message}`);
    console.log(`✓ Updated existing super_admin: ${email}`);
    return;
  }

  const { data, error } = await supabase
    .from("admin_users")
    .insert({
      email,
      password_hash: passwordHash,
      role: "super_admin",
      is_active: true,
      last_login_at: now,
    })
    .select("id")
    .single();
  if (error) fail(`Insert failed: ${error.message}`);

  console.log(`✓ Created super_admin: ${email} (id ${data.id})`);
  console.log("  Sign in at /admin/login.");
}

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

main().catch((err) => {
  console.error("✗ Unexpected error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
