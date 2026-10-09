// @TheTechMargin 2026

interface EmptyStateProps {
  type: "no-assets" | "no-results" | "no-match" | "error";
  query?: string;
  onRetry?: () => void;
}

export default function EmptyState({ type, query, onRetry }: EmptyStateProps) {
  if (type === "error") {
    return (
      <div className="flex flex-col items-center py-20 text-center border border-[var(--el-red-33)] bg-[var(--el-red-08)] p-8">
        <p className="text-xs font-mono uppercase tracking-wider text-red-500">
          &#9888; Не удалось загрузить фото — попробуйте обновить страницу
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 border border-[var(--el-primary-99)] px-6 py-2 text-xs font-mono uppercase tracking-wider text-[var(--el-t-primary-99)] hover:bg-[var(--el-accent-28)] hover:border-[var(--el-accent)] hover:text-[var(--el-t-accent)] transition-all"
          >
            [ПОВТОРИТЬ]
          </button>
        )}
      </div>
    );
  }

  if (type === "no-assets") {
    return (
      <div className="flex flex-col items-center py-20 text-center border border-[var(--el-primary-99)] p-8">
        <div className="text-4xl text-[var(--el-t-primary-d9)] mb-4">+</div>
        <p className="text-xs font-mono uppercase tracking-wider text-[var(--el-t-primary-99)]">
          {"Фотографий пока нет — загрузите их, чтобы участники могли искать себя"}
        </p>
      </div>
    );
  }

  if (type === "no-match") {
    return (
      <div className="flex flex-col items-center py-20 text-center border border-[var(--el-primary-99)] p-8">
        <div className="text-4xl text-[var(--el-t-primary-d9)] mb-4 animate-crosshair-spin">&#x2295;</div>
        <p className="text-xs font-mono uppercase tracking-wider text-[var(--el-t-primary-99)]">
          {"По этому фото совпадений не найдено — попробуйте снимок крупнее и чётче"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-20 text-center border border-[var(--el-primary-99)] p-8">
      <p className="text-xs font-mono uppercase tracking-wider text-[var(--el-t-primary-99)]">
        По запросу &quot;{query}&quot; ничего не найдено
      </p>
    </div>
  );
}
