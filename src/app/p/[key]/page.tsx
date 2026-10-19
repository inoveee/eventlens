// @TheTechMargin 2026
// Публичная галерея проекта: /p/<key>. Показывает только опубликованную
// версию настроек — черновики остаются в панели организатора.
// Неизвестный, неопубликованный или деактивированный ключ — 404.
//
// Пароль-защищённые галереи: если у проекта задан пароль, а посетитель
// ещё не ввёл его (нет валидного guest-cookie) — рендерим гейт вместо
// галереи. Whitelabel-флаг из БД управляет credit-строкой в Footer.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { cookies } from "next/headers";
import PhotoGallery from "@/components/gallery/PhotoGallery";
import GalleryGate from "@/components/gallery/GalleryGate";
import GridSkeleton from "@/components/gallery/GridSkeleton";
import EventSettingsProvider from "@/components/EventSettingsProvider";
import Footer from "@/components/Footer";
import { isProjectKey } from "@/lib/eventSettings";
import {
  projectExists,
  readPublished,
  readProjectAccess,
} from "@/lib/eventSettingsStore";
import { GALLERY_COOKIE, isProjectUnlocked, verifyGalleryAccess } from "@/lib/galleryAuth";

export const dynamic = "force-dynamic";

const eventName = process.env.NEXT_PUBLIC_EVENT_NAME || "Фотогалерея";
const eventTagline =
  process.env.NEXT_PUBLIC_EVENT_TAGLINE || "Найдите себя на снимках мероприятия";

interface ProjectPageProps {
  params: Promise<{ key: string }>;
}

async function resolveProject(key: string) {
  if (!isProjectKey(key)) return null;
  if (!(await projectExists(key))) return null;
  const published = await readPublished(key);
  const access = await readProjectAccess(key);
  return {
    name: published?.text.name || eventName,
    tagline: published?.text.tagline || eventTagline,
    published,
    access,
  };
}

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { key } = await params;
  const project = await resolveProject(key);
  if (!project) return {};
  return {
    title: `${project.name} — Найдите свои фото`,
    description: project.tagline,
    openGraph: {
      title: `${project.name} — Найдите свои фото`,
      description: project.tagline,
    },
  };
}

export default async function PublicProjectPage({ params }: ProjectPageProps) {
  const { key } = await params;
  const project = await resolveProject(key);
  if (!project) notFound();

  // Деактивированный проект не отдаёт галерею — как будто его нет.
  if (!project.access.isActive) notFound();

  // Пароль задан и посетитель его не прошёл → гейт.
  const hasPassword = project.access.galleryPasswordHash !== null;
  let unlocked = false;
  if (hasPassword) {
    const token = (await cookies()).get(GALLERY_COOKIE)?.value;
    const access = token ? await verifyGalleryAccess(token) : null;
    unlocked = isProjectUnlocked(access, key);
  }

  return (
    <EventSettingsProvider projectKey={key} initialSettings={project.published}>
      {hasPassword && !unlocked ? (
        <GalleryGate projectKey={key} />
      ) : (
        <>
          <Suspense
            fallback={
              <div className="min-h-screen bg-[var(--el-bg)]">
                <GridSkeleton />
              </div>
            }
          >
            <PhotoGallery />
          </Suspense>
          <Footer whitelabel={project.access.whitelabelEnabled} />
        </>
      )}
    </EventSettingsProvider>
  );
}
