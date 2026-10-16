// @TheTechMargin 2026
"use client";

import { PhotoRecord } from "@/lib/types";
import PhotoCard from "./PhotoCard";

interface FavoritesSectionProps {
  /** Фото, выбранные пользователем (режим «Выбрать»). */
  photos: PhotoRecord[];
  selectMode: boolean;
  selectedIds: Set<string>;
  hotPhotoIds: Set<string>;
  onPhotoClick: (photo: PhotoRecord) => void;
  onToggleSelect: (id: string) => void;
}

/** «Избранное» — только фото, выбранные самим участником.
 *  Пока ничего не выбрано, раздел не показывается (на главной
 *  по умолчанию открыт общий альбом). */
export default function FavoritesSection({
  photos,
  selectMode,
  selectedIds,
  hotPhotoIds,
  onPhotoClick,
  onToggleSelect,
}: FavoritesSectionProps) {
  if (photos.length === 0) return null;

  return (
    <section className="mb-4 md:mb-8">
      <div className="mb-3 flex items-baseline gap-3 md:mb-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--el-t-primary)]">
          Избранное
        </h2>
        <span className="text-xs text-[var(--el-text-dim)]">
          {photos.length} фото
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
    </section>
  );
}
