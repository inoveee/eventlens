// @TheTechMargin 2026
"use client";

import { MatchResult } from "@/lib/types";

interface SearchStatusProps {
  debouncedQuery: string;
  matchResults: MatchResult[] | null;
  matchDescription: string;
  filteredCount: number;
  totalCount: number;
}

export default function SearchStatus({
  debouncedQuery,
  matchResults,
  matchDescription,
  filteredCount,
  totalCount,
}: SearchStatusProps) {
  return (
    <div className="mx-auto max-w-5xl px-3 md:px-4 pb-3 md:pb-4">
      <p className="text-sm text-[var(--el-text-dim)]">
        {matchResults !== null ? (
          <>
            {debouncedQuery ? (
              <>{filteredCount} из {matchResults.length} совпадений по запросу &quot;{debouncedQuery}&quot;</>
            ) : (
              <>{matchResults.length} совпадений</>
            )}
            {matchResults.length > 0 && (() => {
              const tiers = new Set(matchResults.map((m) => m.tier));
              const parts: string[] = [];
              if (tiers.has("text")) parts.push("по описанию");
              if (tiers.has("visual")) parts.push("по картинке");
              if (tiers.has("vector")) parts.push("по лицу");
              if (tiers.has("both")) { parts.length = 0; parts.push("по описанию", "по картинке"); }
              return (
                <span className="text-[var(--el-t-primary)]">
                  {" — "}{parts.join(" + ")}
                </span>
              );
            })()}
            {matchDescription && (
              <span className="text-[var(--el-t-primary-d9)]">
                {" — "}
                {matchDescription}
              </span>
            )}
          </>
        ) : debouncedQuery ? (
          <>
            Найдено {filteredCount} по запросу &quot;{debouncedQuery}&quot;
          </>
        ) : (
          <>
            {filteredCount} из {totalCount} фото
          </>
        )}
      </p>
    </div>
  );
}
