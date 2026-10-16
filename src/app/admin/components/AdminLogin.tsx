// @TheTechMargin 2026
// Admin authentication gate — validates the admin API secret.
// Вход оформлен как загрузочный экран: иконка с вращающимся оранжевым
// кольцом по центру и лента сообщений на фоне (AdminSplash).

import AdminSplash from "./AdminSplash";

interface AdminLoginProps {
  secret: string;
  setSecret: (v: string) => void;
  onLogin: () => void;
}

export function AdminLogin({ secret, setSecret, onLogin }: AdminLoginProps) {
  return (
    <AdminSplash>
      <input
        type="password"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onLogin()}
        placeholder="ADMIN_API_SECRET"
        className="w-full bg-[var(--el-surface)] border border-[var(--el-primary-33)] text-[var(--el-t-primary)] font-mono text-sm px-4 py-3 mb-3 focus:border-[var(--el-primary)] focus:outline-none placeholder:text-[var(--el-t-accent)]"
      />
      <button
        onClick={onLogin}
        className="w-full border border-[var(--el-primary-99)] bg-[var(--el-surface)] text-[var(--el-t-primary-99)] font-mono text-sm px-4 py-3 hover:bg-[var(--el-accent-28)] hover:border-[var(--el-accent)] hover:text-[var(--el-t-accent)] transition-colors tracking-wider"
      >
        AUTHENTICATE
      </button>
    </AdminSplash>
  );
}
