// @TheTechMargin 2026
// Серверное хранилище настроек мероприятия (только для API-роутов).
//
// Два движка:
//   1. Supabase — таблица event_settings (миграция 013), когда проект
//      сконфигурирован. Это штатный режим продакшена.
//   2. Файл `.eventlens/event-settings.json` — запасной вариант для
//      локальной разработки без Supabase. На серверless-хостинге с
//      доступной только на чтение файловой системой запись завершится
//      ошибкой — тогда возвращаем понятное сообщение, а не «тихий»
//      провал: в UI организатор увидит, что сохранить не удалось.
//
// Секреты и ключи в структуру не попадают — только настройки страницы.

import fs from "fs/promises";
import path from "path";
import {
  EventSettings,
  PhotoConnection,
  defaultEventSettings,
  normalizeEventSettings,
} from "./eventSettings";

export type { PhotoConnection };

export interface SettingsRecord {
  draft: EventSettings;
  published: EventSettings | null;
  photos: PhotoConnection | null;
  updatedAt: string;
}

export type StorageEngine = "supabase" | "file";

export class StorageUnavailableError extends Error {}

const EVENT_KEY = "default";

function supabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function storageEngine(): StorageEngine {
  return supabaseConfigured() ? "supabase" : "file";
}

function filePath(): string {
  return path.join(process.cwd(), ".eventlens", "event-settings.json");
}

function emptyRecord(): SettingsRecord {
  return {
    draft: defaultEventSettings(),
    published: null,
    photos: null,
    updatedAt: new Date().toISOString(),
  };
}

function coerceRecord(raw: unknown): SettingsRecord {
  const rec = (raw ?? {}) as Partial<SettingsRecord>;
  const defaults = defaultEventSettings();
  return {
    draft: normalizeEventSettings(rec.draft, defaults),
    published: rec.published ? normalizeEventSettings(rec.published, defaults) : null,
    photos: (rec.photos as PhotoConnection | null) ?? null,
    updatedAt: typeof rec.updatedAt === "string" ? rec.updatedAt : new Date().toISOString(),
  };
}

async function readFromSupabase(): Promise<SettingsRecord | null> {
  const { createServerClient } = await import("./supabase");
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("event_settings")
    .select("draft, published, photos, updated_at")
    .eq("event_key", EVENT_KEY)
    .maybeSingle();
  if (error) {
    // Таблицы ещё нет (миграция не применена) — говорим об этом прямо,
    // а не подменяем настройки вымышленными значениями.
    if (error.code === "42P01" || /event_settings/i.test(error.message || "")) {
      throw new StorageUnavailableError(
        "В базе данных нет таблицы настроек. Примените миграцию supabase/migrations/013_event_settings.sql.",
      );
    }
    throw new StorageUnavailableError(
      `Не удалось прочитать настройки из базы данных: ${error.message}`,
    );
  }
  if (!data) return null;
  return coerceRecord({
    draft: data.draft,
    published: data.published,
    photos: data.photos,
    updatedAt: data.updated_at,
  });
}

async function writeToSupabase(record: SettingsRecord): Promise<void> {
  const { createServerClient } = await import("./supabase");
  const supabase = createServerClient();
  const { error } = await supabase.from("event_settings").upsert(
    {
      event_key: EVENT_KEY,
      draft: record.draft,
      published: record.published,
      photos: record.photos,
      updated_at: record.updatedAt,
    },
    { onConflict: "event_key" },
  );
  if (error) {
    throw new StorageUnavailableError(
      `Не удалось сохранить настройки в базу данных: ${error.message}`,
    );
  }
}

async function readFromFile(): Promise<SettingsRecord | null> {
  try {
    const raw = await fs.readFile(filePath(), "utf8");
    return coerceRecord(JSON.parse(raw));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return null;
    if (code === "EACCES" || code === "EPERM" || code === "EROFS") {
      throw new StorageUnavailableError(
        "Файловое хранилище недоступно для записи. Настройки не сохранены.",
      );
    }
    // Повреждённый JSON — не роняем запрос, начинаем со стандартных значений.
    console.error("[eventSettingsStore] corrupted settings file:", err);
    return null;
  }
}

async function writeToFile(record: SettingsRecord): Promise<void> {
  const target = filePath();
  try {
    await fs.mkdir(path.dirname(target), { recursive: true });
    const tmp = `${target}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(record, null, 2), "utf8");
    await fs.rename(tmp, target);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "EACCES" || code === "EPERM" || code === "EROFS") {
      throw new StorageUnavailableError(
        "Файловое хранилище недоступно для записи. Настройки не сохранены — подключите Supabase для постоянного хранения.",
      );
    }
    throw new StorageUnavailableError(
      `Не удалось записать файл настроек: ${(err as Error).message}`,
    );
  }
}

export async function readRecord(): Promise<SettingsRecord> {
  const record =
    storageEngine() === "supabase" ? await readFromSupabase() : await readFromFile();
  return record ?? emptyRecord();
}

export async function writeRecord(
  patch: Partial<Pick<SettingsRecord, "draft" | "published" | "photos">>,
): Promise<SettingsRecord> {
  const current = await readRecord();
  const next: SettingsRecord = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  if (storageEngine() === "supabase") {
    await writeToSupabase(next);
  } else {
    await writeToFile(next);
  }
  return next;
}

/** Опубликованная версия (или null — «не опубликовано»). Публичная страница. */
export async function readPublished(): Promise<EventSettings | null> {
  try {
    const record = await readRecord();
    return record.published;
  } catch (err) {
    console.error("[eventSettingsStore] readPublished failed:", err);
    return null;
  }
}

/**
 * Источник фотографий для публичной страницы: сначала папка,
 * подключённая организатором, затем настройки окружения проекта.
 */
export async function resolvePhotoSource(): Promise<{
  provider: "yandex" | "drive";
  value: string;
  configured: boolean;
}> {
  try {
    const record = await readRecord();
    if (record.photos && record.photos.status === "connected") {
      return {
        provider: record.photos.provider,
        value: record.photos.url,
        configured: true,
      };
    }
  } catch (err) {
    console.error("[eventSettingsStore] resolvePhotoSource failed:", err);
  }
  const { config } = await import("./config");
  if (config.photoSource === "yandex") {
    return { provider: "yandex", value: config.yandexDiskUrl, configured: !!config.yandexDiskUrl };
  }
  return { provider: "drive", value: config.driveFolderId, configured: !!config.driveFolderId };
}
