// @TheTechMargin 2026
// Публичная страница читает опубликованные настройки организатора и
// применяет их: CSS-переменные оформления + контекст с текстами.
//
// Режим предпросмотра: кнопка «Предпросмотр» в админке кладёт черновик
// в localStorage и открывает «/?preview=1». Черновик виден только в этой
// вкладке посетителя с этим параметром — другим гостям он не показывается.
//
// Если настроек нет или запрос не удался, страница работает ровно так же,
// как и раньше (значения из окружения проекта).

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  EventSettings,
  brandingTokens,
  defaultEventSettings,
} from "@/lib/eventSettings";

const PREVIEW_KEY = "el-preview-draft";
const PREVIEW_TTL_MS = 60 * 60 * 1000;

/** Кладёт черновик в localStorage — новая вкладка откроется с «/?preview=1»
 *  и увидит его вместо опубликованной версии. Ключ знает только эта вкладка. */
export function storeDraftForPreview(settings: EventSettings): void {
  try {
    window.localStorage.setItem(
      PREVIEW_KEY,
      JSON.stringify({ settings, exp: Date.now() + PREVIEW_TTL_MS }),
    );
  } catch {}
}

export interface EventSettingsContextValue {
  settings: EventSettings;
  /** true — показывается черновик вместо опубликованной версии. */
  preview: boolean;
  loaded: boolean;
}

const EventSettingsContext = createContext<EventSettingsContextValue>({
  settings: defaultEventSettings(),
  preview: false,
  loaded: false,
});

/** Тексты и оформление текущей страницы (опубликованные или из предпросмотра). */
export function useEventSettings(): EventSettingsContextValue {
  return useContext(EventSettingsContext);
}

interface PreviewEntry {
  settings: EventSettings;
  exp: number;
}

function readPreview(): EventSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREVIEW_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as PreviewEntry;
    if (!entry?.settings || typeof entry.exp !== "number" || entry.exp < Date.now()) {
      return null;
    }
    return entry.settings;
  } catch {
    return null;
  }
}

export default function EventSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [published, setPublished] = useState<EventSettings | null>(null);
  const [previewSettings, setPreviewSettings] = useState<EventSettings | null>(null);
  const [preview, setPreview] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const wantPreview =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("preview") === "1";
    if (wantPreview) {
      const entry = readPreview();
      if (entry) {
        setPreviewSettings(entry);
        setPreview(true);
      }
    }

    fetch("/api/event/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && data.published) {
          setPublished(data.published as EventSettings);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<EventSettingsContextValue>(() => {
    const settings = previewSettings ?? published ?? defaultEventSettings();
    return { settings, preview: preview && previewSettings !== null, loaded };
  }, [previewSettings, published, preview, loaded]);

  // Применяем оформление: акцент, фон hero, читаемость текста.
  useEffect(() => {
    if (!loaded) return;
    const tokens = brandingTokens(value.settings.branding);
    const root = document.documentElement;
    for (const [name, cssValue] of Object.entries(tokens)) {
      root.style.setProperty(name, cssValue);
    }
  }, [loaded, value.settings]);

  return (
    <EventSettingsContext.Provider value={value}>
      {children}
    </EventSettingsContext.Provider>
  );
}
