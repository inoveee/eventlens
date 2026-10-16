// @TheTechMargin 2026
"use client";

import { PhotoRecord } from "@/lib/types";
import PhotoCard from "./PhotoCard";
import type { SortOrder } from "@/hooks/useFilters";

interface HeroSectionProps {
  photos: PhotoRecord[];
  totalCount: number;
  sortOrder: SortOrder;
  selectMode: boolean;
  selectedIds: Set<string>;
  hotPhotoIds: Set<string>;
  onPhotoClick: (photo: PhotoRecord) => void;
  onToggleSelect: (id: string) => void;
  onBrowseAll: () => void;
}

export default function HeroSection({
  photos,
  totalCount,
  sortOrder,
  selectMode,
  selectedIds,
  hotPhotoIds,
  onPhotoClick,
  onToggleSelect,
  onBrowseAll,
}: HeroSectionProps) {
  if (photos.length === 0) return null;

  const sortLabel =
    sortOrder === "shuffle"
      ? "Избранное"
      : sortOrder === "name-asc"
        ? "По имени А→Я"
        : "По имени Я→А";

  return (
    <section>
      <div className="mb-3 flex items-baseline gap-3 md:mb-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--el-t-primary)]">
          {sortLabel}
        </h2>
        <span className="text-xs text-[var(--el-text-dim)]">
          {totalCount} всего
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo, index) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            onClick={() => {
              if (selectMode) {
                onToggleSelect(photo.id);
              } else {
                onPhotoClick(photo);
              }
            }}
            index={index}
            selectMode={selectMode}
            selected={selectedIds.has(photo.id)}
            isHot={hotPhotoIds.has(photo.driveFileId)}
          />
        ))}
      </div>
      <div className="mt-6 flex justify-center md:mt-8">
        <button
          onClick={onBrowseAll}
          className="group inline-flex items-center gap-3 py-2 pl-5 pr-2 text-sm font-semibold text-[var(--el-on-primary)]"
          style={{ background: "var(--el-primary)" }}
        >
          Смотреть все фото
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/15 transition-transform group-hover:translate-x-0.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="12" x2="19" y2="12" />
              <polyline points="13 6 19 12 13 18" />
            </svg>
          </span>
        </button>
      </div>
    </section>
  );
}
