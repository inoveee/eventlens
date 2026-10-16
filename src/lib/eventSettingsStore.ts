// @TheTechMargin 2026
// Серверное хранилище настроек проектов (только для API-роутов).
//
// Проект = мероприятие организатора: у него свои тексты, оформление,
// папка с фотографиями и метаданные (дата, описание, архив).
//
// Два движка:
//   1. Supabase — таблица event_settings (миграции 013 и 014), когда
//      проект сконфигурирован. Это штатный режим продакшена.
//   2. Файлы `.eventlens/projects/<key>.json` — запасной вариант для
//      локальной разработки без Supabase (легаси-файл
//      `.eventlens/event-settings.json` мигрирует автоматически).
//      На серверless-хостинге с доступной только на чтение файловой
//      системой запись завершится ошибкой — тогда возвращаем понятное
//      сообщение, а не «тихий» провал.
//
// Секреты и ключи в структуру не попадают — только настройки страницы.

import fs from "fs/promises";
import path from "path";
import {
  EventSettings,
  ProjectMeta,
  PhotoConnection,
  defaultEventSettings,
  defaultProjectMeta,
  isProjectKey,
  makeProjectKey,
  normalizeEventSettings,
  normalizeProjectMeta,
  summarizeProject,
  type ProjectSummary,
} from "./eventSettings";

export type { PhotoConnection, ProjectMeta, ProjectSummary };

export interface SettingsRecord {
  draft: EventSettings;
  published: EventSettings | null;
  photos: PhotoConnection | null;
  meta: ProjectMeta;
  updatedAt: string;
}

export type StorageEngine = "supabase" | "file";

export class StorageUnavailableError extends Error {}
/** Обращение к проекту, которого нет (удалён или ключ выдуман). */
export class ProjectNotFoundError extends Error {}

/** Ключ проекта по умолчанию — публичная страница без параметров. */
export const DEFAULT_PROJECT_KEY = "default";

const SUPABASE_COLUMNS = "draft, published, photos, meta, updated_at";

function supabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function storageEngine(): StorageEngine {
  return supabaseConfigured() ? "supabase" : "file";
}

function baseDir(): string {
  return path.join(process.cwd(), ".eventlens");
}

function filePath(key: string): string {
  return path.join(baseDir(), "projects", `${key}.json`);
}

function legacyFilePath(): string {
  return path.join(baseDir(), "event-settings.json");
}

function emptyRecord(): SettingsRecord {
  return {
    draft: defaultEventSettings(),
    published: null,
    photos: null,
    meta: defaultProjectMeta(),
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
    meta: normalizeProjectMeta(rec.meta),
    updatedAt: typeof rec.updatedAt === "string" ? rec.updatedAt : new Date().toISOString(),
  };
}

/* ─────────────────────────── Supabase ─────────────────────────── */

function supabaseMissingTable(error: { code?: string; message?: string }): boolean {
  return error.code === "42P01" || /event_settings/i.test(error.message || "");
}

async function readFromSupabase(key: string): Promise<SettingsRecord | null> {
  const { createServerClient } = await import("./supabase");
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("event_settings")
    .select(SUPABASE_COLUMNS)
    .eq("event_key", key)
    .maybeSingle();
  if (error) {
    // Таблицы ещё нет (миграция не применена) — говорим об этом прямо,
    // а не подменяем настройки вымышленными значениями.
    if (supabaseMissingTable(error)) {
      throw new StorageUnavailableError(
        "В базе данных нет таблицы настроек. Примените миграции supabase/migrations/013 и 014.",
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
    meta: data.meta,
    updatedAt: data.updated_at,
  });
}

async function listFromSupabase(): Promise<Array<{ key: string; record: SettingsRecord }>> {
  const { createServerClient } = await import("./supabase");
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("event_settings")
    .select(`event_key, ${SUPABASE_COLUMNS}`)
    .order("updated_at", { ascending: false });
  if (error) {
    if (supabaseMissingTable(error)) {
      throw new StorageUnavailableError(
        "В базе данных нет таблицы настроек. Примените миграции supabase/migrations/013 и 014.",
      );
    }
    throw new StorageUnavailableError(
      `Не удалось получить список проектов: ${error.message}`,
    );
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    key: String(row.event_key),
    record: coerceRecord({
      draft: row.draft,
      published: row.published,
      photos: row.photos,
      meta: row.meta,
      updatedAt: row.updated_at,
    }),
  }));
}

async function writeToSupabase(key: string, record: SettingsRecord): Promise<void> {
  const { createServerClient } = await import("./supabase");
  const supabase = createServerClient();
  const { error } = await supabase.from("event_settings").upsert(
    {
      event_key: key,
      draft: record.draft,
      published: record.published,
      photos: record.photos,
      meta: record.meta,
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

async function deleteFromSupabase(key: string): Promise<void> {
  const { createServerClient } = await import("./supabase");
  const supabase = createServerClient();
  const { error } = await supabase.from("event_settings").delete().eq("event_key", key);
  if (error) {
    throw new StorageUnavailableError(
      `Не удалось удалить проект из базы данных: ${error.message}`,
    );
  }
}

/* ───────────────────────────── Файлы ───────────────────────────── */

function mapFileError(err: unknown, action: string): never {
  const code = (err as NodeJS.ErrnoException)?.code;
  if (code === "EACCES" || code === "EPERM" || code === "EROFS") {
    throw new StorageUnavailableError(
      `Файловое хранилище недоступно для записи. ${action} — подключите Supabase для постоянного хранения.`,
    );
  }
  throw new StorageUnavailableError(`Не удалось ${action}: ${(err as Error).message}`);
}

async function writeFileRecord(key: string, record: SettingsRecord): Promise<void> {
  const target = filePath(key);
  try {
    await fs.mkdir(path.dirname(target), { recursive: true });
    const tmp = `${target}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(record, null, 2), "utf8");
    await fs.rename(tmp, target);
  } catch (err) {
    mapFileError(err, "записать файл настроек");
  }
}

/** Легаси-файл одного мероприятия → projects/default.json. */
async function migrateLegacyFile(): Promise<void> {
  try {
    await fs.access(filePath(DEFAULT_PROJECT_KEY));
    return; // новый формат уже есть
  } catch {}
  try {
    const raw = await fs.readFile(legacyFilePath(), "utf8");
    const record = coerceRecord(JSON.parse(raw));
    await writeFileRecord(DEFAULT_PROJECT_KEY, record);
    await fs.unlink(legacyFilePath()).catch(() => {});
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return;
    console.error("[eventSettingsStore] legacy file migration failed:", err);
  }
}

async function readAllFromFile(): Promise<Array<{ key: string; record: SettingsRecord }>> {
  await migrateLegacyFile();
  let entries: string[];
  try {
    entries = await fs.readdir(path.join(baseDir(), "projects"));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return [];
    mapFileError(err, "прочитать каталог проектов");
  }
  const results: Array<{ key: string; record: SettingsRecord }> = [];
  for (const entry of entries.sort()) {
    if (!entry.endsWith(".json")) continue;
    const key = entry.slice(0, -".json".length);
    if (!isProjectKey(key)) continue;
    try {
      const raw = await fs.readFile(path.join(baseDir(), "projects", entry), "utf8");
      results.push({ key, record: coerceRecord(JSON.parse(raw)) });
    } catch (err) {
      // Повреждённый файл не должен ронять весь список.
      console.error(`[eventSettingsStore] corrupted project file ${entry}:`, err);
    }
  }
  return results;
}

async function readFileRecord(key: string): Promise<SettingsRecord | null> {
  try {
    const raw = await fs.readFile(filePath(key), "utf8");
    return coerceRecord(JSON.parse(raw));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      // Файл мог ещё лежать в легаси-месте (написать не удалось, прочесть — да).
      if (key === DEFAULT_PROJECT_KEY) {
        try {
          const raw = await fs.readFile(legacyFilePath(), "utf8");
          return coerceRecord(JSON.parse(raw));
        } catch {}
      }
      return null;
    }
    if (code === "EACCES" || code === "EPERM" || code === "EROFS") {
      throw new StorageUnavailableError(
        "Файловое хранилище недоступно для чтения настроек.",
      );
    }
    // Повреждённый JSON — не роняем запрос, начинаем со стандартных значений.
    console.error("[eventSettingsStore] corrupted settings file:", err);
    return null;
  }
}

/* ─────────────────────────── Публичный API ─────────────────────────── */

function assertKey(key: string): string {
  if (!isProjectKey(key)) {
    throw new ProjectNotFoundError(`Проект «${key}» не найден`);
  }
  return key;
}

/** Все проекты (включая архивные), новые — первыми. */
export async function listRecords(): Promise<Array<{ key: string; record: SettingsRecord }>> {
  return storageEngine() === "supabase" ? await listFromSupabase() : await readAllFromFile();
}

/** Запись проекта; для неизвестного ключа — стандартные значения. */
export async function readRecord(key: string = DEFAULT_PROJECT_KEY): Promise<SettingsRecord> {
  if (!isProjectKey(key)) return emptyRecord();
  const record =
    storageEngine() === "supabase" ? await readFromSupabase(key) : await readFileRecord(key);
  return record ?? emptyRecord();
}

/** Есть ли проект с таким ключом. Публичная страница /p/<key> по нему
 *  отдаёт 404 вместо «стандартной» галереи для выдуманного адреса. */
export async function projectExists(key: string): Promise<boolean> {
  if (!isProjectKey(key)) return false;
  const record =
    storageEngine() === "supabase" ? await readFromSupabase(key) : await readFileRecord(key);
  return record !== null;
}

/** Обновляет запись существующего проекта. */
export async function writeRecord(
  key: string,
  patch: Partial<Pick<SettingsRecord, "draft" | "published" | "photos" | "meta">>,
): Promise<SettingsRecord> {
  assertKey(key);
  if (!(await projectExists(key))) {
    throw new ProjectNotFoundError("Проект не найден");
  }
  const current = await readRecord(key);
  const next: SettingsRecord = {
    ...current,
    ...patch,
    meta: normalizeProjectMeta(patch.meta ?? current.meta, current.meta),
    updatedAt: new Date().toISOString(),
  };
  if (storageEngine() === "supabase") {
    await writeToSupabase(key, next);
  } else {
    await writeFileRecord(key, next);
  }
  return next;
}

/** Новый проект: только настройки по умолчанию с указанным названием.
 *  Никаких вымышленных ссылок на диски и фотографий. */
export async function createProject(input: {
  title: string;
  date?: string | null;
  description?: string;
}): Promise<{ key: string; record: SettingsRecord }> {
  const title = input.title.trim();
  const existing = await listRecords();
  const taken = new Set(existing.map((entry) => entry.key));
  const key = makeProjectKey(title, (candidate) => taken.has(candidate));

  const draft = defaultEventSettings();
  draft.text.name = title;
  const now = new Date().toISOString();
  const record: SettingsRecord = {
    draft,
    published: null,
    photos: null,
    meta: normalizeProjectMeta(
      { date: input.date ?? null, description: input.description ?? "", archived: false, createdAt: now },
    ),
    updatedAt: now,
  };
  if (storageEngine() === "supabase") {
    await writeToSupabase(key, record);
  } else {
    await writeFileRecord(key, record);
  }
  return { key, record };
}

/** Копия настроек проекта; копия начинается как черновик. */
export async function duplicateProject(
  key: string,
): Promise<{ key: string; record: SettingsRecord }> {
  assertKey(key);
  const source =
    storageEngine() === "supabase" ? await readFromSupabase(key) : await readFileRecord(key);
  if (!source) throw new ProjectNotFoundError("Проект не найден");

  const existing = await listRecords();
  const taken = new Set(existing.map((entry) => entry.key));
  const title = `${source.draft.text.name} (копия)`.slice(0, 80);
  const newKey = makeProjectKey(title, (candidate) => taken.has(candidate));

  const now = new Date().toISOString();
  const draft: EventSettings = {
    ...source.draft,
    text: { ...source.draft.text, name: title },
  };
  const record: SettingsRecord = {
    draft,
    published: null, // копия — черновик: публикация отдельное решение
    photos: source.photos,
    meta: normalizeProjectMeta(
      { ...source.meta, archived: false, createdAt: now },
      defaultProjectMeta(),
    ),
    updatedAt: now,
  };
  if (storageEngine() === "supabase") {
    await writeToSupabase(newKey, record);
  } else {
    await writeFileRecord(newKey, record);
  }
  return { key: newKey, record };
}

/** Переименование: название проекта — это название мероприятия. */
export async function renameProject(key: string, title: string): Promise<SettingsRecord> {
  const record = await readRecord(key);
  if (!(await projectExists(key))) throw new ProjectNotFoundError("Проект не найден");
  return writeRecord(key, {
    draft: { ...record.draft, text: { ...record.draft.text, name: title.trim() } },
  });
}

/** Алиас уже занят другим проектом. */
export class ProjectKeyTakenError extends Error {}

/**
 * Смена алиаса: проект получает новый ключ — публичный адрес /p/<newKey>
 * и адрес панели /organizer/project/<newKey>. Содержимое настроек
 * не трогаем, меняется только идентификатор хранилища.
 */
export async function rekeyProject(oldKey: string, newKey: string): Promise<void> {
  assertKey(oldKey);
  assertKey(newKey);
  if (oldKey === newKey) return;
  if (!(await projectExists(oldKey))) throw new ProjectNotFoundError("Проект не найден");
  if (await projectExists(newKey)) {
    throw new ProjectKeyTakenError("Такой алиас уже занят — выберите другой");
  }

  if (storageEngine() === "supabase") {
    const { createServerClient } = await import("./supabase");
    const supabase = createServerClient();
    const { error } = await supabase
      .from("event_settings")
      .update({ event_key: newKey })
      .eq("event_key", oldKey);
    if (error) {
      if (error.code === "23505") {
        throw new ProjectKeyTakenError("Такой алиас уже занят — выберите другой");
      }
      throw new StorageUnavailableError(`Не удалось сменить алиас: ${error.message}`);
    }
    return;
  }

  const record = await readFileRecord(oldKey);
  if (!record) throw new ProjectNotFoundError("Проект не найден");
  await writeFileRecord(newKey, record);
  await fs.unlink(filePath(oldKey)).catch(() => {});
  if (oldKey === DEFAULT_PROJECT_KEY) {
    // Легаси-файл одного мероприятия больше не должен воскрешать «default».
    await fs.unlink(legacyFilePath()).catch(() => {});
  }
}

/** Метаданные: дата, описание, архивирование. */
export async function updateProjectMeta(
  key: string,
  patch: Partial<Pick<ProjectMeta, "date" | "description" | "archived">>,
): Promise<SettingsRecord> {
  const record = await readRecord(key);
  if (!(await projectExists(key))) throw new ProjectNotFoundError("Проект не найден");
  return writeRecord(key, {
    meta: normalizeProjectMeta({ ...record.meta, ...patch }, record.meta),
  });
}

export async function deleteProject(key: string): Promise<void> {
  assertKey(key);
  if (!(await projectExists(key))) throw new ProjectNotFoundError("Проект не найден");
  if (storageEngine() === "supabase") {
    await deleteFromSupabase(key);
  } else {
    try {
      await fs.unlink(filePath(key));
    } catch (err) {
      mapFileError(err, "удалить проект");
    }
  }
}

/** Сводки всех проектов для экрана «Мои проекты». */
export async function listProjectSummaries(): Promise<ProjectSummary[]> {
  const entries = await listRecords();
  return entries
    .map(({ key, record }) => summarizeProject(key, record))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/** Опубликованная версия (или null — «не опубликовано»). Публичная страница. */
export async function readPublished(
  key: string = DEFAULT_PROJECT_KEY,
): Promise<EventSettings | null> {
  try {
    const record = await readRecord(key);
    return record.published;
  } catch (err) {
    console.error("[eventSettingsStore] readPublished failed:", err);
    return null;
  }
}

/**
 * Источник фотографий для публичной страницы проекта: сначала папка,
 * подключённая организатором. Настройки окружения проекта — только для
 * легаси-проекта «default» (одно мероприятие на деплой): остальные
 * проекты не должны показывать чужие фотографии из окружения.
 */
export async function resolvePhotoSource(
  key: string = DEFAULT_PROJECT_KEY,
): Promise<{
  provider: "yandex" | "drive";
  value: string;
  configured: boolean;
}> {
  try {
    const record = await readRecord(key);
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
  if (key !== DEFAULT_PROJECT_KEY) {
    // Проект без подключённой папки — честно пусто, без чужих фото.
    return { provider: "yandex", value: "", configured: false };
  }
  if (config.photoSource === "yandex") {
    return { provider: "yandex", value: config.yandexDiskUrl, configured: !!config.yandexDiskUrl };
  }
  return { provider: "drive", value: config.driveFolderId, configured: !!config.driveFolderId };
}
