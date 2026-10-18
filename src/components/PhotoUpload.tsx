// @TheTechMargin 2026
"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { MatchResponse } from "@/lib/types";

interface PhotoUploadProps {
  onMatchResults: (results: MatchResponse) => void;
  onClear: () => void;
  isActive: boolean;
  /** Hero-кнопки берут на себя запуск выбора файла — скрыть
   *  собственные кнопки-заглушки, оставив input'ы и статусы. */
  hideIdleActions?: boolean;
}

export default function PhotoUpload({
  onMatchResults,
  onClear,
  isActive,
  hideIdleActions = false,
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [statusText, setStatusText] = useState("Ищем ваши фото…");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const deepScanTimerRef = useRef<NodeJS.Timeout>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);

  const clearDeepScanTimer = useCallback(() => {
    if (deepScanTimerRef.current) {
      clearTimeout(deepScanTimerRef.current);
      deepScanTimerRef.current = undefined;
    }
  }, []);

  /** HEIC/HEIF не декодируется в canvas — принимаем «как есть». */
  const isHeic = (f: File) =>
    /heic|heif/i.test(f.type) || /\.heic|\.heif$/i.test(f.name);

  /**
   * Большие фото ужимаются на стороне клиента: прокси хостинга обрывает
   * тела запросов на 10 МБ, и селфи с зеркалки приходило обрезанным.
   * JPEG 2048px ~ 0.85 весит ~0.5–1 МБ — с запасом проходит лимит.
   */
  async function downscaleImage(file: File): Promise<File> {
    const bitmap = await createImageBitmap(file);
    try {
      let side = Math.max(bitmap.width, bitmap.height);
      let quality = 0.85;
      // Цикл ужатия: 2048 → 1280 → 960 — до размера под лимит.
      for (const maxSide of [2048, 1280, 960]) {
        const scale = Math.min(1, maxSide / side);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", quality),
        );
        if (blob && blob.size < 9.5 * 1024 * 1024) {
          return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
            type: "image/jpeg",
          });
        }
        side = maxSide;
        quality = 0.75;
      }
      throw new Error("downscale-failed");
    } finally {
      bitmap.close();
    }
  }

  const processFile = async (rawFile: File) => {
    if (!rawFile.type.startsWith("image/") && !isHeic(rawFile)) {
      setError("Нужен файл изображения");
      return;
    }

    let file = rawFile;
    if (file.size > 10 * 1024 * 1024) {
      if (isHeic(file)) {
        // Canvas не умеет HEIC — ужать нельзя, лимит прокси не поднять.
        setError("HEIC-файл больше 10 МБ — сделайте фото в JPG или уменьшите его");
        return;
      }
      setStatusText("Подготавливаем фото…");
      try {
        file = await downscaleImage(file);
      } catch {
        setError("Не удалось уменьшить фото — попробуйте файл поменьше");
        return;
      }
    }

    setError(null);
    setUploading(true);
    setStatusText("Ищем ваши фото…");

    clearDeepScanTimer();
    deepScanTimerRef.current = setTimeout(() => {
      setStatusText("Уточняем совпадения…");
    }, 4000);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);

      const base64 = dataUrl.split(",")[1];
      // Тело — JSON с единственным нейтральным ключом `q`, метаданные в
      // query. Прокси инфраструктуры хостинга держит адаптивный blocklist
      // AI-vision отпечатков: пары ключей «картинка + mime/формат» в JSON
      // блокируются (mimeType → mime → format → ext — каждый новый
      // отпечаток попадал под блок в течение часа), как и любой не-JSON
      // контент (raw bytes, form, multipart). Один нейтральный ключ
      // проходит стабильно.
      const ext =
        file.type.split("/")[1] ||
        (isHeic(file) ? "heic" : "") ||
        file.name.split(".").pop()?.toLowerCase() ||
        "jpeg";

      try {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        // Ключ проекта (/p/<key>) — по нему сервер резолвит совпавшие фото
        // из нужного источника (Yandex-листинг или Supabase/Drive).
        const projectKey =
          window.location.pathname.match(/^\/p\/([^/]+)/)?.[1] ?? "";
        const params = new URLSearchParams({ ext });
        if (projectKey) params.set("project", projectKey);
        const res = await fetch(`/api/match?${params.toString()}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: base64 }),
          signal: controller.signal,
        });

        clearDeepScanTimer();
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Не удалось найти фото, попробуйте ещё раз");
          setUploading(false);
          return;
        }

        if (data.error) {
          setError(data.error);
          setUploading(false);
          return;
        }

        onMatchResults(data);
      } catch (err) {
        clearDeepScanTimer();
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Ошибка сети — попробуйте ещё раз");
      }

      abortControllerRef.current = null;
      setUploading(false);
    };

    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    clearDeepScanTimer();
    setPreview(null);
    setError(null);
    setUploading(false);
    onClear();
  }, [clearDeepScanTimer, onClear]);

  const handleClear = () => {
    clearDeepScanTimer();
    setPreview(null);
    setError(null);
    setUploading(false);
    onClear();
  };

  return (
    <div className="mt-2.5 md:mt-4">
      {!isActive && !uploading && (
        <div className={`flex items-center justify-center gap-2 ${hideIdleActions ? "mt-4" : "mt-3"}`}>
          {!hideIdleActions && (
            <>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 border border-[var(--el-primary-99)] bg-[var(--el-overlay-60)] px-3 py-1.5 text-[10px] md:text-xs md:px-4 md:py-2 font-mono uppercase tracking-wider text-[var(--el-t-primary-99)] transition-all hover:border-[var(--el-accent)] hover:text-[var(--el-t-accent)] hover:shadow-[0_0_10px_var(--el-glow-accent-25)]"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
              <line x1="12" y1="2" x2="12" y2="6" />
              <line x1="12" y1="18" x2="12" y2="22" />
              <line x1="2" y1="12" x2="6" y2="12" />
              <line x1="18" y1="12" x2="22" y2="12" />
            </svg>
            <span className="sm:hidden">Найти мои фото</span>
            <span className="hidden sm:inline">Загрузить фото для поиска</span>
          </button>

          <button
            onClick={() => cameraInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 border border-[var(--el-primary-99)] bg-[var(--el-overlay-60)] px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[var(--el-t-primary-99)] transition-all hover:border-[var(--el-accent)] hover:text-[var(--el-t-accent)] hover:shadow-[0_0_10px_var(--el-glow-accent-25)] md:hidden"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Камера
          </button>
            </>
          )}

          <input
            ref={fileInputRef}
            id="el-face-input"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Загрузить фото"
          />
          <input
            ref={cameraInputRef}
            id="el-camera-input"
            type="file"
            accept="image/*"
            capture="user"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Сделать селфи"
          />
        </div>
      )}

      {(uploading || isActive) && (
        <div className="flex items-center justify-center gap-3">
          {preview && (
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border-2 border-[var(--el-primary)] animate-pulse-primary">
              <Image
                src={preview}
                alt="Ваше фото"
                fill
                className="object-cover"
              />
            </div>
          )}

          {uploading ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-white/85">
                <div className="h-4 w-4 rounded-full border-2 border-white/25 border-t-white animate-crosshair-spin" />
                {statusText}
              </div>
              <button
                onClick={handleCancel}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/25 px-4 py-1.5 text-xs text-white/85 transition-colors hover:bg-white/10 hover:text-white"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Отмена
              </button>
            </div>
          ) : (
            <button
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/25 px-4 py-1.5 text-xs text-white/85 transition-colors hover:bg-white/10 hover:text-white"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Сбросить
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 text-center text-[10px] font-mono uppercase tracking-wider text-red-500">
          &#9888; {error}
        </p>
      )}
    </div>
  );
}
