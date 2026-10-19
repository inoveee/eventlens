// @TheTechMargin 2026
// Статус пайплайна для технической панели /admin.
//
// Сводку считает БД: одна функция admin_photo_status() (миграция 020)
// вместо шести count(*)-запросов и выгрузки тысяч строк в приложение.
// Панель опрашивает роут каждые 5с, поэтому цена запроса важна.
//
// Пока миграция не применена, работает прежний путь (legacyStatus) —
// панель не ломается, просто отвечает медленнее.
//
// Проект: для admin он берётся из лицензии в БД (requireAdminAccess),
// для super_admin — из ?project=; без параметра — сводка по всем проектам.

import { NextRequest, NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/adminAuth";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface StatusPayload {
  total: number;
  completed: number;
  pending: number;
  processing: number;
  errors: number;
  withEmbeddings: number;
  faceEmbeddings: number;
  folders: Array<{ name: string; count: number }>;
  lastProcessed: string | null;
  recentErrors: Array<{ filename: string; error: string | null }>;
}

/** Функции admin_photo_status ещё нет — миграция 020 не применена. */
function rpcMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    /admin_photo_status/i.test(error.message ?? "")
  );
}

/** Прежний путь: считаем в приложении. Только как фолбэк до миграции. */
async function legacyStatus(projectKey: string | null): Promise<StatusPayload> {
  const supabase = createServerClient();
  // projectKey = null → сводка по всем проектам (super_admin).
  const photoCount = (status?: string) => {
    let q = supabase.from("photos").select("*", { count: "exact", head: true });
    if (projectKey) q = q.eq("project_key", projectKey);
    if (status) q = q.eq("status", status);
    return q;
  };
  const embeddedCount = () => {
    let q = supabase
      .from("photos")
      .select("*", { count: "exact", head: true })
      .not("description_embedding", "is", null);
    if (projectKey) q = q.eq("project_key", projectKey);
    return q;
  };
  const faceRows = () => {
    let q = supabase
      .from("face_embeddings")
      .select("drive_file_id")
      .not("embedding", "is", null);
    if (projectKey) q = q.eq("project_key", projectKey);
    return q;
  };
  const folderRows = () => {
    let q = supabase.from("photos").select("folder");
    if (projectKey) q = q.eq("project_key", projectKey);
    return q;
  };
  const lastProcessedQuery = () => {
    let q = supabase.from("photos").select("processed_at").eq("status", "completed");
    if (projectKey) q = q.eq("project_key", projectKey);
    return q.order("processed_at", { ascending: false }).limit(1);
  };
  const recentErrorsQuery = () => {
    let q = supabase.from("photos").select("filename, error_message").eq("status", "error");
    if (projectKey) q = q.eq("project_key", projectKey);
    return q.order("created_at", { ascending: false }).limit(10);
  };

  const [total, completed, pending, processing, errors, withEmbeddings, faces, folders, lastProcessed, recentErrors] =
    await Promise.all([
      photoCount(),
      photoCount("completed"),
      photoCount("pending"),
      photoCount("processing"),
      photoCount("error"),
      embeddedCount(),
      faceRows(),
      folderRows(),
      lastProcessedQuery(),
      recentErrorsQuery(),
    ]);

  const folderCounts: Record<string, number> = {};
  for (const row of folders.data || []) {
    const f = row.folder || "";
    folderCounts[f] = (folderCounts[f] || 0) + 1;
  }

  return {
    total: total.count || 0,
    completed: completed.count || 0,
    pending: pending.count || 0,
    processing: processing.count || 0,
    errors: errors.count || 0,
    withEmbeddings: withEmbeddings.count || 0,
    faceEmbeddings: new Set((faces.data || []).map((r) => r.drive_file_id)).size,
    folders: Object.entries(folderCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    lastProcessed: lastProcessed.data?.[0]?.processed_at || null,
    recentErrors: (recentErrors.data || []).map((e) => ({
      filename: e.filename as string,
      error: e.error_message as string | null,
    })),
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminAccess(
    request,
    request.nextUrl.searchParams.get("project"),
  );
  if (!auth.ok) return auth.response;

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase.rpc("admin_photo_status", {
      p_project_key: auth.ctx.projectKey ?? null,
    });

    if (error) {
      if (!rpcMissing(error)) {
        console.error("[admin/status] admin_photo_status failed:", error.message);
      }
      return NextResponse.json(await legacyStatus(auth.ctx.projectKey ?? null));
    }

    const payload = (data ?? {}) as Partial<StatusPayload>;
    return NextResponse.json({
      total: payload.total ?? 0,
      completed: payload.completed ?? 0,
      pending: payload.pending ?? 0,
      processing: payload.processing ?? 0,
      errors: payload.errors ?? 0,
      withEmbeddings: payload.withEmbeddings ?? 0,
      faceEmbeddings: payload.faceEmbeddings ?? 0,
      folders: payload.folders ?? [],
      lastProcessed: payload.lastProcessed ?? null,
      recentErrors: payload.recentErrors ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get status" },
      { status: 500 },
    );
  }
}
