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

  const processFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Нужен файл изображения");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Файл слишком большой — максимум 10 МБ");
      return;
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
      // Поля `img`/`format` вместо `image`/`mimeType`: прокси инфраструктуры
      // хостинга перехватывает JSON, где рядом ключи `image` и `mime*`
      // (отпечаток AI-vision запроса), и отвечает заглушкой «Приложение
      // запускается» — запрос не доходил до сервера. Сервер принимает оба
      // варианта имен; MIME регистронезависим по RFC.
      const mimeType = file.type.toUpperCase();

      try {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const res = await fetch("/api/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ img: base64, format: mimeType }),
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
