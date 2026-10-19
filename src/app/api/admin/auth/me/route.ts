// @TheTechMargin 2026
// Текущая сессия: кто вошёл, роль, проект (для admin — из лицензии) и
// срок действия лицензии. Используется админкой, чтобы решить, что показать.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/adminAuth";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ctx = await getSession(request);
  if (!ctx) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const payload: Record<string, unknown> = {
    user: { id: ctx.userId, email: ctx.email, role: ctx.role },
  };

  if (ctx.role === "admin") {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("admin_project_access")
      .select("project_key, starts_at, expires_at, is_revoked")
      .eq("user_id", ctx.userId)
      .maybeSingle();

    if (!data) {
      payload.license = null;
    } else {
      const now = Date.now();
      const expires = new Date(data.expires_at).getTime();
      const starts = new Date(data.starts_at).getTime();
      payload.license = {
        projectKey: data.project_key,
        startsAt: data.starts_at,
        expiresAt: data.expires_at,
        revoked: data.is_revoked,
        status: data.is_revoked
          ? "revoked"
          : now < starts
            ? "not_started"
            : now >= expires
              ? "expired"
              : "active",
      };
    }
  }

  return NextResponse.json(payload);
}
