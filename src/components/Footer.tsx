// @TheTechMargin 2026
import { config } from "@/lib/config";

/**
 * Gallery footer. White-label: the organizer's optional credit line, the
 * noveee.me platform logo and a privacy note. Set NEXT_PUBLIC_FOOTER_CREDIT_URL /
 * NEXT_PUBLIC_FOOTER_CREDIT_TEXT to link back to whoever runs the instance,
 * or leave them empty to hide the line entirely.
 */
export default function Footer() {
  const creditText = process.env.NEXT_PUBLIC_FOOTER_CREDIT_TEXT || "";
  const creditUrl = process.env.NEXT_PUBLIC_FOOTER_CREDIT_URL || "";

  return (
    <footer className="w-full py-6 border-t border-[var(--el-primary-22)] bg-[var(--el-overlay-50)]">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-4">
        {creditText && (
          <div className="flex items-center justify-center">
            {creditUrl ? (
              <a
                href={creditUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-center text-[11px] md:text-xs text-[var(--el-text-dim)] hover:text-[var(--el-t-primary)] transition-colors"
              >
                {creditText}
              </a>
            ) : (
              <span className="text-center text-[11px] md:text-xs text-[var(--el-text-dim)]">
                {creditText}
              </span>
            )}
          </div>
        )}

        {/* noveee.me — платформа; логотип со светлым текстом,
            поэтому на тёмной «табличке», читаемой в обеих темах */}
        <a
          href="https://noveee.me"
          target="_blank"
          rel="noopener noreferrer"
          title="noveee.me"
          className="inline-flex items-center rounded-full bg-black px-4 py-2 transition-opacity hover:opacity-85"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/noveee-logo.png"
            alt="noveee.me"
            className="h-auto w-36 md:w-40"
          />
        </a>

        <div className="group/pii relative flex items-center justify-center">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="shrink-0 opacity-60 cursor-help stroke-[var(--el-accent)]"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 text-[10px] tracking-wider border border-[var(--el-accent)] bg-[var(--el-bg)] opacity-0 pointer-events-none group-hover/pii:opacity-100 transition-opacity"
            style={{ color: "var(--el-t-accent-cc)" }}
          >
            Селфи используется только для поиска и не сохраняется.
          </span>
          <span className="ml-2 text-[10px] md:text-xs text-[var(--el-text-dim)]">
            {config.eventName}
            {config.eventYear ? ` · ${config.eventYear}` : ""}
          </span>
        </div>
      </div>
    </footer>
  );
}
