// @TheTechMargin 2026
// Авторизация организатора для всех маршрутов панели (/organizer/*):
// стартовый экран «Мои проекты» живёт на «/» и оборачивает себя сам,
// а настройки проекта вложены сюда. Панель не индексируется.

import type { Metadata } from "next";
import { OrganizerAuthProvider } from "@/hooks/organizer/OrganizerContext";

export const metadata: Metadata = {
  title: "Панель организатора — noveee.me",
  robots: { index: false, follow: false },
};

export default function OrganizerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <OrganizerAuthProvider>{children}</OrganizerAuthProvider>;
}
