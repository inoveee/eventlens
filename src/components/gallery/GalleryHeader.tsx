// @TheTechMargin 2026
"use client";

import { config } from "@/lib/config";
import { isRecentlyUpdated, splitFirstSentence, timeAgo } from "@/lib/utils";
import PhotoUpload from "@/components/PhotoUpload";
import type { UseSearchReturn } from "@/hooks/useSearch";
import type { MatchResult, MatchTier } from "@/lib/types";

interface GalleryHeaderProps {
  search: UseSearchReturn;
  onRefresh: () => void;
  lastUpdated: string;
  totalPhotos: number;
  activeFolder: string;
  activeTag: string | null;
  activeType: "all" | "photo" | "video";
  onClearActiveFolder: () => void;
  onClearActiveTag: () => void;
}

/** AFD-референс: тёмная hero-секция с радиальными глоу от бренд-цветов,
 *  логотипом слева, огромным uppercase-заголовком (900), теглайном в
 *  акцентном цвете и pill-кнопками со стрелкой в круге. Без меню и
 *  переключателя языка. */
export default function GalleryHeader({
  search,
  lastUpdated,
  totalPhotos,
  activeFolder,
  activeTag,
  activeType,
}: GalleryHeaderProps) {
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch {}
  };

  const triggerFaceSearch = (camera = false) => {
    const id = camera ? "el-camera-input" : "el-face-input";
    document.getElementById(id)?.click();
  };

  const focusSearch = () => {
    const el = document.getElementById("el-search-input");
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    (el as HTMLInputElement | null)?.focus({ preventScroll: true });
  };

  const filtersActive = !!(activeFolder || activeTag || activeType !== "all");

  // Первая фраза — светлая, хвост после точки — в акцентном цвете ивента
  const { first: statementFirst, rest: statementRest } = splitFirstSentence(
    config.heroStatement,
  );

  return (
    <header className="el-hero">
      <div className="mx-auto max-w-6xl px-5 pt-6 pb-9 md:px-8 md:pt-10 md:pb-16">
        {/* ── Верхняя строка: логотип слева, мета-чипы справа ── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {config.logoUrl ? (
              /* Organizer logo — falls back to the event name if the
                 image fails to load. */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={config.logoUrl}
                alt={config.eventName}
                className="h-9 w-auto object-contain md:h-12"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : null}
            <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/45 md:text-[11px]">
              Фотогалерея
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/70 backdrop-blur sm:inline-flex">
              {totalPhotos > 0 ? `${totalPhotos} фото` : "Загрузка…"}
            </span>
            {isRecentlyUpdated(lastUpdated) && (
              <span className="hidden items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/70 backdrop-blur md:inline-flex">
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full"
                  style={{ background: "var(--el-primary)" }}
                />
                Обновлено {timeAgo(lastUpdated)}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="rounded-full border border-white/25 px-3.5 py-1.5 text-xs text-white/75 transition-colors hover:bg-white/10 hover:text-white"
              title="Выйти"
            >
              Выйти
            </button>
          </div>
        </div>

        {/* ── Заголовок: огромный uppercase + двухцветная фраза + пояснение ── */}
        <div className="mt-10 max-w-4xl md:mt-20">
          <h1 className="text-[clamp(2.5rem,10vw,6.5rem)] font-black uppercase leading-[0.92] tracking-[-0.02em] text-white">
            {config.eventName}
          </h1>
          <p className="mt-5 text-xl font-semibold leading-snug tracking-[-0.01em] text-white text-balance md:mt-7 md:text-4xl">
            {statementFirst}
            {statementRest && (
              <>
                {" "}
                <span style={{ color: "var(--el-primary)" }}>{statementRest}</span>
              </>
            )}
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55 md:mt-4 md:text-lg">
            {config.eventDescription}
          </p>
        </div>

        {/* ── Поиск + pill-кнопки ── */}
        <div className="mt-8 flex flex-col gap-4 md:mt-12">
          <div className="relative w-full max-w-2xl">
            <svg
              className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              id="el-search-input"
              type="text"
              value={search.searchInput}
              onChange={(e) => search.setSearchInput(e.target.value)}
              placeholder="Поиск по фото, людям, сценам…"
              className="w-full rounded-full border border-white/15 bg-white/10 py-3.5 pl-12 pr-12 text-base text-white backdrop-blur-xl transition-colors placeholder:text-white/45 focus:border-white/40 focus:bg-white/15 md:py-4"
              aria-label="Поиск фото"
              enterKeyHint="search"
            />
            {search.searchInput && (
              <button
                onClick={() => search.setSearchInput("")}
                className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Очистить поиск"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 md:gap-3">
            <button
              onClick={() => triggerFaceSearch(false)}
              className="group inline-flex items-center gap-3 py-2 pl-5 pr-2 text-sm font-semibold text-[var(--el-on-primary)]"
              style={{ background: "var(--el-primary)" }}
            >
              Найти мои фото
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/15 transition-transform group-hover:translate-x-0.5">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="4" y1="12" x2="19" y2="12" />
                  <polyline points="13 6 19 12 13 18" />
                </svg>
              </span>
            </button>

            <button
              onClick={() => triggerFaceSearch(true)}
              className="inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-2.5 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white md:hidden"
            >
              Камера
            </button>

            <button
              onClick={focusSearch}
              className="inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-2.5 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white"
            >
              Поиск по описанию
            </button>

            <span className="hidden text-xs text-white/45 sm:inline">
              {totalPhotos > 0 ? `${totalPhotos} фото в галерее` : ""}
            </span>
          </div>
        </div>

        {/* ── Активные фильтры ── */}
        {filtersActive && (
          <p className="mt-4 inline-flex rounded-full bg-white/10 px-4 py-1.5 text-xs text-white/70 backdrop-blur">
            Фильтры:{" "}
            {[
              activeFolder ? `«${activeFolder}»` : "",
              activeTag ? `#${activeTag}` : "",
              activeType !== "all"
                ? activeType === "video"
                  ? "только видео"
                  : "только фото"
                : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}

        {/* Управление поиском по лицу: скрытые input'ы здесь же,
            кнопки-действия (отмена/сброс/превью) показываются PhotoUpload */}
        <PhotoUpload
          hideIdleActions
          onMatchResults={(data: { matches: MatchResult[]; description: string; tier?: MatchTier; recommendations?: string[] }) => {
            search.handleMatchResults(data);
          }}
          onClear={search.handleClearMatch}
          isActive={search.matchResults !== null}
        />
      </div>
    </header>
  );
}
