// @TheTechMargin 2026
// Оболочка настроек одного проекта: боковая навигация, верхняя панель
// со статусом публикации и действиями, уведомления. Панель не
// индексируется поисковиками.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isProjectKey } from "@/lib/eventSettings";
import { projectExists } from "@/lib/eventSettingsStore";
import { OrganizerProvider } from "@/hooks/organizer/OrganizerContext";
import OrganizerShell from "../../components/OrganizerShell";

export const metadata: Metadata = {
  title: "Панель организатора — noveee.me",
  robots: { index: false, follow: false },
};

export default async function ProjectLayout({
  params,
  children,
}: Readonly<{ params: Promise<{ key: string }>; children: React.ReactNode }>) {
  const { key } = await params;
  if (!isProjectKey(key)) notFound();
  if (!(await projectExists(key))) notFound();

  return (
    <OrganizerProvider projectKey={key}>
      <OrganizerShell>{children}</OrganizerShell>
    </OrganizerProvider>
  );
}
