// @TheTechMargin 2026
// Гейт пароля для пароль-защищённой галереи. Показывается сервером /p/<key>,
// когда у проекта задан пароль, а посетитель ещё не ввёл его.
//
// Пароль per-project уходит на /api/auth/login с project=<key>; сервер
// ставит подписанный guest-cookie и мы перезагружаем страницу — сервер
// увидит cookie и отдаёт галерею.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEventSettings } from "@/components/EventSettingsProvider";

export default function GalleryGate({ projectKey }: { projectKey: string }) {
  const router = useRouter();
  const { settings } = useEventSettings();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ project: projectKey, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Неверный пароль");
        return;
      }
      // Cookie выставлен — перечитываем страницу: сервер отдаёт галерею.
      router.refresh();
    } catch {
      setError("Сеть недоступна — попробуйте позже");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--el-bg)] flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="border border-[var(--el-primary-33)] bg-[var(--el-overlay-80)] p-8 max-w-sm w-full"
      >
        <h1 className="text-[var(--el-t-primary)] font-mono text-base mb-1 tracking-wider">
          {settings.text.name || "Фотогалерея"}
        </h1>
        <p className="text-[var(--el-t-dim)] font-mono text-xs mb-6">
          Галерея защищена паролем. Введите пароль, чтобы продолжить.
        </p>

        <label
          htmlFor="gallery-password"
          className="block text-[var(--el-t-dim)] font-mono text-xs mb-1.5"
        >
          Пароль
        </label>
        <input
          id="gallery-password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-[var(--el-bg)] border border-[var(--el-primary-33)] text-[var(--el-t-primary)] font-mono text-sm px-4 py-3 mb-4 focus:border-[var(--el-primary)] focus:outline-none"
        />

        {error && (
          <p
            role="alert"
            className="text-[var(--el-t-accent)] font-mono text-xs mb-4"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full border border-[var(--el-primary-99)] text-[var(--el-t-primary-99)] font-mono text-sm px-4 py-3 tracking-wider hover:bg-[var(--el-accent-28)] hover:border-[var(--el-accent)] hover:text-[var(--el-t-accent)] transition-colors disabled:opacity-50"
        >
          {loading ? "ПРОВЕРЯЕМ…" : "ОТКРЫТЬ"}
        </button>
      </form>
    </div>
  );
}
