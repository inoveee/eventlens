// @TheTechMargin 2026
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="el-hero flex min-h-screen items-center justify-center p-5">
      <div className="w-full max-w-md text-center">
        <p className="text-[clamp(4rem,18vw,8rem)] font-black leading-none text-white">404</p>
        <h1 className="mt-4 text-xl font-semibold text-white md:text-2xl">
          Страница не найдена
        </h1>
        <p className="mt-2 text-sm text-white/55">
          Такого адреса не существует — возможно, ссылка устарела.
        </p>

        <div className="mt-8 flex justify-center">
          <Link
            href="/"
            className="group inline-flex items-center gap-3 py-2 pl-5 pr-2 text-sm font-semibold text-[var(--el-on-primary)]"
            style={{ background: "var(--el-primary)" }}
          >
            Вернуться в галерею
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/15 transition-transform group-hover:translate-x-0.5">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="12" x2="19" y2="12" />
                <polyline points="13 6 19 12 13 18" />
              </svg>
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
