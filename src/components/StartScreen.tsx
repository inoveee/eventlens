// @TheTechMargin 2026
// Логика стартового экрана после сплэша:
//   1. Для гостей (и впервые пришедших) — маркетинговая страница.
//   2. Экран авторизации открывается только по кнопке «Войти».
//   3. Уже вошедший организатор после сплэша сразу попадает в проекты —
//      промежуточный экран для него не показывается.

"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useOrganizerAuth } from "@/hooks/organizer/OrganizerContext";
import ProjectsScreen from "@/app/organizer/components/ProjectsScreen";
import { IntroPrototype } from "@/components/intro/IntroPrototype";

// На сервере useLayoutEffect недоступен; в браузере flip stage идёт до
// первой отрисовки — вошедший организатор не видит кадра интро.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function StartScreen() {
  const { checking, authenticated } = useOrganizerAuth();
  // "intro" — маркетинговая страница, "app" — существующий сценарий
  // «вход → мои проекты» (экран авторизации показывает OrganizerAuthGate).
  const [stage, setStage] = useState<"intro" | "app">("intro");

  // Сессия уже восстановлена — организатору промежуточный экран не нужен.
  // До первой отрисовки, чтобы возврат на «Все проекты» был мгновенным.
  useIsoLayoutEffect(() => {
    if (!checking && authenticated && stage === "intro") setStage("app");
  }, [checking, authenticated, stage]);

  // Кнопка «Войти» раньше только меняла stage — история браузера не
  // пополнялась, и «назад» с экрана авторизации ничего не делал (или
  // уносил с сайта). Теперь вход пушит запись {screen:"auth"}; popstate
  // возвращает на интро (Forward — снова на вход). Reload на входе
  // восстанавливает stage из history.state.
  useEffect(() => {
    const onPopState = () => {
      setStage(history.state?.screen === "auth" ? "app" : "intro");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Reload на экране входа: восстанавливаем stage до первой отрисовки.
  useIsoLayoutEffect(() => {
    if (history.state?.screen === "auth") setStage("app");
  }, []);

  const openLogin = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    if (history.state?.screen !== "auth") {
      history.pushState({ screen: "auth" }, "", window.location.href);
    }
    setStage("app");
  }, []);

  // Видимый выход с экрана входа обратно на интро: history.back() снимает
  // запись {screen:"auth"} и popstate сам переключает stage (Back из
  // браузера и эта кнопка идут по одному пути). Fallback — на случай,
  // если записи в истории нет.
  const backToIntro = useCallback(() => {
    if (history.state?.screen === "auth") {
      history.back();
    } else {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      setStage("intro");
    }
  }, []);

  if (stage === "app") {
    // Выход с экрана входа (крестик на карточке) — та же функция, что
    // была у кнопки «← Назад»: history.back() снимает запись {screen:"auth"}
    // и popstate сам возвращает на интро; fallback — прямой переход.
    return <ProjectsScreen onClose={backToIntro} />;
  }
  return <IntroPrototype onLogin={openLogin} />;
}
