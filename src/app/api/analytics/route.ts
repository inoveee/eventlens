// @TheTechMargin 2026
// Beacon «посетитель открыл галерею».
//
// Почему отдельный роут, а не /api/photos: тот опрашивается клиентом каждые
// 30с и кэшируется ISR-ом (revalidate=60) — событие «заход» там либо
// терялось бы в кэше, либо умножалось на каждый поллинг. Здесь событие
// пишется ровно один раз при загрузке страницы, анонимно.
//
// POST { project } — пишет page_view (fire-and-forget) и ставит cookie
// с анонимным session_id, если его ещё нет. Приватность: никаких селфи,
// векторов, IP и текста — только id проекта и случайный session_id.

import { NextRequest, NextResponse } from "next/server";
import { coerceProjectKey } from "@/lib/eventSettings";
import {
  resolveAnalyticsSession,
  setAnalyticsSessionCookie,
  trackEvent,
} from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { project?: unknown };
  const project =
    coerceProjectKey(body.project) ??
    coerceProjectKey(request.nextUrl.searchParams.get("project")) ??
    "default";
  if (project === null) {
    return NextResponse.json({ error: "Некорректный ключ проекта" }, { status: 400 });
  }

  const { sessionId, newCookie } = resolveAnalyticsSession(request);
  trackEvent(request, { projectKey: project, eventType: "page_view" }, sessionId);

  const response = NextResponse.json({ success: true });
  setAnalyticsSessionCookie(response, newCookie);
  return response;
}
