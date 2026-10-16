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
    <div className="el-hero flex min-h-screen items-center justify-center p-5">
      <div className="w-full max-w-md">
        <div className="el-glass rounded-3xl p-7 shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:p-9">
          <div className="text-center">
            {config.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={config.logoUrl}
                alt={config.eventName}
                className="mx-auto mb-5 h-12 w-auto object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <h1 className="text-2xl font-black uppercase leading-tight tracking-tight md:text-3xl">
              {config.eventName}
            </h1>
            <p className="mt-2 text-sm text-[var(--el-text-dim)]">
              {config.eventTagline}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-[var(--el-text-dim)]"
              >
                Код доступа
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите код доступа"
                className="w-full rounded-full border border-[var(--el-primary-33)] bg-[var(--el-surface)] px-5 py-3.5 text-base text-[var(--el-text)] transition-all placeholder:text-[var(--el-text-dim)] focus:border-[var(--el-primary)] focus:ring-4 focus:ring-[var(--el-glow-primary-15)]"
                disabled={isLoading}
                autoFocus
              />
            </div>

            {error && (
              <div className="rounded-full bg-[var(--el-red-11)] px-4 py-2.5 text-center text-sm text-[var(--el-red)]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !password}
              className="w-full py-3.5 text-base font-semibold text-[var(--el-on-primary)] disabled:opacity-50"
              style={{ background: "var(--el-primary)" }}
            >
              {isLoading ? "Проверяем…" : "Войти в галерею"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-white/45">
          Фотографии мероприятия · {config.eventYear}
        </p>
      </div>
    </div>
  );
}
