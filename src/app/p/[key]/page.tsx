// @TheTechMargin 2026
// Публичная галерея проекта: /p/<key>. Показывает только опубликованную
// версию настроек — черновики остаются в панели организатора.
// Неизвестный или неопубликованный ключ — 404, а не «стандартная»
// галерея под чужим адресом.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import PhotoGallery from "@/components/gallery/PhotoGallery";
import GridSkeleton from "@/components/gallery/GridSkeleton";
import EventSettingsProvider from "@/components/EventSettingsProvider";
import Footer from "@/components/Footer";
import { isProjectKey } from "@/lib/eventSettings";
import { projectExists, readPublished } from "@/lib/eventSettingsStore";

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
  return {
    name: published?.text.name || eventName,
    tagline: published?.text.tagline || eventTagline,
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

  return (
    <EventSettingsProvider projectKey={key}>
      <Suspense
        fallback={
          <div className="min-h-screen bg-[var(--el-bg)]">
            <GridSkeleton />
          </div>
        }
      >
        <PhotoGallery />
      </Suspense>
      <Footer />
    </EventSettingsProvider>
  );
}
