// @TheTechMargin 2026
// Предпросмотр публичной страницы. Собирается из тех же классов, что и
// настоящая страница (el-hero, --el-* токены, pill-кнопки), поэтому
// совпадает с ней по фону, логотипу, акцентам и типографике.
// Миниатюры — реальные фотографии подключённой папки.

"use client";

import { useEffect, useState } from "react";
import {
  EventSettings,
  brandingTokens,
} from "@/lib/eventSettings";
import { withProjectParam } from "@/lib/project";
import { useOrganizer } from "@/hooks/organizer/OrganizerContext";
import { splitFirstSentence } from "@/lib/utils";

type Viewport = "desktop" | "mobile";

interface PreviewPhoto {
  id: string;
  filename: string;
  thumbnailUrl: string;
}

export default function PagePreview({
  settings,
  mode,
}: {
  settings: EventSettings;
  mode: "draft" | "published";
}) {
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [photos, setPhotos] = useState<PreviewPhoto[] | null>(null);
  const [folders, setFolders] = useState<string[]>([]);
  const { projectKey } = useOrganizer();

  // Логотип организатора заменяет иконку платформы и в предпросмотре.
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const logo = settings.branding.logo;
  const showLogo = !!logo && failedLogo !== logo;

  useEffect(() => {
    let cancelled = false;
    fetch(withProjectParam("/api/photos?limit=8", projectKey))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setPhotos((data.photos as PreviewPhoto[]) || []);
        setFolders(((data.folders as string[]) || []).filter(
          (f) => f && !/^(root|all)$/i.test(f),
        ));
      })
      .catch(() => {
        if (!cancelled) setPhotos([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectKey]);

  const tokens = brandingTokens(settings.branding) as React.CSSProperties;
  const { first, rest } = splitFirstSentence(settings.text.statement);
  const accent = settings.branding.accent;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--org-faint)]">
            Предпросмотр
          </span>
          <span className={`org-pill ${mode === "draft" ? "org-pill-warn" : "org-pill-ok"}`}>
            {mode === "draft" ? "Черновик" : "Опубликовано"}
          </span>
        </div>
        <div className="org-seg" role="tablist" aria-label="Размер окна">
          <button
            type="button"
            data-active={viewport === "desktop" ? "true" : "false"}
            onClick={() => setViewport("desktop")}
            role="tab"
            aria-selected={viewport === "desktop"}
          >
            Компьютер
          </button>
          <button
            type="button"
            data-active={viewport === "mobile" ? "true" : "false"}
            onClick={() => setViewport("mobile")}
            role="tab"
            aria-selected={viewport === "mobile"}
          >
            Телефон
          </button>
        </div>
      </div>

      <div
        className={`org-preview-frame ${viewport === "mobile" ? "mx-auto w-[330px] max-w-full" : "w-full"}`}
        style={tokens}
      >
        {/* Адресная строка — обозначает, что это страница посетителя */}
        <div className="org-preview-chrome">
          <span className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-[#e4e4e9]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#e4e4e9]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#e4e4e9]" />
          </span>
          <span className="truncate rounded-full bg-[#f0f0f3] px-3 py-1 text-[11px] text-[var(--org-dim)]">
            noveee.me
          </span>
        </div>

        <div className="org-scroll-y h-[560px]">
          {/* ── Верхняя часть страницы ── */}
          <div className="el-hero">
            <div className="px-5 pb-9 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  {showLogo && logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logo}
                      alt={settings.text.name}
                      className="h-7 w-auto object-contain md:h-9"
                      onError={() => setFailedLogo(logo)}
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src="/noveee-icon.png" alt="noveee.me" className="h-6 w-auto md:h-8" />
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-[var(--el-hero-chip-bg)] px-2.5 py-1 text-[10px] text-[var(--el-hero-chip-text)]">
                  {photos && photos.length > 0 ? `${photos.length} фото` : "Загрузка…"}
                </span>
              </div>

              <div className="mt-6 max-w-[92%] md:mt-10">
                <h1 className="text-[clamp(1.35rem,6.5cqi,2.75rem)] font-black uppercase leading-[0.95] tracking-[-0.02em] text-[var(--el-hero-text)]">
                  {settings.text.name}
                </h1>
                <p className="mt-2.5 text-[clamp(0.72rem,3cqi,1.3rem)] font-semibold leading-snug tracking-[-0.01em] text-[var(--el-hero-text)]">
                  {first}
                  {rest && (
                    <>
                      {" "}
                      <span style={{ color: "var(--el-primary)" }}>{rest}</span>
                    </>
                  )}
                </p>
                <p className="mt-2 max-w-[85%] text-[clamp(0.6rem,2.1cqi,0.9rem)] leading-relaxed text-[var(--el-hero-dim)]">
                  {settings.text.description}
                </p>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[clamp(0.6rem,2.2cqi,0.85rem)] font-semibold"
                  style={{
                    background: "var(--el-primary)",
                    color: "var(--el-on-primary)",
                  }}
                >
                  Найти мои фото
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/15">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="4" y1="12" x2="19" y2="12" />
                      <polyline points="13 6 19 12 13 18" />
                    </svg>
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--el-hero-chip-bg)] px-3 py-1.5 text-[clamp(0.55rem,2cqi,0.8rem)] text-[var(--el-hero-chip-text)]">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: accent }}
                    aria-hidden
                  />
                  Селфи — только для поиска
                </span>
              </div>
            </div>
          </div>

          {/* ── Галерея ── */}
          <div className="bg-[var(--el-bg)] px-4 py-5 md:px-6">
            <div className="scrollbar-hide mb-3 flex gap-1.5 overflow-x-auto">
              {["Все", ...folders.slice(0, 3)].map((folder, index) => (
                <span
                  key={folder}
                  className="shrink-0 rounded-full px-3 py-1 text-[clamp(0.55rem,1.9cqi,0.78rem)] font-medium"
                  style={
                    index === 0
                      ? {
                          background: "var(--el-primary)",
                          color: "var(--el-on-primary)",
                        }
                      : {
                          background: "var(--el-surface)",
                          color: "var(--el-text-dim)",
                          border: "1px solid color-mix(in srgb, var(--el-text) 10%, transparent)",
                        }
                  }
                >
                  {folder}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {photos && photos.length > 0
                ? photos.slice(0, 6).map((photo) => (
                    <div
                      key={photo.id}
                      className="aspect-square overflow-hidden rounded-xl bg-[var(--el-surface)]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.thumbnailUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))
                : Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className="skeleton-terminal aspect-square"
                      style={{ "--delay": `${index * 0.12}s` } as React.CSSProperties}
                    />
                  ))}
            </div>

            <div className="mt-5 flex justify-center">
              <span
                className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[clamp(0.58rem,2cqi,0.82rem)] font-semibold"
                style={{
                  background: "var(--el-primary)",
                  color: "var(--el-on-primary)",
                }}
              >
                Смотреть все фото
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/15">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="4" y1="12" x2="19" y2="12" />
                    <polyline points="13 6 19 12 13 18" />
                  </svg>
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="org-hint mt-2.5">
        {mode === "draft"
          ? "Черновик — посетители увидят его после публикации."
          : "Так страницу видят посетители прямо сейчас."}
      </p>
    </div>
  );
}
