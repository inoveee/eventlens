// @TheTechMargin 2026
// Карточка проекта на стартовом экране. На первом плане — название,
// статус и быстрый переход в настройки; вторичные действия спрятаны
// в меню с тремя точками.

"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectSummary } from "@/lib/eventSettings";

export interface ProjectActions {
  onRename: (project: ProjectSummary) => void;
  /** Только для super_admin; у роли admin скрыто. */
  onDuplicate?: (project: ProjectSummary) => void;
  onToggleArchive: (project: ProjectSummary) => void;
  onDelete: (project: ProjectSummary) => void;
}

const CURRENT_YEAR = String(new Date().getFullYear());

/** «24 мая» или «24 мая 2025» для дат других лет. */
function formatEventDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  const withYear = parsed.getFullYear() !== Number(CURRENT_YEAR);
  return parsed.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

/** «сегодня», «вчера» или дата — когда проект последний раз менялся. */
function formatUpdated(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  const today = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(parsed, today)) return "сегодня";
  if (sameDay(parsed, yesterday)) return "вчера";
  return parsed.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function projectHref(project: ProjectSummary): string {
  return `/organizer/project/${encodeURIComponent(project.key)}`;
}

function KebabMenu({
  project,
  busy,
  actions,
}: {
  project: ProjectSummary;
  busy: boolean;
  actions: ProjectActions;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        className="org-btn org-btn-ghost h-8 w-8 !p-0"
        aria-label="Действия с проектом"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open && (
        <div className="org-menu-panel" role="menu">
          <button
            type="button"
            role="menuitem"
            className="org-menu-item"
            onClick={() => run(() => actions.onRename(project))}
          >
            Переименовать
          </button>
          <button
            type="button"
            role="menuitem"
            className="org-menu-item"
            onClick={() => run(() => actions.onDuplicate?.(project))}
            hidden={!actions.onDuplicate}
          >
            Дублировать настройки
          </button>
          <button
            type="button"
            role="menuitem"
            className="org-menu-item"
            onClick={() => run(() => actions.onToggleArchive(project))}
          >
            {project.archived ? "Вернуть из архива" : "Архивировать"}
          </button>
          <div className="org-menu-divider" aria-hidden />
          <button
            type="button"
            role="menuitem"
            className="org-menu-item org-menu-item-danger"
            onClick={() => run(() => actions.onDelete(project))}
          >
            Удалить
          </button>
        </div>
      )}
    </div>
  );
}

function StatusPills({ project }: { project: ProjectSummary }) {
  return (
    <>
      <span
        className={`org-pill ${project.published ? "org-pill-ok" : "org-pill-neutral"}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
        {project.published ? "Опубликован" : "Черновик"}
      </span>
      {project.archived && <span className="org-pill org-pill-neutral">В архиве</span>}
      <span
        className={`org-pill ${
          project.photos?.connected ? "org-pill-neutral" : "org-pill-warn"
        }`}
      >
        {project.photos?.connected
          ? `${project.photos.photoCount} фото`
          : "Фото не подключены"}
      </span>
    </>
  );
}

function CoverThumb({ project }: { project: ProjectSummary }) {
  if (!project.cover) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={project.cover}
      alt=""
      className="h-12 w-12 shrink-0 rounded-[11px] object-cover ring-1 ring-black/[0.06]"
    />
  );
}

export function ProjectCard({
  project,
  busy,
  actions,
}: {
  project: ProjectSummary;
  busy: boolean;
  actions: ProjectActions;
}) {
  const meta = [project.date ? formatEventDate(project.date) : null, `изменён ${formatUpdated(project.updatedAt)}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="org-card project-card flex flex-col p-5">
      <div className="flex items-start gap-3">
        <CoverThumb project={project} />
        <div className="min-w-0 flex-1">
          <a
            href={projectHref(project)}
            className="project-card-title block truncate text-[15px] font-semibold tracking-[-0.015em]"
            title={project.title}
          >
            {project.title}
          </a>
          {meta && <p className="org-hint mt-0.5 truncate">{meta}</p>}
        </div>
        <KebabMenu project={project} busy={busy} actions={actions} />
      </div>

      {project.description && (
        <p className="org-hint mt-3 line-clamp-2">{project.description}</p>
      )}

      <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
        <StatusPills project={project} />
      </div>

      <div className="mt-auto pt-4">
        <a
          href={projectHref(project)}
          className="org-btn org-btn-secondary w-full justify-center"
        >
          Открыть проект
        </a>
      </div>
    </div>
  );
}

export function ProjectRow({
  project,
  busy,
  actions,
}: {
  project: ProjectSummary;
  busy: boolean;
  actions: ProjectActions;
}) {
  return (
    <div className="org-card project-card flex items-center gap-3.5 p-3.5">
      <CoverThumb project={project} />
      <div className="min-w-0 flex-1">
        <a
          href={projectHref(project)}
          className="project-card-title block truncate text-[14.5px] font-semibold tracking-[-0.015em]"
          title={project.title}
        >
          {project.title}
        </a>
        <p className="org-hint mt-0.5 truncate">
          {project.date ? `${formatEventDate(project.date)} · ` : ""}
          изменён {formatUpdated(project.updatedAt)}
        </p>
      </div>
      <div className="hidden flex-wrap items-center gap-1.5 md:flex">
        <StatusPills project={project} />
      </div>
      <KebabMenu project={project} busy={busy} actions={actions} />
      <a
        href={projectHref(project)}
        className="org-btn org-btn-secondary shrink-0"
      >
        Открыть
      </a>
    </div>
  );
}
