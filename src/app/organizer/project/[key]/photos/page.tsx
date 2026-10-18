// @TheTechMargin 2026
// Фотографии: подключение папки на облачном диске, статус синхронизации
// и прогресс обработки. Проверка ссылки настоящая — ошибки доступа
// возвращаются с понятными сообщениями.

"use client";

import { useEffect, useState } from "react";
import { useOrganizer } from "@/hooks/organizer/OrganizerContext";
import { SectionHeader, StatTile } from "@/app/organizer/components/ui";
import type { PhotoConnection } from "@/lib/eventSettings";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function providerLabel(provider: PhotoConnection["provider"]): string {
  return provider === "yandex" ? "Яндекс.Диск" : "Google Drive";
}

export default function PhotosPage() {
  const { photos, connectPhotos, syncPhotos, busy, notify, reload, ingest, runIngest } =
    useOrganizer();

  const [url, setUrl] = useState(photos?.url ?? "");
  const [error, setError] = useState<string | null>(null);

  // Поле следует за сохранённой ссылкой (например, после загрузки страницы).
  useEffect(() => {
    setUrl(photos?.url ?? "");
  }, [photos?.url]);

  const detected = /yandex|yadi\.sk/i.test(url)
    ? "Яндекс.Диск"
    : /drive\.google/i.test(url)
      ? "Google Drive"
      : null;

  const submit = async (action: "connect" | "sync") => {
    setError(null);
    const target = action === "connect" ? url.trim() : photos?.url || "";
    if (action === "connect" && !target) {
      setError("Вставьте ссылку на папку с фотографиями.");
      return;
    }
    const result = action === "connect" ? await connectPhotos(target) : await syncPhotos();
    if (result.ok) {
      notify(
        action === "connect"
          ? "Папка подключена — фотографии доступны на странице"
          : "Синхронизация завершена",
      );
    } else {
      setError(result.error);
    }
  };

  const connected = photos?.status === "connected";
  const failed = photos?.status === "error";
  const processed = photos?.processed ?? null;
  const processPercent =
    processed && processed.total > 0
      ? Math.round((processed.completed / processed.total) * 100)
      : 0;

  return (
    <div>
      <SectionHeader
        title="Фотографии"
        description="Укажите публичную ссылку на папку с фотографиями — страница поиска будет показывать именно её."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-4">
          {/* ── Источник ── */}
          <div className="org-card p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--org-faint)]">
                Источник фотографий
              </p>
              <span
                className={`org-pill ${
                  busy
                    ? "org-pill-warn"
                    : connected
                      ? "org-pill-ok"
                      : failed
                        ? "org-pill-err"
                        : "org-pill-neutral"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                {busy
                  ? "Подключение…"
                  : connected
                    ? "Успешно подключено"
                    : failed
                      ? "Ошибка"
                      : "Не подключено"}
              </span>
            </div>

            <form
              className="mt-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submit("connect");
              }}
            >
              <label className="org-label mb-1.5" htmlFor="photo-source-url">
                Ссылка на папку
              </label>
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <div className="min-w-0 flex-1">
                  <input
                    id="photo-source-url"
                    className="org-input"
                    placeholder="https://disk.yandex.ru/d/… или https://drive.google.com/drive/folders/…"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      setError(null);
                    }}
                    aria-invalid={error ? "true" : undefined}
                    spellCheck={false}
                  />
                </div>
                <button
                  type="submit"
                  className="org-btn org-btn-primary shrink-0"
                  disabled={busy}
                >
                  {busy
                    ? "Проверяем…"
                    : connected
                      ? "Сохранить и синхронизировать"
                      : "Подключить фотографии"}
                </button>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {detected && (
                  <span className="org-pill org-pill-neutral">{detected}</span>
                )}
                <p className="org-hint">
                  {connected
                    ? "Ссылка сохранена. Нажмите кнопку, чтобы проверить папку и обновить счётчики."
                    : "Папка должна быть открыта по ссылке — «Поделиться» → «Все, у кого есть ссылка»."}
                </p>
              </div>
            </form>

            {error && (
              <div className="mt-4 rounded-[14px] border border-[#f0c8c5] bg-[var(--org-err-bg)] px-4 py-3">
                <p className="text-[13.5px] font-medium text-[var(--org-err)]">{error}</p>
                <p className="org-hint mt-1 text-[var(--org-err)] opacity-80">
                  Настройки публичной страницы при этом не изменились.
                </p>
              </div>
            )}

            {connected && (
              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[var(--org-border)] pt-4 sm:grid-cols-4">
                <StatTile
                  label="Найдено фото"
                  value={photos.photoCount.toLocaleString("ru-RU")}
                />
                <StatTile label="Папок" value={String(photos.folderCount)} />
                <StatTile
                  label="Источник"
                  value={providerLabel(photos.provider)}
                  sub={photos.url.length > 28 ? "ссылка сохранена" : photos.url}
                />
                <StatTile label="Синхронизация" value={formatWhen(photos.lastSyncAt)} />
              </div>
            )}

            {connected && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  className="org-btn org-btn-secondary"
                  onClick={() => void submit("sync")}
                  disabled={busy}
                >
                  {busy ? "Обновляем…" : "Обновить счётчики"}
                </button>
                <button className="org-btn org-btn-ghost" onClick={() => void reload()}>
                  Обновить статус
                </button>
              </div>
            )}
          </div>

          {/* ── Обработка ── */}
          <div className="org-card p-5 md:p-6">
            <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--org-faint)]">
              Обработка фотографий
            </p>

            {processed && processed.total > 0 ? (
              <div className="mt-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[15px] font-semibold tracking-[-0.015em]">
                    {processed.completed.toLocaleString("ru-RU")} из{" "}
                    {processed.total.toLocaleString("ru-RU")} обработано
                  </p>
                  <span className="text-[13px] font-semibold text-[var(--org-dim)]">
                    {processPercent}%
                  </span>
                </div>
                <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#ececef]">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{
                      width: `${processPercent}%`,
                      background: "var(--org-text)",
                    }}
                  />
                </div>
                <p className="org-hint mt-2">
                  {ingest.running
                    ? "ИИ-обработка идёт — можно закрыть страницу, она продолжится при следующем открытии."
                    : processed.errors > 0
                      ? `Не обработано с ошибкой: ${processed.errors} — их можно перезапустить в технической панели.`
                      : "Поиск по описанию и совпадение лиц работают по обработанным фото."}
                </p>
                {!ingest.running && processPercent < 100 && (
                  <button
                    className="org-btn org-btn-secondary mt-3"
                    onClick={() => void runIngest()}
                  >
                    Продолжить обработку
                  </button>
                )}
              </div>
            ) : ingest.running ? (
              <div className="mt-3 flex items-start gap-3 rounded-[14px] bg-[#f4f4f6] px-4 py-3.5">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--org-border)] border-t-[var(--org-text)]" aria-hidden />
                <div>
                  <p className="text-[13.5px] font-medium">
                    ИИ-обработка запущена — находим лица и считаем отпечатки
                  </p>
                  <p className="org-hint mt-0.5">
                    Обычно занимает несколько минут на 400 фото. Можно закрыть
                    страницу — обработка продолжится при следующем открытии.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex items-start gap-3 rounded-[14px] bg-[#f4f4f6] px-4 py-3.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="mt-0.5 shrink-0 text-[var(--org-dim)]" aria-hidden>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8h.01M11 12h1v4h1" />
                </svg>
                <div>
                  <p className="text-[13.5px] font-medium">
                    ИИ-обработка пока не запускалась
                  </p>
                  <p className="org-hint mt-0.5">
                    Поиск по описанию и совпадение лиц подключаются отдельно.
                    Галерея и просмотр фотографий работают и без них.
                  </p>
                </div>
              </div>
            )}

            {ingest.error && (
              <div className="mt-4 rounded-[14px] border border-[#f0c8c5] bg-[var(--org-err-bg)] px-4 py-3">
                <p className="text-[13.5px] font-medium text-[var(--org-err)]">
                  {ingest.error}
                </p>
                <button
                  className="org-btn org-btn-secondary mt-2"
                  onClick={() => void runIngest()}
                >
                  Повторить обработку
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Помощь: как получить ссылку ── */}
        <div className="org-card h-fit p-5">
          <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--org-faint)]">
            Как скопировать ссылку
          </p>

          <div className="mt-4 flex flex-col gap-4">
            <div>
              <p className="text-[13.5px] font-semibold">Яндекс.Диск</p>
              <ol className="org-hint mt-1 list-decimal space-y-0.5 pl-4">
                <li>Откройте папку с фотографиями.</li>
                <li>Нажмите «Поделиться».</li>
                <li>Выберите «Все, у кого есть ссылка».</li>
                <li>Скопируйте ссылку и вставьте её слева.</li>
              </ol>
            </div>
            <div className="border-t border-[var(--org-border)] pt-4">
              <p className="text-[13.5px] font-semibold">Google Drive</p>
              <ol className="org-hint mt-1 list-decimal space-y-0.5 pl-4">
                <li>Откройте папку.</li>
                <li>Нажмите «Доступ».</li>
                <li>Поставьте «Все, у кого есть ссылка».</li>
                <li>Скопируйте ссылку.</li>
              </ol>
            </div>
          </div>

          <p className="org-hint mt-5 border-t border-[var(--org-border)] pt-4">
            Папку можно заменить в любой момент — достаточно вставить новую ссылку
            и нажать «Подключить фотографии».
          </p>
        </div>
      </div>

      {/* Пустое состояние до подключения */}
      {!photos && (
        <div className="org-card mt-4 flex flex-col items-center px-6 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#f1f1f4]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--org-dim)]" aria-hidden>
              <rect x="3" y="5" width="18" height="14" rx="2.5" />
              <circle cx="8.5" cy="10" r="1.6" />
              <path d="m4 17 4.5-4.5 3.5 3.5 3-3L20 17" />
            </svg>
          </span>
          <p className="mt-4 text-[15px] font-semibold tracking-[-0.015em]">
            Фотографии ещё не подключены
          </p>
          <p className="org-hint mt-1.5 max-w-md">
            Вставьте ссылку на папку в поле выше — после подключения участники
            увидят фотографии на публичной странице.
          </p>
        </div>
      )}
    </div>
  );
}
