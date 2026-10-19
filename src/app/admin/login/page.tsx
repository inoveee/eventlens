// @TheTechMargin 2026
// Вход в админку по email и паролю. Cookie-сессия ставится сервером;
// при успехе — редирект на /admin.

"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Не удалось войти");
        return;
      }
      const next = search.get("next");
      router.replace(next && next.startsWith("/") ? next : "/admin");
      router.refresh();
    } catch {
      setError("Сеть недоступна — попробуйте позже");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--el-bg)] flex items-center justify-center p-4">
      <div className="border border-[var(--el-primary-33)] bg-[var(--el-overlay-80)] p-8 max-w-md w-full">
        <h1 className="text-[var(--el-t-primary)] font-mono text-lg mb-2 tracking-wider">
          ADMIN ACCESS
        </h1>
        <p className="text-[var(--el-t-dim)] font-mono text-xs mb-6">
          Вход по email и паролю организатора.
        </p>

        <form onSubmit={submit}>
          <label className="block text-[var(--el-t-dim)] font-mono text-xs mb-1.5" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            className="w-full bg-[var(--el-bg)] border border-[var(--el-primary-33)] text-[var(--el-t-primary)] font-mono text-sm px-4 py-3 mb-4 focus:border-[var(--el-primary)] focus:outline-none"
          />

          <label className="block text-[var(--el-t-dim)] font-mono text-xs mb-1.5" htmlFor="password">
            Пароль
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-[var(--el-bg)] border border-[var(--el-primary-33)] text-[var(--el-t-primary)] font-mono text-sm px-4 py-3 mb-4 focus:border-[var(--el-primary)] focus:outline-none"
          />

          {error && (
            <p className="text-[var(--el-t-accent)] font-mono text-xs mb-4" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full border border-[var(--el-primary-99)] text-[var(--el-t-primary-99)] font-mono text-sm px-4 py-3 hover:bg-[var(--el-accent-28)] hover:border-[var(--el-accent)] hover:text-[var(--el-t-accent)] transition-colors tracking-wider disabled:opacity-50"
          >
            {loading ? "ПРОВЕРЯЕМ…" : "ВОЙТИ"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--el-bg)]" />}>
      <LoginForm />
    </Suspense>
  );
}
