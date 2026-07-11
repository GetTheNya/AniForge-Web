import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { useContextMenu } from '../context/ContextMenuContext';
import { useUserTracking } from '../context/UserTrackingContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { userDb } from '../services/userDb';
import { STATUS_CONFIGS } from '../utils/statusConfig';
import { useUserCollections } from '../hooks/useUserCollections';
import { useTranslation } from 'react-i18next';

export default function CustomContextMenu() {
  const { isOpen, isExiting, position, animeId, animeData, closeContextMenu, closeContextMenuWithDelay } = useContextMenu();
  const { saveTracking, removeTracking, addAnimeToCollection, removeAnimeFromCollection } = useUserTracking();
  const { t } = useTranslation();

  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isCollectionsOpen, setIsCollectionsOpen] = useState(false);
  const [subPosition, setSubPosition] = useState<'right' | 'left'>('right');
  const [hoveredScore, setHoveredScore] = useState<number | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const collectionsTriggerRef = useRef<HTMLDivElement>(null);

  // Observe tracking record reactively
  const tracking = useLiveQuery(
    async () => {
      if (!animeId) return null;
      return userDb.user_tracking.get(animeId);
    },
    [animeId]
  );

  const animeCollectionIds = useLiveQuery(
    async () => {
      if (!animeId) return new Set<string>();
      const refs = await userDb.collection_anime_cross_ref
        .where('animeId')
        .equals(animeId)
        .toArray();
      return new Set(refs.filter((r) => r.is_deleted !== 1).map((r) => r.collectionId));
    },
    [animeId]
  );

  const { collections, isLoading: isCollectionsLoading } = useUserCollections();

  const isTracked = tracking && !tracking.is_deleted;
  const currentStatus = isTracked ? tracking.status : null;
  const currentProgress = isTracked ? tracking.episode_progress : 0;
  const currentScore = isTracked ? tracking.score : null;

  // Viewport bounds checking and collision adjustments
  useLayoutEffect(() => {
    if (!isOpen || !menuRef.current) {
      setCoords(null);
      return;
    }

    const rect = menuRef.current.getBoundingClientRect();
    const menuWidth = rect.width || 256;
    const menuHeight = rect.height || 340;

    let x = position.x;
    let y = position.y;

    if (x + menuWidth > window.innerWidth) {
      x = x - menuWidth;
    }
    if (y + menuHeight > window.innerHeight) {
      y = y - menuHeight;
    }

    // Keep within bounds with a small margin
    if (x < 8) x = 8;
    if (y < 8) y = 8;

    setCoords({ x, y });
  }, [isOpen, position]);

  // Check sub-menu viewport side collision
  useEffect(() => {
    if (!isOpen || !collectionsTriggerRef.current) return;
    const rect = collectionsTriggerRef.current.getBoundingClientRect();
    const submenuWidth = 240; // width of submenu (w-60)

    if (rect.right + submenuWidth > window.innerWidth) {
      setSubPosition('left');
    } else {
      setSubPosition('right');
    }
  }, [isOpen, isCollectionsOpen]);

  if (!isOpen) return null;

  const currentStatusConfig = STATUS_CONFIGS.find((c) => c.id === currentStatus);

  const handleStatusSelect = (statusId: string) => {
    saveTracking(animeId!, { status: statusId });
    closeContextMenuWithDelay();
  };

  const handleProgressChange = (newVal: number) => {
    const maxEps = animeData?.episodes;
    let val = newVal;
    if (val < 0) val = 0;
    if (maxEps && val > maxEps) val = maxEps;
    saveTracking(animeId!, { episode_progress: val });
  };

  const handleScoreSelect = (score: number) => {
    const newScore = currentScore === score ? null : score;
    saveTracking(animeId!, { score: newScore });
    closeContextMenuWithDelay();
  };

  const handleCollectionToggle = async (collectionId: string, hasCollection: boolean) => {
    if (hasCollection) {
      await removeAnimeFromCollection(collectionId, animeId!);
    } else {
      await addAnimeToCollection(collectionId, animeId!);
    }
  };

  const handleRemoveTracking = () => {
    removeTracking(animeId!);
    closeContextMenuWithDelay();
  };

  // Pre-calculated position styles
  const style: React.CSSProperties = coords
    ? { left: `${coords.x}px`, top: `${coords.y}px`, opacity: 1 }
    : { left: `${position.x}px`, top: `${position.y}px`, opacity: 0 };

  return (
    <div
      id="custom-context-menu"
      ref={menuRef}
      style={style}
      className={`fixed z-[1000] w-64 p-2 bg-[var(--color-bg-base)]/90 border border-[var(--color-border-glass)] backdrop-blur-md shadow-2xl rounded-xl text-xs text-[var(--color-text-primary)] transition-opacity duration-150 flex flex-col gap-1.5 select-none ${
        isExiting ? 'animate-context-menu-exit' : 'animate-context-menu'
      }`}
    >
      {/* Anime Title Header */}
      <div className="px-2 py-1 border-b border-[var(--color-border-glass)] mb-1">
        <h4 className="font-bold text-[var(--color-text-primary)] line-clamp-1">
          {animeData?.title_en || animeData?.title_romaji || t('contextMenu.title')}
        </h4>
        <p className="text-[10px] text-[var(--color-text-tertiary)] line-clamp-1">
          {animeData?.format || t('contextMenu.format')} • {animeData?.season_year || t('contextMenu.year')}
        </p>
      </div>

      {/* 1. Quick Status Selector */}
      <div className="flex flex-col">
        <button
          onClick={() => {
            setIsStatusOpen(!isStatusOpen);
            setIsCollectionsOpen(false);
          }}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors text-left font-medium cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span>📊</span>
            <span>{t('detail.watchStatus')}</span>
          </div>
          <div className="flex items-center gap-1">
            {currentStatusConfig ? (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-md text-white flex items-center gap-1 border border-white/10"
                style={{ backgroundColor: `${currentStatusConfig.color}90` }}
              >
                {t(`status.${currentStatusConfig.id}`)}
              </span>
            ) : (
              <span className="text-[10px] text-[var(--color-text-tertiary)]">
                {t('contextMenu.notTracking')}
              </span>
            )}
            <span className={`text-[10px] transition-transform duration-200 ${isStatusOpen ? 'rotate-90' : ''}`}>▶</span>
          </div>
        </button>

        {isStatusOpen && (
          <div className="mt-1 flex flex-col bg-white/5 border border-[var(--color-border-glass)] rounded-lg p-1 animate-page-enter">
            {STATUS_CONFIGS.map((config) => {
              const isActive = currentStatus === config.id;
              return (
                <button
                  key={config.id}
                  onClick={() => handleStatusSelect(config.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-white/5 active:bg-white/10 transition-colors text-left cursor-pointer ${
                    isActive ? 'text-white font-bold bg-white/5' : 'text-[var(--color-text-secondary)]'
                  }`}
                >
                  <span style={{ color: config.color }}>
                    {isActive ? config.activeIcon : config.inactiveIcon}
                  </span>
                  <span>{t(`status.${config.id}`)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Episode Progress Counter */}
      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-2">
          <span>🎬</span>
          <span>{t('contextMenu.progress')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleProgressChange(currentProgress - 1)}
            disabled={currentProgress <= 0}
            className="w-5 h-5 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 border border-[var(--color-border-glass)] disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-95 cursor-pointer"
          >
            -
          </button>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={currentProgress}
            onChange={(e) => {
              const val = parseInt(e.target.value.replace(/\D/g, ''), 10);
              handleProgressChange(isNaN(val) ? 0 : val);
            }}
            className="w-10 h-5 text-center bg-white/5 border border-[var(--color-border-glass)] rounded-md text-[11px] font-bold text-white focus:outline-none focus:border-[var(--color-accent-primary)] focus:ring-1 focus:ring-[var(--color-accent-primary)]/20"
          />
          <span className="text-[10px] text-[var(--color-text-tertiary)]">
            / {animeData?.episodes || '?'}
          </span>
          <button
            onClick={() => handleProgressChange(currentProgress + 1)}
            disabled={!!(animeData?.episodes && currentProgress >= animeData.episodes)}
            className="w-5 h-5 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 border border-[var(--color-border-glass)] disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-95 cursor-pointer"
          >
            +
          </button>
        </div>
      </div>

      {/* 3. Score Rating Stars */}
      <div className="flex flex-col gap-1 px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⭐</span>
            <span>{t('contextMenu.score')}</span>
          </div>
          <span className="text-[10px] font-bold text-[var(--color-accent-warm)]">
            {currentScore !== null ? `${currentScore}/10` : t('contextMenu.noScore')}
          </span>
        </div>
        <div
          className="flex items-center justify-between pt-1 gap-0.5"
          onMouseLeave={() => setHoveredScore(null)}
        >
          {Array.from({ length: 10 }).map((_, idx) => {
            const starValue = idx + 1;
            const isFilled = hoveredScore !== null ? starValue <= hoveredScore : (currentScore !== null && starValue <= currentScore);
            return (
              <button
                key={starValue}
                type="button"
                onMouseEnter={() => setHoveredScore(starValue)}
                onClick={() => handleScoreSelect(starValue)}
                className="focus:outline-none transition-transform duration-100 hover:scale-125 cursor-pointer"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-3.5 h-3.5"
                  fill={isFilled ? 'var(--color-accent-warm)' : 'none'}
                  stroke={isFilled ? 'var(--color-accent-warm)' : 'var(--color-text-tertiary)'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Add to Collection Sub-menu */}
      <div
        ref={collectionsTriggerRef}
        className="relative"
        onMouseEnter={() => setIsCollectionsOpen(true)}
        onMouseLeave={() => setIsCollectionsOpen(false)}
      >
        <button
          onClick={() => {
            setIsCollectionsOpen(!isCollectionsOpen);
            setIsStatusOpen(false);
          }}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors text-left font-medium cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span>📁</span>
            <span>{t('library.customCollections')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {animeCollectionIds && animeCollectionIds.size > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[var(--color-accent-primary)]/20 text-[var(--color-accent-primary)] border border-[var(--color-accent-primary)]/30">
                {animeCollectionIds.size}
              </span>
            )}
            <span className="text-[10px] text-[var(--color-text-tertiary)]">▶</span>
          </div>
        </button>

        {isCollectionsOpen && (
          <div
            style={{
              top: '-4px',
            }}
            className={`absolute w-60 p-2 bg-[var(--color-bg-base)]/95 border border-[var(--color-border-glass)] backdrop-blur-xl shadow-2xl rounded-xl flex flex-col gap-1 z-[1001] ${
              subPosition === 'left' ? 'right-full mr-1.5 animate-sub-menu-left' : 'left-full ml-1.5 animate-sub-menu-right'
            }`}
          >
            <div className="px-2 py-1 border-b border-[var(--color-border-glass)] mb-1 text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">
              {t('detail.addToCollection')}
            </div>
            {isCollectionsLoading ? (
              <div className="px-2.5 py-2 text-[var(--color-text-tertiary)] text-center animate-pulse">
                {t('common.loading')}
              </div>
            ) : collections.length === 0 ? (
              <div className="px-2.5 py-3 text-[var(--color-text-tertiary)] text-center flex flex-col gap-1">
                <span>{t('contextMenu.noCollections')}</span>
                <span className="text-[10px] text-[var(--color-text-muted)]">{t('contextMenu.createInLibrary')}</span>
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5">
                {collections.map((col) => {
                  const hasCollection = animeCollectionIds ? animeCollectionIds.has(col.id) : false;
                  return (
                    <button
                      key={col.id}
                      onClick={() => handleCollectionToggle(col.id, hasCollection)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-white/5 active:bg-white/10 transition-colors text-left cursor-pointer"
                    >
                      <span className="truncate pr-2 font-medium text-[var(--color-text-secondary)] hover:text-white">
                        {col.title}
                      </span>
                      <span className={`w-4 h-4 flex items-center justify-center rounded-md border border-[var(--color-border-glass)] transition-all ${
                        hasCollection
                          ? 'bg-[var(--color-accent-primary)] border-[var(--color-accent-primary)] text-white text-[10px] font-bold'
                          : 'bg-white/5 text-transparent'
                      }`}>
                        ✓
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <hr className="border-[var(--color-border-glass)] my-0.5" />

      {/* 5. Open in New Tab */}
      <a
        href={`/anime?id=${animeId}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={closeContextMenu}
        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors font-medium text-[var(--color-text-secondary)] hover:text-white"
      >
        <div className="flex items-center gap-2">
          <span>🔗</span>
          <span>{t('contextMenu.openNewTab')}</span>
        </div>
        <span>↗</span>
      </a>

      {/* 6. Remove Tracking */}
      {isTracked && (
        <button
          onClick={handleRemoveTracking}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--color-accent-rose)]/10 text-[var(--color-accent-rose)] transition-colors text-left font-semibold active:bg-[var(--color-accent-rose)]/20 cursor-pointer"
        >
          <span>🗑️</span>
          <span>{t('contextMenu.removeTracking')}</span>
        </button>
      )}
    </div>
  );
}
