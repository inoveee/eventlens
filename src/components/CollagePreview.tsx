// @TheTechMargin 2026
"use client";

import { useEffect } from "react";

interface CollagePreviewProps {
  blobUrl: string;
  onDownload: () => void;
  onDismiss: () => void;
}

export default function CollagePreview({
  blobUrl,
  onDownload,
  onDismiss,
}: CollagePreviewProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onDismiss}
    >
      <div
        className="relative flex flex-col items-center gap-4 p-4 max-w-[90vw] max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-hidden rounded-2xl border border-[var(--el-primary-22)] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={blobUrl}
            alt="Предпросмотр коллажа"
            className="max-w-full max-h-[75vh] object-contain"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onDismiss}
            className="border border-white/25 px-5 py-2.5 text-sm text-white/85 hover:bg-white/10 hover:text-white transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={onDownload}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-[var(--el-on-primary)]"
            style={{ background: "var(--el-primary)" }}
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
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Скачать
          </button>
        </div>
      </div>
    </div>
  );
}
