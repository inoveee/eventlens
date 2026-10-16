// @TheTechMargin 2026
// Выбор акцентного цвета: палитра, системный селектор, HEX-поле.

"use client";

import { useEffect, useState } from "react";
import { contrastOn, normalizeHex } from "@/lib/color";

const PRESETS = [
  { hex: "#fd8d2c", name: "Оранжевый noveee" },
  { hex: "#ff5a3c", name: "Коралловый" },
  { hex: "#f43f5e", name: "Розово-красный" },
  { hex: "#8b5cf6", name: "Фиолетовый" },
  { hex: "#3b82f6", name: "Синий" },
  { hex: "#10b981", name: "Изумрудный" },
  { hex: "#eab308", name: "Жёлтый" },
  { hex: "#1f2937", name: "Графит" },
];

export default function ColorControl({
  value,
  onChange,
  hint = "Применяется к кнопкам, ссылкам и акцентным элементам публичной страницы.",
  showButtonPreview = true,
  showPresets = false,
  label,
}: {
  value: string;
  onChange: (hex: string) => void;
  hint?: string;
  showButtonPreview?: boolean;
  showPresets?: boolean;
  label?: string;
}) {
  const normalized = normalizeHex(value) ?? "#fd8d2c";
  const [input, setInput] = useState(normalized.toUpperCase());

  useEffect(() => {
    setInput(normalized.toUpperCase());
  }, [normalized]);

  const handleInput = (raw: string) => {
    setInput(raw);
    const hex = normalizeHex(raw);
    if (hex) onChange(hex);
  };

  return (
    <div>
      <div className="flex items-center gap-2.5">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[12px] border border-[var(--org-border-strong)] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]">
          <span
            className="absolute inset-0"
            style={{ background: normalized }}
            aria-hidden
          />
          <input
            type="color"
            value={normalized}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={label || "Выбрать цвет"}
          />
        </div>
        <input
          className="org-input min-w-0 flex-1 uppercase"
          value={input}
          onChange={(e) => handleInput(e.target.value)}
          onBlur={() => setInput(normalized.toUpperCase())}
          spellCheck={false}
          aria-label={label ? `${label} (HEX)` : "HEX-код цвета"}
        />
        {showButtonPreview && (
          <div
            className="flex h-10 shrink-0 items-center rounded-full px-4 text-[13px] font-semibold"
            style={{ background: normalized, color: contrastOn(normalized) }}
            aria-hidden
          >
            Кнопка
          </div>
        )}
      </div>

      {showPresets && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => {
            const active = preset.hex === normalized;
            return (
              <button
                key={preset.hex}
                type="button"
                onClick={() => onChange(preset.hex)}
                title={preset.name}
                aria-label={preset.name}
                aria-pressed={active}
                className="h-7 w-7 rounded-full transition-transform hover:scale-110"
                style={{
                  background: preset.hex,
                  boxShadow: active
                    ? "0 0 0 2px #ffffff, 0 0 0 4px var(--org-text)"
                    : "inset 0 0 0 1px rgba(0,0,0,0.1)",
                }}
              />
            );
          })}
        </div>
      )}

      {hint && <p className="org-hint mt-2.5">{hint}</p>}
    </div>
  );
}
