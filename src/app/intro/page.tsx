import type { Metadata } from "next";
import { IntroPrototype } from "@/components/intro/IntroPrototype";

/**
 * Изолированный прототип маркетинговой страницы noveee.me.
 *
 * Основной сценарий — корневой маршрут `/`: сплэш → эта страница →
 * кнопка «Войти» → существующий экран авторизации. Маршрут /intro
 * сохранён для прямого доступа и отладки (кнопка «Войти» здесь
 * не подключена к авторизации).
 */
export const metadata: Metadata = {
  title: "noveee.me — Все ваши фотографии. Без бесконечного поиска",
  description:
    "Загрузите селфи, чтобы найти свои снимки с мероприятия. Сервис для участников и организаторов мероприятий.",
  robots: { index: false, follow: false },
};

export default function IntroPage() {
  return <IntroPrototype />;
}
