// @TheTechMargin 2026
"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { CollageRatio } from "@/components/FloatingActionBar";

interface CollageRatioModalProps {
  onSelect: (ratio: CollageRatio) => void;
  onDismiss: () => void;
  selectedCount: number;
}

const RATIO_OPTIONS: {
  value: CollageRatio;
  label: string;
  description: string;
  icon: ReactNode;
}[] = [
  {
    value: "letterbox",
    label: "16:9",
    description: "Широкая — для экранов и презентаций",
    icon: (
      <svg width="48" height="27" viewBox="0 0 48 27" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="1" width="46" height="25" rx="1" />
        <line x1="16" y1="1" x2="16" y2="26" opacity="0.3" />
        <line x1="32" y1="1" x2="32" y2="26" opacity="0.3" />
        <line x1="1" y1="13" x2="47" y2="13" opacity="0.3" />
      </svg>
    ),
  },
  {
    value: "portrait",
    label: "9:16",
    description: "Вертикальная — для сторис",
    icon: (
      <svg width="27" height="48" viewBox="0 0 27 48" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="1" width="25" height="46" rx="1" />
        <line x1="1" y1="16" x2="26" y2="16" opacity="0.3" />
        <line x1="1" y1="32" x2="26" y2="32" opacity="0.3" />
        <line x1="13" y1="1" x2="13" y2="47" opacity="0.3" />
      </svg>
    ),
  },
  {
    value: "square",
    label: "1:1",
    description: "Квадрат — для соцсетей",
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="1" width="38" height="38" rx="1" />
        <line x1="1" y1="20" x2="39" y2="20" opacity="0.3" />
        <line x1="20" y1="1" x2="20" y2="39" opacity="0.3" />
      </svg>
    ),
  },
];

export default function CollageRatioModal({
  onSelect,
  onDismiss,
  selectedCount,
}: CollageRatioModalProps) {
  const [chosen, setChosen] = useState<CollageRatio | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xl p-4"
      onClick={onDismiss}
    >
      <div
        className="el-glass relative w-[90vw] max-w-sm rounded-3xl p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 text-center">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--el-text)]">
            Формат коллажа
          </h2>
          <p className="mt-1 text-xs text-[var(--el-text-dim)]">
            Выбрано фото: {selectedCount}
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          {RATIO_OPTIONS.map((opt) => {
            const active = chosen === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setChosen(opt.value)}
                className={`group flex items-center gap-4 rounded-2xl border px-4 py-3.5 transition-all ${
                  active
                    ? "border-[var(--el-primary)] bg-[var(--el-primary-11)]"
                    : "border-[var(--el-primary-22)] hover:border-[var(--el-primary-44)] hover:bg-[var(--el-primary-08)]"
                }`}
              >
                <div className={`shrink-0 w-12 h-12 flex items-center justify-center transition-colors ${
                  active ? "text-[var(--el-t-primary)]" : "text-[var(--el-text-dim)] group-hover:text-[var(--el-t-primary)]"
                }`}>
                  {opt.icon}
                </div>
                <div className="text-left">
                  <span className={`block text-sm font-semibold transition-colors ${
                    active ? "text-[var(--el-t-primary)]" : "text-[var(--el-text)] group-hover:text-[var(--el-t-primary)]"
                  }`}>
                    {opt.label}
                  </span>
                  <span className="block text-xs text-[var(--el-text-dim)]">
                    {opt.description}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => chosen && onSelect(chosen)}
          disabled={!chosen}
          className="mt-5 w-full py-3 text-sm font-semibold text-[var(--el-on-primary)] transition-all disabled:opacity-40"
          style={{ background: "var(--el-primary)" }}
        >
          Создать коллаж
        </button>

        <button
          onClick={onDismiss}
          className="mt-2 w-full py-2.5 text-sm text-[var(--el-text-dim)] hover:text-[var(--el-text)] transition-colors"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
