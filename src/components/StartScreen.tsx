// @TheTechMargin 2026
// Логика стартового экрана после сплэша:
//   1. Для гостей (и впервые пришедших) — маркетинговая страница.
//   2. Экран авторизации открывается только по кнопке «Войти».
//   3. Уже вошедший организатор после сплэша сразу попадает в проекты —
//      промежуточный экран для него не показывается.

"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrganizerAuth } from "@/hooks/organizer/OrganizerContext";
import ProjectsScreen from "@/app/organizer/components/ProjectsScreen";
import { IntroPrototype } from "@/components/intro/IntroPrototype";

export default function StartScreen() {
  const { checking, authenticated } = useOrganizerAuth();
  // "intro" — маркетинговая страница, "app" — существующий сценарий
  // «вход → мои проекты» (экран авторизации показывает OrganizerAuthGate).
  const [stage, setStage] = useState<"intro" | "app">("intro");

  // Сессия уже восстановлена — организатору промежуточный экран не нужен.
  useEffect(() => {
    if (!checking && authenticated && stage === "intro") setStage("app");
  }, [checking, authenticated, stage]);

  // Кнопка «Войти» раньше только меняла stage — история браузера не
  // пополнялась, и «назад» с экрана авторизации ничего не делал (или
  // уносил с сайта). Теперь вход пушит запись {screen:"auth"}; popstate
  // возвращает на интро (Forward — снова на вход). Reload на входе
  // восстанавливает stage из history.state.
  useEffect(() => {
    if (history.state?.screen === "auth") setStage("app");
    const onPopState = () => {
      setStage(history.state?.screen === "auth" ? "app" : "intro");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const openLogin = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    if (history.state?.screen !== "auth") {
      history.pushState({ screen: "auth" }, "", window.location.href);
    }
    setStage("app");
  }, []);

  if (stage === "app") return <ProjectsScreen />;
  return <IntroPrototype onLogin={openLogin} />;
}
