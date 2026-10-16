// @TheTechMargin 2026
"use client";

import { config } from "@/lib/config";
import { isRecentlyUpdated, splitFirstSentence, timeAgo } from "@/lib/utils";
import PhotoUpload from "@/components/PhotoUpload";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import type { UseSearchReturn } from "@/hooks/useSearch";
import type { MatchResult, MatchTier } from "@/lib/types";

interface GalleryHeaderProps {
  search: UseSearchReturn;
  onRefresh: () => void;
  lastUpdated: string;
  totalPhotos: number;
}

/** AFD-референс: тёмная hero-секция с радиальными глоу от бренд-цветов,
 *  логотипом слева, огромным uppercase-заголовком (900), теглайном в
 *  акцентном цвете и pill-кнопками со стрелкой в круге. Без меню и
 *  переключателя языка. */
export default function GalleryHeader({
  search,
  lastUpdated,
  totalPhotos,
}: GalleryHeaderProps) {
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch {}
  };

  const triggerFaceSearch = () => {
    document.getElementById("el-face-input")?.click();
  };

  // Первая фраза — светлая, хвост после точки — в акцентном цвете ивента
  const { first: statementFirst, rest: statementRest } = splitFirstSentence(
    config.heroStatement,
  );

  return (
    <header className="el-hero">
      <div className="mx-auto max-w-6xl px-5 pt-6 pb-9 md:px-8 md:pt-10 md:pb-16">
        {/* ── Верхняя строка: логотип слева, тема по центру, мета-чипы справа ── */}
        <div className="relative flex items-start justify-between gap-4">
          {/* Переключатель фона — в самом верху по центру страницы */}
          <div className="absolute left-1/2 top-0 -translate-x-1/2 print:hidden">
            <ThemeSwitcher
              defaultTheme={config.theme === "light" ? "light" : "dark"}
            />
          </div>
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
            {/* noveee.me — иконка платформы вместо текстовой подписи */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/noveee-icon.png"
              alt="noveee.me"
              className="h-8 w-auto md:h-11"
            />
          </div>

          <div className="flex shrink-0 items-center gap-2">
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

        {/* ── Pill-кнопки действия ── */}
        <div className="mt-8 flex flex-col gap-4 md:mt-12">
          <div className="flex flex-wrap items-center gap-2.5 md:gap-3">
            <button
              onClick={triggerFaceSearch}
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

            <span className="inline-flex rounded-full bg-white/10 px-3.5 py-2 text-xs text-white/70 backdrop-blur">
              {totalPhotos > 0 ? `${totalPhotos} фото` : "Загрузка…"}
            </span>
          </div>

          {/* Приватность селфи — на видном месте, сразу под кнопками */}
          <p className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs leading-relaxed text-white/70 backdrop-blur md:text-[13px]">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
              aria-hidden="true"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Селфи используется только для поиска — фото не сохраняем
          </p>
        </div>

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
