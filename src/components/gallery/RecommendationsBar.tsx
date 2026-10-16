// @TheTechMargin 2026
"use client";

import { useMemo } from "react";
import { PhotoRecord } from "@/lib/types";
import PhotoCard from "./PhotoCard";

interface RecommendationsBarProps {
  recommendations: string[];
  allPhotos: PhotoRecord[];
  onPhotoClick: (photo: PhotoRecord) => void;
}

export default function RecommendationsBar({
  recommendations,
  allPhotos,
  onPhotoClick,
}: RecommendationsBarProps) {
  const recPhotos = useMemo(
    () => allPhotos.filter((p) => recommendations.includes(p.driveFileId)),
    [allPhotos, recommendations],
  );

  if (recPhotos.length === 0) return null;

  return (
    <section className="mt-6 md:mt-8">
      <div className="mb-3 flex items-baseline gap-3 md:mb-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--el-t-primary)]">
          Вас могут узнать и здесь
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {recPhotos.map((photo, index) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            onClick={() => onPhotoClick(photo)}
            index={index}
            selectMode={false}
            selected={false}
          />
        ))}
      </div>
    </section>
  );
}
