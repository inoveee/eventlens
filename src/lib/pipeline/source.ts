// @TheTechMargin 2026
// Источник фото для пайплайна: Google Drive или Яндекс.Диск.
// Раньше фазы были жёстко привязаны к Drive-эндпоинтам, из-за чего
// проекты с Яндекс.Диском нельзя было проингестить. Теперь фазы
// работают через этот интерфейс, а провайдер выбирается по проекту.

import {
  listDriveImages,
  listDriveSubfolders,
  downloadAsBase64,
} from "./drive-client";
import {
  listYandexImages,
  listYandexSubfolders,
  pickSizeUrl,
} from "@/lib/yandex-disk";

export interface PipelineFile {
  /** Drive-id или путь в папке Яндекса ("/IMG_001.jpg") — канонический id. */
  id: string;
  name: string;
  folder: string;
  mimeType: string;
  mediaType: string; // "image" | "video" | …
}

export interface PipelineSource {
  provider: "drive" | "yandex";
  /** Все изображения (и видео — их фазы пропускают) корня + подпапок. */
  listImages(): Promise<PipelineFile[]>;
  /** Файл base64. width — желаемый размер превью (для phash достаточно 64). */
  download(id: string, width?: number): Promise<{ base64: string; mimeType: string } | null>;
  /** Ссылка на оригинал для строки photos.drive_url. */
  publicUrl(id: string): string;
}

/* ───────────────────────────── Drive ───────────────────────────── */

export function driveSource(apiKey: string, folderId: string): PipelineSource {
  return {
    provider: "drive",
    async listImages() {
      const subfolders = await listDriveSubfolders(folderId, apiKey);
      const allFolders = [{ id: folderId, name: "" }, ...subfolders];
      const files: PipelineFile[] = [];
      for (const folder of allFolders) {
        const listed = await listDriveImages(folder.id, apiKey);
        for (const f of listed) {
          files.push({
            id: f.id,
            name: f.name,
            folder: folder.name,
            mimeType: f.mimeType || "",
            mediaType: (f.mimeType || "").startsWith("video/") ? "video" : "image",
          });
        }
      }
      return files;
    },
    download(id: string, width = 1200) {
      return downloadAsBase64(id, apiKey, width);
    },
    publicUrl(id: string) {
      return `https://drive.google.com/file/d/${id}/view`;
    },
  };
}

/* ─────────────────────────── Яндекс.Диск ─────────────────────────── */

const YANDEX_API = "https://cloud-api.yandex.net/v1/disk/public/resources";

export function yandexSource(publicKey: string): PipelineSource {
  // Размеры превью приходят только из листинга — кэшируем его на время
  // жизни инстанса (фаза = один инстанс), чтобы download не дёргал API.
  let sizeById: Map<string, { sizes: Array<{ name: string; url: string }>; mimeType: string }> | null = null;

  async function ensureListing() {
    if (sizeById) return sizeById;
    const subfolders = await listYandexSubfolders(publicKey);
    const paths = ["/", ...subfolders.map((f) => f.path)];
    const map = new Map<string, { sizes: Array<{ name: string; url: string }>; mimeType: string }>();
    for (const path of paths) {
      const files = await listYandexImages(publicKey, path);
      for (const f of files) {
        map.set(f.path, { sizes: f.sizes, mimeType: f.mimeType || "" });
      }
    }
    sizeById = map;
    return map;
  }

  return {
    provider: "yandex",
    async listImages() {
      const subfolders = await listYandexSubfolders(publicKey);
      const paths = [{ path: "/", name: "" }, ...subfolders];
      const files: PipelineFile[] = [];
      for (const folder of paths) {
        const listed = await listYandexImages(publicKey, folder.path);
        for (const f of listed) {
          files.push({
            id: f.path,
            name: f.name,
            folder: folder.name,
            mimeType: f.mimeType || "",
            mediaType: f.mediaType || "",
          });
        }
      }
      return files;
    },
    async download(id: string, width = 1200) {
      const listing = await ensureListing();
      const entry = listing.get(id);
      // XXL ≈ 2048px — для buffalo_l с запасом; оригиналы по 5-6 МБ
      // не качаем вообще. width=64 (phash) берёт маленькое превью.
      const preferred =
        width <= 128 ? ["M", "L", "XL"] : width <= 1200 ? ["XL", "XXL"] : ["XXL", "XL"];
      const url = entry ? pickSizeUrl(entry.sizes, preferred) : "";
      if (!url) {
        // Свежезалитые файлы без sizes — один ресурсный запрос напрямую.
        try {
          const res = await fetch(
            `${YANDEX_API}?public_key=${encodeURIComponent(publicKey)}&path=${encodeURIComponent(id)}&preview_size=XXL`,
          );
          if (!res.ok) return null;
          const data = await res.json();
          const preview: string = data.preview || "";
          if (!preview) return null;
          const imgRes = await fetch(preview);
          if (!imgRes.ok) return null;
          const buf = Buffer.from(await imgRes.arrayBuffer());
          return {
            base64: buf.toString("base64"),
            mimeType: data.mime_type || "image/jpeg",
          };
        } catch {
          return null;
        }
      }
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        return {
          base64: buf.toString("base64"),
          mimeType: entry?.mimeType || res.headers.get("content-type") || "image/jpeg",
        };
      } catch {
        return null;
      }
    },
    publicUrl() {
      // Гость резолвит фото через листинг папки (/api/photos), а не по
      // drive_url — храним саму публичную ссылку как справочную.
      return publicKey;
    },
  };
}
