// Browser download endpoint for Yandex Disk photos.
// The public sizes URLs serve files inline; the official download endpoint
// returns an href with `Content-Disposition: attachment`, which we redirect to.

import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { fetchYandexDownloadHref } from "@/lib/yandex-disk";

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path") || "";

  if (!config.yandexDiskUrl) {
    return NextResponse.json({ error: "Yandex Disk is not configured" }, { status: 503 });
  }

  const href = await fetchYandexDownloadHref(config.yandexDiskUrl, path);
  if (!href) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  return NextResponse.redirect(href, 307);
}
