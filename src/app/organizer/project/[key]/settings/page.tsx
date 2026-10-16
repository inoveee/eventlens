// @TheTechMargin 2026
// Настройки мероприятия: тексты публичной страницы и алиас проекта.
// Изменения, как и оформление, попадают к посетителям только после
// публикации; алиас сразу меняет адреса панели и публичной страницы.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganizer } from "@/hooks/organizer/OrganizerContext";
import { SectionHeader, Field } from "@/app/organizer/components/ui";
import {
  TEXT_LIMITS,
  defaultEventSettings,
  isProjectKey,
  settingsEqual,
} from "@/lib/eventSettings";

export default function EventSettingsPage() {
  const router = useRouter();
  const {
    projectKey,
    draft,
    published,
    updateText,
    save,
    publish,
    changeAlias,
    busy,
    unsavedChanges,
    unpublishedChanges,
    storage,
  } = useOrganizer();

  const defaults = defaultEventSettings();
  const textChanged = !settingsEqual(draft.text, defaults.text);

  const resetTexts = () => updateText(defaults.text);

  /* ── Алиас проекта ── */
  const [alias, setAlias] = useState(projectKey);
  const [aliasBusy, setAliasBusy] = useState(false);
  const [aliasError, setAliasError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // После смены алиаса (или перехода в другой проект) поле показывает
  // текущий ключ проекта.
  useEffect(() => {
    setAlias(projectKey);
    setAliasError(null);
  }, [projectKey]);

  const aliasValue = alias.trim();
  const aliasChanged = aliasValue !== projectKey;
  const aliasValid = isProjectKey(aliasValue);

  const submitAlias = async () => {
    if (!aliasValid) {
      setAliasError("Только латиница в нижнем регистре, цифры и дефис — например, devfest");
      return;
    }
    if (unsavedChanges) {
      setAliasError("Сначала сохраните несохранённые правки текстов.");
      return;
    }
    setAliasBusy(true);
    setAliasError(null);
    try {
      const key = await changeAlias(aliasValue);
      setAlias(key);
      router.replace(`/organizer/project/${encodeURIComponent(key)}/settings`);
    } catch (err) {
      setAliasError(err instanceof Error ? err.message : "Не удалось сменить алиас");
    } finally {
      setAliasBusy(false);
    }
  };

  return (
    <div>
      <SectionHeader
        title="Настройки мероприятия"
        description="Название и подписи, которые видят посетители на публичной странице."
        action={
          <>
            <button
              className="org-btn org-btn-secondary"
              onClick={() => void save()}
              disabled={busy || !unsavedChanges}
            >
              Сохранить
            </button>
            <button
              className="org-btn org-btn-primary"
              onClick={() => void publish()}
              disabled={busy}
            >
              Опубликовать
            </button>
          </>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="org-card flex flex-col gap-5 p-5 md:p-6">
          <Field
            label="Название мероприятия"
            htmlFor="event-name"
            hint="Большим шрифтом в верхней части страницы и в заголовке вкладки."
          >
            <input
              id="event-name"
              className="org-input"
              value={draft.text.name}
              maxLength={TEXT_LIMITS.name}
              onChange={(e) => updateText({ name: e.target.value })}
            />
          </Field>

          <Field
            label="Короткая подпись"
            htmlFor="event-tagline"
            hint="Описание страницы в поисковиках и соцсетях."
          >
            <input
              id="event-tagline"
              className="org-input"
              value={draft.text.tagline}
              maxLength={TEXT_LIMITS.tagline}
              onChange={(e) => updateText({ tagline: e.target.value })}
            />
          </Field>

          <Field
            label="Фраза на главной"
            htmlFor="event-statement"
            hint="После первой точки вторая часть фразы подсвечивается акцентным цветом."
          >
            <input
              id="event-statement"
              className="org-input"
              value={draft.text.statement}
              maxLength={TEXT_LIMITS.statement}
              onChange={(e) => updateText({ statement: e.target.value })}
            />
          </Field>

          <Field
            label="Пояснение под фразой"
            htmlFor="event-description"
            hint="Коротко объясните, что можно сделать на странице."
          >
            <textarea
              id="event-description"
              className="org-textarea"
              value={draft.text.description}
              maxLength={TEXT_LIMITS.description}
              onChange={(e) => updateText({ description: e.target.value })}
            />
          </Field>

          <Field
            label="Название общего альбома"
            htmlFor="event-album"
            hint="Так называется подборка фотографий на главной, например «Гонки — 12 мая 2026»."
          >
            <input
              id="event-album"
              className="org-input"
              value={draft.text.albumName}
              maxLength={TEXT_LIMITS.albumName}
              onChange={(e) => updateText({ albumName: e.target.value })}
            />
          </Field>

          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--org-border)] pt-4">
            <button
              className="org-btn org-btn-secondary"
              onClick={() => void save()}
              disabled={busy || !unsavedChanges}
            >
              {busy ? "Сохраняем…" : "Сохранить изменения"}
            </button>
            <button
              className="org-btn org-btn-primary"
              onClick={() => void publish()}
              disabled={busy}
            >
              Опубликовать
            </button>
            <button
              className="org-btn org-btn-ghost ml-auto"
              onClick={resetTexts}
              disabled={busy || !textChanged}
              title="Вернуть подписи из настроек проекта"
            >
              Вернуть стандартные подписи
            </button>
          </div>
        </div>

        <div className="org-card h-fit p-5">
          <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--org-faint)]">
            Как это работает
          </p>
          <ol className="org-hint mt-3 list-decimal space-y-2 pl-4">
            <li>
              Правки попадают в черновик — их видите только вы, пока не нажали
              «Опубликовать».
            </li>
            <li>
              «Сохранить» запоминает черновик, чтобы не потерять его при закрытии
              вкладки.
            </li>
            <li>
              «Опубликовать» применяет черновик к публичной странице — посетители
              видят новую версию сразу.
            </li>
          </ol>

          <div className="mt-4 border-t border-[var(--org-border)] pt-4">
            <p className="text-[13px] font-semibold">Текущий статус</p>
            <p className="org-hint mt-1">
              {unsavedChanges
                ? "Есть несохранённые изменения."
                : unpublishedChanges || published === null
                  ? "Черновик сохранён, но ещё не опубликован."
                  : "Страница опубликована в текущей версии."}
            </p>
          </div>

          {storage === "file" && (
            <p className="org-hint mt-4 border-t border-[var(--org-border)] pt-4">
              Настройки хранятся в файле на этом сервере.
            </p>
          )}
        </div>
      </div>

      {/* ── Алиас: адрес публичной страницы вместо ключа по умолчанию ── */}
      <div className="org-card mt-5 p-5 md:p-6">
        <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--org-faint)]">
          Алиас проекта
        </p>
        <p className="mt-1 text-[14.5px] font-semibold tracking-[-0.01em]">
          Адрес страницы для участников
        </p>
        <p className="org-hint mt-1">
          Вместо технического ключа в адресе можно поставить короткое название —
          например, вместо{" "}
          <span className="font-medium text-[var(--org-text)]">/p/default</span>{" "}
          — <span className="font-medium text-[var(--org-text)]">/p/devfest</span>.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Field
              label="Алиас"
              htmlFor="project-alias"
              hint="Латиница в нижнем регистре, цифры и дефис."
            >
              <input
                id="project-alias"
                className="org-input"
                value={alias}
                maxLength={64}
                onChange={(e) => {
                  setAlias(e.target.value);
                  setAliasError(null);
                }}
                aria-invalid={aliasError ? "true" : undefined}
              />
            </Field>
          </div>
          <button
            className="org-btn org-btn-primary"
            onClick={() => void submitAlias()}
            disabled={aliasBusy || !aliasChanged || !aliasValid || unsavedChanges}
          >
            {aliasBusy ? "Сохраняем…" : "Сохранить адрес"}
          </button>
        </div>

        <p className="org-hint mt-3">
          Публичный адрес:{" "}
          <span className="font-medium text-[var(--org-text)]">
            {origin}/p/{aliasValue || projectKey}
          </span>
        </p>
        {unsavedChanges && (
          <p className="org-hint mt-1">
            Есть несохранённые правки текстов — сохраните их, чтобы сменить алиас.
          </p>
        )}
        {aliasError && (
          <p className="mt-2 text-[12.5px] font-medium text-[var(--org-err)]">
            {aliasError}
          </p>
        )}
      </div>
    </div>
  );
}
