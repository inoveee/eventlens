// @TheTechMargin 2026
// Обзор: статус публикации, подключения фото и последовательность
// «подключить → оформить → проверить → опубликовать».

"use client";

import { useState } from "react";
import Link from "next/link";
import { useOrganizer } from "@/hooks/organizer/OrganizerContext";
import { SectionHeader, StatTile } from "@/app/organizer/components/ui";
import { defaultEventSettings, settingsEqual } from "@/lib/eventSettings";

interface Step {
  key: string;
  title: string;
  description: string;
  done: boolean;
  doneText: string;
  todoText: string;
  href?: string;
}

export default function OverviewPage() {
  const {
    projectKey,
    draft,
    published,
    photos,
    status,
    unsavedChanges,
    unpublishedChanges,
    openPublicPage,
    save,
    publish,
    busy,
    storage,
  } = useOrganizer();

  const projectBase = `/organizer/project/${encodeURIComponent(projectKey)}`;

  const [working, setWorking] = useState<"save" | "publish" | null>(null);

  const run = async (kind: "save" | "publish") => {
    setWorking(kind);
    try {
      if (kind === "save") await save();
      else await publish();
    } finally {
      setWorking(null);
    }
  };

  const brandingChanged = !settingsEqual(
    draft.branding,
    defaultEventSettings().branding,
  );

  const steps: Step[] = [
    {
      key: "photos",
      title: "Подключить фотографии",
      description: "Ссылка на папку с фотографиями на облачном диске.",
      done: photos?.status === "connected" && photos.photoCount > 0,
      doneText: `${photos?.photoCount ?? 0} фото`,
      todoText: "Папка не подключена",
      href: `${projectBase}/photos`,
    },
    {
      key: "appearance",
      title: "Настроить оформление",
      description: "Фон верхней части, акцентный цвет и логотип.",
      done: brandingChanged,
      doneText: "Изменения есть",
      todoText: "Стандартное оформление",
      href: `${projectBase}/appearance`,
    },
    {
      key: "preview",
      title: "Проверить результат",
      description: "Посмотрите, как страница выглядит на телефоне и на компьютере.",
      done: false,
      doneText: "",
      todoText: "",
    },
    {
      key: "publish",
      title: "Опубликовать",
      description: "Применить сохранённые изменения к публичной странице.",
      done: !unsavedChanges && !unpublishedChanges && published !== null,
      doneText: "Опубликовано",
      todoText: "Ожидает публикации",
    },
  ];

  return (
    <div>
      <SectionHeader
        title="Обзор"
        description="Состояние страницы мероприятия: что уже подключено, что изменено и что осталось сделать."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Публикация */}
        <div className="org-card p-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--org-faint)]">
                Публикация
              </p>
              <div className="mt-2.5 flex items-center gap-2.5">
                <span
                  className={`org-pill org-pill-${
                    status.tone === "ok"
                      ? "ok"
                      : status.tone === "warn"
                        ? "warn"
                        : "neutral"
                  }`}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-current"
                    aria-hidden
                  />
                  {status.label}
                </span>
              </div>
              <p className="org-hint mt-2.5 max-w-md">{status.hint}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button className="org-btn org-btn-secondary" onClick={openPublicPage}>
                Открыть страницу
              </button>
              {unsavedChanges && (
                <button
                  className="org-btn org-btn-secondary"
                  onClick={() => void run("save")}
                  disabled={busy}
                >
                  {working === "save" ? "Сохраняем…" : "Сохранить"}
                </button>
              )}
              {!unsavedChanges && (unpublishedChanges || published === null) && (
                <button
                  className="org-btn org-btn-primary"
                  onClick={() => void run("publish")}
                  disabled={busy}
                >
                  {working === "publish" ? "Публикуем…" : "Опубликовать"}
                </button>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[var(--org-border)] pt-4 sm:grid-cols-3">
            <StatTile
              label="Фотографии"
              value={
                photos?.status === "connected"
                  ? String(photos.photoCount)
                  : "—"
              }
              sub={
                photos?.status === "connected"
                  ? `Папок: ${photos.folderCount}`
                  : "Папка не подключена"
              }
            />
            <StatTile
              label="Оформление"
              value={brandingChanged ? "Изменено" : "Стандарт"}
              sub={
                draft.branding.logo ? "Логотип загружен" : "Без логотипа"
              }
            />
            <StatTile
              label="Акцент"
              value={
                <span className="flex items-center gap-2">
                  <span
                    className="h-4 w-4 rounded-full ring-1 ring-black/10"
                    style={{ background: draft.branding.accent }}
                  />
                  {draft.branding.accent.toUpperCase()}
                </span>
              }
              sub="Основной цвет кнопок"
            />
          </div>
        </div>

        {/* Фотографии — короткая карточка */}
        <div className="org-card flex flex-col p-5">
          <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--org-faint)]">
            Источник фото
          </p>
          {photos?.status === "connected" ? (
            <>
              <p className="mt-2.5 truncate text-[15px] font-semibold tracking-[-0.015em]">
                {photos.provider === "yandex" ? "Яндекс.Диск" : "Google Drive"}
              </p>
              <p className="org-hint mt-1 truncate" title={photos.url}>
                {photos.lastSyncAt
                  ? `Обновлено: ${new Date(photos.lastSyncAt).toLocaleString("ru-RU", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : "Синхронизация не запускалась"}
              </p>
            </>
          ) : photos?.status === "error" ? (
            <p className="mt-2.5 text-[13.5px] font-medium text-[var(--org-err)]">
              {photos.error || "Ошибка подключения"}
            </p>
          ) : (
            <p className="org-hint mt-2.5">
              Вставьте ссылку на папку — фотографии появятся на публичной странице.
            </p>
          )}
          <div className="mt-auto pt-4">
            <Link href={`${projectBase}/photos`} className="org-btn org-btn-secondary w-full">
              {photos?.status === "connected" ? "Управление фото" : "Подключить фото"}
            </Link>
          </div>
        </div>
      </div>

      {/* Последовательность настройки */}
      <div className="org-card mt-4 p-5 md:p-6">
        <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--org-faint)]">
          Как настроить страницу
        </p>
        <ol className="mt-4 flex flex-col gap-4">
          {steps.map((step, index) => (
            <li key={step.key} className="flex items-start gap-3.5">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
                style={{
                  background: step.done ? "var(--org-ok-bg)" : "#ececef",
                  color: step.done ? "var(--org-ok)" : "var(--org-dim)",
                }}
                aria-hidden
              >
                {step.done ? "✓" : index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[14px] font-semibold tracking-[-0.01em]">
                    {step.title}
                  </p>
                  {step.done && (
                    <span className="org-pill org-pill-ok">{step.doneText}</span>
                  )}
                </div>
                <p className="org-hint mt-0.5">{step.description}</p>
              </div>
              {step.href ? (
                <a
                  href={step.href}
                  className="org-btn org-btn-ghost shrink-0 text-[13px]"
                >
                  Перейти
                </a>
              ) : step.key === "preview" ? (
                <button
                  className="org-btn org-btn-ghost shrink-0 text-[13px]"
                  onClick={openPublicPage}
                >
                  Открыть
                </button>
              ) : null}
            </li>
          ))}
        </ol>

        {storage === "file" && (
          <p className="org-hint mt-5 border-t border-[var(--org-border)] pt-4">
            Настройки хранятся в файле на этом сервере — переносите их вместе с
            проектом или подключите постоянное хранилище.
          </p>
        )}
      </div>

      {/* Статусы сохранения/публикации — подсказка внизу обзора */}
      {(unsavedChanges || unpublishedChanges) && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[14px] border border-[#efdfc3] bg-[var(--org-warn-bg)] px-4 py-3">
          <p className="text-[13px] font-medium text-[var(--org-warn)]">
            {unsavedChanges
              ? "Есть несохранённые изменения"
              : "Изменения сохранены, но ещё не опубликованы"}
          </p>
          <div className="ml-auto flex gap-2">
            {unsavedChanges && (
              <button
                className="org-btn org-btn-secondary"
                onClick={() => void run("save")}
                disabled={busy}
              >
                {working === "save" ? "Сохраняем…" : "Сохранить изменения"}
              </button>
            )}
            <button
              className="org-btn org-btn-primary"
              onClick={() => void run("publish")}
              disabled={busy}
              title="Сохранить черновик и применить его к публичной странице"
            >
              {working === "publish" ? "Публикуем…" : "Опубликовать"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
