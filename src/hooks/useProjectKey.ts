// @TheTechMargin 2026
// Ключ проекта текущей публичной страницы: галерея живёт по адресу
// /p/<key>. На любых других маршрутах (например, старые ссылки
// без ключа) используется проект «default».

"use client";

import { usePathname } from "next/navigation";
import { isProjectKey } from "@/lib/eventSettings";

export function useProjectKey(): string {
  const pathname = usePathname();
  const match = pathname?.match(/^\/p\/([^/]+)/);
  if (!match) return "default";
  try {
    const key = decodeURIComponent(match[1]).toLowerCase();
    return isProjectKey(key) ? key : "default";
  } catch {
    return "default";
  }
}
