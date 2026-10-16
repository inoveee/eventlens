// @TheTechMargin 2026
// Вход организатора и состояния ожидания. Общие для стартового экрана
// «Мои проекты» и настроек проекта.

"use client";

import type { ReactNode } from "react";
import { useOrganizerAuth } from "@/hooks/organizer/OrganizerContext";

export function LoginScreen() {
  const { secret, setSecret, login, authenticating, authError } = useOrganizerAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <div className="org-card w-full max-w-[380px] p-7">
        <div className="mb-6 flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/noveee-icon.png" alt="noveee.me" className="h-8 w-auto" />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">
            Панель организатора
          </span>
        </div>

        <h1 className="text-[19px] font-semibold tracking-[-0.02em]">Вход</h1>
        <p className="org-hint mt-1.5">
          Пароль выдаёт администратор мероприятия.
        </p>

        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            void login();
          }}
        >
          <label className="org-label mb-1.5" htmlFor="org-secret">
            Пароль организатора
          </label>
          <input
            id="org-secret"
            type="password"
            className="org-input"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoFocus
            aria-invalid={authError ? "true" : undefined}
          />
          {authError && (
            <p className="mt-2 text-[12.5px] font-medium text-[var(--org-err)]">
              {authError}
            </p>
          )}

          <button
            type="submit"
            className="org-btn org-btn-primary mt-4 w-full"
            disabled={authenticating}
          >
            {authenticating ? "Проверяем…" : "Войти"}
          </button>
        </form>
      </div>
      <p className="mt-5 text-xs text-[var(--org-faint)]">
        noveee.me · фотографии вашего мероприятия
      </p>
    </div>
  );
}

export function LoadingScreen({ label = "Загружаем…" }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-2.5 text-[13px] text-[var(--org-dim)]">
        <span
          className="h-3.5 w-3.5 animate-crosshair-spin border-2 border-[var(--org-border-strong)] border-t-[var(--org-text)]"
          aria-hidden
        />
        {label}
      </div>
    </div>
  );
}

/** Показывает содержимое только вошедшему организатору. */
export default function OrganizerAuthGate({ children }: { children: ReactNode }) {
  const { checking, authenticated } = useOrganizerAuth();
  if (checking) {
    return (
      <div className="org-shell">
        <LoadingScreen label="Проверяем вход…" />
      </div>
    );
  }
  if (!authenticated) {
    return (
      <div className="org-shell">
        <LoginScreen />
      </div>
    );
  }
  return <>{children}</>;
}
