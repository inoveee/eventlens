// @TheTechMargin 2026
// Стартовый экран продукта: вход организатора и список его проектов.
// Отсюда организатор попадает в настройки мероприятия, а посетители —
// в публичную галерею проекта по адресу /p/<key>.

import type { Metadata } from "next";
import { OrganizerAuthProvider } from "@/hooks/organizer/OrganizerContext";
import ProjectsScreen from "@/app/organizer/components/ProjectsScreen";

export const metadata: Metadata = {
  title: "Мои проекты — noveee.me",
  description: "Управляйте мероприятиями, фотографиями и оформлением страниц.",
  robots: { index: false, follow: false },
};

export default function HomePage() {
  return (
    <OrganizerAuthProvider>
      <ProjectsScreen />
    </OrganizerAuthProvider>
  );
}
