// @TheTechMargin 2026
"use client";

import { useMemo } from "react";
import Image from "next/image";
import { PhotoRecord } from "@/lib/types";

interface AlbumGridProps {
  folders: string[];
  photos: PhotoRecord[];
  folderCounts: Record<string, number>;
  onSelect: (folder: string) => void;
}

export default function AlbumGrid({
  folders,
  photos,
  folderCounts,
  onSelect,
}: AlbumGridProps) {
  const folderPreviews = useMemo(() => {
    const previews: Record<string, PhotoRecord[]> = {};
    for (const p of photos) {
      if (!previews[p.folder]) previews[p.folder] = [];
      if (previews[p.folder].length < 4) previews[p.folder].push(p);
    }
    return previews;
  }, [photos]);

  if (folders.length <= 1) return null;

  return (
    <section className="mb-4 md:mb-8">
      <div className="mb-3 flex items-baseline gap-3 md:mb-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--el-t-primary)]">
          Альбомы
        </h2>
        <span className="text-xs text-[var(--el-text-dim)]">{folders.length}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {folders.map((folder) => {
          const previews = folderPreviews[folder] || [];
          const count = folderCounts[folder] || 0;
          return (
            <button
              key={folder}
              onClick={() => onSelect(folder)}
              className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-[var(--el-primary-22)] bg-[var(--el-bg)] cursor-pointer transition-all duration-300 hover:border-[var(--el-accent)] motion-safe:hover:scale-[1.02] motion-safe:hover:shadow-[0_16px_40px_rgba(0,0,0,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--el-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--el-bg)]"
            >
              <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-px bg-[var(--el-primary-11)]">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="relative overflow-hidden bg-[var(--el-bg)]">
                    {previews[i]?.thumbnailUrl ? (
                      <Image
                        src={previews[i].thumbnailUrl}
                        alt=""
                        fill
                        unoptimized
                        sizes="80px"
                        className="object-cover opacity-50 group-hover:opacity-70 transition-opacity"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <span className="text-[var(--el-t-primary-11)] text-lg">+</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent flex flex-col items-center justify-end pb-3.5 md:pb-4">
                <span className="text-sm font-semibold tracking-wide text-white transition-transform duration-300 group-hover:-translate-y-0.5">
                  {folder.replace(/_/g, " ")}
                </span>
                <span className="mt-0.5 text-[11px] text-white/70">{count} фото</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
