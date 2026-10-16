// @TheTechMargin 2026
"use client";

interface TagTabsProps {
  tags: string[];
  active: string | null;
  onSelect: (tag: string | null) => void;
  tagCounts: Record<string, number>;
}

/** Чипы-pill для тегов. Активный чип — в цвете ивента. */
export default function TagTabs({
  tags,
  active,
  onSelect,
  tagCounts,
}: TagTabsProps) {
  if (tags.length === 0) return null;

  const chipClass = (isActive: boolean) =>
    `shrink-0 rounded-full px-4 py-2 text-xs font-medium tracking-wide transition-all ${
      isActive
        ? "bg-[var(--el-primary)] text-[var(--el-on-primary)] shadow-[0_6px_20px_var(--el-glow-primary-25)]"
        : "border border-[var(--el-primary-22)] bg-[var(--el-surface)] text-[var(--el-t-primary-99)] hover:border-[var(--el-primary-44)] hover:text-[var(--el-t-primary)]"
    }`;

  return (
    <div className="hidden md:block scrollbar-hide overflow-x-auto -mx-4 px-4">
      <div className="flex items-center gap-2">
        <span className="shrink-0 mr-1 text-[10px] uppercase tracking-[0.2em] text-[var(--el-text-dim)]">
          Теги
        </span>
        {tags.map((tag) => (
          <button
            key={tag}
            onClick={() => onSelect(active === tag ? null : tag)}
            className={chipClass(active === tag)}
          >
            {tag}
            <span className="ml-1.5 opacity-60">{tagCounts[tag] || 0}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
