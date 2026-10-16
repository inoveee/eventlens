// @TheTechMargin 2026
// Загрузка изображения (логотип или фон hero): проверка формата и
// размера, предпросмотр, замена и удаление. Для фона дополнительно
// считается средняя яркость — она нужна, чтобы текст поверх фото
// оставался читаемым.

"use client";

import { useRef, useState } from "react";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function extensionHint(accept: string[]): string {
  return accept
    .map((t) => t.split("/")[1].toUpperCase().replace("SVG+XML", "SVG"))
    .join(", ");
}

/** Средняя относительная яркость изображения (0..1). */
function averageLuminance(dataUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 24;
        canvas.height = 24;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(0.1);
        ctx.drawImage(img, 0, 0, 24, 24);
        const { data } = ctx.getImageData(0, 0, 24, 24);
        const lin = (c: number) =>
          c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        let sum = 0;
        const pixels = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          sum +=
            0.2126 * lin(data[i] / 255) +
            0.7152 * lin(data[i + 1] / 255) +
            0.0722 * lin(data[i + 2] / 255);
        }
        resolve(sum / pixels);
      } catch {
        resolve(0.1);
      }
    };
    img.onerror = () => resolve(0.1);
    img.src = dataUrl;
  });
}

interface ImageFieldProps {
  label: string;
  hint: string;
  accept: string[];
  maxBytes: number;
  value: string | null;
  /** "logo" — компактный превью, "wide" — широкий блок под фон. */
  variant?: "logo" | "wide";
  emptyText: string;
  onChange: (next: string | null, luminance?: number | null) => void;
}

export default function ImageField({
  label,
  hint,
  accept,
  maxBytes,
  value,
  variant = "logo",
  emptyText,
  onChange,
}: ImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);

    if (!accept.includes(file.type)) {
      setError(`Формат не поддерживается — доступны: ${extensionHint(accept)}.`);
      return;
    }
    if (file.size > maxBytes) {
      setError(`Файл слишком большой: ${formatBytes(file.size)} (максимум ${formatBytes(maxBytes)}).`);
      return;
    }

    setReading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read"));
        reader.readAsDataURL(file);
      });
      if (variant === "wide") {
        const lum = await averageLuminance(dataUrl);
        onChange(dataUrl, lum);
      } else {
        onChange(dataUrl);
      }
    } catch {
      setError("Не удалось прочитать файл — попробуйте другой.");
    } finally {
      setReading(false);
    }
  };

  return (
    <div>
      <span className="org-label mb-1.5">{label}</span>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`rounded-[14px] border border-dashed p-3 transition-colors ${
          dragging
            ? "border-[var(--org-text)] bg-[#f4f4f6]"
            : "border-[var(--org-border-strong)] bg-[#fafafb]"
        }`}
      >
        {value ? (
          <div className="flex items-center gap-3">
            <div
              className={`flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-[var(--org-border)] bg-white ${
                variant === "wide" ? "h-16 w-28" : "h-14 w-24"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value}
                alt="Загруженное изображение"
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
              <button
                type="button"
                className="org-btn org-btn-secondary"
                onClick={() => inputRef.current?.click()}
                disabled={reading}
              >
                {reading ? "Читаем…" : "Заменить"}
              </button>
            </div>
            <button
              type="button"
              className="org-btn org-btn-danger"
              onClick={() => {
                setError(null);
                onChange(null, null);
              }}
            >
              Удалить
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="flex w-full flex-col items-center gap-1.5 py-3 text-center"
            onClick={() => inputRef.current?.click()}
            disabled={reading}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ededf0]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--org-dim)]" aria-hidden>
                <path d="M12 16V4m0 0 4 4m-4-4L8 8" />
                <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
            </span>
            <span className="text-[13.5px] font-semibold">
              {reading ? "Загружаем файл…" : emptyText}
            </span>
            <span className="org-hint">
              {extensionHint(accept)}, до {formatBytes(maxBytes)} · можно перетащить файл сюда
            </span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept.join(",")}
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <p className="org-hint mt-1.5">{hint}</p>
      {error && (
        <p className="mt-1.5 text-[12.5px] font-medium text-[var(--org-err)]">{error}</p>
      )}
    </div>
  );
}
