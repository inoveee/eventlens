// @TheTechMargin 2026
// Мелкие строительные блоки панели: заголовки разделов, поля, диалоги.

"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="max-w-2xl">
        <h2 className="text-[21px] font-semibold tracking-[-0.02em]">{title}</h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--org-dim)]">
          {description}
        </p>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="org-label mb-1.5" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="org-hint mt-1.5">{hint}</p>}
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--org-faint)]">
        {label}
      </p>
      <p className="mt-1 truncate text-[17px] font-semibold tracking-[-0.02em]">{value}</p>
      {sub && <p className="org-hint mt-0.5">{sub}</p>}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 backdrop-blur-[2px]"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="org-card w-full max-w-[420px] p-6"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[16px] font-semibold tracking-[-0.015em]">{title}</h3>
        <p className="org-hint mt-2">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="org-btn org-btn-secondary" onClick={onCancel} disabled={busy}>
            Отмена
          </button>
          <button className="org-btn org-btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? "Выполняем…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Модальное окно с произвольным содержимым (формы создания/переименования).
 *  Закрывается по Escape и клику вне окна. */
export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="org-card w-full max-w-[440px] p-6"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[16px] font-semibold tracking-[-0.015em]">{title}</h3>
        {description && <p className="org-hint mt-2">{description}</p>}
        <div className="mt-4">{children}</div>
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
