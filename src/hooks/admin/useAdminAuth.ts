// @TheTechMargin 2026
// Состояние входа в админку: cookie-сессия (JWT), а не Bearer-секрет.
//
// При монтировании хук спрашивает /api/admin/auth/me — есть ли живая сессия
// и какая роль/проект. Форма входа шлёт email+пароль на /api/admin/auth/login,
// сервер ставит httpOnly-cookie; fetch дальше сам отправляет её для
// same-origin запросов, поэтому Authorization-заголовок больше не нужен.

import { useState, useCallback, useEffect } from "react";

export interface AdminUser {
  id: string;
  email: string;
  role: "super_admin" | "admin";
}

export interface AdminLicense {
  projectKey: string;
  startsAt: string;
  expiresAt: string;
  revoked: boolean;
  status: "active" | "expired" | "not_started" | "revoked";
}

export function useAdminAuth() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [license, setLicense] = useState<AdminLicense | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/auth/me", { credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user ?? null);
        setLicense(data.license ?? null);
        return true;
      }
      setUser(null);
      setLicense(null);
      return false;
    } catch {
      setUser(null);
      return false;
    }
  }, []);

  // Проверяем сессию при загрузке.
  useEffect(() => {
    let active = true;
    void (async () => {
      await refresh();
      if (active) setChecking(false);
    })();
    return () => {
      active = false;
    };
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setError(null);
      try {
        const res = await fetch("/api/admin/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Не удалось войти");
          return false;
        }
        setUser(data.user ?? null);
        // Дозапрашиваем лицензию (для admin-роли).
        await refresh();
        return true;
      } catch {
        setError("Сеть недоступна — попробуйте позже");
        return false;
      }
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    await fetch("/api/admin/auth/logout", { method: "POST", credentials: "same-origin" });
    setUser(null);
    setLicense(null);
  }, []);

  // Cookie-сессия: fetch сам шлёт её. Нужен только Content-Type.
  const headers = useCallback(
    () => ({ "Content-Type": "application/json" }),
    [],
  );

  return {
    user,
    license,
    authenticated: !!user,
    checking,
    error,
    login,
    logout,
    refresh,
    headers,
  };
}
