import type { ReactNode } from "react";

/**
 * Макеты реальных экранов панели организатора (по скриншотам продукта):
 *  - OverviewScreen   — экран «Обзор» проекта;
 *  - AppearanceScreen — экран «Оформление» с редактором акцента и предпросмотром.
 * Демонстрационный проект: DevFest 2026. Это визуальные макеты для прототипа
 * маркетинговой страницы, а не скриншоты работающего приложения.
 */

const C = {
  bg: "#f6f6f7",
  panel: "#ffffff",
  border: "#e7e7ec",
  text: "#17171a",
  dim: "#63636d",
  faint: "#9a9aa4",
  hover: "#f1f1f4",
  okBg: "#e8f6ec",
  ok: "#15803d",
  accent: "#fd8d2c",
};

/* Мелкие иконки (line-стиль панели) */
function IconFolder() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M2.5 6.5A1.5 1.5 0 0 1 4 5h3.4l1.4 1.6H16a1.5 1.5 0 0 1 1.5 1.5v6.4A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5v-8Z" />
    </svg>
  );
}
function IconGrid() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="3" y="3" width="6" height="6" rx="1.4" />
      <rect x="11" y="3" width="6" height="6" rx="1.4" />
      <rect x="3" y="11" width="6" height="6" rx="1.4" />
      <rect x="11" y="11" width="6" height="6" rx="1.4" />
    </svg>
  );
}
function IconPhoto() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2.8" y="4" width="14.4" height="12" rx="2" />
      <circle cx="7.2" cy="8.2" r="1.3" />
      <path d="m4.5 14.5 3.4-3.4a1.2 1.2 0 0 1 1.7 0l4.9 4.4" />
    </svg>
  );
}
function IconBrush() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M11.5 3.5 16.5 8.5 8 17H3v-5l8.5-8.5Z" />
      <path d="M9.5 5.5 14.5 10.5" />
    </svg>
  );
}
function IconSliders() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M3 6h14M3 10h14M3 14h14" />
      <circle cx="7" cy="6" r="1.6" fill="#fff" />
      <circle cx="13" cy="10" r="1.6" fill="#fff" />
      <circle cx="8.5" cy="14" r="1.6" fill="#fff" />
    </svg>
  );
}

function Sidebar({ active }: { active: "overview" | "appearance" }) {
  const items: Array<{ key: string; label: string; icon: ReactNode }> = [
    { key: "all", label: "Все проекты", icon: <IconFolder /> },
    { key: "overview", label: "Обзор", icon: <IconGrid /> },
    { key: "photos", label: "Фотографии", icon: <IconPhoto /> },
    { key: "appearance", label: "Оформление", icon: <IconBrush /> },
    { key: "settings", label: "Настройки мероприяти…", icon: <IconSliders /> },
  ];
  return (
    <aside className="flex w-[192px] shrink-0 flex-col border-r px-3.5 pb-4 pt-4" style={{ borderColor: C.border, background: C.panel }}>
      <div className="flex items-center gap-2 px-1">
        <img src="/noveee-icon.png" alt="" className="h-6 w-6 rounded-[7px]" />
        <span className="text-[12.5px] font-semibold tracking-[-0.01em]" style={{ color: C.text }}>noveee.me</span>
      </div>
      <div className="mt-1 px-1 text-[10.5px]" style={{ color: C.dim }}>DevFest 2026</div>
      <nav className="mt-4 space-y-0.5">
        {items.map((it) => (
          <div
            key={it.key}
            className="flex items-center gap-2 rounded-[9px] px-2.5 py-[7px] text-[11.5px]"
            style={
              it.key === active
                ? { background: C.hover, color: C.text, fontWeight: 600 }
                : { color: C.dim }
            }
          >
            {it.icon}
            <span className="truncate">{it.label}</span>
          </div>
        ))}
      </nav>
      <div className="flex-1" />
      <div className="px-1 text-[10px] leading-relaxed" style={{ color: C.faint }}>
        Фотографии → Оформление →
        <br />
        Публикация
      </div>
      <div className="mt-3 px-1 text-[11px]" style={{ color: C.dim }}>Выйти</div>
    </aside>
  );
}

function TopBar() {
  return (
    <div className="flex items-center gap-2.5 border-b px-5 py-3" style={{ borderColor: C.border }}>
      <span className="text-[14px] font-semibold tracking-[-0.01em]" style={{ color: C.text }}>DevFest 2026</span>
      <span className="flex items-center gap-1.5 rounded-full px-2 py-[3px] text-[10.5px] font-medium" style={{ background: C.okBg, color: C.ok }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: C.ok }} />
        Опубликовано
      </span>
      <div className="ml-auto flex gap-2">
        <span className="rounded-full border px-3 py-[6px] text-[11px] font-medium" style={{ borderColor: C.border, color: C.text, background: C.panel }}>
          Предпросмотр
        </span>
        <span className="rounded-full border px-3 py-[6px] text-[11px] font-medium" style={{ borderColor: C.border, color: C.text, background: C.panel }}>
          Открыть страницу ↗
        </span>
      </div>
    </div>
  );
}

/** Обёртка «скриншота»: горизонтальный скролл на узких экранах. */
export function PanelFrame({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[20px] border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
      <div className="min-w-[1000px]" style={{ background: C.bg, color: C.text }}>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Экран «Обзор»                                                       */
/* ------------------------------------------------------------------ */

export function OverviewScreen() {
  const checklist = [
    { done: true, n: null as string | null, title: "Подключить фотографии", pill: "387 фото", sub: "Ссылка на папку с фотографиями на облачном диске.", link: "Перейти" },
    { done: false, n: "2", title: "Настроить оформление", pill: null as string | null, sub: "Фон верхней части, акцентный цвет и логотип.", link: "Перейти" },
    { done: false, n: "3", title: "Проверить результат", pill: null as string | null, sub: "Посмотрите, как страница выглядит на телефоне и на компьютере.", link: "Открыть" },
    { done: true, n: null as string | null, title: "Опубликовать", pill: "Опубликовано", sub: "Применить сохранённые изменения к публичной странице.", link: "" },
  ];
  return (
    <div className="flex">
      <Sidebar active="overview" />
      <main className="flex-1 pb-6">
        <TopBar />
        <div className="px-5 pt-5">
          <h3 className="text-[20px] font-semibold tracking-[-0.02em]">Обзор</h3>
          <p className="mt-1 text-[11.5px]" style={{ color: C.dim }}>
            Состояние страницы мероприятия: что уже подключено, что изменено и что осталось сделать.
          </p>

          <div className="mt-4 flex gap-4">
            {/* Публикация */}
            <div className="flex-1 rounded-[14px] border bg-white p-4" style={{ borderColor: C.border }}>
              <div className="flex items-start">
                <span className="text-[10px] font-medium uppercase tracking-[0.12em]" style={{ color: C.faint }}>Публикация</span>
                <div className="ml-auto flex gap-2">
                  <span className="rounded-full border px-3 py-[5px] text-[10.5px] font-medium" style={{ borderColor: C.border }}>Предпросмотр</span>
                  <span className="rounded-full border px-3 py-[5px] text-[10.5px] font-medium" style={{ borderColor: C.border }}>Открыть страницу</span>
                </div>
              </div>
              <span className="mt-2.5 flex w-fit items-center gap-1.5 rounded-full px-2 py-[3px] text-[10.5px] font-medium" style={{ background: C.okBg, color: C.ok }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: C.ok }} />
                Опубликовано
              </span>
              <p className="mt-2 text-[11px]" style={{ color: C.dim }}>Посетители видят текущую версию страницы.</p>
              <div className="mt-3.5 grid grid-cols-3 gap-3 border-t pt-3.5" style={{ borderColor: C.border }}>
                <div>
                  <div className="text-[9.5px] font-medium uppercase tracking-[0.12em]" style={{ color: C.faint }}>Фотографии</div>
                  <div className="mt-1 text-[17px] font-semibold">387</div>
                  <div className="text-[10px]" style={{ color: C.dim }}>Папок: 0</div>
                </div>
                <div>
                  <div className="text-[9.5px] font-medium uppercase tracking-[0.12em]" style={{ color: C.faint }}>Оформление</div>
                  <div className="mt-1 text-[17px] font-semibold">Стандарт</div>
                  <div className="text-[10px]" style={{ color: C.dim }}>Без логотипа</div>
                </div>
                <div>
                  <div className="text-[9.5px] font-medium uppercase tracking-[0.12em]" style={{ color: C.faint }}>Акцент</div>
                  <div className="mt-1 flex items-center gap-2 text-[17px] font-semibold">
                    <span className="h-4 w-4 rounded-full" style={{ background: C.accent }} />
                    #FD8D2C
                  </div>
                  <div className="text-[10px]" style={{ color: C.dim }}>Основной цвет кнопок</div>
                </div>
              </div>
            </div>

            {/* Источник фото */}
            <div className="flex w-[248px] flex-col rounded-[14px] border bg-white p-4" style={{ borderColor: C.border }}>
              <span className="text-[10px] font-medium uppercase tracking-[0.12em]" style={{ color: C.faint }}>Источник фото</span>
              <div className="mt-2 text-[15px] font-semibold">Яндекс.Диск</div>
              <div className="mt-0.5 text-[10.5px]" style={{ color: C.dim }}>Обновлено: 16 окт., 17:35</div>
              <div className="flex-1" />
              <span className="mt-4 rounded-full border py-[7px] text-center text-[11px] font-medium" style={{ borderColor: C.border }}>
                Управление фото
              </span>
            </div>
          </div>

          {/* Чек-лист */}
          <div className="mt-4 rounded-[14px] border bg-white p-4" style={{ borderColor: C.border }}>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em]" style={{ color: C.faint }}>Как настроить страницу</span>
            <div className="mt-3 space-y-3">
              {checklist.map((it, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span
                    className="mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                    style={it.done ? { background: C.okBg, color: C.ok } : { background: C.hover, color: C.dim }}
                  >
                    {it.done ? "✓" : it.n}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[12px] font-semibold">
                      {it.title}
                      {it.pill && (
                        <span className="rounded-full px-2 py-[2px] text-[9.5px] font-medium" style={{ background: C.okBg, color: C.ok }}>
                          {it.pill}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[10.5px]" style={{ color: C.dim }}>{it.sub}</div>
                  </div>
                  {it.link && (
                    <span className="mt-0.5 shrink-0 text-[11px] font-medium" style={{ color: C.text }}>{it.link}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3.5 border-t pt-3 text-[10px]" style={{ borderColor: C.border, color: C.faint }}>
              Настройки хранятся в файле на этом сервере — переносите их вместе с проектом или подключите постоянное хранилище.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Экран «Оформление»                                                  */
/* ------------------------------------------------------------------ */

export function AppearanceScreen() {
  const swatches = ["#fd8d2c", "#ff4444", "#ff2d78", "#a855f7", "#3b82f6", "#22c55e", "#eab308", "#1f2937"];
  return (
    <div className="flex">
      <Sidebar active="appearance" />
      <main className="flex-1 pb-6">
        <TopBar />
        <div className="px-5 pt-5">
          <div className="flex items-start">
            <div>
              <h3 className="text-[20px] font-semibold tracking-[-0.02em]">Оформление</h3>
              <p className="mt-1 max-w-[520px] text-[11.5px]" style={{ color: C.dim }}>
                Настройте внешний вид публичной страницы. Результат виден в предпросмотре сразу — публикация отдельным шагом.
              </p>
            </div>
            <div className="ml-auto flex gap-2">
              <span className="rounded-full border px-3.5 py-[7px] text-[11px] font-medium" style={{ borderColor: C.border, background: C.panel }}>Сохранить</span>
              <span className="rounded-full px-3.5 py-[7px] text-[11px] font-semibold" style={{ background: "#17171a", color: "#fff" }}>Опубликовать</span>
            </div>
          </div>

          <div className="mt-4 flex gap-4">
            {/* Настройки слева */}
            <div className="w-[300px] shrink-0 space-y-4">
              <div className="rounded-[14px] border bg-white p-4" style={{ borderColor: C.border }}>
                <span className="text-[10px] font-medium uppercase tracking-[0.12em]" style={{ color: C.faint }}>Верхняя часть страницы</span>
                <div className="mt-2.5 flex gap-1 rounded-full p-1" style={{ background: C.hover }}>
                  {["Стандарт", "Цвет", "Градиент", "Изображение"].map((t, i) => (
                    <span
                      key={t}
                      className="flex-1 rounded-full py-[5px] text-center text-[10.5px]"
                      style={i === 0 ? { background: C.panel, fontWeight: 600, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" } : { color: C.dim }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <p className="mt-2.5 text-[10.5px] leading-relaxed" style={{ color: C.dim }}>
                  Фирменный тёмный фон noveee.me со световыми акцентами в цветах мероприятия. Ничего не меняется, пока вы не выберете другой режим.
                </p>
              </div>

              <div className="rounded-[14px] border bg-white p-4" style={{ borderColor: C.border }}>
                <span className="text-[10px] font-medium uppercase tracking-[0.12em]" style={{ color: C.faint }}>Акцентный цвет</span>
                <div className="mt-2.5 flex items-center gap-2.5">
                  <span className="h-9 w-9 rounded-[10px]" style={{ background: C.accent }} />
                  <span className="flex-1 rounded-[10px] border px-3 py-2 font-mono text-[11.5px]" style={{ borderColor: C.border }}>#FD8D2C</span>
                  <span className="rounded-full px-3.5 py-2 text-[11px] font-semibold" style={{ background: C.accent, color: "#17171a" }}>Кнопка</span>
                </div>
                <div className="mt-3 flex gap-2">
                  {swatches.map((c, i) => (
                    <span
                      key={c}
                      className="h-[22px] w-[22px] rounded-full"
                      style={{ background: c, boxShadow: i === 0 ? `0 0 0 2px #fff, 0 0 0 4px ${C.text}` : "none" }}
                    />
                  ))}
                </div>
                <p className="mt-2.5 text-[10.5px] leading-relaxed" style={{ color: C.dim }}>
                  Применяется к кнопкам, ссылкам и акцентным элементам публичной страницы.
                </p>
              </div>

              <div className="rounded-[14px] border bg-white p-4" style={{ borderColor: C.border }}>
                <span className="text-[10px] font-medium uppercase tracking-[0.12em]" style={{ color: C.faint }}>Логотип</span>
                <div className="mt-2 text-[11.5px] font-semibold">Логотип мероприятия или компании</div>
                <div className="mt-2.5 rounded-[12px] border border-dashed px-4 py-5 text-center" style={{ borderColor: C.border }}>
                  <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-full" style={{ background: C.hover, color: C.dim }}>↑</span>
                  <div className="mt-2 text-[11.5px] font-semibold">Загрузить логотип</div>
                  <div className="mt-0.5 text-[10px]" style={{ color: C.faint }}>PNG, JPEG, WEBP, SVG, до 512 КБ · можно перетащить</div>
                </div>
              </div>
            </div>

            {/* Предпросмотр справа */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium uppercase tracking-[0.12em]" style={{ color: C.faint }}>Предпросмотр</span>
                <span className="flex items-center gap-1.5 rounded-full px-2 py-[3px] text-[10.5px] font-medium" style={{ background: C.okBg, color: C.ok }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: C.ok }} />
                  Опубликовано
                </span>
                <div className="ml-auto flex gap-1 rounded-full p-1" style={{ background: C.hover }}>
                  <span className="rounded-full px-3 py-[4px] text-[10.5px]" style={{ background: C.panel, fontWeight: 600, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>Компьютер</span>
                  <span className="rounded-full px-3 py-[4px] text-[10.5px]" style={{ color: C.dim }}>Телефон</span>
                </div>
              </div>

              <div className="mt-2.5 overflow-hidden rounded-[14px] border bg-white" style={{ borderColor: C.border }}>
                <div className="flex items-center gap-2 border-b px-4 py-2" style={{ borderColor: C.border }}>
                  <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
                  <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
                  <span className="h-2 w-2 rounded-full bg-[#28c840]" />
                  <span className="ml-2 rounded-full px-2.5 py-0.5 text-[9.5px]" style={{ background: C.hover, color: C.dim }}>noveee.me</span>
                </div>
                {/* Публичная страница в предпросмотре */}
                <div className="p-4" style={{ background: "radial-gradient(120% 140% at 85% 0%, rgba(253,141,44,0.16), transparent 55%), radial-gradient(100% 130% at 10% 10%, rgba(255,0,255,0.08), transparent 50%), #0d0d11" }}>
                  <div className="flex items-center">
                    <img src="/noveee-icon.png" alt="" className="h-7 w-7 rounded-[8px]" />
                    <span className="ml-auto rounded-full px-2.5 py-1 text-[10px] text-white/70" style={{ background: "rgba(255,255,255,0.08)" }}>8 фото</span>
                  </div>
                  <div className="mt-4 text-[30px] font-bold leading-none tracking-[-0.03em] text-white">DEVFEST 2026</div>
                  <div className="mt-2 text-[13px] font-semibold" style={{ color: C.accent }}>
                    Вся съёмка с мероприятия. И ваши кадры в ней
                  </div>
                  <div className="mt-1.5 max-w-[420px] text-[10.5px] leading-relaxed text-white/45">
                    Сделайте селфи — найдём ваши фото. Или просто листайте галерею по альбомам
                  </div>
                  <div className="mt-3.5 flex items-center gap-2.5">
                    <span className="rounded-full px-3.5 py-2 text-[11px] font-semibold" style={{ background: C.accent, color: "#17171a" }}>Найти мои фото →</span>
                    <span className="rounded-full px-3 py-2 text-[10.5px] text-white/70" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full" style={{ background: C.accent }} />
                      Селфи — только для поиска
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <span className="rounded-full px-3 py-1.5 text-[10.5px] font-semibold" style={{ background: C.accent, color: "#17171a" }}>Всё</span>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-[86px] rounded-[10px]" style={{ background: C.hover }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
