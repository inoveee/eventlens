// @TheTechMargin 2026
"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { PhotoRecord } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

// Hooks
import { usePhotos } from "@/hooks/usePhotos";
import { useSearch } from "@/hooks/useSearch";
import { useFilters } from "@/hooks/useFilters";
import { useSelection } from "@/hooks/useSelection";
import { useCollage } from "@/hooks/useCollage";
import { useStats } from "@/hooks/useStats";
import { useProgressiveRender } from "@/hooks/useProgressiveRender";
import { useUrlSync } from "@/hooks/useUrlSync";

// Components
import GalleryHeader from "./GalleryHeader";
import FolderTabs from "./FolderTabs";
import TagTabs from "./TagTabs";
import FavoritesSection from "./FavoritesSection";
import AlbumGrid from "./AlbumGrid";
import HeroSection from "./HeroSection";
import SearchStatus from "./SearchStatus";
import EmptyState from "./EmptyState";
import RecommendationsBar from "./RecommendationsBar";
import PhotoGrid from "./PhotoGrid";
import GridSkeleton from "./GridSkeleton";
import Lightbox from "@/components/Lightbox";
import Toast from "@/components/Toast";
import CollagePreview from "@/components/CollagePreview";
import CollageRatioModal from "@/components/CollageRatioModal";
import FloatingActionBar from "@/components/FloatingActionBar";

export default function PhotoGallery() {
  const searchParams = useSearchParams();

  // Core data
  const photos = usePhotos();
  const search = useSearch(
    searchParams.get("q") || "",
    "", // activeFolder will be set after filters init
  );
  const filters = useFilters(
    photos.allPhotos,
    photos.shuffledPhotos,
    search.debouncedQuery,
    search.serverResults,
    search.matchResults,
  );
  const selection = useSelection();
  const collage = useCollage(
    selection.selectedIds,
    filters.filteredPhotos,
    selection.clearSelection,
    photos.setToast,
  );
  const stats = useStats();

  const resetKey = `${filters.activeFolder}|${filters.activeTag}|${search.debouncedQuery}|${filters.sortOrder}`;
  const { visibleCount, sentinelRef } = useProgressiveRender(
    filters.filteredPhotos.length,
    40,
    resetKey,
  );

  // Lightbox state
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoRecord | null>(() => {
    const photoParam = searchParams.get("photo");
    if (photoParam && photos.allPhotos.length > 0) {
      return photos.allPhotos.find((p) => p.filename === photoParam) || null;
    }
    return null;
  });

  // URL sync
  useUrlSync({
    search: search.debouncedQuery,
    folder: filters.activeFolder,
    selectedPhoto,
  });

  // Derived state
  const visiblePhotos = filters.filteredPhotos.slice(0, visibleCount);
  const isHome = !filters.isSearchActive;

  // Корневые папки (Root/ALL) — не альбомы, в чипы и грид альбомов не идут
  const realFolders = useMemo(
    () => photos.folders.filter((f) => f && !/^(root|all)$/i.test(f)),
    [photos.folders],
  );

  // Избранное — фото, выбранные самим участником в режиме «Выбрать»
  const favoritePhotos = useMemo(
    () => photos.allPhotos.filter((p) => selection.selectedIds.has(p.id)),
    [photos.allPhotos, selection.selectedIds],
  );

  // Выбор альбома. «Все» при пустом поиске — возврат на главную
  // (в т.ч. из режима «Смотреть все фото»).
  const { setActiveFolder, setBrowseAll } = filters;
  const { debouncedQuery, matchResults } = search;
  const handleFolderSelect = useCallback(
    (folder: string) => {
      setActiveFolder(folder);
      if (folder === "" && !debouncedQuery && matchResults === null) {
        setBrowseAll(false);
      }
    },
    [setActiveFolder, setBrowseAll, debouncedQuery, matchResults],
  );

  // Страховка: сохранённый в localStorage альбом (например, «Root» из
  // старой версии) больше не существует как чип — сбрасываем его.
  useEffect(() => {
    if (
      !photos.loading &&
      filters.activeFolder &&
      !realFolders.includes(filters.activeFolder)
    ) {
      handleFolderSelect("");
    }
  }, [photos.loading, filters.activeFolder, realFolders, handleFolderSelect]);

  const heroPhotos = useMemo(() => {
    if (filters.sortOrder === "shuffle") return photos.shuffledPhotos.slice(0, 8);
    const sorted = [...photos.allPhotos];
    if (filters.sortOrder === "name-asc") sorted.sort((a, b) => a.filename.localeCompare(b.filename));
    else if (filters.sortOrder === "name-desc") sorted.sort((a, b) => b.filename.localeCompare(a.filename));
    return sorted.slice(0, 8);
  }, [photos.shuffledPhotos, photos.allPhotos, filters.sortOrder]);

  // Handlers
  const handlePhotoClick = useCallback((photo: PhotoRecord) => {
    setSelectedPhoto(photo);
  }, []);

  const handleMatchResultsWithFilterReset = useCallback(
    (data: Parameters<typeof search.handleMatchResults>[0]) => {
      search.handleMatchResults(data);
      filters.setActiveFolder("");
      filters.setActiveTag(null);
    },
    [search, filters],
  );

  const handleClearMatchWithFilterReset = useCallback(() => {
    search.handleClearMatch();
    filters.setActiveType("all");
  }, [search, filters]);

  // Override search's handleMatchResults to also reset filters
  const searchWithFilterReset = useMemo(() => ({
    ...search,
    handleMatchResults: handleMatchResultsWithFilterReset,
    handleClearMatch: handleClearMatchWithFilterReset,
  }), [search, handleMatchResultsWithFilterReset, handleClearMatchWithFilterReset]);

  // Главная без чипов (нет реальных папок/тегов): строка сверху не нужна —
  // в ней одиноко «прилипала» бы кнопка «Выбрать». Она уходит в шапку
  // секции (Избранное либо Общий альбом), к заголовку по левому краю.
  const hasChips = realFolders.length > 0 || photos.tags.length > 0;
  const inlineSelect = isHome && !hasChips;
  const showTabsRow = !isHome || hasChips;
  const selectToggleBtn = (
    <button
      onClick={selection.toggleSelectMode}
      className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium tracking-wide transition-all ${
        selection.selectMode
          ? "bg-[var(--el-primary)] text-[var(--el-on-primary)] shadow-[0_6px_20px_var(--el-glow-primary-25)]"
          : "border border-[var(--el-primary-22)] bg-[var(--el-surface)] text-[var(--el-t-primary-99)] hover:border-[var(--el-primary-44)] hover:text-[var(--el-t-primary)]"
      }`}
    >
      {selection.selectMode ? "Готово" : "Выбрать"}
    </button>
  );

  return (
    <div className="min-h-screen bg-[var(--el-bg)]">
      <GalleryHeader
        search={searchWithFilterReset}
        onRefresh={photos.refresh}
        lastUpdated={photos.lastUpdated}
        totalPhotos={photos.allPhotos.length}
      />

      {!photos.loading && !photos.error && photos.allPhotos.length > 0 && showTabsRow && (
        <div className="mx-auto max-w-5xl px-3 md:px-4 pb-2 md:pb-4 space-y-1.5 md:space-y-2">
          {/* Одна линия: чипы альбомов слева, «Выбрать» справа */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <FolderTabs
                folders={realFolders}
                active={filters.activeFolder}
                onSelect={handleFolderSelect}
                totalCount={photos.allPhotos.length}
                folderCounts={filters.folderCounts}
              />
            </div>
            {!inlineSelect && selectToggleBtn}
          </div>
          <TagTabs
            tags={photos.tags}
            active={filters.activeTag}
            onSelect={filters.setActiveTag}
            tagCounts={filters.tagCounts}
          />
        </div>
      )}

      {filters.isSearchActive && (search.debouncedQuery || search.matchResults !== null) && !photos.loading && !photos.error && (
        <SearchStatus
          debouncedQuery={search.debouncedQuery}
          matchResults={search.matchResults}
          matchDescription={search.matchDescription}
          filteredCount={filters.filteredPhotos.length}
          totalCount={photos.allPhotos.length}
        />
      )}

      <main
        id="gallery"
        className={`mx-auto max-w-5xl px-3 pb-16 md:px-4 md:pb-12${showTabsRow ? "" : " pt-6 md:pt-8"}`}
      >
        {photos.loading && <GridSkeleton />}

        {photos.error && (
          <EmptyState type="error" onRetry={photos.retryLoad} />
        )}

        {!photos.loading && !photos.error && photos.allPhotos.length === 0 && (
          <EmptyState type="no-assets" />
        )}

        {!photos.loading && !photos.error && photos.allPhotos.length > 0 && isHome && (
          <>
            <FavoritesSection
              photos={favoritePhotos}
              selectMode={selection.selectMode}
              selectedIds={selection.selectedIds}
              hotPhotoIds={stats.hotPhotoIds}
              onPhotoClick={handlePhotoClick}
              onToggleSelect={selection.togglePhoto}
              actions={
                inlineSelect && favoritePhotos.length > 0
                  ? selectToggleBtn
                  : undefined
              }
            />
            <AlbumGrid
              folders={realFolders}
              photos={photos.shuffledPhotos}
              folderCounts={filters.folderCounts}
              onSelect={handleFolderSelect}
            />
            <HeroSection
              photos={heroPhotos}
              totalCount={photos.allPhotos.length}
              selectMode={selection.selectMode}
              selectedIds={selection.selectedIds}
              hotPhotoIds={stats.hotPhotoIds}
              onPhotoClick={handlePhotoClick}
              onToggleSelect={selection.togglePhoto}
              onBrowseAll={() => filters.setBrowseAll(true)}
              actions={
                inlineSelect && favoritePhotos.length === 0
                  ? selectToggleBtn
                  : undefined
              }
            />
          </>
        )}

        {!photos.loading && !photos.error && filters.isSearchActive && (
          <>
            {filters.filteredPhotos.length === 0 && search.matchResults === null && (
              <EmptyState type="no-results" query={search.debouncedQuery} />
            )}

            {search.matchResults !== null && search.matchResults.length === 0 && (
              <EmptyState type="no-match" />
            )}

            {filters.filteredPhotos.length > 0 && (
              <>
                <PhotoGrid
                  photos={visiblePhotos}
                  selectMode={selection.selectMode}
                  selectedIds={selection.selectedIds}
                  matchInfoMap={filters.matchInfoMap}
                  hotPhotoIds={stats.hotPhotoIds}
                  onPhotoClick={handlePhotoClick}
                  onToggleSelect={selection.togglePhoto}
                />
                {visibleCount < filters.filteredPhotos.length && (
                  <div ref={sentinelRef} className="h-8 w-full" />
                )}
              </>
            )}

            {search.matchResults !== null && search.recommendations.length > 0 && (
              <RecommendationsBar
                recommendations={search.recommendations}
                allPhotos={photos.allPhotos}
                onPhotoClick={handlePhotoClick}
              />
            )}
          </>
        )}
      </main>

      {!photos.loading && !photos.error && photos.allPhotos.length > 0 && (
        <footer className="border-t border-[var(--el-primary-15)] px-4 py-8 text-center">
          <p className="text-xs text-[var(--el-text-dim)]">
            {photos.allPhotos.length} фото · {photos.folders.length}{" "}
            {photos.folders.length === 1 ? "альбом" : photos.folders.length < 5 ? "альбома" : "альбомов"}
            {photos.lastUpdated && <> · обновлено {timeAgo(photos.lastUpdated)}</>}
          </p>
        </footer>
      )}

      <Lightbox
        photo={selectedPhoto}
        photos={filters.filteredPhotos}
        onClose={() => setSelectedPhoto(null)}
        onNavigate={setSelectedPhoto}
        isSelected={selectedPhoto ? selection.selectedIds.has(selectedPhoto.id) : false}
        onToggleSelect={(id: string) => {
          if (!selection.selectMode) selection.setSelectMode(true);
          selection.togglePhoto(id);
        }}
      />

      {photos.toast && (
        <Toast
          message={photos.toast.message}
          action={{ label: "Обновить", onClick: photos.refresh }}
          onDismiss={() => photos.setToast(null)}
        />
      )}

      {collage.showRatioModal && (
        <CollageRatioModal
          onSelect={collage.handleRatioSelect}
          onDismiss={() => collage.handleCollageDismiss()}
          selectedCount={selection.selectedIds.size}
        />
      )}

      {collage.collagePending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 rounded-full border-2 border-[var(--el-primary-22)] border-t-[var(--el-primary)] animate-crosshair-spin" />
            <span className="text-xs uppercase tracking-[0.2em] text-[var(--el-t-primary)]">
              Собираем коллаж…
            </span>
          </div>
        </div>
      )}

      {collage.collagePreviewUrl && (
        <CollagePreview
          blobUrl={collage.collagePreviewUrl}
          onDownload={collage.handleCollageDownload}
          onDismiss={collage.handleCollageDismiss}
        />
      )}

      <FloatingActionBar
        selectedCount={selection.selectedIds.size}
        totalCount={filters.filteredPhotos.length}
        onSelectAll={() => selection.selectAll(filters.filteredPhotos)}
        onClearSelection={selection.clearSelection}
        onDownloadZip={collage.handleDownloadZip}
        onMakeCollage={collage.startCollage}
        downloading={collage.downloading}
        collagePending={collage.collagePending}
      />
    </div>
  );
}
