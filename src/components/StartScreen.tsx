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
    return (
      <>
        {/* Крестик-назад виден только на неавторизованном экране (вход):
            после входа организатор остаётся в панели. */}
        {!checking && !authenticated && (
          <button
            type="button"
            onClick={backToIntro}
            aria-label="Назад на главную"
            className="fixed left-4 top-4 z-[100] flex items-center gap-1.5 rounded-full border border-[var(--org-border)] bg-white/90 px-3.5 py-2 text-[13px] font-medium text-[var(--org-text)] shadow-[0_6px_20px_rgba(0,0,0,0.14)] backdrop-blur transition-colors hover:bg-white"
          >
            <span aria-hidden>←</span> Назад
          </button>
        )}
        <ProjectsScreen />
      </>
    );
  }
  return <IntroPrototype onLogin={openLogin} />;
}
