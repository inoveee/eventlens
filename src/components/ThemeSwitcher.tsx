// @TheTechMargin 2026
"use client";

import { useEffect, useState } from "react";

export type ThemeName = "light" | "dark";

const THEME_KEY = "el-theme";

/** Синхронизация цвета мобильной шапки браузера с актуальным фоном. */
function syncMetaThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const bg = getComputedStyle(document.documentElement)
    .getPropertyValue("--el-bg")
    .trim();
  if (bg) meta.setAttribute("content", bg);
}

/**
 * Переключатель фона (тёмная/светлая версия). Стоит в самом верху
 * страницы по центру — в тёмной hero-шапке, поэтому стилизован под
 * неё (полупрозрачные white-пилюли, как у «Выйти» и чипов рядом).
 * Выбор сохраняется в localStorage и применяется до отрисовки
 * инлайн-скриптом в layout.tsx (без «мигания» при загрузке).
 */
export default function ThemeSwitcher({
  defaultTheme,
}: {
  /** Тема из env (NEXT_PUBLIC_THEME) — дефолт до первого выбора. */
  defaultTheme: ThemeName;
}) {
  const [theme, setTheme] = useState<ThemeName>(defaultTheme);

  // Восстановление сохранённого выбора после гидратации
  // (само применение на странице делает скрипт в <head>).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      // localStorage недоступен (приватный режим) — остаёмся на env-теме
    }
  }, []);

  const apply = (next: ThemeName) => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // приватный режим — выбор просто не переживёт перезагрузку
    }
    syncMetaThemeColor();
    setTheme(next);
  };

  const pillClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-all duration-300 sm:px-3.5 ${
      active
        ? "bg-[var(--el-primary)] text-[var(--el-on-primary)] shadow-[0_4px_14px_var(--el-glow-primary-25)]"
        : "text-white/70 hover:text-white"
    }`;

  return (
    <div
      role="group"
      aria-label="Оформление сайта"
      className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 p-1 backdrop-blur"
    >
      <button
        type="button"
        onClick={() => apply("light")}
        aria-pressed={theme === "light"}
        title="Светлый фон"
        className={pillClass(theme === "light")}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
        <span className="hidden sm:inline">Светлая</span>
      </button>
      <button
        type="button"
        onClick={() => apply("dark")}
        aria-pressed={theme === "dark"}
        title="Тёмный фон"
        className={pillClass(theme === "dark")}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
        <span className="hidden sm:inline">Тёмная</span>
      </button>
    </div>
  );
}
