// @TheTechMargin 2026
// Однократный beacon «посетитель открыл галерею» на /p/<key>.
//
// Срабатывает один раз при монтировании (StrictMode-повторы отфильтрованы
// рефом). Уходит на /api/analytics — там событие пишется fire-and-forget
// и ставится cookie с анонимным session_id. Ошибки сети игнорируются:
// аналитика не должна влиять на работу галереи.

import { useEffect, useRef } from "react";

export function usePageView(projectKey: string): void {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ project: projectKey }),
    }).catch(() => {});
  }, [projectKey]);
}
