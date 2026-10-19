// @TheTechMargin 2026
// Модель настроек мероприятия: тексты публичной страницы + оформление.
// Одна структура хранится дважды — черновик (draft) и опубликованная
// версия (published); публичная страница читает только published.

import { config } from "./config";
import { contrastOn, normalizeHex, relativeLuminance } from "./color";

export type HeroMode = "default" | "color" | "gradient" | "image";
export type ImageFit = "cover" | "contain";

/** Верхняя часть страницы (hero). mode="default" — фирменные радиальные
 *  глоу из globals.css, их не нужно переопределять. */
export interface HeroSettings {
  mode: HeroMode;
  /** Сплошной фон (mode="color"). */
  color: string;
  /** Градиент (mode="gradient"). */
  gradientFrom: string;
  gradientTo: string;
  gradientAngle: number;
  /** Фоновое изображение (mode="image") — data URL. */
  image: string | null;
  imageFit: ImageFit;
  /** Средняя яркость картинки (0..1), считается при загрузке клиентом.
   *  Нужна, чтобы подобрать читаемый цвет текста поверх фото. */
  imageLuminance: number | null;
  /** Затемнение поверх фона, 0..90 (%). */
  overlay: number;
}

export interface BrandingSettings {
  /** Акцентный цвет: кнопки, ссылки, акценты интерфейса. */
  accent: string;
  hero: HeroSettings;
  /** Логотип — data URL или внешний URL. null = текстовый заголовок. */
  logo: string | null;
}

export interface EventTextSettings {
  name: string;
  tagline: string;
  statement: string;
  description: string;
  albumName: string;
}

export interface EventSettings {
  text: EventTextSettings;
  branding: BrandingSettings;
}

/** Метаданные проекта (мероприятия), отдельные от настроек страницы.
 *  Название мероприятия живёт в draft.text.name — здесь только то,
 *  что не относится к оформлению. */
export interface ProjectMeta {
  /** Дата проведения в формате YYYY-MM-DD. null — не указана. */
  date: string | null;
  /** Краткое описание для карточки проекта. */
  description: string;
  /** Проект в архиве: скрыт из основного списка, но не удалён. */
  archived: boolean;
  createdAt: string;
}

export const PROJECT_TITLE_LIMIT = 80;
export const PROJECT_DESCRIPTION_LIMIT = 240;

export function defaultProjectMeta(): ProjectMeta {
  return {
    date: null,
    description: "",
    archived: false,
    createdAt: new Date().toISOString(),
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Нормализует метаданные проекта; некорректные значения заменяются
 *  предыдущими или значениями по умолчанию. */
export function normalizeProjectMeta(input: unknown, base?: ProjectMeta): ProjectMeta {
  const raw = (input ?? {}) as Partial<ProjectMeta>;
  const prev = base ?? defaultProjectMeta();
  const date =
    raw.date === null
      ? null
      : typeof raw.date === "string" && DATE_RE.test(raw.date)
        ? raw.date
        : prev.date;
  return {
    date,
    description:
      typeof raw.description === "string"
        ? raw.description.trim().slice(0, PROJECT_DESCRIPTION_LIMIT)
        : prev.description,
    archived: typeof raw.archived === "boolean" ? raw.archived : prev.archived,
    createdAt:
      typeof raw.createdAt === "string" && raw.createdAt
        ? raw.createdAt
        : prev.createdAt,
  };
}

/** Ключ проекта в URL и хранилище: латиница, цифры, дефис. */
const PROJECT_KEY_RE = /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$/;

export function isProjectKey(value: unknown): value is string {
  return typeof value === "string" && PROJECT_KEY_RE.test(value);
}

/** Проверяет присланный ключ: null/пусто → "default", мусор → null. */
export function coerceProjectKey(value: unknown): string | null {
  if (value == null || value === "") return "default";
  return isProjectKey(value) ? value : null;
}

const CYRILLIC_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh",
  щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/** Читаемый ключ из названия: «Моя свадьба» → «moya-svadba». */
export function slugifyProjectTitle(title: string): string {
  return title
    .toLowerCase()
    .split("")
    .map((ch) => (ch in CYRILLIC_MAP ? CYRILLIC_MAP[ch] : ch))
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Уникальный ключ проекта; isTaken проверяет конфликты. */
export function makeProjectKey(
  title: string,
  isTaken?: (key: string) => boolean,
): string {
  const base = (slugifyProjectTitle(title).slice(0, 40).replace(/-+$/g, "") || "project");
  if (!isTaken?.(base)) return base;
  for (let i = 0; i < 50; i += 1) {
    const suffix = Math.random().toString(36).slice(2, 6);
    const candidate = `${base}-${suffix}`;
    if (!isTaken?.(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Строка карточки проекта для списка «Мои проекты». */
export interface ProjectSummary {
  key: string;
  title: string;
  date: string | null;
  description: string;
  archived: boolean;
  /** Опубликованная версия существует — посетители видят страницу. */
  published: boolean;
  /** Состояние папки с фотографиями; null — папка не подключалась. */
  photos: { connected: boolean; photoCount: number; provider: "yandex" | "drive" } | null;
  /** Миниатюра карточки: фон hero или логотип, если загружены. */
  cover: string | null;
  updatedAt: string;
  createdAt: string;
}

/** Сводка проекта из его записи хранилища (чистая функция — тестируется). */
export function summarizeProject(
  key: string,
  record: {
    draft: EventSettings;
    published: EventSettings | null;
    photos: PhotoConnection | null;
    meta: ProjectMeta;
    updatedAt: string;
  },
): ProjectSummary {
  return {
    key,
    title: record.draft.text.name,
    date: record.meta.date,
    description: record.meta.description,
    archived: record.meta.archived,
    published: record.published !== null,
    photos: record.photos
      ? {
          connected: record.photos.status === "connected",
          photoCount: record.photos.photoCount,
          provider: record.photos.provider,
        }
      : null,
    cover: record.draft.branding.hero.image ?? record.draft.branding.logo,
    updatedAt: record.updatedAt,
    createdAt: record.meta.createdAt,
  };
}

/** Подключённая папка с фотографиями и статус синхронизации. */
export interface PhotoConnection {
  provider: "yandex" | "drive";
  url: string;
  status: "connected" | "error";
  /** Сколько фотографий реально найдено в папке. */
  photoCount: number;
  /** Сколько вложенных папок просмотрено. */
  folderCount: number;
  /** Прогресс ИИ-обработки, если Supabase подключён. null — не ведётся. */
  processed: { completed: number; total: number; errors: number } | null;
  connectedAt: string;
  lastSyncAt: string | null;
  /** Последняя ошибка подключения/синхронизации (человекочитаемая). */
  error: string | null;
}

export const TEXT_LIMITS = {
  name: 80,
  tagline: 160,
  statement: 220,
  description: 320,
  albumName: 80,
} as const;

/** Лимиты файлов: байты для клиента, символы data URL для сервера. */
export const LOGO_MAX_BYTES = 512 * 1024;
export const HERO_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
const LOGO_MAX_CHARS = Math.ceil((LOGO_MAX_BYTES * 4) / 3) + 128;
const HERO_IMAGE_MAX_CHARS = Math.ceil((HERO_IMAGE_MAX_BYTES * 4) / 3) + 128;

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const HERO_TYPES = ["image/png", "image/jpeg", "image/webp"];

export const LOGO_ACCEPTED_TYPES = LOGO_TYPES;
export const HERO_ACCEPTED_TYPES = HERO_TYPES;

export class SettingsValidationError extends Error {}

export function acceptedTypeLabel(types: string[]): string {
  return types.map((t) => t.split("/")[1].toUpperCase().replace("SVG+XML", "SVG")).join(", ");
}

/** Стандартное оформление — те значения, что заданы в окружении проекта.
 *  «Сбросить оформление» возвращает именно их. */
export function defaultEventSettings(): EventSettings {
  return {
    text: {
      name: config.eventName,
      tagline: config.eventTagline,
      statement: config.heroStatement,
      description: config.eventDescription,
      albumName: config.defaultAlbumName,
    },
    branding: {
      accent: normalizeHex(config.primaryColor) ?? "#fd8d2c",
      logo: config.logoUrl || null,
      hero: {
        mode: "default",
        color: "#141416",
        gradientFrom: normalizeHex(config.primaryColor) ?? "#fd8d2c",
        gradientTo: "#0a0a0e",
        gradientAngle: 135,
        image: null,
        imageFit: "cover",
        imageLuminance: null,
        overlay: 35,
      },
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pickText(value: unknown, fallback: string, limit: number): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().slice(0, limit);
  return trimmed || fallback;
}

function pickImage(value: unknown, maxChars: number, label: string): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new SettingsValidationError(`${label}: некорректные данные изображения`);
  }
  if (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(value)) {
    throw new SettingsValidationError(`${label}: ожидается изображение`);
  }
  if (value.length > maxChars) {
    throw new SettingsValidationError(`${label}: файл слишком большой`);
  }
  return value;
}

/**
 * Нормализует присланные настройки: цвета → hex, тексты → усечённые,
 * картинки → проверенные data URL. Бросает SettingsValidationError с
 * понятным сообщением при нарушении лимитов.
 */
export function normalizeEventSettings(input: unknown, base?: EventSettings): EventSettings {
  const defaults = base ?? defaultEventSettings();
  const raw = (input ?? {}) as Partial<EventSettings>;
  const rawText = (raw.text ?? {}) as Partial<EventTextSettings>;
  const rawBranding = (raw.branding ?? {}) as Partial<BrandingSettings>;
  const rawHero = (rawBranding.hero ?? {}) as Partial<HeroSettings>;

  const mode: HeroMode = (["default", "color", "gradient", "image"] as const).includes(
    rawHero.mode as HeroMode,
  )
    ? (rawHero.mode as HeroMode)
    : defaults.branding.hero.mode;

  const fit: ImageFit = rawHero.imageFit === "contain" ? "contain" : "cover";

  const heroImage = pickImage(rawHero.image, HERO_IMAGE_MAX_CHARS, "Фоновое изображение");
  const logo = pickImage(rawBranding.logo, LOGO_MAX_CHARS, "Логотип");

  const luminance =
    typeof rawHero.imageLuminance === "number" && Number.isFinite(rawHero.imageLuminance)
      ? clamp(rawHero.imageLuminance, 0, 1)
      : null;

  return {
    text: {
      name: pickText(rawText.name, defaults.text.name, TEXT_LIMITS.name),
      tagline: pickText(rawText.tagline, defaults.text.tagline, TEXT_LIMITS.tagline),
      statement: pickText(rawText.statement, defaults.text.statement, TEXT_LIMITS.statement),
      description: pickText(rawText.description, defaults.text.description, TEXT_LIMITS.description),
      albumName: pickText(rawText.albumName, defaults.text.albumName, TEXT_LIMITS.albumName),
    },
    branding: {
      accent: normalizeHex(rawBranding.accent) ?? defaults.branding.accent,
      logo,
      hero: {
        mode,
        color: normalizeHex(rawHero.color) ?? defaults.branding.hero.color,
        gradientFrom:
          normalizeHex(rawHero.gradientFrom) ?? defaults.branding.hero.gradientFrom,
        gradientTo: normalizeHex(rawHero.gradientTo) ?? defaults.branding.hero.gradientTo,
        gradientAngle:
          typeof rawHero.gradientAngle === "number" && Number.isFinite(rawHero.gradientAngle)
            ? Math.round(clamp(rawHero.gradientAngle, 0, 360))
            : defaults.branding.hero.gradientAngle,
        image: heroImage,
        imageFit: fit,
        imageLuminance: luminance,
        overlay:
          typeof rawHero.overlay === "number" && Number.isFinite(rawHero.overlay)
            ? Math.round(clamp(rawHero.overlay, 0, 90))
            : defaults.branding.hero.overlay,
      },
    },
  };
}

/** Тот же цвет, что уже используется в градиентах героя, в виде hex
 *  (для вычисления контраста поверх градиента). */
function mixHex(a: string, b: string, ratio = 0.5): string {
  const pa = normalizeHex(a);
  const pb = normalizeHex(b);
  if (!pa || !pb) return pa ?? pb ?? "#000000";
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  // Байты RGB лежат в hex-строке после "#": смещения 1, 3, 5.
  const mixed = [1, 3, 5]
    .map((offset) => {
      const va = parseInt(pa.slice(offset, offset + 2), 16);
      const vb = parseInt(pb.slice(offset, offset + 2), 16);
      return toHex(Math.round(va * (1 - ratio) + vb * ratio));
    })
    .join("");
  return `#${mixed}`;
}

/** CSS-значение фона hero или null — «стандартное оформление». */
export function heroBackgroundValue(hero: HeroSettings): string | null {
  switch (hero.mode) {
    case "color":
      return hero.color;
    case "gradient":
      return `linear-gradient(${hero.gradientAngle}deg, ${hero.gradientFrom} 0%, ${hero.gradientTo} 100%)`;
    case "image":
      return hero.image ? `url("${hero.image}")` : null;
    default:
      return null;
  }
}

/** Ским — одноцветное затемнение поверх фона (читаемость текста). */
function heroScrimValue(overlay: number): string {
  const alpha = (clamp(overlay, 0, 90) / 100).toFixed(3);
  return `linear-gradient(rgba(0,0,0,${alpha}), rgba(0,0,0,${alpha}))`;
}

/** Яркость основы hero с учётом затемнения (0..1). */
function effectiveLuminance(hero: HeroSettings): number {
  let lum: number;
  switch (hero.mode) {
    case "color":
      lum = relativeLuminance(hero.color);
      break;
    case "gradient":
      lum = relativeLuminance(mixHex(hero.gradientFrom, hero.gradientTo));
      break;
    case "image":
      lum = hero.imageLuminance ?? 0.1;
      break;
    default:
      lum = 0.04; // стандартный тёмный hero
  }
  const dim = 1 - clamp(hero.overlay, 0, 90) / 100;
  return lum * dim;
}

export interface HeroTokens {
  "--el-hero-bg"?: string;
  /** Размер фоновой картинки hero (см. .el-hero): cover/contain по
   *  выбору организатора. Без этого токена остаётся `auto` и обложка
   *  не заполняет блок. */
  "--el-hero-size"?: string;
  "--el-hero-scrim": string;
  "--el-hero-text": string;
  "--el-hero-dim": string;
  "--el-hero-chip-bg": string;
  "--el-hero-chip-text": string;
  "--el-hero-border": string;
}

/**
 * Токены hero: фон, затемнение и производные цвета текста/чипов.
 * Их же использует предпросмотр — он выглядит как настоящая страница.
 */
export function heroTokens(hero: HeroSettings): HeroTokens {
  const bg = heroBackgroundValue(hero);
  // Чёрный текст на светлой основе, белый — на тёмной (порог WCAG).
  const text = effectiveLuminance(hero) > 0.179 ? "#0a0a0a" : "#ffffff";
  const t = text === "#ffffff" ? "255,255,255" : "10,10,10";
  return {
    ...(bg ? { "--el-hero-bg": bg } : {}),
    ...(bg && hero.mode === "image"
      ? { "--el-hero-size": hero.imageFit === "contain" ? "contain" : "cover" }
      : {}),
    "--el-hero-scrim": heroScrimValue(hero.overlay),
    "--el-hero-text": text,
    "--el-hero-dim": `rgba(${t}, 0.62)`,
    "--el-hero-chip-bg": `rgba(${t}, 0.12)`,
    "--el-hero-chip-text": `rgba(${t}, 0.78)`,
    "--el-hero-border": `rgba(${t}, 0.3)`,
  };
}

export type StyleTokens = Record<string, string>;

/** Цель применения токенов: подходит CSSStyleDeclaration и её тест-дубль. */
export interface StyleTokenTarget {
  setProperty(name: string, value: string): void;
  removeProperty(name: string): void;
}

/**
 * Применяет токены оформления и убирает те, что пропали из набора.
 *
 * Без удаления «лишних» переменных смена фона на «Стандарт» не срабатывала:
 * heroTokens перестаёт возвращать --el-hero-bg, но инлайн-значение на
 * :root остаётся с прошлого применения — фон не менялся, пока страница
 * не перезагрузится целиком (переход между проектами в одной вкладке).
 *
 * @param applied имена переменных, выставленных прошлым вызовом
 * @returns имена переменных, выставленных сейчас (передавайте их в
 *          следующий вызов — так отслеживаются «пропавшие»)
 */
export function applyStyleTokens<T extends object>(
  target: StyleTokenTarget,
  tokens: T,
  applied: Iterable<string> = [],
): string[] {
  const names: string[] = [];
  for (const [name, value] of Object.entries(tokens) as Array<[string, string | undefined]>) {
    // heroTokens() не отдаёт ключ вовсе, когда фон стандартный; значение
    // undefined означало бы «снять переменную» — пропускаем.
    if (value === undefined) continue;
    target.setProperty(name, value);
    names.push(name);
  }
  const next = new Set(names);
  for (const name of applied) {
    if (!next.has(name)) target.removeProperty(name);
  }
  return names;
}

/** Токены акцентного цвета: кнопки, ссылки, активные состояния. */
export function accentTokens(accent: string): StyleTokens {
  const color = normalizeHex(accent) ?? "#fd8d2c";
  return {
    "--el-primary": color,
    "--el-accent": color,
    "--el-on-primary": contrastOn(color),
  };
}

/** Полный набор CSS-переменных для оформления (акцент + hero). */
export function brandingTokens(branding: BrandingSettings): StyleTokens {
  return { ...accentTokens(branding.accent), ...heroTokens(branding.hero) };
}

export function settingsEqual<T>(a: T | null | undefined, b: T | null | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}
