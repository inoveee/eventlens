// @TheTechMargin 2026
// Стартовый экран продукта: после сплэша гостям показывается маркетинговая
// страница, экран авторизации открывается по кнопке «Войти», а вошедший
// организатор сразу попадает к списку проектов. Отсюда организатор уходит
// в настройки мероприятия, а посетители — в публичную галерею /p/<key>.

import type { Metadata } from "next";
import { OrganizerAuthProvider } from "@/hooks/organizer/OrganizerContext";
import SplashGate from "@/components/SplashGate";
import StartScreen from "@/components/StartScreen";

export const metadata: Metadata = {
  title: "noveee.me — Все ваши фотографии. Без бесконечного поиска",
  description:
    "Загрузите селфи, чтобы найти свои снимки с мероприятия. Сервис для участников и организаторов мероприятий.",
  robots: { index: false, follow: false },
};

export default function HomePage() {
  return (
    <OrganizerAuthProvider>
      <SplashGate>
        <StartScreen />
      </SplashGate>
    </OrganizerAuthProvider>
  );
}
