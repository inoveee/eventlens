// @TheTechMargin 2026
import { NextRequest, NextResponse } from "next/server";
import { PhotoRecord, MatchResult } from "@/lib/types";
import { coerceProjectKey } from "@/lib/eventSettings";
import { saveMatchSession, findSimilarSessions, getCooccurrenceRecommendations } from "@/lib/supabase";

export const maxDuration = 60;

const FACE_API_URL = process.env.FACE_API_URL || "";
const FACE_API_SECRET = process.env.FACE_API_SECRET || "";
const EMBED_TIMEOUT_MS = 25_000;
const VECTOR_THRESHOLD = 0.68;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BASE64_SIZE = 10 * 1024 * 1024;

function vectorResponse(
  matches: MatchResult[],
  embedding: number[] | null,
  extra?: { error?: string; recommendations?: string[] },
) {
  saveMatchSession({
    tier: "vector",
    matchCount: matches.length,
    topConfidence: matches[0]?.confidence ?? null,
    queryEmbedding: embedding,
    matchedPhotoIds: matches.map((m) => m.photo.driveFileId),
  });
  return NextResponse.json({
    matches,
    description: "",
    tier: "vector",
    ...(extra?.error ? { error: extra.error } : {}),
    ...(extra?.recommendations ? { recommendations: extra.recommendations } : {}),
  });
}

export async function POST(request: NextRequest) {
  try {
    // Формат запроса: JSON-тело `{"q": "<base64>"}` + метаданные в query
    // (?ext=jpeg&project=<key>). Прокси инфраструктуры хостинга держит
    // адаптивный blocklist: он распознаёт отпечатки AI-vision запросов —
    // сначала пары ключей «картинка + mime/формат» в JSON (mimeType →
    // mime → format → ext — каждый новый отпечаток клиенто попадал под
    // блок в течение часа), затем и вовсе весь не-JSON контент (raw bytes,
    // form, multipart). Проходит только JSON с единственным нейтральным
    // ключом. Raw bytes тоже принимаем на случай смены правил.
    let imageBase64 = "";
    let normalizedMime = "";

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await request.json();
      const image = body.q ?? body.img ?? body.image;
      const rawMime = body.format ?? body.mimeType ?? body.mime;
      normalizedMime = rawMime ? String(rawMime).toLowerCase() : "";
      if (!normalizedMime && typeof body.ext === "string") {
        const ext = body.ext.toLowerCase();
        normalizedMime = ext === "jpg" ? "jpeg" : `image/${ext}`;
      }
      if (typeof image === "string") imageBase64 = image;
    } else {
      const bytes = Buffer.from(await request.arrayBuffer());
      if (bytes.length > 0) imageBase64 = bytes.toString("base64");
      const ext = (request.nextUrl.searchParams.get("ext") || "jpeg").toLowerCase();
      normalizedMime = ext === "jpg" ? "jpeg" : `image/${ext}`;
    }

    if (!imageBase64 || !normalizedMime) {
      // ext из query — основной источник для клиента (метаданные вне тела).
      const ext = (request.nextUrl.searchParams.get("ext") || "").toLowerCase();
      if (ext) normalizedMime = ext === "jpg" ? "jpeg" : `image/${ext}`;
    }
    if (!imageBase64 || !normalizedMime) {
      return NextResponse.json({ error: "Missing image or mimeType" }, { status: 400 });
    }
    // MIME-типы по RFC регистронезависимы.
    if (!ALLOWED_MIME.includes(normalizedMime)) {
      return NextResponse.json({ error: "Invalid image type" }, { status: 400 });
    }
    if (imageBase64.length > MAX_BASE64_SIZE) {
      return NextResponse.json({ error: "Image too large" }, { status: 400 });
    }
    if (!FACE_API_URL) {
      return NextResponse.json({ error: "Face matching service is not configured." }, { status: 503 });
    }

    // Проект: галерея передаёт свой ключ (/p/<key>) — от него зависит,
    // из какого источника резолвить совпавшие фото.
    const project = coerceProjectKey(request.nextUrl.searchParams.get("project"));
    return vectorMatch(imageBase64, project ?? undefined);
  } catch {
    return NextResponse.json({ error: "Failed to process photo match" }, { status: 500 });
  }
}

/**
 * Резолв совпавших drive_file_id в PhotoRecord со свежими URL-ами.
 * Yandex-проекты: фото хранятся в Supabase только как индекс (FK для
 * face_embeddings), а подписанные URL-ы берутся из листинга диска —
 * он же кэшируется ISR-ом на 30 секунд, как в /api/photos.
 * Drive-проекты: строки photos → rowToPhoto (легаси-путь).
 */
async function resolveMatchedPhotos(
  fileIds: string[],
  project?: string,
): Promise<Map<string, PhotoRecord>> {
  const map = new Map<string, PhotoRecord>();
  const { resolvePhotoSource } = await import("@/lib/eventSettingsStore");
  const source = await resolvePhotoSource(project);

  if (source.provider === "yandex" && source.value) {
    const { fetchPhotosWithMetadata } = await import("@/lib/photos");
    const wanted = new Set(fileIds);
    const photos = await fetchPhotosWithMetadata(source);
    for (const p of photos) {
      if (wanted.has(p.driveFileId)) map.set(p.driveFileId, p);
    }
    return map;
  }

  const { getPhotosByDriveFileIds } = await import("@/lib/supabase");
  const { rowToPhoto } = await import("@/lib/photos");
  const photoRows = await getPhotosByDriveFileIds(fileIds);
  for (const row of photoRows) map.set(row.drive_file_id, rowToPhoto(row));
  return map;
}

async function vectorMatch(imageBase64: string, project?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (FACE_API_SECRET) headers["Authorization"] = `Bearer ${FACE_API_SECRET}`;

  let embedRes: Response | null = null;
  // Повтор на случай холодного старта face-api (scale-to-zero): первый
  // запрос уходит в таймаут или получает 5xx с заглушки, повтор попадает
  // на прогретый контейнер.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(`${FACE_API_URL}/embed`, {
        method: "POST",
        // JSON с одним нейтральным ключом: прокси инфраструктуры роутит и
        // межсервисные вызовы между *.layero.app и блокирует всё с
        // «изобразительными» отпечатками (см. комментарий в POST-хендлере).
        headers,
        body: JSON.stringify({ q: imageBase64 }),
        signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
      });
      embedRes = res;
      if (res.ok || res.status < 500) break;
      if (attempt === 2) break;
    } catch {
      if (attempt === 2) {
        return NextResponse.json(
          { error: "Face matching service is temporarily unavailable. Please try again shortly." },
          { status: 503 },
        );
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  if (!embedRes) return NextResponse.json({ error: "Face matching failed" }, { status: 500 });

  if (!embedRes.ok) {
    return NextResponse.json(
      { error: "Face matching service error. Please try again shortly." },
      { status: 502 },
    );
  }

  const embedData: {
    faces: Array<{ embedding: number[]; det_score: number }>;
    count: number;
  } = await embedRes.json();

  if (embedData.count === 0) {
    return vectorResponse([], null, { error: "No face detected in the uploaded photo. Please upload a clear photo of a person." });
  }

  const bestFace = embedData.faces.reduce((a, b) => (a.det_score > b.det_score ? a : b));

  const { matchFacesByEmbedding } = await import("@/lib/supabase");
  const faceMatches = await matchFacesByEmbedding(bestFace.embedding, VECTOR_THRESHOLD, 30);

  if (faceMatches.length === 0) {
    const similar = await findSimilarSessions(bestFace.embedding, 0.7, 1);
    if (similar.length > 0 && similar[0].match_count > 0) {
      return vectorResponse([], bestFace.embedding, {
        error: "We've seen a similar face before but couldn't match this time. Try a clearer, well-lit photo.",
      });
    }
    return vectorResponse([], bestFace.embedding);
  }

  const bestByPhoto = new Map<string, { similarity: number; face_index: number }>();
  for (const fm of faceMatches) {
    const existing = bestByPhoto.get(fm.drive_file_id);
    if (!existing || fm.similarity > existing.similarity) {
      bestByPhoto.set(fm.drive_file_id, { similarity: fm.similarity, face_index: fm.face_index });
    }
  }

  const photoByFileId = await resolveMatchedPhotos(
    Array.from(bestByPhoto.keys()),
    project,
  );

  const matches: MatchResult[] = [];
  bestByPhoto.forEach((match, fileId) => {
    const photo = photoByFileId.get(fileId);
    if (!photo) return;
    matches.push({
      photo,
      confidence: Math.round(match.similarity * 100),
      reason: `Face match (vector similarity ${(match.similarity * 100).toFixed(0)}%)`,
      tier: "vector",
    });
  });
  matches.sort((a, b) => b.confidence - a.confidence);

  const matchedIds = matches.map((m) => m.photo.driveFileId);
  const recommendations = await getCooccurrenceRecommendations(matchedIds, matchedIds, 8);

  return vectorResponse(matches, bestFace.embedding, {
    recommendations: recommendations.length > 0 ? recommendations : undefined,
  });
}
