// @TheTechMargin 2026
// Настройки мероприятия: тексты публичной страницы. Изменения, как и
// оформление, попадают к посетителям только после публикации.

"use client";

import { useOrganizer } from "@/hooks/organizer/OrganizerContext";
import { SectionHeader, Field } from "../components/ui";
import { TEXT_LIMITS, defaultEventSettings, settingsEqual } from "@/lib/eventSettings";

export default function EventSettingsPage() {
  const {
    draft,
    published,
    updateText,
    save,
    publish,
    busy,
    unsavedChanges,
    unpublishedChanges,
    storage,
  } = useOrganizer();

  const defaults = defaultEventSettings();
  const textChanged = !settingsEqual(draft.text, defaults.text);

  const resetTexts = () => updateText(defaults.text);

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
    </div>
  );
}
