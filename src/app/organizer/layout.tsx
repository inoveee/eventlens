// @TheTechMargin 2026
// Оболочка раздела организатора. Панель не индексируется поисковиками.

import type { Metadata } from "next";
import { OrganizerProvider } from "@/hooks/organizer/OrganizerContext";
import OrganizerShell from "./components/OrganizerShell";

export const metadata: Metadata = {
  title: "Панель организатора — noveee.me",
  robots: { index: false, follow: false },
};

export default function OrganizerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <OrganizerProvider>
      <OrganizerShell>{children}</OrganizerShell>
    </OrganizerProvider>
  );
}
