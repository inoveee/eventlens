// @TheTechMargin 2026
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { config } from "@/lib/config";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "Неверный пароль");
      }
    } catch {
      setError("Нет связи с сервером");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[var(--el-bg)] text-[var(--el-text)] font-mono flex items-center justify-center p-4 scan-line-bg">
      <div className="w-full max-w-md">
        <div className="border border-[var(--el-primary-d9)] bg-[var(--el-overlay-80)] p-6 backdrop-blur">
          <div className="flex items-center gap-2 border-b border-[var(--el-primary-99)] pb-3 mb-6">
            <div className="h-2 w-2 rounded-full bg-[var(--el-primary)]" />
            <div className="h-2 w-2 rounded-full bg-[var(--el-primary-d9)]" />
            <div className="h-2 w-2 rounded-full bg-[var(--el-primary-d9)]" />
            <span className="ml-2 text-[10px] uppercase tracking-widest text-[var(--el-t-primary-d9)]">
              вход в галерею
            </span>
          </div>

          <div className="text-center mb-6">
            <h1 className="font-heading text-2xl font-bold tracking-wider text-[var(--el-t-primary)] uppercase glow-text">
              {config.eventName}
            </h1>
            <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-[var(--el-t-primary-d9)]">
              {config.eventTagline}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="block text-[10px] uppercase tracking-wider text-[var(--el-t-primary-d9)] mb-2"
              >
                Код доступа
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--el-t-primary-d9)] text-sm font-mono">
                  {">_"}
                </span>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Введите код доступа"
                  className="w-full border border-[var(--el-primary-d9)] bg-[var(--el-overlay-60)] py-3 pl-10 pr-4 text-sm text-[var(--el-t-primary)] font-mono placeholder:text-[var(--el-t-accent)] outline-none transition-all focus:border-[var(--el-primary)] focus:shadow-[0_0_15px_var(--el-glow-primary-15)]"
                  disabled={isLoading}
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <div className="text-[var(--el-flame)] text-xs font-mono uppercase tracking-wider text-center border border-[var(--el-flame-99)] bg-[rgba(255,87,51,0.1)] py-2 px-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !password}
              className="w-full border border-[var(--el-primary)] bg-[var(--el-primary)] text-[var(--el-on-primary)] py-3 text-sm font-mono uppercase tracking-wider transition-all hover:bg-transparent hover:text-[var(--el-t-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Проверяем…" : "Войти в галерею"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
