// @TheTechMargin 2026
// Pipeline status polling — fetches status on interval, handles auth expiry.
//
// Две важные детали производительности:
//   1. Первый запрос уходит сразу при входе, а не через 5с — панель
//      раньше показывала пустой экран до первого тика интервала.
//   2. Колбэки держим в ref (идентичность fetchStatus стабильна): иначе
//      каждый рендер пересоздавал интервал и сбрасывал его таймер.

import { useState, useCallback, useEffect, useRef } from "react";
import type { StatusData } from "@/app/admin/types";

interface UseAdminStatusOptions {
  headers: () => Record<string, string>;
  authenticated: boolean;
  setAuthenticated: (v: boolean) => void;
  addLog: (msg: string) => void;
}

export function useAdminStatus({
  headers,
  authenticated,
  setAuthenticated,
  addLog,
}: UseAdminStatusOptions) {
  const [status, setStatus] = useState<StatusData | null>(null);

  const setAuthRef = useRef(setAuthenticated);
  const addLogRef = useRef(addLog);
  const inFlightRef = useRef(false);

  useEffect(() => {
    setAuthRef.current = setAuthenticated;
  }, [setAuthenticated]);
  useEffect(() => {
    addLogRef.current = addLog;
  }, [addLog]);

  const fetchStatus = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await fetch("/api/admin/status", { headers: headers() });
      if (!res.ok) {
        // 401 — сессия мертва, уводим на логин. Прочие ошибки (сеть,
        // 5xx) НЕ разлогинивают: иначе моргнувшая сеть выбрасывала
        // организатора со страницы.
        if (res.status === 401) {
          setAuthRef.current(false);
          return;
        }
        throw new Error(`Status fetch failed: ${res.status}`);
      }
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data: StatusData = await res.json();
        setStatus(data);
      } else {
        throw new Error("Unexpected response format");
      }
    } catch (error) {
      addLogRef.current(
        `Status error: ${error instanceof Error ? error.message : "Unknown"}`,
      );
    } finally {
      inFlightRef.current = false;
    }
  }, [headers]);

  // Первый запрос сразу + опрос каждые 5с, пока есть сессия.
  useEffect(() => {
    if (!authenticated) return;
    void fetchStatus();
    const interval = setInterval(() => void fetchStatus(), 5000);
    return () => clearInterval(interval);
  }, [authenticated, fetchStatus]);

  return { status, fetchStatus };
}
