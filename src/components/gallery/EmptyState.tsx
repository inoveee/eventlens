// @TheTechMargin 2026

interface EmptyStateProps {
  type: "no-assets" | "no-results" | "no-match" | "error";
  query?: string;
  onRetry?: () => void;
}

export default function EmptyState({ type, query, onRetry }: EmptyStateProps) {
  if (type === "error") {
    return (
      <div className="flex flex-col items-center rounded-3xl border border-[var(--el-red-33)] bg-[var(--el-red-08)] p-10 text-center">
        <p className="max-w-md text-sm text-[var(--el-red)]">
          Не удалось загрузить фото — попробуйте обновить страницу
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-5 border border-[var(--el-primary-33)] px-7 py-2.5 text-sm font-medium text-[var(--el-t-primary-99)] hover:border-[var(--el-primary)] hover:text-[var(--el-t-primary)] transition-all"
          >
            Повторить
          </button>
        )}
      </div>
    );
  }

  if (type === "no-assets") {
    return (
      <div className="flex flex-col items-center rounded-3xl border border-[var(--el-primary-22)] bg-[var(--el-surface)] p-10 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--el-primary-15)]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--el-t-primary)]">
            <rect x="3" y="5" width="18" height="14" rx="3" />
            <circle cx="8.5" cy="10" r="1.5" />
            <path d="M21 16l-5-5-5 5" />
          </svg>
        </div>
        <p className="max-w-md text-sm text-[var(--el-text-dim)]">
          Фотографий пока нет — загрузите их, чтобы участники могли искать себя
        </p>
      </div>
    );
  }

  if (type === "no-match") {
    return (
      <div className="flex flex-col items-center rounded-3xl border border-[var(--el-primary-22)] bg-[var(--el-surface)] p-10 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--el-primary-15)]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--el-t-primary)]">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8.5" y1="8.5" x2="13.5" y2="13.5" />
            <line x1="13.5" y1="8.5" x2="8.5" y2="13.5" />
          </svg>
        </div>
        <p className="max-w-md text-sm text-[var(--el-text-dim)]">
          По этому фото совпадений не найдено — попробуйте снимок крупнее и чётче
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center rounded-3xl border border-[var(--el-primary-22)] bg-[var(--el-surface)] p-10 text-center">
      <p className="max-w-md text-sm text-[var(--el-text-dim)]">
        По запросу &quot;{query}&quot; ничего не найдено
      </p>
    </div>
  );
}
