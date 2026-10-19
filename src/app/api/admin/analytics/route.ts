// @TheTechMargin 2026
// Агрегированная аналитика для /admin/analytics.
//
// В браузер уходят ТОЛЬКО агрегаты (KPI, ряды, топ), никогда — сырые события
// и персональные данные. Все запросы — через SQL-функции (миграция 019),
// сгруппированные на стороне БД.
//
// Скоуп по роли:
//   - super_admin: project=… → один проект; project omitted/"" → все проекты
//     (analytics_by_project + сводка по всем);
//   - admin: ВСЕГДА только её проект из лицензии — параметр project из
//     запроса игнорируется (чужой project_key не подставить).
//
// Агрегаты вызываются с p_project_key = null только для super_admin.

import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/adminAuth";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const PERIODS = new Set(["7d", "30d", "90d", "24h"]);
/** Часовой пояс для почасовой разбивки; можно ?tz=. */
const TZ_RE = /^[A-Za-z0-9_+\-/]{1,64}$/;

function periodToRange(period: string): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  switch (period) {
    case "24h":
      from.setHours(from.getHours() - 24);
      break;
    case "30d":
      from.setDate(from.getDate() - 30);
      break;
    case "90d":
      from.setDate(from.getDate() - 90);
      break;
    default: // 7d
      from.setDate(from.getDate() - 7);
      break;
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const requested = sp.get("project");
  const auth = await requireProjectAccess(request, requested);
  if (!auth.ok) return auth.response;

  const periodParam = sp.get("period") || "7d";
  if (!PERIODS.has(periodParam)) {
    return NextResponse.json({ error: "Неизвестный период" }, { status: 400 });
  }
  const tzRaw = sp.get("tz") || "UTC";
  const tz = TZ_RE.test(tzRaw) ? tzRaw : "UTC";
  const { from, to } = periodToRange(periodParam);

  // Для admin проект всегда из лицензии; для super_admin — null = все проекты.
  const isSuper = auth.ctx.role === "super_admin";
  const projectKey: string | null = isSuper
    ? auth.ctx.projectKey || null
    : auth.ctx.projectKey;

  try {
    const supabase = createServerClient();

    const bucket = periodParam === "24h" ? "hour" : "day";

    const [summaryRes, seriesRes, hourlyRes, topRes] = await Promise.all([
      supabase.rpc("analytics_summary", {
        p_project_key: projectKey,
        p_from: from,
        p_to: to,
      }),
      supabase.rpc("analytics_timeseries", {
        p_project_key: projectKey,
        p_from: from,
        p_to: to,
        p_bucket: bucket,
        p_tz: tz,
      }),
      supabase.rpc("analytics_hourly", {
        p_project_key: projectKey,
        p_from: from,
        p_to: to,
        p_tz: tz,
      }),
      supabase.rpc("analytics_top_photos", {
        p_project_key: projectKey,
        p_from: from,
        p_to: to,
        p_limit: 10,
      }),
    ]);

    // Таблица по проектам — только super_admin (все проекты).
    let byProject: unknown[] = [];
    if (isSuper && projectKey === null) {
      const { data } = await supabase.rpc("analytics_by_project", {
        p_from: from,
        p_to: to,
      });
      byProject = data ?? [];
    }

    for (const res of [summaryRes, seriesRes, hourlyRes, topRes]) {
      if (res.error) {
        // Миграция 019 не применена — честно сообщаем, а не отдаём пустоту.
        return NextResponse.json(
          { error: `Аналитика недоступна: ${res.error.message}` },
          { status: 503 },
        );
      }
    }

    // KPI: разложим сводку по типам в удобные карточки.
    const summary = (summaryRes.data ?? []) as Array<{
      event_type: string;
      events: number;
      unique_visitors: number;
    }>;
    // Уникальные посетители — максимум по типам (один посетитель даёт
    // несколько типов событий, суммировать нельзя). Это верхняя оценка;
    // точный distinct по всем событиям считает БД в analytics_summary.
    const uniqueVisitors = summary.reduce(
      (max, s) => Math.max(max, s.unique_visitors ?? 0),
      0,
    );
    const kpi = {
      pageViews: summary.find((s) => s.event_type === "page_view")?.events ?? 0,
      uniqueVisitors,
      searches:
        (summary.find((s) => s.event_type === "search_text")?.events ?? 0) +
        (summary.find((s) => s.event_type === "search_semantic")?.events ?? 0),
      faceSearches: summary.find((s) => s.event_type === "search_face")?.events ?? 0,
      downloads:
        (summary.find((s) => s.event_type === "download_single")?.events ?? 0) +
        (summary.find((s) => s.event_type === "download_zip")?.events ?? 0),
      collages: summary.find((s) => s.event_type === "collage_create")?.events ?? 0,
    };

    return NextResponse.json({
      period: periodParam,
      from,
      to,
      project: projectKey,
      scope: projectKey === null ? "all" : "one",
      kpi,
      series: seriesRes.data ?? [],
      hourly: hourlyRes.data ?? [],
      topPhotos: topRes.data ?? [],
      byProject,
    });
  } catch (err) {
    console.error("[admin/analytics] GET failed:", err);
    return NextResponse.json(
      { error: "Не удалось построить аналитику" },
      { status: 500 },
    );
  }
}
