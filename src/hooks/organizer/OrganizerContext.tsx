// @TheTechMargin 2026
// Состояние панели организатора: авторизация, черновик настроек,
// статусы сохранения/публикации, подключение папки, уведомления.
//
// Черновик живёт в памяти вкладки и хранится на сервере; публичная
// страница видит только опубликованную версию.

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
  EventTextSettings,
  BrandingSettings,
  HeroSettings,
  PhotoConnection,
  defaultEventSettings,
  settingsEqual,
} from "@/lib/eventSettings";
import { storeDraftForPreview } from "@/components/EventSettingsProvider";

const SECRET_STORAGE_KEY = "el-organizer-secret";

export type PublishStatus = {
  label: string;
  tone: "ok" | "warn" | "neutral" | "err";
  hint: string;
};

interface OrganizerContextValue {
  // Авторизация
  authenticated: boolean;
  authenticating: boolean;
  authError: string | null;
  secret: string;
  setSecret: (v: string) => void;
  login: () => Promise<void>;
  logout: () => void;

  // Данные
  loading: boolean;
  loadError: string | null;
  draft: EventSettings;
  saved: EventSettings;
  published: EventSettings | null;
  photos: PhotoConnection | null;
  storage: "supabase" | "file" | null;

  // Статусы
  unsavedChanges: boolean;
  unpublishedChanges: boolean;
  status: PublishStatus;

  // Действия
  updateText: (patch: Partial<EventTextSettings>) => void;
  updateBranding: (patch: Partial<BrandingSettings>) => void;
  updateHero: (patch: Partial<HeroSettings>) => void;
  save: () => Promise<boolean>;
  publish: () => Promise<boolean>;
  resetBranding: () => Promise<boolean>;
  reload: () => Promise<void>;

  connectPhotos: (url: string) => Promise<{ ok: boolean; error: string | null }>;
  syncPhotos: () => Promise<{ ok: boolean; error: string | null }>;

  openPublicPage: () => void;
  openPreview: () => void;

  // Уведомления
  toast: { id: number; message: string } | null;
  notify: (message: string) => void;
  dismissToast: () => void;

  busy: boolean;
}

const OrganizerContext = createContext<OrganizerContextValue | null>(null);

export function useOrganizer(): OrganizerContextValue {
  const ctx = useContext(OrganizerContext);
  if (!ctx) throw new Error("useOrganizer must be used inside OrganizerProvider");
  return ctx;
}

interface SettingsResponse {
  draft?: EventSettings;
  published?: EventSettings | null;
  photos?: PhotoConnection | null;
  updatedAt?: string;
  storage?: "supabase" | "file";
  error?: string;
}

export function OrganizerProvider({ children }: { children: React.ReactNode }) {
  const [secret, setSecretState] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<EventSettings>(() => defaultEventSettings());
  const [saved, setSaved] = useState<EventSettings>(() => defaultEventSettings());
  const [published, setPublished] = useState<EventSettings | null>(null);
  const [photos, setPhotos] = useState<PhotoConnection | null>(null);
  const [storage, setStorage] = useState<"supabase" | "file" | null>(null);

  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    const item = { id: Date.now(), message };
    setToast(item);
    toastTimer.current = setTimeout(() => {
      setToast((current) => (current?.id === item.id ? null : current));
    }, 5000);
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const applyResponse = useCallback((data: SettingsResponse) => {
    if (data.draft) setDraft(data.draft);
    if (data.draft) setSaved(data.draft);
    if (data.published !== undefined) setPublished(data.published ?? null);
    if (data.photos !== undefined) setPhotos(data.photos ?? null);
    if (data.storage) setStorage(data.storage);
  }, []);

  const request = useCallback(
    async (path: string, init?: RequestInit): Promise<Response> => {
      return fetch(path, {
        ...init,
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
          ...(init?.headers || {}),
        },
      });
    },
    [secret],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await request("/api/event/settings");
      if (res.status === 401) {
        setAuthenticated(false);
        setLoadError("Сессия истекла — войдите снова.");
        return;
      }
      const data = (await res.json()) as SettingsResponse;
      if (!res.ok) throw new Error(data.error || "Не удалось загрузить настройки");
      if (!data.draft) throw new Error("Нет доступа к настройкам мероприятия");
      applyResponse(data);
      setAuthenticated(true);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Не удалось загрузить настройки");
    } finally {
      setLoading(false);
    }
  }, [request, applyResponse]);

  // Скрытый вход: секрет из этой вкладки (sessionStorage).
  useEffect(() => {
    let stored = "";
    try {
      stored = sessionStorage.getItem(SECRET_STORAGE_KEY) || "";
    } catch {}
    if (!stored) {
      setLoading(false);
      return;
    }
    setSecretState(stored);
    (async () => {
      try {
        const res = await fetch("/api/event/settings", {
          headers: { Authorization: `Bearer ${stored}` },
        });
        if (res.status === 401) {
          try {
            sessionStorage.removeItem(SECRET_STORAGE_KEY);
          } catch {}
          return;
        }
        const data = (await res.json()) as SettingsResponse;
        if (res.ok) {
          setSecretState(stored);
          applyResponse(data);
          setAuthenticated(true);
        }
      } catch {}
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSecret = useCallback((value: string) => {
    setSecretState(value);
    setAuthError(null);
  }, []);

  const login = useCallback(async () => {
    if (!secret.trim()) {
      setAuthError("Введите пароль организатора");
      return;
    }
    setAuthenticating(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/event/settings", {
        headers: { Authorization: `Bearer ${secret.trim()}` },
      });
      if (res.status === 401) {
        setAuthError("Неверный пароль");
        return;
      }
      const data = (await res.json()) as SettingsResponse;
      if (!res.ok) throw new Error(data.error || "Не удалось войти");
      if (!data.draft) {
        setAuthError("Неверный пароль");
        return;
      }
      try {
        sessionStorage.setItem(SECRET_STORAGE_KEY, secret.trim());
      } catch {}
      applyResponse(data);
      setAuthenticated(true);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Не удалось войти");
    } finally {
      setAuthenticating(false);
    }
  }, [secret, applyResponse]);

  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem(SECRET_STORAGE_KEY);
    } catch {}
    setAuthenticated(false);
    setSecretState("");
  }, []);

  const unsavedChanges = useMemo(() => !settingsEqual(draft, saved), [draft, saved]);
  const unpublishedChanges = useMemo(
    () => !settingsEqual(saved, published),
    [saved, published],
  );

  const status = useMemo<PublishStatus>(() => {
    if (unsavedChanges) {
      return {
        label: "Есть несохранённые изменения",
        tone: "warn",
        hint: "Сохраните черновик, чтобы не потерять правки.",
      };
    }
    if (published === null) {
      return {
        label: "Не опубликовано",
        tone: "neutral",
        hint: "Посетители видят стандартное оформление.",
      };
    }
    if (unpublishedChanges) {
      return {
        label: "Не опубликовано",
        tone: "warn",
        hint: "Сохранённые изменения ещё не применены к публичной странице.",
      };
    }
    return {
      label: "Опубликовано",
      tone: "ok",
      hint: "Посетители видят текущую версию страницы.",
    };
  }, [unsavedChanges, unpublishedChanges, published]);

  const updateText = useCallback((patch: Partial<EventTextSettings>) => {
    setDraft((prev) => ({ ...prev, text: { ...prev.text, ...patch } }));
  }, []);

  const updateBranding = useCallback((patch: Partial<BrandingSettings>) => {
    setDraft((prev) => ({ ...prev, branding: { ...prev.branding, ...patch } }));
  }, []);

  const updateHero = useCallback((patch: Partial<HeroSettings>) => {
    setDraft((prev) => ({
      ...prev,
      branding: { ...prev.branding, hero: { ...prev.branding.hero, ...patch } },
    }));
  }, []);

  const save = useCallback(async () => {
    setBusy(true);
    try {
      const res = await request("/api/event/settings", {
        method: "PUT",
        body: JSON.stringify({ draft }),
      });
      const data = (await res.json()) as SettingsResponse;
      if (!res.ok) throw new Error(data.error || "Не удалось сохранить");
      applyResponse(data);
      notify("Черновик сохранён");
      return true;
    } catch (err) {
      notify(err instanceof Error ? err.message : "Не удалось сохранить");
      return false;
    } finally {
      setBusy(false);
    }
  }, [draft, request, applyResponse, notify]);

  const publish = useCallback(async () => {
    setBusy(true);
    try {
      const res = await request("/api/event/publish", {
        method: "POST",
        body: JSON.stringify({ draft }),
      });
      const data = (await res.json()) as SettingsResponse;
      if (!res.ok) throw new Error(data.error || "Не удалось опубликовать");
      applyResponse(data);
      notify("Изменения опубликованы");
      return true;
    } catch (err) {
      notify(err instanceof Error ? err.message : "Не удалось опубликовать");
      return false;
    } finally {
      setBusy(false);
    }
  }, [draft, request, applyResponse, notify]);

  const resetBranding = useCallback(async () => {
    setBusy(true);
    try {
      const res = await request("/api/event/reset", { method: "POST" });
      const data = (await res.json()) as SettingsResponse;
      if (!res.ok) throw new Error(data.error || "Не удалось сбросить оформление");
      applyResponse(data);
      notify("Стандартное оформление восстановлено");
      return true;
    } catch (err) {
      notify(err instanceof Error ? err.message : "Не удалось сбросить оформление");
      return false;
    } finally {
      setBusy(false);
    }
  }, [request, applyResponse, notify]);

  const connectRequest = useCallback(
    async (body: Record<string, string>) => {
      setBusy(true);
      try {
        const res = await request("/api/event/photos", {
          method: "POST",
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as {
          photos?: PhotoConnection;
          error?: string;
        };
        if (data.photos) setPhotos(data.photos);
        if (!res.ok) {
          return { ok: false, error: data.error || "Не удалось подключить папку" };
        }
        return { ok: true, error: null };
      } catch {
        return { ok: false, error: "Не удалось подключить папку — попробуйте ещё раз." };
      } finally {
        setBusy(false);
      }
    },
    [request],
  );

  const connectPhotos = useCallback(
    (url: string) => connectRequest({ action: "connect", url }),
    [connectRequest],
  );

  const syncPhotos = useCallback(
    () => connectRequest({ action: "sync" }),
    [connectRequest],
  );

  const openPublicPage = useCallback(() => {
    window.open("/", "_blank", "noopener");
  }, []);

  /** Черновик кладётся в localStorage — новая вкладка откроется с «/?preview=1». */
  const openPreview = useCallback(() => {
    storeDraftForPreview(draft);
    window.open("/?preview=1", "_blank", "noopener");
  }, [draft]);

  // Не даём закрыть вкладку с несохранёнными правками.
  useEffect(() => {
    if (!unsavedChanges) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [unsavedChanges]);

  const value = useMemo<OrganizerContextValue>(
    () => ({
      authenticated,
      authenticating,
      authError,
      secret,
      setSecret,
      login,
      logout,
      loading,
      loadError,
      draft,
      saved,
      published,
      photos,
      storage,
      unsavedChanges,
      unpublishedChanges,
      status,
      updateText,
      updateBranding,
      updateHero,
      save,
      publish,
      resetBranding,
      reload: load,
      connectPhotos,
      syncPhotos,
      openPublicPage,
      openPreview,
      toast,
      notify,
      dismissToast,
      busy,
    }),
    [
      authenticated,
      authenticating,
      authError,
      secret,
      setSecret,
      login,
      logout,
      loading,
      loadError,
      draft,
      saved,
      published,
      photos,
      storage,
      unsavedChanges,
      unpublishedChanges,
      status,
      updateText,
      updateBranding,
      updateHero,
      save,
      publish,
      resetBranding,
      load,
      connectPhotos,
      syncPhotos,
      openPublicPage,
      openPreview,
      toast,
      notify,
      dismissToast,
      busy,
    ],
  );

  return <OrganizerContext.Provider value={value}>{children}</OrganizerContext.Provider>;
}
