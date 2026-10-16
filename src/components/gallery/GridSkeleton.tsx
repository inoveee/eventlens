// @TheTechMargin 2026

export default function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="aspect-[4/3] skeleton-terminal"
          style={{ '--delay': `${i * 0.15}s` } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
