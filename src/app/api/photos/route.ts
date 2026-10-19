// @TheTechMargin 2026
import { NextRequest, NextResponse } from "next/server";
import { fetchPhotosWithMetadata, getFolders, getTags } from "@/lib/photos";
import { resolvePhotoSource } from "@/lib/eventSettingsStore";
import { coerceProjectKey } from "@/lib/eventSettings";

// Каждые 60с: на холодном кэше полный обход папки Яндекса (5 страниц,
// теперь параллельных, ~2с). Новые фото гости видят в пределах минуты —
// клиент опрашивает этот же роут каждые 30с.
export const revalidate = 60;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit")) || 0;
    const offset = Number(searchParams.get("offset")) || 0;
    // Проект: /p/<key> на публичной странице; без параметра — «default».
    const project = coerceProjectKey(searchParams.get("project"));
    if (project === null) {
      return NextResponse.json({ error: "Некорректный ключ проекта" }, { status: 400 });
    }

    const source = await resolvePhotoSource(project);

    // Проект без подключённой папки — пустая галерея вместо запроса
    // к диску (env-фолбэк действует только для легаси-проекта «default»).
    if (!source.value) {
      return NextResponse.json({
        photos: [],
        folders: [],
        tags: [],
        lastUpdated: "",
        total: 0,
        hasMore: false,
      });
    }

    const allPhotos = await fetchPhotosWithMetadata(source, project);
    const folders = getFolders(allPhotos);
    const tags = getTags(allPhotos);
    const total = allPhotos.length;

    // If limit is specified, return a slice; otherwise return all photos.
    // ISR cache (revalidate: 60) means the full fetch only runs every 60s.
    // Progressive DOM rendering via IntersectionObserver handles the frontend perf.
    const photos = limit > 0 ? allPhotos.slice(offset, offset + limit) : allPhotos;

    const lastUpdated =
      allPhotos.length > 0
        ? allPhotos.reduce((latest, p) => {
            const t = p.processedAt;
            return t > latest ? t : latest;
          }, allPhotos[0].processedAt)
        : "";

    return NextResponse.json({
      photos,
      folders,
      tags,
      lastUpdated,
      total,
      hasMore: limit > 0 ? offset + limit < total : false,
    });
  } catch (error) {
    console.error("[/api/photos] failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch photos" },
      { status: 500 }
    );
  }
}
