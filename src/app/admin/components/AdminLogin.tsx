// @TheTechMargin 2026
// Admin authentication gate — validates the admin API secret.

interface AdminLoginProps {
  secret: string;
  setSecret: (v: string) => void;
  onLogin: () => void;
}

export function AdminLogin({ secret, setSecret, onLogin }: AdminLoginProps) {
  return (
    <div className="min-h-screen bg-[var(--el-bg)] flex items-center justify-center p-4">
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
          className="w-full bg-[var(--el-bg)] border border-[var(--el-primary-33)] text-[var(--el-t-primary)] font-mono text-sm px-4 py-3 mb-4 focus:border-[var(--el-primary)] focus:outline-none placeholder:text-[var(--el-t-accent)]"
        />
        <button
          onClick={onLogin}
          className="w-full border border-[var(--el-primary-99)] text-[var(--el-t-primary-99)] font-mono text-sm px-4 py-3 hover:bg-[var(--el-accent-28)] hover:border-[var(--el-accent)] hover:text-[var(--el-t-accent)] transition-colors tracking-wider"
        >
          AUTHENTICATE
        </button>
      </div>
    </div>
  );
}
