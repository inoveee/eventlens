// @TheTechMargin 2026
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { PhotoRecord, PhotosResponse } from "@/lib/types";
import { shuffleArray } from "@/lib/utils";
import { withProjectParam } from "@/lib/project";
import { useProjectKey } from "@/hooks/useProjectKey";

export interface UsePhotosReturn {
  allPhotos: PhotoRecord[];
  shuffledPhotos: PhotoRecord[];
  folders: string[];
  tags: string[];
  lastUpdated: string;
  loading: boolean;
  error: boolean;
  toast: { message: string; count: number } | null;
  setToast: (t: { message: string; count: number } | null) => void;
  refresh: () => void;
  retryLoad: () => void;
}

export function usePhotos(): UsePhotosReturn {
  const projectKey = useProjectKey();
  const [allPhotos, setAllPhotos] = useState<PhotoRecord[]>([]);
  const [shuffledPhotos, setShuffledPhotos] = useState<PhotoRecord[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [toast, setToast] = useState<{ message: string; count: number } | null>(null);
  const pendingPhotosRef = useRef<PhotoRecord[] | null>(null);

  const cacheKey = `eventlens:photos:${projectKey}`;

  const readCache = useCallback((): PhotosResponse | null => {
    try {
      const raw = sessionStorage.getItem(cacheKey);
      return raw ? (JSON.parse(raw) as PhotosResponse) : null;
    } catch {
      return null;
    }
  }, [cacheKey]);

  const writeCache = useCallback(
    (data: PhotosResponse) => {
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
      } catch {
        // quota exceeded — кэш просто не сохранится, не критично
      }
    },
    [cacheKey],
  );

  const applyData = useCallback((data: PhotosResponse) => {
    setAllPhotos(data.photos);
    setFolders(data.folders);
    setTags(data.tags || []);
    setShuffledPhotos(shuffleArray(data.photos));
    setLastUpdated(data.lastUpdated);
  }, []);

  const fetchData = useCallback(async (): Promise<PhotosResponse | null> => {
    try {
      const res = await fetch(withProjectParam("/api/photos", projectKey));
      if (!res.ok) throw new Error("Failed to fetch");
      return await res.json();
    } catch {
      return null;
    }
  }, [projectKey]);

  // Initial load: sessionStorage-кэш рисует галерею мгновенно (повторные
  // визиты не ждут 5-8с холодного /api/photos), затем фоновый revalidate
  // приносит актуальные данные. Ошибка сети при наличии кэша — тихо
  // оставляем старое (offline-friendly).
  useEffect(() => {
    const cached = readCache();
    if (cached?.photos?.length) {
      applyData(cached);
      setLoading(false);
    }
    fetchData().then((data) => {
      if (data) {
        applyData(data);
        writeCache(data);
        setLoading(false);
      } else if (!cached?.photos?.length) {
        setError(true);
        setLoading(false);
      }
    });
  }, [fetchData, readCache, applyData, writeCache]);

  // Polling for new photos
  useEffect(() => {
    const interval = setInterval(async () => {
      const data = await fetchData();
      if (data && data.photos.length > allPhotos.length) {
        const diff = data.photos.length - allPhotos.length;
        pendingPhotosRef.current = data.photos;
        setToast({
          message: `${diff} new photo${diff === 1 ? "" : "s"} detected`,
          count: diff,
        });
        setFolders(data.folders);
        setTags(data.tags || []);
        setLastUpdated(data.lastUpdated);
        writeCache(data);
      } else if (data) {
        setFolders(data.folders);
        setTags(data.tags || []);
        setLastUpdated(data.lastUpdated);
        writeCache(data);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [allPhotos.length, fetchData, writeCache]);

  const refresh = useCallback(() => {
    if (pendingPhotosRef.current) {
      setAllPhotos(pendingPhotosRef.current);
      setShuffledPhotos(shuffleArray(pendingPhotosRef.current));
      pendingPhotosRef.current = null;
    }
    setToast(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const retryLoad = useCallback(() => {
    setError(false);
    setLoading(true);
    fetchData().then((data) => {
      if (data) {
        applyData(data);
        writeCache(data);
        setLoading(false);
      } else {
        setError(true);
        setLoading(false);
      }
    });
  }, [fetchData, applyData, writeCache]);

  return {
    allPhotos,
    shuffledPhotos,
    folders,
    tags,
    lastUpdated,
    loading,
    error,
    toast,
    setToast,
    refresh,
    retryLoad,
  };
}
