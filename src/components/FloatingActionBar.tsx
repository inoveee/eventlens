// @TheTechMargin 2026
"use client";

export type CollageRatio = "letterbox" | "portrait" | "square";

interface FloatingActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDownloadZip: () => void;
  onMakeCollage: () => void;
  downloading: boolean;
  collagePending: boolean;
}

export default function FloatingActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onDownloadZip,
  onMakeCollage,
  downloading,
  collagePending,
}: FloatingActionBarProps) {
  if (selectedCount === 0) return null;

  const busy = downloading || collagePending;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--el-primary-22)] bg-[var(--el-overlay-80)] backdrop-blur-xl animate-slide-up safe-bottom">
      <div className="mx-auto max-w-5xl flex items-center justify-between px-3 py-2.5 md:px-4 md:py-3 gap-2 md:gap-3">
        <button
          onClick={onClearSelection}
          className="shrink-0 border border-[var(--el-primary-22)] px-4 py-2 md:py-1.5 text-xs font-medium text-[var(--el-t-primary-99)] hover:border-[var(--el-primary-44)] hover:text-[var(--el-t-primary)] transition-all"
          title="Снять выбор"
        >
          Очистить
        </button>

        <span className="text-xs tabular-nums text-[var(--el-text-dim)] whitespace-nowrap">
          {selectedCount} / {totalCount}
        </span>

        <div className="flex items-center gap-1.5 md:gap-2">
          {selectedCount < totalCount && (
            <button
              onClick={onSelectAll}
              className="hidden sm:block shrink-0 border border-[var(--el-primary-22)] px-4 py-2 md:py-1.5 text-xs font-medium text-[var(--el-t-primary-99)] hover:border-[var(--el-primary-44)] hover:text-[var(--el-t-primary)] transition-all"
            >
              Выбрать все
            </button>
          )}
          <button
            onClick={onMakeCollage}
            disabled={busy || selectedCount > 20}
            title={selectedCount > 20 ? "Не больше 20 фото" : undefined}
            className="shrink-0 inline-flex items-center gap-1.5 md:gap-2 border border-[var(--el-primary-33)] bg-[var(--el-primary-11)] px-3.5 md:px-4 py-2 md:py-1.5 text-xs font-medium text-[var(--el-t-primary-99)] hover:bg-[var(--el-primary-15)] transition-all disabled:border-[var(--el-primary-15)] disabled:text-[var(--el-t-primary-33)] disabled:bg-transparent disabled:cursor-not-allowed"
          >
            {collagePending ? (
              <>
                <div className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-crosshair-spin" />
                <span className="hidden sm:inline">Собираем…</span>
                <span className="sm:hidden">…</span>
              </>
            ) : (
              <>
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
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                </svg>
                <span className="hidden sm:inline">Коллаж</span>
                <span className="sm:hidden">Коллаж</span>
              </>
            )}
          </button>
          <button
            onClick={onDownloadZip}
            disabled={busy}
            className="shrink-0 inline-flex items-center gap-1.5 md:gap-2 border border-[var(--el-primary-33)] bg-[var(--el-primary-11)] px-3.5 md:px-4 py-2 md:py-1.5 text-xs font-medium text-[var(--el-t-primary-99)] hover:bg-[var(--el-primary-15)] transition-all disabled:border-[var(--el-primary-15)] disabled:text-[var(--el-t-primary-33)] disabled:bg-transparent disabled:cursor-not-allowed"
          >
            {downloading ? (
              <>
                <div className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-crosshair-spin" />
                <span className="hidden sm:inline">Упаковываем…</span>
                <span className="sm:hidden">…</span>
              </>
            ) : (
              <>
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
                <span className="hidden sm:inline">Скачать архив</span>
                <span className="sm:hidden">Архив</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
