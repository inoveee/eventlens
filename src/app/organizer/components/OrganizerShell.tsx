// @TheTechMargin 2026
// Оболочка настроек проекта: боковая навигация (включая возврат к
// списку «Все проекты»), верхняя панель со статусом публикации и
// действиями, уведомления.

"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  useOrganizer,
  useOrganizerAuth,
} from "@/hooks/organizer/OrganizerContext";
import Toast from "@/components/Toast";
import OrganizerAuthGate, { LoadingScreen } from "./AuthGate";

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

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  /** Активен только при точном совпадении пути. */
  exact?: boolean;
}

const PROJECTS_ICON = (
  <svg {...iconProps}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
  </svg>
);

export default function OrganizerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast, dismissToast, logout } = useOrganizerAuth();
  const {
    projectKey,
    loading,
    loadError,
    draft,
    status,
    unsavedChanges,
    unpublishedChanges,
    save,
    publish,
    openPublicPage,
    busy,
    reload,
  } = useOrganizer();

  const base = `/organizer/project/${encodeURIComponent(projectKey)}`;
  const NAV: NavItem[] = [
    { href: "/", label: "Все проекты", icon: PROJECTS_ICON, exact: true },
    {
      href: base,
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
      href: `${base}/photos`,
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
      href: `${base}/appearance`,
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
      href: `${base}/settings`,
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

  const isActive = (item: NavItem) =>
    item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const primaryAction = unsavedChanges
    ? { label: busy ? "Сохраняем…" : "Сохранить изменения", onClick: () => void save() }
    : unpublishedChanges
      ? { label: busy ? "Публикуем…" : "Опубликовать", onClick: () => void publish() }
      : null;

  return (
    // Крестик на экране входа (сессия истекла внутри панели) закрывает
    // настройки и уводит на стартовый экран.
    <OrganizerAuthGate onClose={() => router.push("/")}>
      <div className="org-shell min-h-screen">
        <div className="mx-auto flex min-h-screen w-full max-w-[1360px]">
          {/* ── Боковая панель ── */}
          <aside className="hidden w-[248px] shrink-0 flex-col border-r border-[var(--org-border)] px-4 py-6 lg:flex">
            <Link href="/" className="mb-1 flex items-center gap-2.5 px-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/noveee-icon.png" alt="noveee.me" className="h-7 w-auto" />
              <span className="text-[14.5px] font-semibold tracking-[-0.01em]">
                noveee.me
              </span>
            </Link>
            <p className="mb-6 truncate px-2 text-[12.5px] text-[var(--org-dim)]" title={draft.text.name}>
              {draft.text.name}
            </p>

            <nav className="flex flex-col gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="org-nav-item"
                  data-active={isActive(item) ? "true" : "false"}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </Link>
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
                  <Link href="/" className="org-btn org-btn-ghost px-2 text-[13px]">
                    Все проекты
                  </Link>
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
                    onClick={openPublicPage}
                    className="org-btn org-btn-secondary"
                    title="Открыть публичную страницу проекта"
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
                  <Link
                    key={item.href}
                    href={item.href}
                    className="org-nav-item shrink-0"
                    data-active={isActive(item) ? "true" : "false"}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                ))}
              </nav>
            </header>

            <main className="flex-1 px-4 py-6 md:px-7 md:py-8">
              {loading ? (
                <LoadingScreen label="Загружаем проект…" />
              ) : (
                <>
                  {loadError && (
                    <div className="org-card mb-5 flex items-center justify-between gap-3 border-[#f0c8c5] p-4">
                      <p className="text-[13.5px] text-[var(--org-err)]">{loadError}</p>
                      <button className="org-btn org-btn-secondary" onClick={() => void reload()}>
                        Повторить
                      </button>
                    </div>
                  )}
                  {children}
                </>
              )}
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
    </OrganizerAuthGate>
  );
}
