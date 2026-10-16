// @TheTechMargin 2026
// Состояние панели организатора.
//
// Два контекста:
//   1. OrganizerAuthProvider — авторизация (пароль, сессия, уведомления).
//      Живёт в корневом layout: и стартовый экран «Мои проекты», и
//      настройки проекта начинаются со входа.
//   2. OrganizerProvider — состояние одного проекта: черновик настроек,
//      статусы сохранения/публикации, подключение папки. Ключ проекта
//      приходит из маршрута /organizer/project/<key>.
//
// Черновик живёт в памяти вкладки и хранится на сервере; публичная
// страница /p/<key> видит только опубликованную версию.

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
  ProjectMeta,
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

/* ────────────────────────── Авторизация ────────────────────────── */

interface OrganizerAuthValue {
  /** Проверяем сохранённый секрет — ни входа, ни контента ещё нет. */
  checking: boolean;
  authenticated: boolean;
  authenticating: boolean;
  authError: string | null;
  secret: string;
  setSecret: (v: string) => void;
  login: () => Promise<void>;
  logout: () => void;

  toast: { id: number; message: string } | null;
  notify: (message: string) => void;
  dismissToast: () => void;
}

const OrganizerAuthContext = createContext<OrganizerAuthValue | null>(null);

export function useOrganizerAuth(): OrganizerAuthValue {
  const ctx = useContext(OrganizerAuthContext);
  if (!ctx) throw new Error("useOrganizerAuth must be used inside OrganizerAuthProvider");
  return ctx;
}

export function OrganizerAuthProvider({ children }: { children: React.ReactNode }) {
  const [secret, setSecretState] = useState("");
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
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

  /** Проверяет секрет лёгким запросом списка проектов. */
  const probeAuth = useCallback(async (candidate: string): Promise<boolean> => {
    const res = await fetch("/api/event/projects", {
      headers: { Authorization: `Bearer ${candidate}` },
    });
    return res.ok;
  }, []);

  // Скрытый вход: секрет из этой вкладки (sessionStorage).
  useEffect(() => {
    let stored = "";
    try {
      stored = sessionStorage.getItem(SECRET_STORAGE_KEY) || "";
    } catch {}
    if (!stored) {
      setChecking(false);
      return;
    }
    setSecretState(stored);
    probeAuth(stored)
      .then((ok) => {
        if (ok) {
          setAuthenticated(true);
        } else {
          try {
            sessionStorage.removeItem(SECRET_STORAGE_KEY);
          } catch {}
          setSecretState("");
        }
      })
      .finally(() => setChecking(false));
  }, [probeAuth]);

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
      const ok = await probeAuth(secret.trim());
      if (!ok) {
        setAuthError("Неверный пароль");
        return;
      }
      try {
        sessionStorage.setItem(SECRET_STORAGE_KEY, secret.trim());
      } catch {}
      setAuthenticated(true);
    } catch {
      setAuthError("Не удалось войти — попробуйте ещё раз");
    } finally {
      setAuthenticating(false);
    }
  }, [secret, probeAuth]);

  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem(SECRET_STORAGE_KEY);
    } catch {}
    setAuthenticated(false);
    setSecretState("");
  }, []);

  const value = useMemo<OrganizerAuthValue>(
    () => ({
      checking,
      authenticated,
      authenticating,
      authError,
      secret,
      setSecret,
      login,
      logout,
      toast,
      notify,
      dismissToast,
    }),
    [checking, authenticated, authenticating, authError, secret, setSecret, login, logout, toast, notify, dismissToast],
  );

  return <OrganizerAuthContext.Provider value={value}>{children}</OrganizerAuthContext.Provider>;
}

/* ─────────────────────────── Проект ─────────────────────────── */

interface OrganizerContextValue {
  /** Ключ проекта в маршруте /organizer/project/<key>. */
  projectKey: string;

  // Данные
  loading: boolean;
  loadError: string | null;
  draft: EventSettings;
  saved: EventSettings;
  published: EventSettings | null;
  photos: PhotoConnection | null;
  meta: ProjectMeta;
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
  /** Смена алиаса проекта: новый ключ — новые адреса панели и
   *  публичной страницы. Возвращает новый ключ или бросает ошибку. */
  changeAlias: (alias: string) => Promise<string>;
  reload: () => Promise<void>;

  connectPhotos: (url: string) => Promise<{ ok: boolean; error: string | null }>;
  syncPhotos: () => Promise<{ ok: boolean; error: string | null }>;

  openPublicPage: () => void;
  openPreview: () => void;

  /** Уведомления (общие со стартовым экраном — из авторизации). */
  notify: (message: string) => void;

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
  meta?: ProjectMeta;
  updatedAt?: string;
  storage?: "supabase" | "file";
  error?: string;
}

/** Запросы панели: секрет из авторизации, ключ проекта — в URL/теле. */
function useProjectRequest(projectKey: string) {
  const { secret } = useOrganizerAuth();
  return useCallback(
    async (path: string, init?: RequestInit): Promise<Response> => {
      const separator = path.includes("?") ? "&" : "?";
      return fetch(`${path}${separator}project=${encodeURIComponent(projectKey)}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
          ...(init?.headers || {}),
        },
      });
    },
    [secret, projectKey],
  );
}

export function OrganizerProvider({
  projectKey,
  children,
}: {
  projectKey: string;
  children: React.ReactNode;
}) {
  const { notify, authenticated } = useOrganizerAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<EventSettings>(() => defaultEventSettings());
  const [saved, setSaved] = useState<EventSettings>(() => defaultEventSettings());
  const [published, setPublished] = useState<EventSettings | null>(null);
  const [photos, setPhotos] = useState<PhotoConnection | null>(null);
  const [meta, setMeta] = useState<ProjectMeta>(() => ({
    date: null,
    description: "",
    archived: false,
    createdAt: new Date().toISOString(),
  }));
  const [storage, setStorage] = useState<"supabase" | "file" | null>(null);
  const [busy, setBusy] = useState(false);

  const request = useProjectRequest(projectKey);

  const applyResponse = useCallback((data: SettingsResponse) => {
    if (data.draft) setDraft(data.draft);
    if (data.draft) setSaved(data.draft);
    if (data.published !== undefined) setPublished(data.published ?? null);
    if (data.photos !== undefined) setPhotos(data.photos ?? null);
    if (data.meta !== undefined) setMeta(data.meta);
    if (data.storage) setStorage(data.storage);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await request("/api/event/settings");
      if (res.status === 401) {
        setLoadError("Сессия истекла — войдите снова.");
        return;
      }
      const data = (await res.json()) as SettingsResponse;
      if (!res.ok) throw new Error(data.error || "Не удалось загрузить настройки");
      if (!data.draft) throw new Error("Нет доступа к настройкам мероприятия");
      applyResponse(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Не удалось загрузить настройки");
    } finally {
      setLoading(false);
    }
  }, [request, applyResponse]);

  // Загрузка после входа (или сразу, если секрет уже в вкладке).
  useEffect(() => {
    if (authenticated) void load();
    else setLoading(false);
  }, [authenticated, load]);

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
        hint: "Посетители пока не видят страницу проекта.",
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
        body: JSON.stringify({ draft, project: projectKey }),
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
  }, [draft, projectKey, request, applyResponse, notify]);

  const publish = useCallback(async () => {
    setBusy(true);
    try {
      const res = await request("/api/event/publish", {
        method: "POST",
        body: JSON.stringify({ draft, project: projectKey }),
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
  }, [draft, projectKey, request, applyResponse, notify]);

  const resetBranding = useCallback(async () => {
    setBusy(true);
    try {
      const res = await request("/api/event/reset", {
        method: "POST",
        body: JSON.stringify({ project: projectKey }),
      });
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
  }, [projectKey, request, applyResponse, notify]);

  /** Смена алиаса: сервер переименовывает ключ проекта — меняются
   *  адреса панели и публичной страницы. Возвращает новый ключ. */
  const changeAlias = useCallback(
    async (alias: string): Promise<string> => {
      setBusy(true);
      try {
        const res = await request("/api/event/projects", {
          method: "POST",
          body: JSON.stringify({ action: "alias", key: projectKey, alias }),
        });
        const data = (await res.json()) as { key?: string; error?: string };
        if (!res.ok || typeof data.key !== "string") {
          throw new Error(data.error || "Не удалось сменить алиас");
        }
        notify("Адрес страницы обновлён");
        return data.key;
      } finally {
        setBusy(false);
      }
    },
    [projectKey, request, notify],
  );

  const connectRequest = useCallback(
    async (body: Record<string, string>) => {
      setBusy(true);
      try {
        const res = await request("/api/event/photos", {
          method: "POST",
          body: JSON.stringify({ ...body, project: projectKey }),
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
    [request, projectKey],
  );

  const connectPhotos = useCallback(
    (url: string) => connectRequest({ action: "connect", url }),
    [connectRequest],
  );

  const syncPhotos = useCallback(
    () => connectRequest({ action: "sync" }),
    [connectRequest],
  );

  /** Публичная страница проекта: /p/<key>. */
  const publicUrl = useCallback(
    () => `/p/${encodeURIComponent(projectKey)}`,
    [projectKey],
  );

  const openPublicPage = useCallback(() => {
    window.open(publicUrl(), "_blank", "noopener");
  }, [publicUrl]);

  /** Черновик кладётся в localStorage — новая вкладка откроется с
   *  «/p/<key>?preview=1» и покажет его вместо опубликованного. */
  const openPreview = useCallback(() => {
    storeDraftForPreview(draft, projectKey);
    window.open(`${publicUrl()}?preview=1`, "_blank", "noopener");
  }, [draft, projectKey, publicUrl]);

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
      projectKey,
      loading,
      loadError,
      draft,
      saved,
      published,
      photos,
      meta,
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
      changeAlias,
      reload: load,
      connectPhotos,
      syncPhotos,
      openPublicPage,
      openPreview,
      notify,
      busy,
    }),
    [
      projectKey,
      loading,
      loadError,
      draft,
      saved,
      published,
      photos,
      meta,
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
      changeAlias,
      load,
      connectPhotos,
      syncPhotos,
      openPublicPage,
      openPreview,
      notify,
      busy,
    ],
  );

  return <OrganizerContext.Provider value={value}>{children}</OrganizerContext.Provider>;
}
