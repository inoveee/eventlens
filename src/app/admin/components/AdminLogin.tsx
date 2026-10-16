// @TheTechMargin 2026
// Admin authentication gate — validates the admin API secret.
// При открытии страницы сначала идёт загрузочный экран (AdminSplash):
// иконка с вращающимся оранжевым кольцом и лента сообщений на фоне.
// Через ~7 секунд он плавно растворяется и открывается форма входа.

import { useEffect, useState } from "react";
import AdminSplash from "./AdminSplash";

interface AdminLoginProps {
  secret: string;
  setSecret: (v: string) => void;
  onLogin: () => void;
}

// Сколько сплэш стоит на экране, и сколько длится его растворение
// (должно совпадать с duration-700 у AdminSplash).
const SPLASH_MS = 7000;
const FADE_MS = 700;

export function AdminLogin({ secret, setSecret, onLogin }: AdminLoginProps) {
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
    <div className="min-h-screen bg-[var(--el-bg)] flex items-center justify-center p-4">
      <div
        className={`w-full max-w-md transition-opacity duration-500 ${
          splash === "hidden" ? "opacity-100" : "opacity-0"
        }`}
        // Форма уже размонтирована не полностью: aria-hidden, пока сплэш виден,
        // чтобы фокус не улетал в поля под ним.
        aria-hidden={splash !== "hidden"}
      >
        <div className="border border-[var(--el-primary-33)] bg-[var(--el-overlay-80)] p-8 max-w-md w-full">
          <h1 className="text-[var(--el-t-primary)] font-mono text-lg mb-6 tracking-wider">
            ADMIN ACCESS
          </h1>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onLogin()}
            placeholder="ADMIN_API_SECRET"
            tabIndex={splash === "hidden" ? 0 : -1}
            className="w-full bg-[var(--el-bg)] border border-[var(--el-primary-33)] text-[var(--el-t-primary)] font-mono text-sm px-4 py-3 mb-4 focus:border-[var(--el-primary)] focus:outline-none placeholder:text-[var(--el-t-accent)]"
          />
          <button
            onClick={onLogin}
            tabIndex={splash === "hidden" ? 0 : -1}
            className="w-full border border-[var(--el-primary-99)] text-[var(--el-t-primary-99)] font-mono text-sm px-4 py-3 hover:bg-[var(--el-accent-28)] hover:border-[var(--el-accent)] hover:text-[var(--el-t-accent)] transition-colors tracking-wider"
          >
            AUTHENTICATE
          </button>
        </div>
      </div>

      {splash !== "hidden" && (
        <AdminSplash fading={splash === "fade"} />
      )}
    </div>
  );
}
