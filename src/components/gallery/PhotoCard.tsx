// @TheTechMargin 2026
"use client";

import React, { useState } from "react";
import Image from "next/image";
import { PhotoRecord, MatchTier } from "@/lib/types";

const TIER_LABELS: Record<MatchTier, string> = {
  text: "TXT",
  visual: "VIS",
  vector: "VEC",
  both: "TXT+VIS",
};

export interface PhotoCardProps {
  photo: PhotoRecord;
  onClick: () => void;
  matchInfo?: { confidence: number; tier: MatchTier };
  index: number;
  selectMode: boolean;
  selected: boolean;
  isHot?: boolean;
}

function PhotoCardInner({
  photo,
  onClick,
  matchInfo,
  index,
  selectMode,
  selected,
  isHot,
}: PhotoCardProps) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <button
      onClick={onClick}
      className={`group relative aspect-[4/3] overflow-hidden rounded-2xl border bg-[var(--el-bg)] cursor-pointer transition-all duration-300 motion-safe:hover:scale-[1.02] motion-safe:hover:shadow-[0_16px_40px_rgba(0,0,0,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--el-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--el-bg)] ${index < 40 ? 'animate-grid-reveal' : ''} ${
        selected
          ? "border-[var(--el-primary)] ring-2 ring-[var(--el-primary)]"
          : matchInfo && matchInfo.confidence >= 70
            ? "border-[var(--el-primary)]"
            : "border-[var(--el-primary-22)] hover:border-[var(--el-accent)]"
      }`}
      style={index < 40 ? { '--delay': `${index * 0.03}s` } as React.CSSProperties : undefined}
    >
      {imgError || !photo.thumbnailUrl ? (
        <div className="flex h-full w-full items-center justify-center bg-[var(--el-surface)]">
          <span className="text-[var(--el-t-primary-22)] text-2xl">+</span>
        </div>
      ) : (
        <>
          {!imgLoaded && (
            <div className="absolute inset-0 bg-[var(--el-surface)] animate-pulse" />
          )}
          <Image
            src={photo.thumbnailUrl}
            alt={photo.filename}
            fill
            unoptimized
            loading={index < 8 ? "eager" : "lazy"}
            {...(index < 8 ? { priority: true } : {})}
            className={`object-cover transition-opacity duration-300 ${
              !imgLoaded ? "opacity-0" : selected ? "opacity-70" : "opacity-100"
            }`}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
          />
        </>
      )}

      {(/\.(mp4|mov|webm|avi)$/i.test(photo.filename) ||
        photo.mimeType?.startsWith("video/")) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[5]">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--el-primary)" stroke="none">
              <polygon points="6,3 20,12 6,21" />
            </svg>
          </div>
        </div>
      )}

      {selectMode && (
        <div className="absolute top-1.5 left-1.5 z-10">
          <div
            className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
              selected
                ? "border-[var(--el-primary)] bg-[var(--el-primary)]"
                : "border-white/60 bg-black/30 backdrop-blur-sm"
            }`}
          >
            {selected && (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="black"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        </div>
      )}

      {!selectMode && isHot && !matchInfo && (
        <div className="absolute left-1.5 top-1.5">
          <span
            className="rounded-full bg-black/55 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm"
          >
            Популярное
          </span>
        </div>
      )}

      {!(
        !photo.folder ||
        photo.folder.toUpperCase() === "ROOT" ||
        photo.folder.toUpperCase() === "ALL"
      ) && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-2.5 pb-2.5 pt-8 group-hover:opacity-0 transition-opacity">
          <span className="inline-block rounded-full bg-black/45 px-2.5 py-1 text-[10px] uppercase tracking-wider text-white/85 backdrop-blur-sm">
            {photo.folder.replace(/_/g, " ")}
          </span>
        </div>
      )}

      {!selectMode && matchInfo ? (
        <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5">
          <span
            className={`rounded-full bg-black/55 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm ${
              matchInfo.tier === "both"
                ? "ring-1 ring-[var(--el-primary)]"
                : matchInfo.tier === "visual" || matchInfo.tier === "vector"
                  ? "ring-1 ring-[var(--el-cyan)]"
                  : "ring-1 ring-[var(--el-amber)]"
            }`}
          >
            {TIER_LABELS[matchInfo.tier]}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
              matchInfo.confidence >= 70
                ? "bg-[var(--el-primary)] text-[var(--el-on-primary)]"
                : matchInfo.confidence >= 50
                  ? "bg-[var(--el-primary-88)] text-[var(--el-on-primary)]"
                  : "bg-black/55 text-white/90 backdrop-blur-sm"
            }`}
          >
            {matchInfo.confidence}%
          </span>
        </div>
      ) : (
        !selectMode &&
        photo.faceCount > 0 && (
          <div className="absolute right-1.5 top-1.5 flex items-center justify-center rounded-full bg-[var(--el-primary)] px-2 py-0.5 text-[9px] font-semibold text-[var(--el-on-primary)]">
            {photo.faceCount} {photo.faceCount === 1 ? "лицо" : "лиц"}
          </div>
        )
      )}
    </button>
  );
}

const PhotoCard = React.memo(PhotoCardInner, (prev, next) => {
  return (
    prev.photo.id === next.photo.id &&
    prev.selected === next.selected &&
    prev.selectMode === next.selectMode &&
    prev.matchInfo?.confidence === next.matchInfo?.confidence &&
    prev.isHot === next.isHot &&
    prev.index === next.index
  );
});

export default PhotoCard;
