// @TheTechMargin 2026
"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PhotoRecord } from "@/lib/types";

export function useUrlSync(params: {
  search?: string;
  folder?: string;
  selectedPhoto?: PhotoRecord | null;
}): void {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const urlParams = new URLSearchParams();
    if (params.search) urlParams.set("q", params.search);
    if (params.folder) urlParams.set("folder", params.folder);
    if (params.selectedPhoto) urlParams.set("photo", params.selectedPhoto.filename);

    // Чужие параметры (например, preview=1 у предпросмотра) сохраняем —
    // иначе первая же синхронизация адреса выключит предпросмотр.
    const kept = new URLSearchParams(window.location.search);
    for (const key of ["q", "folder", "photo"]) kept.delete(key);
    kept.forEach((value, key) => urlParams.set(key, value));

    const str = urlParams.toString();
    // Пустые параметры — остаёмся на текущем адресе: публичная галерея
    // живёт на /p/<key>, а не на корневом экране организатора.
    router.replace(str ? `?${str}` : pathname, { scroll: false });
  }, [params.search, params.folder, params.selectedPhoto, router, pathname]);
}
