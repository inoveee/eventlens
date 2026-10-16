// @TheTechMargin 2026
"use client";

interface FolderTabsProps {
  folders: string[];
  active: string;
  onSelect: (folder: string) => void;
  totalCount: number;
  folderCounts: Record<string, number>;
}

/** Чипы-pill для альбомов (папок). Активный чип — в цвете ивента. */
export default function FolderTabs({
  folders,
  active,
  onSelect,
  totalCount,
  folderCounts,
}: FolderTabsProps) {
  if (folders.length === 0) return null;

  const chipClass = (isActive: boolean) =>
    `shrink-0 rounded-full px-4 py-2 text-xs font-medium tracking-wide transition-all ${
      isActive
        ? "bg-[var(--el-primary)] text-[var(--el-on-primary)] shadow-[0_6px_20px_var(--el-glow-primary-25)]"
        : "border border-[var(--el-primary-22)] bg-[var(--el-surface)] text-[var(--el-t-primary-99)] hover:border-[var(--el-primary-44)] hover:text-[var(--el-t-primary)]"
    }`;

  return (
    <div className="hidden md:block scrollbar-hide overflow-x-auto -mx-4 px-4">
      <div className="flex items-center gap-2">
        <button onClick={() => onSelect("")} className={chipClass(active === "")}>
          Все
          <span className="ml-1.5 opacity-60">{totalCount}</span>
        </button>
        {folders.map((folder) => (
          <button
            key={folder}
            onClick={() => onSelect(active === folder ? "" : folder)}
            className={chipClass(active === folder)}
          >
            {folder.replace(/_/g, " ")}
            <span className="ml-1.5 opacity-60">{folderCounts[folder] || 0}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
