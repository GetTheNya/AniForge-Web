import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../hooks/useNavigation';
import { useToast } from '../context/ToastContext';
import { useDatabase } from '../context/DatabaseContext';
import { useSettings } from '../context/SettingsContext';
import { supabase } from '../services/supabase';
import { userDb } from '../services/userDb';
import { rowToAnime, type Anime } from '../types/anime';
import Pagination from './Pagination';

interface RemoteCollection {
  collection_id: string;
  title: string;
  description: string | null;
}

interface RemoteCrossRef {
  anime_id: number;
  order_index: number;
}

interface AnimeCollectionItem {
  anime_id: number;
  order_index: number;
  anime: Anime | null;
}

export default function SharedCollectionView() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { search, navigate } = useNavigation();
  const { addToast: showToast } = useToast();
  const { db, status, queryObjects } = useDatabase();
  const { getAnimeTitle } = useSettings();

  const { targetUserId, collectionId } = useMemo(() => {
    const params = new URLSearchParams(search);
    return {
      targetUserId: params.get('userId') || '',
      collectionId: params.get('collectionId') || '',
    };
  }, [search]);

  const [collection, setCollection] = useState<RemoteCollection | null>(null);
  const [collectionItems, setCollectionItems] = useState<AnimeCollectionItem[]>([]);
  const [localCompletedAnimeIds, setLocalCompletedAnimeIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isCloning, setIsCloning] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [coWatchFilter, setCoWatchFilter] = useState(false);
  const [moviesFilter, setMoviesFilter] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 24;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, coWatchFilter, moviesFilter]);

  // Fetch Collection and CrossRefs
  const loadCollectionData = useCallback(async () => {
    if (!targetUserId || !collectionId || !db || status !== 'ready') return;
    setIsLoading(true);
    try {
      // 1. Fetch collection details
      const { data: rawCol, error: cError } = await supabase
        .from('collections')
        .select('collection_id, title, description')
        .eq('user_id', targetUserId)
        .eq('collection_id', collectionId)
        .single();

      if (cError) throw cError;
      setCollection(rawCol as RemoteCollection);

      // 2. Fetch collection cross refs (with 1000 limit break pagination)
      let refsPage = 0;
      let refsHasMore = true;
      const refs: RemoteCrossRef[] = [];
      const PAGE_SIZE = 1000;

      while (refsHasMore) {
        const start = refsPage * PAGE_SIZE;
        const end = start + PAGE_SIZE - 1;

        const { data: rawRefs, error: rError } = await supabase
          .from('collection_anime_cross_ref')
          .select('anime_id, order_index')
          .eq('user_id', targetUserId)
          .eq('collection_id', collectionId)
          .eq('is_deleted', false)
          .order('order_index', { ascending: true })
          .range(start, end);

        if (rError) throw rError;

        if (!rawRefs || rawRefs.length === 0) {
          refsHasMore = false;
        } else {
          refs.push(...(rawRefs as RemoteCrossRef[]));
          if (rawRefs.length < PAGE_SIZE) {
            refsHasMore = false;
          } else {
            refsPage++;
          }
        }
      }

      // 3. Hydrate with SQLite metadata
      if (refs.length > 0) {
        const ids = refs.map((r) => r.anime_id);
        const placeholders = ids.map(() => '?').join(',');
        const sql = `SELECT * FROM anime WHERE anilist_id IN (${placeholders})`;
        const rows = queryObjects<Record<string, unknown>>(sql, ids);

        const animeMap = new Map<number, Anime>();
        rows.forEach((row) => {
          const a = rowToAnime(row);
          a.displayTitle = getAnimeTitle(a);
          animeMap.set(a.anilist_id, a);
        });

        setCollectionItems(
          refs.map((ref) => ({
            anime_id: ref.anime_id,
            order_index: ref.order_index,
            anime: animeMap.get(ref.anime_id) ?? null,
          }))
        );
      } else {
        setCollectionItems([]);
      }

      // 4. Fetch our local Completed tracking ids from Dexie
      const localRecords = await userDb.user_tracking.toArray();
      const completedSet = new Set<number>();
      localRecords.forEach((r) => {
        if (!r.is_deleted && r.status === 'COMPLETED') {
          completedSet.add(r.anilist_id);
        }
      });
      setLocalCompletedAnimeIds(completedSet);
    } catch (err: any) {
      console.error('[shared-collection] Error loading collection:', err);
      showToast(t('socialScreen.networkExceptionAlert'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId, collectionId, db, status, queryObjects, getAnimeTitle, showToast, t]);

  useEffect(() => {
    loadCollectionData();
  }, [loadCollectionData]);

  // Compatibility mutual check list
  const [mutualTrackingMap, setMutualTrackingMap] = useState<Map<number, string>>(new Map());
  useEffect(() => {
    async function loadMutualList() {
      const records = await userDb.user_tracking.toArray();
      const map = new Map<number, string>();
      records.forEach((r) => {
        if (!r.is_deleted) {
          map.set(r.anilist_id, r.status);
        }
      });
      setMutualTrackingMap(map);
    }
    loadMutualList();
  }, []);

  // Filtered collection list
  const filteredList = useMemo(() => {
    return collectionItems.filter((item) => {
      // Text query search
      if (searchQuery.trim() && item.anime) {
        const title = item.anime.displayTitle || '';
        const enTitle = item.anime.title_en || '';
        const roTitle = item.anime.title_romaji || '';
        const ukTitle = item.anime.title_uk || '';
        const match =
          title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          enTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
          roTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ukTitle.toLowerCase().includes(searchQuery.toLowerCase());
        if (!match) return false;
      }

      // Co-watch: item is in our local list as PLANNING or CURRENT
      if (coWatchFilter) {
        const localStatus = mutualTrackingMap.get(item.anime_id);
        if (!localStatus || (localStatus !== 'PLANNING' && localStatus !== 'CURRENT')) return false;
      }

      // Movies only filter
      if (moviesFilter && item.anime?.format !== 'MOVIE') return false;

      return true;
    });
  }, [collectionItems, searchQuery, coWatchFilter, moviesFilter, mutualTrackingMap]);

  // Paginated collection list
  const paginatedList = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredList.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredList, currentPage, itemsPerPage]);

  // Local Completed Progress calculation
  const totalCount = collectionItems.length;
  const completedCount = useMemo(() => {
    return collectionItems.filter((item) => localCompletedAnimeIds.has(item.anime_id)).length;
  }, [collectionItems, localCompletedAnimeIds]);

  const progressFraction = totalCount > 0 ? completedCount / totalCount : 0;

  // Clone collection to Library
  const cloneCollection = async () => {
    if (!collection || collectionItems.length === 0 || !currentUser) return;
    setIsCloning(true);
    try {
      const newCollectionId = crypto.randomUUID();
      const now = Date.now();

      await userDb.transaction('rw', [userDb.collections, userDb.collection_anime_cross_ref], async () => {
        // 1. Create collection record
        await userDb.collections.add({
          id: newCollectionId,
          title: collection.title,
          description: collection.description || '',
          createdAt: now,
          is_synced: 0,
          is_deleted: 0,
          last_modified: now,
        });

        // 2. Add cross refs
        for (const item of collectionItems) {
          await userDb.collection_anime_cross_ref.add({
            collectionId: newCollectionId,
            animeId: item.anime_id,
            orderIndex: item.order_index,
            is_synced: 0,
            is_deleted: 0,
            last_modified: now,
          });
        }
      });

      showToast(t('socialScreen.cloneSuccess'), 'success');
      navigate('/library');
    } catch (err: any) {
      console.error('[shared-collection] Clone error:', err);
      showToast(err.message || 'Clone failed', 'error');
    } finally {
      setIsCloning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-sm text-[var(--color-text-secondary)]">
        {t('common.loading')}
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <h3 className="text-lg font-bold text-[var(--color-accent-rose)]">
          {t('collection.notFound')}
        </h3>
        <button
          onClick={() => navigate('/shared-profile', `?id=${targetUserId}`)}
          className="glass-button text-xs"
        >
          ← {t('profileScreen.userProfile')}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-16">
      {/* Back button */}
      <button
        onClick={() => navigate('/shared-profile', `?id=${targetUserId}`)}
        className="glass-badge py-1.5 px-3 bg-[var(--color-bg-input)] border-[var(--color-border-glass)] text-[var(--color-text-secondary)] hover:text-white transition-all cursor-pointer text-xs"
      >
        ← {t('profileScreen.userProfile')}
      </button>

      {/* Collection Title Header */}
      <div className="glass-card p-6 relative overflow-hidden backdrop-blur-xl bg-[#0C0C0E]/60 border border-[var(--color-border-glass)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1.5 flex-1 min-w-0">
          <h2 className="text-2xl font-black text-white truncate">
            {collection.title}
          </h2>
          {collection.description && (
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              {collection.description}
            </p>
          )}
        </div>

        <button
          onClick={cloneCollection}
          disabled={isCloning}
          className="glass-button text-xs px-4 py-2.5 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
        >
          {isCloning ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <span>📥</span>
          )}
          <span>{t('socialScreen.cloneCollection')}</span>
        </button>
      </div>

      {/* Local Completed Progress Section */}
      <div className="glass-card p-4 space-y-3 backdrop-blur-xl bg-[#0C0C0E]/60 border border-[var(--color-border-glass)]">
        <div className="flex justify-between items-center text-xs">
          <span className="text-[var(--color-text-secondary)] font-medium">
            {t('common.status')}: {filteredList.length} / {totalCount}
          </span>
          <span className="text-[var(--color-accent-primary)] font-bold">
            {t('socialScreen.localProgressLabel', { completed: completedCount, total: totalCount })}
          </span>
        </div>
        <div className="w-full h-2 bg-[var(--color-bg-input)] rounded-full overflow-hidden border border-white/5 shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] rounded-full progress-glow transition-all duration-500 ease-out"
            style={{ width: `${progressFraction * 100}%` }}
          />
        </div>
      </div>

      {/* Search & Filters */}
      <div className="glass-card p-4 flex flex-col md:flex-row gap-3 items-center backdrop-blur-xl bg-[#0C0C0E]/60 border border-[var(--color-border-glass)]">
        {/* Text Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('catalog.searchPlaceholderAnime')}
          className="w-full md:w-64 px-4 py-2 rounded-xl text-xs bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-primary)]"
        />

        <div className="flex gap-3 w-full md:w-auto">
          {/* Co-Watch Toggle */}
          <button
            onClick={() => setCoWatchFilter(!coWatchFilter)}
            className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              coWatchFilter
                ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)]'
                : 'border-[var(--color-border-glass)] bg-[var(--color-bg-input)] text-[var(--color-text-secondary)] hover:text-white'
            }`}
          >
            👥 {t('socialScreen.coWatch')}
          </button>

          {/* Movies Toggle */}
          <button
            onClick={() => setMoviesFilter(!moviesFilter)}
            className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              moviesFilter
                ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)]'
                : 'border-[var(--color-border-glass)] bg-[var(--color-bg-input)] text-[var(--color-text-secondary)] hover:text-white'
            }`}
          >
            🎬 {t('socialScreen.moviesOnly')}
          </button>
        </div>
      </div>

      {/* Grid of anime */}
      {filteredList.length === 0 ? (
        <div className="glass-card p-12 text-center text-sm text-[var(--color-text-tertiary)] bg-[#0C0C0E]/40 border border-[var(--color-border-glass)]">
          {t('common.noResults')}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {paginatedList.map((item) => {
              if (!item.anime) return null;
              const isCompleted = localCompletedAnimeIds.has(item.anime_id);

              return (
                <div
                  key={item.anime_id}
                  onClick={() => navigate('/anime', `?id=${item.anime_id}`)}
                  className="glass-card flex flex-col overflow-hidden relative group cursor-pointer border border-[var(--color-border-glass)] rounded-xl bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-card-hover)] transition-all duration-300"
                >
                  {/* Cover image */}
                  <div className="relative aspect-[3/4] overflow-hidden bg-[var(--color-bg-input)]">
                    <img
                      src={item.anime.cover_large || ''}
                      alt={item.anime.displayTitle}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    {/* Format Badge */}
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-black/60 backdrop-blur-md text-[var(--color-text-primary)] border border-white/10 uppercase tracking-wider">
                      {item.anime.format?.replace('_', ' ')}
                    </div>

                    {/* Completed status badge */}
                    {isCompleted && (
                      <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-[var(--color-accent-emerald)] text-black shadow-sm flex items-center gap-0.5">
                        ✓ {t('status.COMPLETED')}
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  <div className="p-3 flex-1 flex flex-col justify-between gap-1.5">
                    <h4 className="text-xs font-bold text-[var(--color-text-primary)] line-clamp-2 leading-snug">
                      {item.anime.displayTitle}
                    </h4>
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(filteredList.length / itemsPerPage)}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  );
}
