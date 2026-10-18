// @TheTechMargin 2026
// Подключение папки с фотографиями: распознавание ссылки и реальная
// проверка доступа к облачному диску. Никакой имитации — при ошибке
// возвращаем человекочитаемую причину («не найдена», «нет прав», …).
//
// Используются существующие клиенты проекта: Яндекс.Диск по публичной
// ссылке (без токена) и Google Drive API.

import {
  listYandexImages,
  listYandexSubfolders,
  normalizePublicKey,
} from "./yandex-disk";
import { DriveFile, listDriveImages, listDriveSubfolders } from "./drive";
import {
  isServiceAccountConfigured,
  listDriveImagesWithServiceAccount,
  listDriveSubfoldersWithServiceAccount,
} from "./drive-sa";

export type PhotoProvider = "yandex" | "drive";

export interface ProbeSuccess {
  ok: true;
  provider: PhotoProvider;
  url: string;
  photoCount: number;
  folderCount: number;
  /** true — просмотрены не все вложенные папки (лимит перебора). */
  truncated?: boolean;
}

export interface ProbeFailure {
  ok: false;
  provider: PhotoProvider | "unknown";
  error: string;
}

export type ProbeResult = ProbeSuccess | ProbeFailure;

const YANDEX_API = "https://cloud-api.yandex.net/v1/disk/public/resources";

/** Сколько вложенных папок просматриваем при подсчёте (защита от
 *  слишком долгого запроса на serverless). */
const MAX_SUBFOLDERS = 15;

const DRIVE_FOLDER_RE = /drive\.google\.com\/(?:drive\/folders|open|uc).*?[?&]id=([-\w]{10,})|drive\.google\.com\/drive\/folders\/([-\w]{10,})/i;
const BARE_ID_RE = /^([-\w]{20,})$/;

/** Распознаёт провайдера по ссылке организатора. */
export function classifyPhotoUrl(raw: string): {
  provider: PhotoProvider | "unknown";
  url: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { provider: "unknown", url: "" };

  if (/disk\.yandex\.(ru|com)/i.test(trimmed) || /yadi\.sk/i.test(trimmed)) {
    return { provider: "yandex", url: normalizePublicKey(trimmed) };
  }

  const driveMatch = DRIVE_FOLDER_RE.exec(trimmed);
  if (driveMatch) {
    const id = driveMatch[1] || driveMatch[2];
    return { provider: "drive", url: id };
  }
  if (/drive\.google\.com/i.test(trimmed)) {
    // Ссылка на Drive, но не на папку — сообщим об этом прямо.
    return { provider: "drive", url: trimmed };
  }
  if (BARE_ID_RE.test(trimmed)) {
    return { provider: "drive", url: trimmed };
  }
  return { provider: "unknown", url: trimmed };
}

async function probeYandex(rawUrl: string): Promise<ProbeResult> {
  const key = normalizePublicKey(rawUrl);
  const url = `${YANDEX_API}?public_key=${encodeURIComponent(key)}&limit=1`;

  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch {
    return {
      ok: false,
      provider: "yandex",
      error: "Не удалось связаться с Яндекс.Диском — проверьте соединение и повторите.",
    };
  }

  if (!res.ok) {
    const map: Record<number, string> = {
      400:
        "Ссылка на папку некорректна. Откройте папку на Яндекс.Диске и скопируйте ссылку заново.",
      403: "Нет прав на чтение папки. Откройте доступ по ссылке: «Поделиться» → «Все, у кого есть ссылка».",
      404: "Папка не найдена по этой ссылке. Возможно, ссылка устарела или папка удалена.",
      401: "Яндекс.Диск требует авторизации — убедитесь, что папка открыта по публичной ссылке.",
    };
    return {
      ok: false,
      provider: "yandex",
      error:
        map[res.status] ??
        `Яндекс.Диск ответил ошибкой (${res.status}). Повторите попытку позже.`,
    };
  }

  try {
    const [rootFiles, subfolders] = await Promise.all([
      listYandexImages(key, "/"),
      listYandexSubfolders(key, "/"),
    ]);
    const visible = subfolders.slice(0, MAX_SUBFOLDERS);
    const rest = subfolders.slice(MAX_SUBFOLDERS);

    let photoCount = rootFiles.length;
    for (const folder of visible) {
      photoCount += (await listYandexImages(key, folder.path)).length;
    }
    return {
      ok: true,
      provider: "yandex",
      url: key,
      photoCount,
      folderCount: subfolders.length,
      // Остальные папки не просматривали — счётчик занижен.
      ...(rest.length > 0 ? { truncated: true } : {}),
    };
  } catch {
    return {
      ok: false,
      provider: "yandex",
      error: "Папка открылась, но прочитать её содержимое не удалось.",
    };
  }
}

async function probeDrive(folderId: string): Promise<ProbeResult> {
  if (!process.env.GOOGLE_API_KEY && !isServiceAccountConfigured()) {
    return {
      ok: false,
      provider: "drive",
      error:
        "Сервер не подключён к Google Drive. Используйте публичную ссылку Яндекс.Диска или обратитесь к администратору.",
    };
  }

  const apiKey = process.env.GOOGLE_API_KEY || "";
  const useSa = isServiceAccountConfigured() && !apiKey;

  // Предварительная проверка доступа: один лёгкий запрос.
  if (!useSa) {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    let res: Response;
    try {
      res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&pageSize=1&key=${apiKey}`,
        { cache: "no-store" },
      );
    } catch {
      return {
        ok: false,
        provider: "drive",
        error: "Не удалось связаться с Google Drive — проверьте соединение.",
      };
    }
    if (!res.ok) {
      const map: Record<number, string> = {
        400: "Ссылка на папку некорректна. Проверьте адрес папки Google Drive.",
        403: "Нет прав на чтение папки. Откройте доступ: «Доступ» → «Все, у кого есть ссылка».",
        404: "Папка не найдена — проверьте ссылку или идентификатор папки.",
      };
      return {
        ok: false,
        provider: "drive",
        error:
          map[res.status] ??
          `Google Drive ответил ошибкой (${res.status}). Повторите попытку позже.`,
      };
    }
  }

  try {
    const [rootFiles, subfolders] = await Promise.all([
      useSa ? listDriveImagesWithServiceAccount(folderId) : listDriveImages(folderId, apiKey),
      useSa
        ? listDriveSubfoldersWithServiceAccount(folderId)
        : listDriveSubfolders(folderId, apiKey),
    ]);
    const visible = subfolders.slice(0, MAX_SUBFOLDERS);
    const count = (files: DriveFile[]) =>
      files.filter((f) => f.mimeType?.startsWith("image/") || f.mimeType?.startsWith("video/"))
        .length;

    let photoCount = count(rootFiles);
    for (const folder of visible) {
      const files = useSa
        ? await listDriveImagesWithServiceAccount(folder.id)
        : await listDriveImages(folder.id, apiKey);
      photoCount += count(files);
    }
    return {
      ok: true,
      provider: "drive",
      url: folderId,
      photoCount,
      folderCount: subfolders.length,
    };
  } catch {
    return {
      ok: false,
      provider: "drive",
      error: "Папка открылась, но прочитать её содержимое не удалось.",
    };
  }
}

/** Проверяет ссылку на папку и возвращает реальные счётчики. */
export async function probePhotoSource(rawUrl: string): Promise<ProbeResult> {
  const { provider, url } = classifyPhotoUrl(rawUrl);
  if (!url) {
    return { ok: false, provider, error: "Вставьте ссылку на папку с фотографиями." };
  }
  if (provider === "unknown") {
    return {
      ok: false,
      provider,
      error:
        "Ссылка не похожа на папку Яндекс.Диска или Google Drive. Поддерживаются ссылки вида https://disk.yandex.ru/d/… и https://drive.google.com/drive/folders/…",
    };
  }
  return provider === "yandex" ? probeYandex(url) : probeDrive(url);
}

/**
 * Прогресс ИИ-обработки из базы. null — Supabase не подключён,
 * обработка не ведётся (тогда UI честно показывает «не подключено»).
 * projectKey ограничивает счётчик одним проектом: без него админка
 * показывает сводные цифры по всем проектам.
 */
export async function readProcessingStats(projectKey?: string | null): Promise<{
  completed: number;
  total: number;
  errors: number;
} | null> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return null;
  }
  try {
    const { createServerClient } = await import("./supabase");
    const supabase = createServerClient();
    const base = () => {
      const q = supabase
        .from("photos")
        .select("id", { count: "exact", head: true })
        .neq("hidden", true);
      return projectKey ? q.eq("project_key", projectKey) : q;
    };
    const [total, completed, errors] = await Promise.all([
      base(),
      base().eq("status", "completed"),
      base().eq("status", "error"),
    ]);
    if (total.error || completed.error || errors.error) return null;
    return {
      completed: completed.count ?? 0,
      total: total.count ?? 0,
      errors: errors.count ?? 0,
    };
  } catch {
    return null;
  }
}
