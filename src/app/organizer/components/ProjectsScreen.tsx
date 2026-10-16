// @TheTechMargin 2026
// Стартовый экран организатора: список мероприятий (проектов) с
// поиском, фильтром по статусу и переключателем «карточки/список».
// Отсюда организатор открывает настройки конкретного проекта.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ProjectSummary } from "@/lib/eventSettings";
import { useOrganizerAuth } from "@/hooks/organizer/OrganizerContext";
import Toast from "@/components/Toast";
import OrganizerAuthGate, { LoadingScreen } from "./AuthGate";
import { Field, Modal } from "./ui";
import { ProjectCard, ProjectRow, type ProjectActions } from "./ProjectCard";

type Filter = "all" | "published" | "draft" | "archive";
type View = "grid" | "list";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "Все" },
  { id: "published", label: "Опубликованные" },
  { id: "draft", label: "Черновики" },
  { id: "archive", label: "Архив" },
];

interface ProjectsResponse {
  projects?: ProjectSummary[];
  error?: string;
}

interface CreateState {
  open: boolean;
  title: string;
  date: string;
  description: string;
  busy: boolean;
  error: string | null;
}

const EMPTY_CREATE: CreateState = {
  open: false,
  title: "",
  date: "",
  description: "",
  busy: false,
  error: null,
};

function AvatarMenu({ onLogout }: { onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="org-avatar"
        aria-label="Профиль организатора"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        О
      </button>
      {open && (
        <div className="org-menu-panel" role="menu">
          <div className="px-3 py-2">
            <p className="text-[13px] font-semibold">Организатор</p>
            <p className="org-hint">Парольный доступ</p>
          </div>
          <div className="org-menu-divider" aria-hidden />
          <button
            type="button"
            role="menuitem"
            className="org-menu-item"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            Выйти
          </button>
        </div>
      )}
    </div>
  );
}

export default function ProjectsScreen() {
  const router = useRouter();
  const { secret, notify, toast, dismissToast, logout } = useOrganizerAuth();

  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<View>("grid");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [create, setCreate] = useState<CreateState>(EMPTY_CREATE);
  const [rename, setRename] = useState<{
    project: ProjectSummary | null;
    title: string;
    busy: boolean;
    error: string | null;
  }>({ project: null, title: "", busy: false, error: null });
  const [deleteTarget, setDeleteTarget] = useState<{
    project: ProjectSummary | null;
    busy: boolean;
  }>({ project: null, busy: false });

  const request = useCallback(
    async (path: string, init?: RequestInit): Promise<Response> => {
      return fetch(path, {
        ...init,
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
          ...(init?.headers || {}),
        },
      });
    },
    [secret],
  );

  const load = useCallback(async () => {
    // До восстановления секрета из sessionStorage не ходим в API —
    // иначе гонка гасит успешную загрузку поздним 401.
    if (!secret.trim()) return;
    setLoadError(null);
    try {
      const res = await request("/api/event/projects");
      if (res.status === 401) {
        setLoadError("Сессия истекла — войдите снова.");
        return;
      }
      const data = (await res.json()) as ProjectsResponse;
      if (!res.ok) throw new Error(data.error || "Не удалось загрузить проекты");
      setProjects(data.projects ?? []);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Не удалось загрузить проекты");
    }
  }, [request, secret]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Общая отправка действий; key — идентификатор занятого объекта. */
  const act = useCallback(
    async (body: Record<string, unknown>, key: string): Promise<Record<string, unknown> | null> => {
      setBusyKey(key);
      try {
        const res = await request("/api/event/projects", {
          method: "POST",
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as Record<string, unknown> & { error?: string };
        if (!res.ok) throw new Error(data.error || "Не удалось выполнить действие");
        return data;
      } catch (err) {
        notify(err instanceof Error ? err.message : "Не удалось выполнить действие");
        return null;
      } finally {
        setBusyKey(null);
      }
    },
    [request, notify],
  );

  /* ── Действия ── */

  const submitCreate = async () => {
    const title = create.title.trim();
    if (!title) {
      setCreate((s) => ({ ...s, error: "Укажите название мероприятия" }));
      return;
    }
    setCreate((s) => ({ ...s, busy: true, error: null }));
    const data = await act(
      { action: "create", title, date: create.date || null, description: create.description.trim() },
      "create",
    );
    if (!data || typeof data.key !== "string") {
      setCreate((s) => ({ ...s, busy: false, error: "Не удалось создать проект" }));
      return;
    }
    notify("Проект создан");
    setCreate(EMPTY_CREATE);
    router.push(`/organizer/project/${encodeURIComponent(data.key)}`);
  };

  const submitRename = async () => {
    const project = rename.project;
    if (!project) return;
    const title = rename.title.trim();
    if (!title) {
      setRename((s) => ({ ...s, error: "Укажите название мероприятия" }));
      return;
    }
    setRename((s) => ({ ...s, busy: true, error: null }));
    const data = await act({ action: "rename", key: project.key, title }, project.key);
    setRename((s) => ({ ...s, busy: false }));
    if (data) {
      notify("Название обновлено");
      setRename({ project: null, title: "", busy: false, error: null });
      void load();
    }
  };

  const actions: ProjectActions = {
    onRename: (project) =>
      setRename({ project, title: project.title, busy: false, error: null }),

    onDuplicate: async (project) => {
      const data = await act({ action: "duplicate", key: project.key }, project.key);
      if (data) {
        notify("Создана копия проекта");
        void load();
      }
    },

    onToggleArchive: async (project) => {
      const data = await act(
        { action: "archive", key: project.key, archived: !project.archived },
        project.key,
      );
      if (data) {
        notify(project.archived ? "Проект возвращён из архива" : "Проект отправлен в архив");
        void load();
      }
    },

    onDelete: (project) => setDeleteTarget({ project, busy: false }),
  };

  const submitDelete = async () => {
    const project = deleteTarget.project;
    if (!project) return;
    setDeleteTarget({ project, busy: true });
    const data = await act({ action: "delete", key: project.key }, project.key);
    if (data) {
      notify("Проект удалён");
      setDeleteTarget({ project: null, busy: false });
      void load();
    } else {
      setDeleteTarget({ project: null, busy: false });
    }
  };

  /* ── Поиск и фильтры ── */

  const visible = useMemo(() => {
    let list = projects ?? [];
    if (filter === "archive") {
      list = list.filter((p) => p.archived);
    } else {
      list = list.filter(
        (p) =>
          !p.archived &&
          (filter === "all" ||
            (filter === "published" ? p.published : !p.published)),
      );
    }
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((p) => p.title.toLowerCase().includes(q));
    return list;
  }, [projects, filter, query]);

  const hasAnyProjects = (projects?.length ?? 0) > 0;
  const hasActiveFilters = query.trim().length > 0 || filter !== "all";

  return (
    <OrganizerAuthGate>
      <div className="org-shell min-h-screen">
        {/* ── Верхняя панель ── */}
        <header className="sticky top-0 z-30 border-b border-[var(--org-border)] bg-[color-mix(in_srgb,var(--org-bg)_88%,transparent)] backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-[1120px] items-center gap-3 px-5 py-3.5">
            <Link href="/" className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/noveee-icon.png" alt="noveee.me" className="h-7 w-auto" />
              <span className="text-[14.5px] font-semibold tracking-[-0.01em]">
                noveee.me
              </span>
            </Link>
            <div className="ml-auto flex items-center gap-2.5">
              <button
                type="button"
                className="org-btn org-btn-primary"
                onClick={() => setCreate({ ...EMPTY_CREATE, open: true })}
              >
                <span aria-hidden>+</span> Создать проект
              </button>
              <AvatarMenu onLogout={logout} />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1120px] px-5 py-8 md:py-10">
          {/* ── Заголовок ── */}
          <div>
            <h1 className="text-[26px] font-semibold tracking-[-0.025em]">
              Мои проекты
            </h1>
            <p className="org-hint mt-1.5 text-[13.5px]">
              Управляйте мероприятиями, фотографиями и оформлением страниц.
            </p>
          </div>

          {/* ── Поиск, фильтр, вид ── */}
          {hasAnyProjects && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-[280px]">
                <svg
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--org-faint)]"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.2-3.2" />
                </svg>
                <input
                  type="text"
                  className="org-input"
                  style={{ paddingLeft: 34 }}
                  placeholder="Поиск по названию"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Поиск проекта по названию"
                />
              </div>

              <div className="scrollbar-hide org-seg overflow-x-auto" role="tablist" aria-label="Фильтр по статусу">
                {FILTERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={filter === item.id}
                    data-active={filter === item.id ? "true" : "false"}
                    onClick={() => setFilter(item.id)}
                    className="shrink-0"
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="org-seg ml-auto hidden sm:flex" role="tablist" aria-label="Вид списка">
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === "grid"}
                  aria-label="Карточки"
                  data-active={view === "grid" ? "true" : "false"}
                  onClick={() => setView("grid")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
                    <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
                    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
                    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
                    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
                  </svg>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === "list"}
                  aria-label="Список"
                  data-active={view === "list" ? "true" : "false"}
                  onClick={() => setView("list")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* ── Содержимое ── */}
          <div className="mt-6">
            {loadError ? (
              <div className="org-card flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[14.5px] font-semibold">Не удалось загрузить проекты</p>
                  <p className="org-hint mt-1">{loadError}</p>
                </div>
                <button className="org-btn org-btn-secondary shrink-0" onClick={() => void load()}>
                  Повторить
                </button>
              </div>
            ) : projects === null ? (
              <LoadingScreen label="Загружаем проекты…" />
            ) : !hasAnyProjects ? (
              <div className="org-card flex flex-col items-center px-6 py-12 text-center">
                <p className="text-[16px] font-semibold tracking-[-0.015em]">
                  У вас пока нет проектов
                </p>
                <p className="org-hint mt-2 max-w-sm">
                  Создайте мероприятие, чтобы подключить фотографии и настроить
                  его страницу.
                </p>
                <button
                  className="org-btn org-btn-primary mt-5"
                  onClick={() => setCreate({ ...EMPTY_CREATE, open: true })}
                >
                  Создать первый проект
                </button>
              </div>
            ) : visible.length === 0 ? (
              <div className="org-card flex flex-col items-center px-6 py-12 text-center">
                <p className="text-[16px] font-semibold tracking-[-0.015em]">
                  Проекты не найдены
                </p>
                <p className="org-hint mt-2 max-w-sm">
                  Попробуйте изменить запрос или выбрать другой фильтр.
                </p>
                {hasActiveFilters && (
                  <button
                    className="org-btn org-btn-secondary mt-5"
                    onClick={() => {
                      setQuery("");
                      setFilter("all");
                    }}
                  >
                    Сбросить поиск и фильтр
                  </button>
                )}
              </div>
            ) : view === "grid" ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((project) => (
                  <ProjectCard
                    key={project.key}
                    project={project}
                    busy={busyKey === project.key}
                    actions={actions}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {visible.map((project) => (
                  <ProjectRow
                    key={project.key}
                    project={project}
                    busy={busyKey === project.key}
                    actions={actions}
                  />
                ))}
              </div>
            )}
          </div>
        </main>

        {/* ── Создание проекта ── */}
        <Modal
          open={create.open}
          title="Новый проект"
          description="После создания вы попадёте в настройки мероприятия: там подключается папка с фотографиями и оформление страницы."
          onClose={() => !create.busy && setCreate(EMPTY_CREATE)}
          footer={
            <>
              <button
                className="org-btn org-btn-secondary"
                onClick={() => setCreate(EMPTY_CREATE)}
                disabled={create.busy}
              >
                Отмена
              </button>
              <button
                className="org-btn org-btn-primary"
                onClick={() => void submitCreate()}
                disabled={create.busy}
              >
                {create.busy ? "Создаём…" : "Создать проект"}
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Field label="Название мероприятия *" htmlFor="new-project-title">
              <input
                id="new-project-title"
                className="org-input"
                value={create.title}
                onChange={(e) =>
                  setCreate((s) => ({ ...s, title: e.target.value, error: null }))
                }
                placeholder="Например, «День города 2026»"
                maxLength={80}
                autoFocus
                aria-invalid={create.error ? "true" : undefined}
              />
            </Field>
            <Field label="Дата мероприятия" htmlFor="new-project-date" hint="Необязательно — поможет найти проект позже.">
              <input
                id="new-project-date"
                type="date"
                className="org-input"
                value={create.date}
                onChange={(e) => setCreate((s) => ({ ...s, date: e.target.value }))}
              />
            </Field>
            <Field label="Краткое описание" htmlFor="new-project-desc" hint="Необязательно — видно только вам в списке проектов.">
              <textarea
                id="new-project-desc"
                className="org-textarea"
                value={create.description}
                onChange={(e) =>
                  setCreate((s) => ({ ...s, description: e.target.value }))
                }
                maxLength={240}
                rows={3}
              />
            </Field>
            {create.error && (
              <p className="text-[12.5px] font-medium text-[var(--org-err)]">
                {create.error}
              </p>
            )}
          </div>
        </Modal>

        {/* ── Переименование ── */}
        <Modal
          open={rename.project !== null}
          title="Переименовать проект"
          onClose={() =>
            !rename.busy && setRename({ project: null, title: "", busy: false, error: null })
          }
          footer={
            <>
              <button
                className="org-btn org-btn-secondary"
                onClick={() =>
                  setRename({ project: null, title: "", busy: false, error: null })
                }
                disabled={rename.busy}
              >
                Отмена
              </button>
              <button
                className="org-btn org-btn-primary"
                onClick={() => void submitRename()}
                disabled={rename.busy}
              >
                {rename.busy ? "Сохраняем…" : "Сохранить"}
              </button>
            </>
          }
        >
          <Field label="Название мероприятия *" htmlFor="rename-project-title">
            <input
              id="rename-project-title"
              className="org-input"
              value={rename.title}
              onChange={(e) =>
                setRename((s) => ({ ...s, title: e.target.value, error: null }))
              }
              maxLength={80}
              autoFocus
            />
          </Field>
          <p className="org-hint mt-2">
            Название увидят и посетители публичной страницы проекта.
          </p>
          {rename.error && (
            <p className="mt-2 text-[12.5px] font-medium text-[var(--org-err)]">
              {rename.error}
            </p>
          )}
        </Modal>

        {/* ── Удаление ── */}
        <Modal
          open={deleteTarget.project !== null}
          title="Удалить проект?"
          description={
            deleteTarget.project
              ? `Проект «${deleteTarget.project.title}» и все его настройки будут удалены безвозвратно.`
              : ""
          }
          onClose={() => !deleteTarget.busy && setDeleteTarget({ project: null, busy: false })}
          footer={
            <>
              <button
                className="org-btn org-btn-secondary"
                onClick={() => setDeleteTarget({ project: null, busy: false })}
                disabled={deleteTarget.busy}
              >
                Отмена
              </button>
              <button
                className="org-btn org-btn-danger"
                onClick={() => void submitDelete()}
                disabled={deleteTarget.busy}
              >
                {deleteTarget.busy ? "Удаляем…" : "Удалить"}
              </button>
            </>
          }
        >
          <p className="org-hint">
            Фотографии в облачной папке не пострадают — удаляются только
            настройки проекта на noveee.me.
          </p>
        </Modal>

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
