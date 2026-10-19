// @TheTechMargin 2026
// Выход посетителя из галереи: снимает guest-cookie разблокированных
// проектов. Старый cookie «auth» тоже удаляем — чистим легаси-край.
import { NextResponse } from "next/server";
import { clearGalleryAccessCookie } from "@/lib/galleryAuth";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ success: true });
  clearGalleryAccessCookie(response);
  response.cookies.delete("auth");
  return response;
}
