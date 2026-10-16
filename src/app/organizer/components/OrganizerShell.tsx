// @TheTechMargin 2026
// Оболочка панели организатора: боковая навигация, верхняя панель
// со статусом публикации и действиями, экран входа, уведомления.

"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useOrganizer } from "@/hooks/organizer/OrganizerContext";
import Toast from "@/components/Toast";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const iconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const NAV: NavItem[] = [
  {
    href: "/organizer",
    label: "Обзор",
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/organizer/photos",
    label: "Фотографии",
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <circle cx="8.5" cy="10" r="1.6" />
        <path d="m4 17 4.5-4.5 3.5 3.5 3-3L20 17" />
      </svg>
    ),
  },
  {
    href: "/organizer/appearance",
    label: "Оформление",
    icon: (
      <svg {...iconProps}>
        <path d="M12 3.5 4.5 12a4.6 4.6 0 0 0 0 6.5 4.6 4.6 0 0 0 6.5 0L18.5 10" />
        <path d="M12 3.5 15 6.5" />
        <circle cx="16.5" cy="16.5" r="1.2" />
      </svg>
    ),
  },
  {
    href: "/organizer/settings",
    label: "Настройки мероприятия",
    icon: (
      <svg {...iconProps}>
        <path d="M4 7h16M4 12h16M4 17h16" />
        <circle cx="9" cy="7" r="2" fill="var(--org-panel)" />
        <circle cx="15" cy="12" r="2" fill="var(--org-panel)" />
        <circle cx="8" cy="17" r="2" fill="var(--org-panel)" />
      </svg>
    ),
  },
];

function LoginScreen() {
  const { secret, setSecret, login, authenticating, authError } = useOrganizer();

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

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-2.5 text-[13px] text-[var(--org-dim)]">
        <span
          className="h-3.5 w-3.5 animate-crosshair-spin border-2 border-[var(--org-border-strong)] border-t-[var(--org-text)]"
          aria-hidden
        />
        Загружаем настройки…
      </div>
    </div>
  );
}

export default function OrganizerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const {
    authenticated,
    loading,
    loadError,
    draft,
    status,
    unsavedChanges,
    unpublishedChanges,
    save,
    publish,
    openPublicPage,
    openPreview,
    logout,
    toast,
    dismissToast,
    busy,
    reload,
  } = useOrganizer();

  if (!authenticated) {
    if (loading) return <div className="org-shell"><LoadingScreen /></div>;
    return <div className="org-shell"><LoginScreen /></div>;
  }

  const isActive = (href: string) =>
    href === "/organizer" ? pathname === "/organizer" : pathname.startsWith(href);

  const primaryAction = unsavedChanges
    ? { label: busy ? "Сохраняем…" : "Сохранить изменения", onClick: () => void save() }
    : unpublishedChanges
      ? { label: busy ? "Публикуем…" : "Опубликовать", onClick: () => void publish() }
      : null;

  return (
    <div className="org-shell min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-[1360px]">
        {/* ── Боковая панель ── */}
        <aside className="hidden w-[248px] shrink-0 flex-col border-r border-[var(--org-border)] px-4 py-6 lg:flex">
          <a href="/organizer" className="mb-1 flex items-center gap-2.5 px-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/noveee-icon.png" alt="noveee.me" className="h-7 w-auto" />
            <span className="text-[14.5px] font-semibold tracking-[-0.01em]">
              noveee.me
            </span>
          </a>
          <p className="mb-6 truncate px-2 text-[12.5px] text-[var(--org-dim)]" title={draft.text.name}>
            {draft.text.name}
          </p>

          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="org-nav-item"
                data-active={isActive(item.href) ? "true" : "false"}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </a>
            ))}
          </nav>

          <div className="mt-auto flex flex-col gap-3 pt-8">
            <div className="px-2">
              <p className="org-hint">Фотографии → Оформление → Публикация</p>
            </div>
            <button
              onClick={logout}
              className="org-btn org-btn-ghost justify-start"
            >
              Выйти
            </button>
          </div>
        </aside>

        {/* ── Основная область ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-[var(--org-border)] bg-[color-mix(in_srgb,var(--org-bg)_88%,transparent)] backdrop-blur-md">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 md:px-7">
              <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/noveee-icon.png" alt="noveee.me" className="h-6 w-auto" />
              </div>

              <div className="min-w-[190px] flex-1">
                <div className="flex items-center gap-2.5">
                  <h1 className="truncate text-[15px] font-semibold tracking-[-0.015em]">
                    {draft.text.name}
                  </h1>
                  <span className="org-pill org-pill-neutral" title={status.hint}>
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        background:
                          status.tone === "ok"
                            ? "var(--org-ok)"
                            : status.tone === "warn"
                              ? "var(--org-warn)"
                              : "var(--org-faint)",
                      }}
                    />
                    {status.label}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={openPreview}
                  className="org-btn org-btn-secondary"
                  title="Открыть страницу с текущим черновиком"
                >
                  Предпросмотр
                </button>
                <button
                  onClick={openPublicPage}
                  className="org-btn org-btn-secondary"
                  title="Открыть публичную страницу"
                >
                  Открыть страницу
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M15 3h6v6" />
                    <path d="M10 14 21 3" />
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  </svg>
                </button>
                {primaryAction && (
                  <button
                    onClick={primaryAction.onClick}
                    disabled={busy}
                    className="org-btn org-btn-primary"
                  >
                    {primaryAction.label}
                  </button>
                )}
              </div>
            </div>

            {/* Мобильная навигация */}
            <nav className="scrollbar-hide flex gap-1 overflow-x-auto px-4 pb-2.5 lg:hidden">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="org-nav-item shrink-0"
                  data-active={isActive(item.href) ? "true" : "false"}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </a>
              ))}
            </nav>
          </header>

          <main className="flex-1 px-4 py-6 md:px-7 md:py-8">
            {loadError && (
              <div className="org-card mb-5 flex items-center justify-between gap-3 border-[#f0c8c5] p-4">
                <p className="text-[13.5px] text-[var(--org-err)]">{loadError}</p>
                <button className="org-btn org-btn-secondary" onClick={() => void reload()}>
                  Повторить
                </button>
              </div>
            )}
            {children}
          </main>
        </div>
      </div>

      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          duration={5000}
          onDismiss={dismissToast}
        />
      )}
    </div>
  );
}
