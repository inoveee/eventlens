// @TheTechMargin 2026
// Вход организатора и состояния ожидания. Общие для стартового экрана
// «Мои проекты» и настроек проекта. Фон страницы входа — картинка
// из public/login-bg.png (класс .org-login-bg в globals.css).

"use client";

import type { ReactNode } from "react";
import { useOrganizerAuth } from "@/hooks/organizer/OrganizerContext";

const closeIcon = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  "aria-hidden": true,
};

/**
 * Вход в панель: email + пароль (cookie-сессия). `onClose` закрывает
 * экран входа — тот же путь, что и кнопка «Назад» на стартовом экране
 * (возврат на интро). Крестик — в правом верхнем углу карточки.
 */
export function LoginScreen({ onClose }: { onClose?: () => void }) {
  const {
    email,
    setEmail,
    password,
    setPassword,
    login,
    authenticating,
    authError,
  } = useOrganizerAuth();

  return (
    <div className="org-login-bg flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <div className="org-card relative w-full max-w-[380px] p-7 shadow-[0_18px_50px_rgba(16,16,20,0.10)]">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-[var(--org-dim)] transition hover:bg-[var(--org-panel)] hover:text-[var(--org-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--el-primary,#4f7cff)]"
          >
            <svg {...closeIcon}>
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        )}
        <div className="mb-6 flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/noveee-icon.png" alt="noveee.me" className="h-8 w-auto" />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">
            Панель организатора
          </span>
        </div>

        <h1 className="text-[19px] font-semibold tracking-[-0.02em]">Вход</h1>
        <p className="org-hint mt-1.5">
          Учётную запись выдаёт администратор мероприятия.
        </p>

        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            void login();
          }}
        >
          <label className="org-label mb-1.5" htmlFor="org-email">
            Email
          </label>
          <input
            id="org-email"
            type="email"
            className="org-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoFocus
            aria-invalid={authError ? "true" : undefined}
          />

          <label className="org-label mb-1.5 mt-3.5" htmlFor="org-password">
            Пароль
          </label>
          <input
            id="org-password"
            type="password"
            className="org-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
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
export default function OrganizerAuthGate({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose?: () => void;
}) {
  const { checking, authenticated } = useOrganizerAuth();
  if (checking) {
    // Тот же фон, что и у входа, — без мигания пустого экрана.
    return (
      <div className="org-shell org-login-bg">
        <LoadingScreen label="Проверяем вход…" />
      </div>
    );
  }
  if (!authenticated) {
    return (
      <div className="org-shell">
        <LoginScreen onClose={onClose} />
      </div>
    );
  }
  return <>{children}</>;
}
