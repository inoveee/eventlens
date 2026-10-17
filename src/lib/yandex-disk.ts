// Yandex Disk public-folder client.
// Reads a shared folder by its public link — no OAuth token required.
// API: https://cloud-api.yandex.net/v1/disk/public/resources?public_key=…

export interface YandexFile {
  path: string; // "/IMG_0002.jpg" — unique within the shared folder
  name: string;
  mimeType: string;
  mediaType: string; // "image" | "video" | …
  modified?: string;
  size: number;
  /** Direct URLs for preview sizes (S…XXL) plus ORIGINAL. */
  sizes: Array<{ name: string; url: string }>;
  /** Universal preview link from the API — present even when `sizes` is
   *  empty (fresh uploads, videos), so the grid never falls back to «+». */
  preview?: string;
}

export interface YandexFolder {
  path: string;
  name: string;
}

interface FetchOpts {
  revalidate?: number;
}

function fetchInit(opts?: FetchOpts): RequestInit {
  if (!opts?.revalidate) return {};
  return { next: { revalidate: opts.revalidate } } as RequestInit;
}

const API = "https://cloud-api.yandex.net/v1/disk/public/resources";
const PAGE_SIZE = 200;

/** Accepts full share links (https://disk.yandex.ru/d/…) and short ones (yadi.sk/d/…). */
export function normalizePublicKey(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

export function isYandexConfigured(url: string): boolean {
  return !!normalizePublicKey(url);
}

interface YandexResourceItem {
  type: string;
  path: string;
  name: string;
  mime_type?: string;
  media_type?: string;
  modified?: string;
  size?: number;
  sizes?: Array<{ name: string; url: string }>;
  preview?: string;
}

interface YandexResourceResponse {
  type: string;
  name: string;
  _embedded?: {
    total?: number;
    items?: YandexResourceItem[];
  };
}

/** Lists one level of a shared folder (files only) with pagination.
 *  The first page reveals the total; the remaining pages are fetched in
 *  PARALLEL — for a 999-photo folder that's 5 sequential roundtrips
 *  (~5-6s on cold cache) versus one plus a parallel slot (~2s). */
export async function listYandexImages(
  publicKey: string,
  path = "/",
  opts?: FetchOpts,
): Promise<YandexFile[]> {
  const key = normalizePublicKey(publicKey);
  if (!key) return [];

  const pageUrl = (offset: number) =>
    `${API}?public_key=${encodeURIComponent(key)}&path=${encodeURIComponent(path)}&limit=${PAGE_SIZE}&offset=${offset}`;

  const toFiles = (items: YandexResourceItem[]): YandexFile[] =>
    items
      .filter(
        (i) =>
          i.type === "file" &&
          (i.media_type === "image" || i.media_type === "video"),
      )
      .map((item) => ({
        path: item.path,
        name: item.name,
        mimeType: item.mime_type || "",
        mediaType: item.media_type || "",
        modified: item.modified,
        size: item.size || 0,
        sizes: item.sizes || [],
        preview: item.preview || "",
      }));

  try {
    const first = await fetch(pageUrl(0), fetchInit(opts));
    if (!first.ok) return [];
    const firstData: YandexResourceResponse = await first.json();
    const embedded = firstData._embedded;
    if (!embedded) return [];

    const files = toFiles(embedded.items || []);
    const total = embedded.total ?? 0;

    const restOffsets: number[] = [];
    for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) {
      restOffsets.push(offset);
    }
    if (restOffsets.length > 0) {
      const pages = await Promise.all(
        restOffsets.map(async (offset) => {
          const res = await fetch(pageUrl(offset), fetchInit(opts));
          if (!res.ok) return [];
          const data: YandexResourceResponse = await res.json();
          return data._embedded?.items || [];
        }),
      );
      for (const items of pages) files.push(...toFiles(items));
    }

    return files;
  } catch (err) {
    console.error("[yandex-disk] listYandexImages failed:", err);
    return [];
  }
}

/** Lists subfolders of a shared folder level. */
export async function listYandexSubfolders(
  publicKey: string,
  path = "/",
  opts?: FetchOpts,
): Promise<YandexFolder[]> {
  const key = normalizePublicKey(publicKey);
  if (!key) return [];

  try {
    const url = `${API}?public_key=${encodeURIComponent(key)}&path=${encodeURIComponent(path)}&limit=${PAGE_SIZE}`;
    const res = await fetch(url, fetchInit(opts));
    if (!res.ok) return [];

    const data: YandexResourceResponse = await res.json();
    const items = data._embedded?.items || [];
    return items
      .filter((i) => i.type === "dir")
      .map((i) => ({ path: i.path, name: i.name }));
  } catch (err) {
    console.error("[yandex-disk] listYandexSubfolders failed:", err);
    return [];
  }
}

/**
 * Picks the best available size URL: prefers the named size, falls back down
 * the chain, then ORIGINAL, then any size.
 */
export function pickSizeUrl(
  sizes: Array<{ name: string; url: string }>,
  preferred: string[],
): string {
  for (const name of preferred) {
    const hit = sizes.find((s) => s.name === name);
    if (hit) return hit.url;
  }
  const original = sizes.find((s) => s.name === "ORIGINAL");
  if (original) return original.url;
  return sizes[0]?.url || "";
}

/** Thumbnail for grid cards (~640px, matches Drive's w640).
 *  `sizes` is preferred; when it's empty the API's `preview` link keeps
 *  the card from rendering as a permanent «+» placeholder. */
export function yandexThumbUrl(file: YandexFile): string {
  return pickSizeUrl(file.sizes, ["XL", "L", "M"]) || file.preview || "";
}

/** Full-size URL for the lightbox (~1024px+, matches Drive's w1200). */
export function yandexFullsizeUrl(file: YandexFile): string {
  return pickSizeUrl(file.sizes, ["XXL", "XL", "ORIGINAL"]);
}

/** Original file URL for downloads. */
export function yandexOriginalUrl(file: YandexFile): string {
  return pickSizeUrl(file.sizes, ["ORIGINAL", "XXL"]);
}

/**
 * Resolves a one-time download href via the official API.
 * The href serves the file with `Content-Disposition: attachment`.
 */
export async function fetchYandexDownloadHref(
  publicKey: string,
  path: string,
): Promise<string | null> {
  const key = normalizePublicKey(publicKey);
  if (!key || !path.startsWith("/") || path.includes("..")) return null;
  try {
    const url = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(key)}&path=${encodeURIComponent(path)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: { href?: string } = await res.json();
    return data.href || null;
  } catch {
    return null;
  }
}
