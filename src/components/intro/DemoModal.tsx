"use client";

import { useEffect, useState } from "react";

/**
 * Прототип формы записи на демонстрацию.
 *
 * ВАЖНО (этап 1 — изолированный прототип):
 * Форма ничего не отправляет — нет интеграций, нет API, нет сохранения данных.
 * После «отправки» показывается честное уведомление о том, что заявка не ушла.
 * Точка подключения реального механизма помечена комментарием onSubmitDemo.
 */
export function DemoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) setSent(false);
  }, [open]);

  if (!open) return null;

  // Точка подключения: здесь подключается реальный механизм записи
  // (email-форма, Telegram-бот, CRM и т.п.) — по согласованию на этапе 2.
  const onSubmitDemo = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Записаться на демонстрацию"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-[440px] overflow-hidden rounded-[24px] border border-white/10 bg-[#16161c] shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
        <div
          className="relative h-[92px] overflow-hidden"
          style={{
            background:
              "radial-gradient(120% 160% at 20% 0%, color-mix(in srgb, var(--el-primary) 34%, transparent) 0%, transparent 55%), radial-gradient(110% 150% at 85% 10%, color-mix(in srgb, var(--el-accent) 22%, transparent) 0%, transparent 60%), #101014",
          }}
        >
          <img
            src="/noveee-icon.png"
            alt="noveee.me"
            className="absolute left-6 top-1/2 h-10 w-10 -translate-y-1/2 rounded-[10px]"
          />
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
          >
            ✕
          </button>
        </div>

        {sent ? (
          <div className="p-7">
            <h3 className="text-[19px] font-semibold tracking-[-0.02em]">
              Это визуальный прототип
            </h3>
            <p className="mt-2.5 text-[14px] leading-relaxed text-[#a1a1aa]">
              Заявка <b className="text-[#e4e4e7]">не отправлена</b> — форма
              демонстрирует только внешний вид сценария записи на демо. Реальный
              канал связи подключим после согласования интеграции.
            </p>
            <button
              onClick={onClose}
              className="mt-6 w-full rounded-full bg-[var(--el-primary)] px-5 py-3 text-[14px] font-semibold text-black transition hover:-translate-y-px active:scale-[0.98]"
            >
              Понятно
            </button>
          </div>
        ) : (
          <form className="p-7" onSubmit={onSubmitDemo}>
            <h3 className="text-[19px] font-semibold tracking-[-0.02em]">
              Демонстрация noveee.me
            </h3>
            <p className="mt-1.5 text-[13px] text-[#a1a1aa]">
              Покажем сервис и обсудим доступ к фотографиям для ваших участников.
            </p>

            <label className="mt-5 block text-[12px] font-medium text-[#a1a1aa]" htmlFor="demo-name">
              Имя
            </label>
            <input
              id="demo-name"
              required
              placeholder="Как к вам обращаться"
              className="mt-1.5 w-full rounded-[14px] border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[14px] text-[#f4f4f5] outline-none transition placeholder:text-[#6b6b73] focus:border-[var(--el-primary)]"
            />

            <label className="mt-4 block text-[12px] font-medium text-[#a1a1aa]" htmlFor="demo-email">
              Email
            </label>
            <input
              id="demo-email"
              type="email"
              required
              placeholder="you@company.com"
              className="mt-1.5 w-full rounded-[14px] border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[14px] text-[#f4f4f5] outline-none transition placeholder:text-[#6b6b73] focus:border-[var(--el-primary)]"
            />

            <label className="mt-4 block text-[12px] font-medium text-[#a1a1aa]" htmlFor="demo-event">
              Мероприятие
            </label>
            <input
              id="demo-event"
              placeholder="Конференция, корпоратив, фестиваль…"
              className="mt-1.5 w-full rounded-[14px] border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[14px] text-[#f4f4f5] outline-none transition placeholder:text-[#6b6b73] focus:border-[var(--el-primary)]"
            />

            <button
              type="submit"
              className="mt-6 w-full rounded-full bg-[var(--el-primary)] px-5 py-3 text-[14px] font-semibold text-black transition hover:-translate-y-px active:scale-[0.98]"
            >
              Отправить заявку
            </button>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-[#6b6b73]">
              Прототип: данные никуда не передаются и не сохраняются.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
