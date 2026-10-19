// @TheTechMargin 2026
// Публичная страница читает опубликованные настройки организатора и
// применяет их: CSS-переменные оформления + контекст с текстами.
//
// Режим предпросмотра: предпросмотр в админке кладёт черновик
// в localStorage и открывает «/p/<key>?preview=1». Черновик виден только в
// этой вкладке посетителя с этим параметром — другим гостям он не показывается.
//
// Если настроек нет или запрос не удался, страница работает ровно так же,
// как и раньше (значения из окружения проекта).

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  EventSettings,
  applyStyleTokens,
  brandingTokens,
  defaultEventSettings,
} from "@/lib/eventSettings";

const PREVIEW_KEY_PREFIX = "el-preview-draft:";
const PREVIEW_TTL_MS = 60 * 60 * 1000;

/** Ключ черновика предпросмотра в localStorage — свой у каждого проекта,
 *  чтобы предпросмотры разных мероприятий не смешивались. */
export function previewStorageKey(projectKey: string): string {
  return `${PREVIEW_KEY_PREFIX}${projectKey}`;
}

/** Кладёт черновик в localStorage — новая вкладка откроется с
 *  «/p/<key>?preview=1» и увидит его вместо опубликованной версии.
 *  Ключ знает только эта вкладка. */
export function storeDraftForPreview(
  settings: EventSettings,
  projectKey = "default",
): void {
  try {
    window.localStorage.setItem(
      previewStorageKey(projectKey),
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

function readPreview(projectKey: string): EventSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(previewStorageKey(projectKey));
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
  projectKey = "default",
  initialSettings = null,
  children,
}: {
  projectKey?: string;
  /** Опубликованные настройки, прочитанные на сервере: страница сразу
   *  рендерится с брендингом организатора, базовый дизайн не мелькает. */
  initialSettings?: EventSettings | null;
  children: React.ReactNode;
}) {
  const [published, setPublished] = useState<EventSettings | null>(initialSettings);
  const [previewSettings, setPreviewSettings] = useState<EventSettings | null>(null);
  const [preview, setPreview] = useState(false);
  const [loaded, setLoaded] = useState(initialSettings !== null);

  /** true — открыта ссылка «/p/<key>?preview=1» (черновик из localStorage). */
  const wantsPreview = useCallback(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("preview") === "1",
    [],
  );

  const loadPreview = useCallback(() => {
    if (!wantsPreview()) return;
    const entry = readPreview(projectKey);
    if (entry) {
      setPreviewSettings(entry);
      setPreview(true);
    }
  }, [projectKey, wantsPreview]);

  /**
   * Читает опубликованные настройки. Один повтор: однократный сбой сети
   * или сервера не оставляет страницу без брендинга организатора.
   */
  const fetchPublished = useCallback(async (): Promise<EventSettings | null> => {
    const attempt = () =>
      fetch(`/api/event/settings?project=${encodeURIComponent(projectKey)}`, {
        cache: "no-store",
        // Публичная страница ходит без cookie: сервер в таком случае
        // отдаёт только опубликованную версию, а не черновик панели.
        credentials: "omit",
      })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null);

    const data = (await attempt()) ?? (await new Promise((r) => setTimeout(r, 1500)).then(attempt));
    return (data?.published as EventSettings | undefined) ?? null;
  }, [projectKey]);

  // Первая загрузка и смена проекта.
  useEffect(() => {
    let cancelled = false;
    loadPreview();
    void fetchPublished().then((settings) => {
      if (cancelled) return;
      if (settings) setPublished(settings);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchPublished, loadPreview]);

  // Вкладка проснулась (её вернули на передний план) — перечитываем
  // опубликованное. Так организатор видит новый фон сразу после публикации,
  // даже если страница была открыта до неё: window.open по тому же адресу
  // не перезагружает вкладку, и без этого обновления фон казался «старым».
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onWake = () => {
      if (document.visibilityState !== "visible") return;
      loadPreview();
      void fetchPublished().then((settings) => {
        if (settings) setPublished(settings);
      });
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [fetchPublished, loadPreview]);

  const value = useMemo<EventSettingsContextValue>(() => {
    const settings = previewSettings ?? published ?? defaultEventSettings();
    return { settings, preview: preview && previewSettings !== null, loaded };
  }, [previewSettings, published, preview, loaded]);

  // Применяем оформление: акцент, фон hero, читаемость текста.
  // applyStyleTokens снимает переменные, которых больше нет в наборе
  // (например --el-hero-bg после возврата фона к «Стандарту») — иначе
  // старое инлайн-значение на :root переживало смену настроек.
  const appliedTokensRef = useRef<string[]>([]);
  useEffect(() => {
    if (!loaded) return;
    const tokens = brandingTokens(value.settings.branding);
    appliedTokensRef.current = applyStyleTokens(
      document.documentElement.style,
      tokens,
      appliedTokensRef.current,
    );
  }, [loaded, value.settings]);

  // Те же переменные — в SSR-теге <style>: он попадает в HTML и действует
  // с первого кадра, до hydration (иначе первый экран рисуется в базовых
  // цветах проекта и через мгновение перекрашивается брендингом).
  // key по содержимому: тег пересоздаётся вместе с набором токенов, поэтому
  // в нём не остаётся фона предыдущего проекта при переходе между
  // страницами в одной вкладке.
  const tokenCss = useMemo(() => {
    const decls = Object.entries(brandingTokens(value.settings.branding))
      .map(([name, cssValue]) => `${name}:${cssValue}`)
      .join(";");
    return `:root{${decls}}`;
  }, [value.settings]);

  return (
    <EventSettingsContext.Provider value={value}>
      <style
        key={tokenCss}
        href="el-branding-tokens"
        precedence="high"
        dangerouslySetInnerHTML={{ __html: tokenCss }}
      />
      {children}
    </EventSettingsContext.Provider>
  );
}
