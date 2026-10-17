// @TheTechMargin 2026
"use client";

import { useState, useEffect, Dispatch, SetStateAction } from "react";

const DEFAULT_BATCH_SIZE = 40;

export interface UseProgressiveRenderReturn {
  visibleCount: number;
  /** Callback-ref, а не RefObject: сентинел появляется в DOM позже хука
   *  (на главной его вовсе нет, пока не открыт режим «все фото»), и
   *  наблюдатель создаётся именно в момент его маунта — иначе
   *  IntersectionObserver никогда не создаётся и первая порция фото
   *  остаётся единственной. */
  sentinelRef: Dispatch<SetStateAction<HTMLDivElement | null>>;
}

export function useProgressiveRender(
  totalCount: number,
  batchSize: number = DEFAULT_BATCH_SIZE,
  resetKey: string = "",
): UseProgressiveRenderReturn {
  const [visibleCount, setVisibleCount] = useState(batchSize);
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);

  // IntersectionObserver to load more
  useEffect(() => {
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + batchSize, totalCount));
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, totalCount, batchSize]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(batchSize);
  }, [resetKey, batchSize]);

  return { visibleCount, sentinelRef: setSentinel };
}
