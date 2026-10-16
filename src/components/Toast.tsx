// @TheTechMargin 2026
"use client";

import { useEffect, useState } from "react";

interface ToastProps {
  message: string;
  action?: { label: string; onClick: () => void };
  duration?: number;
  onDismiss: () => void;
}

export default function Toast({
  message,
  action,
  duration = 10000,
  onDismiss,
}: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  return (
    <div
      className={`fixed bottom-4 left-3 right-3 z-40 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:bottom-6 mb-safe-bottom transition-all duration-300 ${
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-4 opacity-0"
      }`}
    >
      <div className="el-glass flex items-center justify-between gap-2 sm:gap-3 rounded-2xl px-4 py-3 shadow-[0_16px_48px_rgba(0,0,0,0.3)]">
        <span className="min-w-0 truncate text-sm text-[var(--el-text)]">
          {message}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {action && (
            <button
              onClick={action.onClick}
              className="border border-[var(--el-primary-33)] px-4 py-1.5 text-xs font-medium text-[var(--el-t-primary-99)] hover:bg-[var(--el-primary-11)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--el-primary)]"
            >
              {action.label}
            </button>
          )}
          <button
            onClick={() => {
              setVisible(false);
              setTimeout(onDismiss, 300);
            }}
            className="p-1.5 text-[var(--el-text-dim)] hover:text-[var(--el-text)] transition-colors"
            aria-label="Скрыть"
          >
            <svg
              width="14"
              height="14"
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
        </div>
      </div>
    </div>
  );
}
