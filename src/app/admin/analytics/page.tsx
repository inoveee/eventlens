// @TheTechMargin 2026
// Аналитика галерей: KPI, графики и таблица по проектам.
//
// В браузер приходят только агрегаты из /api/admin/analytics — сырые
// события и персональные данные (селфи, векторы, IP, тексты запросов)
// не покидают БД. super_admin переключает проект (или видит все),
// admin — всегда только свой (проект выбирается на сервере по лицензии).

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface Kpi {
  pageViews: number;
  uniqueVisitors: number;
  searches: number;
  faceSearches: number;
  downloads: number;
  collages: number;
}

interface SeriesPoint {
  bucket: string;
  event_type: string;
  events: number;
  unique_visitors: number;
}

interface HourlyPoint {
  hour: number;
  events: number;
}

interface TopPhoto {
  photo_id: string;
  views: number;
  downloads: number;
}

interface ByProjectRow {
  project_key: string;
  project_name: string | null;
  page_views: number;
  visitors: number;
  searches: number;
  face_searches: number;
  downloads: number;
}

interface AnalyticsData {
  period: string;
  project: string | null;
  scope: "all" | "one";
  kpi: Kpi;
  series: SeriesPoint[];
  hourly: HourlyPoint[];
  topPhotos: TopPhoto[];
  byProject: ByProjectRow[];
}

type Period = "24h" | "7d" | "30d" | "90d";
const PERIODS: Array<{ value: Period; label: string }> = [
  { value: "24h", label: "24 часа" },
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "30 дней" },
  { value: "90d", label: "90 дней" },
];

interface ProjectOption {
  key: string;
  title: string;
}

type SortKey = "project_key" | "page_views" | "visitors" | "searches" | "face_searches" | "downloads";

function formatNum(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n);
}

function toCsv(rows: ByProjectRow[]): string {
  const header = [
    "project_key",
    "project_name",
    "page_views",
    "visitors",
    "searches",
    "face_searches",
    "downloads",
  ];
  const escape = (v: unknown): string => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      r.project_key,
      r.project_name ?? "",
      r.page_views,
      r.visitors,
      r.searches,
      r.face_searches,
      r.downloads,
    ]
      .map(escape)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("7d");
  const [project, setProject] = useState<string>(""); // "" = все (super_admin)
  const [role, setRole] = useState<"super_admin" | "admin" | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("page_views");
  const [sortAsc, setSortAsc] = useState(false);

  // Роль + список проектов (для селектора super_admin).
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const me = await fetch("/api/admin/auth/me", { credentials: "same-origin" });
        if (me.ok) {
          const { user } = await me.json();
          if (active) setRole(user?.role ?? null);
          if (user?.role === "super_admin") {
            const res = await fetch("/api/event/projects", { credentials: "same-origin" });
            if (res.ok) {
              const { projects: list } = await res.json();
              if (active) {
                setProjects(
                  (list ?? []).map((p: { key: string; title: string }) => ({
                    key: p.key,
                    title: p.title,
                  })),
                );
              }
            }
          }
        }
      } catch {
        // ignore — форма останется без селектора
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ period });
      if (project) params.set("project", project);
      const res = await fetch(`/api/admin/analytics?${params.toString()}`, {
        credentials: "same-origin",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Не удалось загрузить аналитику");
        setData(null);
        return;
      }
      setData(body as AnalyticsData);
    } catch {
      setError("Сеть недоступна — попробуйте позже");
    } finally {
      setLoading(false);
    }
  }, [period, project]);

  useEffect(() => {
    void load();
  }, [load]);

  // Дневной ряд: складываем события всех типов по каждому бакету.
  const dailySeries = useMemo(() => {
    if (!data) return [];
    const byBucket = new Map<string, { bucket: string; events: number; visitors: number }>();
    for (const point of data.series) {
      const key = String(point.bucket).slice(0, 10);
      const entry = byBucket.get(key) ?? { bucket: key, events: 0, visitors: 0 };
      entry.events += point.events ?? 0;
      entry.visitors = Math.max(entry.visitors, point.unique_visitors ?? 0);
      byBucket.set(key, entry);
    }
    return Array.from(byBucket.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));
  }, [data]);

  const sortedProjects = useMemo(() => {
    if (!data?.byProject) return [];
    const rows = [...data.byProject];
    rows.sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortAsc ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
    return rows;
  }, [data, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  function exportCsv() {
    if (!data?.byProject?.length) return;
    const csv = toCsv(data.byProject);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${data.period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const kpiCards: Array<{ label: string; value: number }> = data
    ? [
        { label: "Заходы", value: data.kpi.pageViews },
        { label: "Посетители", value: data.kpi.uniqueVisitors },
        { label: "Поиски", value: data.kpi.searches },
        { label: "Поиск по лицу", value: data.kpi.faceSearches },
        { label: "Скачивания", value: data.kpi.downloads },
        { label: "Коллажи", value: data.kpi.collages },
      ]
    : [];

  return (
    <div className="min-h-screen bg-[var(--el-bg)] text-[var(--el-t-primary)] font-mono p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 border-b border-[var(--el-primary-33)] pb-4">
          <h1 className="text-xl tracking-wider">АНАЛИТИКА</h1>
          <a
            href="/admin"
            className="text-xs text-[var(--el-t-dim)] hover:text-[var(--el-t-primary)]"
          >
            ← Панель
          </a>
        </div>

        {/* Фильтры */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--el-t-dim)]">Период:</span>
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 text-xs border transition-colors ${
                  period === p.value
                    ? "border-[var(--el-accent)] text-[var(--el-t-accent)]"
                    : "border-[var(--el-primary-33)] text-[var(--el-t-dim)] hover:text-[var(--el-t-primary)]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {role === "super_admin" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--el-t-dim)]">Проект:</span>
              <select
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className="bg-[var(--el-bg)] border border-[var(--el-primary-33)] text-[var(--el-t-primary)] text-xs px-3 py-1.5 focus:border-[var(--el-primary)] focus:outline-none"
              >
                <option value="">Все проекты</option>
                {projects.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.title} ({p.key})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="text-[var(--el-t-accent)] text-sm mb-6">
            {error}
          </p>
        )}
        {loading && <p className="text-[var(--el-t-dim)] text-sm mb-6">Загружаем…</p>}

        {/* KPI */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            {kpiCards.map((card) => (
              <div
                key={card.label}
                className="border border-[var(--el-primary-33)] bg-[var(--el-overlay-80)] p-4"
              >
                <div className="text-2xl text-[var(--el-t-primary)]">
                  {formatNum(card.value)}
                </div>
                <div className="text-[11px] text-[var(--el-t-dim)] mt-1">{card.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Графики */}
        {data && dailySeries.length > 0 && (
          <div className="border border-[var(--el-primary-33)] bg-[var(--el-overlay-80)] p-4 mb-6">
            <h2 className="text-sm text-[var(--el-t-dim)] mb-4">Активность по дням</h2>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={dailySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--el-primary-33)" />
                <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: "var(--el-t-dim)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--el-t-dim)" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--el-bg)",
                    border: "1px solid var(--el-primary-33)",
                    fontFamily: "monospace",
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="events"
                  name="События"
                  stroke="var(--el-accent)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="visitors"
                  name="Посетители"
                  stroke="var(--el-t-dim)"
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {data && data.hourly?.length > 0 && (
          <div className="border border-[var(--el-primary-33)] bg-[var(--el-overlay-80)] p-4 mb-6">
            <h2 className="text-sm text-[var(--el-t-dim)] mb-4">Активность по часам суток</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.hourly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--el-primary-33)" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "var(--el-t-dim)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--el-t-dim)" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--el-bg)",
                    border: "1px solid var(--el-primary-33)",
                    fontFamily: "monospace",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="events" name="События" fill="var(--el-accent)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Топ фото */}
        {data && data.topPhotos?.length > 0 && (
          <div className="border border-[var(--el-primary-33)] bg-[var(--el-overlay-80)] p-4 mb-6">
            <h2 className="text-sm text-[var(--el-t-dim)] mb-4">Популярные фото</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[var(--el-t-dim)] border-b border-[var(--el-primary-33)]">
                    <th className="text-left py-2 pr-4">Фото</th>
                    <th className="text-right py-2 px-4">Просмотры</th>
                    <th className="text-right py-2 pl-4">Скачивания</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topPhotos.map((p) => (
                    <tr key={p.photo_id} className="border-b border-[var(--el-primary-22)]">
                      <td className="py-2 pr-4 text-[var(--el-t-dim)] break-all">
                        {p.photo_id}
                      </td>
                      <td className="py-2 px-4 text-right">{formatNum(p.views)}</td>
                      <td className="py-2 pl-4 text-right">{formatNum(p.downloads)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Таблица по проектам (только super_admin, все проекты) */}
        {data && data.scope === "all" && data.byProject?.length > 0 && (
          <div className="border border-[var(--el-primary-33)] bg-[var(--el-overlay-80)] p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm text-[var(--el-t-dim)]">Все проекты</h2>
              <button
                onClick={exportCsv}
                className="text-xs border border-[var(--el-primary-33)] px-3 py-1.5 text-[var(--el-t-dim)] hover:text-[var(--el-t-primary)] hover:border-[var(--el-accent)] transition-colors"
              >
                Экспорт CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[var(--el-t-dim)] border-b border-[var(--el-primary-33)]">
                    {(
                      [
                        ["project_key", "Проект"],
                        ["page_views", "Заходы"],
                        ["visitors", "Посетители"],
                        ["searches", "Поиски"],
                        ["face_searches", "Поиск по лицу"],
                        ["downloads", "Скачивания"],
                      ] as Array<[SortKey, string]>
                    ).map(([key, label]) => (
                      <th
                        key={key}
                        onClick={() => toggleSort(key)}
                        className={`py-2 px-3 cursor-pointer select-none hover:text-[var(--el-t-primary)] ${
                          key === "project_key" ? "text-left" : "text-right"
                        }`}
                      >
                        {label}
                        {sortKey === key && (sortAsc ? " ↑" : " ↓")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedProjects.map((r) => (
                    <tr key={r.project_key} className="border-b border-[var(--el-primary-22)]">
                      <td className="py-2 px-3 text-left">
                        {r.project_name || r.project_key}
                        <span className="text-[var(--el-t-dim)] ml-2">{r.project_key}</span>
                      </td>
                      <td className="py-2 px-3 text-right">{formatNum(r.page_views)}</td>
                      <td className="py-2 px-3 text-right">{formatNum(r.visitors)}</td>
                      <td className="py-2 px-3 text-right">{formatNum(r.searches)}</td>
                      <td className="py-2 px-3 text-right">{formatNum(r.face_searches)}</td>
                      <td className="py-2 px-3 text-right">{formatNum(r.downloads)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data && data.kpi.pageViews === 0 && !loading && (
          <p className="text-[var(--el-t-dim)] text-sm">
            За выбранный период событий пока нет.
          </p>
        )}
      </div>
    </div>
  );
}
