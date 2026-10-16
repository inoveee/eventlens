// @TheTechMargin 2026
// Обёртка загрузочного экрана: при открытии страницы поверх контента
// ~9 секунд крутится сплэш (иконка с оранжевым кольцом и лента
// сообщений), затем он плавно растворяется и отдаёт управление
// странице входа под ним.
"use client";

import { useEffect, useState, type ReactNode } from "react";
import SplashScreen from "./SplashScreen";

// Сколько сплэш стоит на экране, и сколько длится его растворение
// (должно совпадать с duration-700 у SplashScreen).
const SPLASH_MS = 9000;
const FADE_MS = 700;

export default function SplashGate({ children }: { children: ReactNode }) {
  // "show" — сплэш на экране, "fade" — растворяется, "hidden" — убран.
  const [splash, setSplash] = useState<"show" | "fade" | "hidden">("show");

  useEffect(() => {
    const toFade = setTimeout(() => setSplash("fade"), SPLASH_MS);
    const toHide = setTimeout(() => setSplash("hidden"), SPLASH_MS + FADE_MS);
    return () => {
      clearTimeout(toFade);
      clearTimeout(toHide);
    };
  }, []);

  return (
    <>
      {/* Контент страницы под сплэшем: пока тот виден, блокируем
          прокрутку, клики и фокус (inert), чтобы не уводить ввод
          в поля под оверлеем. */}
      <div className={splash === "show" ? "pointer-events-none" : ""} inert={splash === "show"}>
        {children}
      </div>

      {splash !== "hidden" && <SplashScreen fading={splash === "fade"} />}
    </>
  );
}
