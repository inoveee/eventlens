// @TheTechMargin 2026
// Admin dashboard — orchestrates hooks and components.
// Follows the same delegation pattern as page.tsx → PhotoGallery:
// the page wires state to UI, individual hooks own behavior,
// individual components own rendering.
//
// Вход — cookie-сессия (/admin/login). Middleware уводит на логин без
// сессии; здесь клиентский фолбэк на случай истечения посреди работы.
"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/hooks/admin/useAdminAuth";
import { useAdminStatus } from "@/hooks/admin/useAdminStatus";
import { useAdminPipeline } from "@/hooks/admin/useAdminPipeline";
import { useAdminDuplicates } from "@/hooks/admin/useAdminDuplicates";
import { StatusCards } from "./components/StatusCards";
import { FolderBreakdown } from "./components/FolderBreakdown";
import { PipelineControls } from "./components/PipelineControls";
import { DuplicateManager } from "./components/DuplicateManager";
import { ErrorList } from "./components/ErrorList";
import { ActivityLog } from "./components/ActivityLog";

export default function AdminPage() {
  const router = useRouter();
  const [activityLog, setActivityLog] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    setActivityLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const auth = useAdminAuth();
  const { user, license, authenticated, checking, logout } = auth;

  // Сессия истекла посреди работы → на логин (middleware сделает это и
  // на маршруте, но клиентский редирект убирает лишний рендер).
  useEffect(() => {
    if (!checking && !authenticated) {
      router.replace("/admin/login");
    }
  }, [checking, authenticated, router]);

  const { status, fetchStatus } = useAdminStatus({
    headers: auth.headers,
    authenticated,
    setAuthenticated: (v) => {
      if (!v) router.replace("/admin/login");
    },
    addLog,
  });
  const { loading, runPipeline } = useAdminPipeline({
    headers: auth.headers,
    addLog,
    fetchStatus,
  });
  const { duplicates, dupsLoading, fetchDuplicates, hidePhotos, unhidePhotos } =
    useAdminDuplicates({
      headers: auth.headers,
      addLog,
    });

  if (checking || !authenticated) {
    return (
      <div className="min-h-screen bg-[var(--el-bg)] flex items-center justify-center">
        <span className="text-[var(--el-t-dim)] font-mono text-sm">Проверяем вход…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--el-bg)] text-[var(--el-t-primary)] font-mono p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8 border-b border-[var(--el-primary-33)] pb-4">
          <h1 className="text-xl tracking-wider">PHOTO PIPELINE CONTROL</h1>
          <div className="flex items-center gap-3 text-xs">
            <a
              href="/admin/analytics"
              className="text-[var(--el-t-dim)] hover:text-[var(--el-t-primary)]"
            >
              Аналитика
            </a>
            <span className="text-[var(--el-t-dim)]">
              {user?.email}
              <span className="ml-2 text-[var(--el-t-accent)]">{user?.role}</span>
            </span>
            <button
              onClick={() => void logout()}
              className="border border-[var(--el-primary-33)] px-3 py-1.5 text-[var(--el-t-primary-99)] hover:border-[var(--el-accent)] hover:text-[var(--el-t-accent)] transition-colors"
            >
              Выйти
            </button>
          </div>
        </div>

        {user?.role === "admin" && license && (
          <p className="text-xs text-[var(--el-t-dim)] mb-6">
            Проект: <span className="text-[var(--el-t-primary)]">{license.projectKey}</span>
            {license.status === "active" && (
              <>
                {" · лицензия до "}
                {new Date(license.expiresAt).toLocaleDateString()}
              </>
            )}
          </p>
        )}

        {status && <StatusCards status={status} />}
        {status && <FolderBreakdown folders={status.folders} />}

        <PipelineControls
          loading={loading}
          runPipeline={runPipeline}
          onRefresh={async () => {
            await fetchStatus();
            addLog("Status refreshed");
          }}
          onClearLog={() => setActivityLog([])}
        />

        <DuplicateManager
          duplicates={duplicates}
          dupsLoading={dupsLoading}
          onScan={() => fetchDuplicates()}
          onHide={hidePhotos}
          onUnhide={unhidePhotos}
        />

        {status && <ErrorList errors={status.recentErrors} />}

        <ActivityLog
          entries={activityLog}
          lastProcessed={status?.lastProcessed ?? null}
        />
      </div>
    </div>
  );
}
