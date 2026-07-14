import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { STATUS_COLORS } from '../utils/statusConfig';
import Pagination from './Pagination';

import { useNavigation } from '../hooks/useNavigation';
import { useToast } from '../context/ToastContext';
import { useDatabase } from '../context/DatabaseContext';
import { useSettings } from '../context/SettingsContext';
import { supabase } from '../services/supabase';
import { userDb } from '../services/userDb';
import { rowToAnime, type Anime } from '../types/anime';
import type { UserProfile } from '../types/supabase';
import ToggleChip from './ToggleChip';

interface RemoteTracking {
  anilist_id: number;
  watch_status: string;
  score: number | null;
  episode_progress: number | null;
  notes: string | null;
}

interface RemoteCollection {
  collection_id: string;
  title: string;
  description: string | null;
  created_at: string;
}

interface RemoteCrossRef {
  collection_id: string;
  anime_id: number;
  order_index: number;
}

interface TrackingWithAnime {
  tracking: RemoteTracking;
  anime: Anime | null;
}

interface CollectionWithAnime {
  collection: RemoteCollection;
  items: { anime_id: number; anime: Anime | null }[];
}

export default function SharedProfileView() {
  const { t } = useTranslation();
  const { search, navigate } = useNavigation();
  const { addToast: showToast } = useToast();
  const { db, status, queryObjects } = useDatabase();
  const { getAnimeTitle } = useSettings();

  const targetUserId = useMemo(() => {
    const params = new URLSearchParams(search);
    return params.get('id') || '';
  }, [search]);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Sync page title to document.title
  useEffect(() => {
    if (profile?.username) {
      document.title = `${t('socialScreen.sharedProfileTitle', { username: profile.username })} - AniForge Web`;
    } else {
      document.title = `${t('socialScreen.sharedProfileDefault', 'Shared Profile')} - AniForge Web`;
    }
  }, [profile, t]);

  const [activeTab, setActiveTab] = useState<'lists' | 'collections'>('lists');
  const [friendIncludedStatuses, setFriendIncludedStatuses] = useState<string[]>(['CURRENT']);
  const [friendExcludedStatuses, setFriendExcludedStatuses] = useState<string[]>([]);

  // Database lists
  const [remoteTracking, setRemoteTracking] = useState<RemoteTracking[]>([]);
  const [mutualTrackingMap, setMutualTrackingMap] = useState<Map<number, string>>(new Map()); // id -> status
  const [collections, setCollections] = useState<CollectionWithAnime[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [coWatchFilter, setCoWatchFilter] = useState(false);
  const [moviesFilter, setMoviesFilter] = useState(false);
  const [includedStatuses, setIncludedStatuses] = useState<string[]>([]);
  const [excludedStatuses, setExcludedStatuses] = useState<string[]>([]);
  const [isFilterPanelExpanded, setIsFilterPanelExpanded] = useState(false);

  // Roulette picker
  const [showRoulette, setShowRoulette] = useState(false);
  const [rouletteAnime, setRouletteAnime] = useState<Anime | null>(null);
  const [isRouletteSpinning, setIsRouletteSpinning] = useState(false);

  // Roulette portal transition states
  const [rouletteRendered, setRouletteRendered] = useState(false);
  const [rouletteVisible, setRouletteVisible] = useState(false);

  // Sync transitions for roulette portal modal
  useEffect(() => {
    if (showRoulette) {
      setRouletteRendered(true);
      const timer = setTimeout(() => {
        setRouletteVisible(true);
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setRouletteVisible(false);
      const timer = setTimeout(() => {
        setRouletteRendered(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showRoulette]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 24;

  // Reset page when filters, tab or status changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    coWatchFilter,
    moviesFilter,
    friendIncludedStatuses,
    friendExcludedStatuses,
    activeTab,
    includedStatuses,
    excludedStatuses,
  ]);

  // Fetch target user's profile
  const fetchProfile = useCallback(async () => {
    if (!targetUserId) return;
    setIsLoadingProfile(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url')
        .eq('id', targetUserId)
        .single();

      if (error) throw error;
      setProfile(data as UserProfile);
    } catch (err: any) {
      console.error('[shared-profile] Error fetching profile:', err);
      showToast(t('socialScreen.networkExceptionAlert'), 'error');
    } finally {
      setIsLoadingProfile(false);
    }
  }, [targetUserId, showToast, t]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Load lists & collections from Supabase
  const loadRemoteData = useCallback(async () => {
    if (!targetUserId || !db || status !== 'ready') return;
    setIsLoadingData(true);
    try {
      // 1. Fetch remote tracking list (with limit-break pagination, removing last_modified from select and sorting by it)
      let trackingPage = 0;
      let trackingHasMore = true;
      const trackingList: RemoteTracking[] = [];
      const PAGE_SIZE = 1000;

      while (trackingHasMore) {
        const start = trackingPage * PAGE_SIZE;
        const end = start + PAGE_SIZE - 1;

        const { data: rawTracking, error: tError } = await supabase
          .from('user_tracking')
          .select('anilist_id, watch_status, score, episode_progress, notes')
          .eq('user_id', targetUserId)
          .eq('is_deleted', false)
          .order('last_modified', { ascending: false })
          .range(start, end);

        if (tError) throw tError;

        if (!rawTracking || rawTracking.length === 0) {
          trackingHasMore = false;
        } else {
          trackingList.push(...(rawTracking as RemoteTracking[]));
          if (rawTracking.length < PAGE_SIZE) {
            trackingHasMore = false;
          } else {
            trackingPage++;
          }
        }
      }

      setRemoteTracking(trackingList);

      // 2. Fetch our own mutual list from local Dexie to compute overlap / local progress
      const localRecords = await userDb.user_tracking.toArray();
      const localMap = new Map<number, string>();
      localRecords.forEach((r) => {
        if (!r.is_deleted) {
          localMap.set(r.anilist_id, r.status);
        }
      });
      setMutualTrackingMap(localMap);

      // 3. Fetch remote collections
      let collectionsPage = 0;
      let collectionsHasMore = true;
      const cols: RemoteCollection[] = [];

      while (collectionsHasMore) {
        const start = collectionsPage * PAGE_SIZE;
        const end = start + PAGE_SIZE - 1;

        const { data: rawCols, error: cError } = await supabase
          .from('collections')
          .select('collection_id, title, description, created_at')
          .eq('user_id', targetUserId)
          .eq('is_deleted', false)
          .range(start, end);

        if (cError) throw cError;

        if (!rawCols || rawCols.length === 0) {
          collectionsHasMore = false;
        } else {
          cols.push(...(rawCols as RemoteCollection[]));
          if (rawCols.length < PAGE_SIZE) {
            collectionsHasMore = false;
          } else {
            collectionsPage++;
          }
        }
      }

      // 4. Fetch remote collection anime cross refs
      let refsPage = 0;
      let refsHasMore = true;
      const refs: RemoteCrossRef[] = [];

      while (refsHasMore) {
        const start = refsPage * PAGE_SIZE;
        const end = start + PAGE_SIZE - 1;

        const { data: rawRefs, error: rError } = await supabase
          .from('collection_anime_cross_ref')
          .select('collection_id, anime_id, order_index')
          .eq('user_id', targetUserId)
          .eq('is_deleted', false)
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

      // Resolve anime covers for collections (first 4 items of each)
      const allUniqueAnimeIds = Array.from(new Set(refs.map((r) => r.anime_id)));
      const animeMap = new Map<number, Anime>();

      if (allUniqueAnimeIds.length > 0) {
        const placeholders = allUniqueAnimeIds.map(() => '?').join(',');
        const sql = `SELECT * FROM anime WHERE anilist_id IN (${placeholders})`;
        const rows = queryObjects<Record<string, unknown>>(sql, allUniqueAnimeIds);
        rows.forEach((row) => {
          const a = rowToAnime(row);
          a.displayTitle = getAnimeTitle(a);
          animeMap.set(a.anilist_id, a);
        });
      }

      const structuredCollections: CollectionWithAnime[] = cols.map((col) => {
        const colRefs = refs
          .filter((r) => r.collection_id === col.collection_id)
          .sort((a, b) => a.order_index - b.order_index);

        return {
          collection: col,
          items: colRefs.map((ref) => ({
            anime_id: ref.anime_id,
            anime: animeMap.get(ref.anime_id) ?? null,
          })),
        };
      });

      setCollections(structuredCollections);
    } catch (err: any) {
      console.error('[shared-profile] Error loading remote database data:', err);
    } finally {
      setIsLoadingData(false);
    }
  }, [targetUserId, db, status, queryObjects, getAnimeTitle]);

  useEffect(() => {
    loadRemoteData();
  }, [loadRemoteData]);

  // Compute compatibility score
  const compatibilityScore = useMemo(() => {
    if (remoteTracking.length === 0) return 0;
    const remoteIds = new Set(remoteTracking.map((t) => t.anilist_id));
    const localOverlap = Array.from(mutualTrackingMap.keys()).filter((id) =>
      remoteIds.has(id)
    );
    return Math.round((localOverlap.length / remoteTracking.length) * 100);
  }, [remoteTracking, mutualTrackingMap]);

  // Hydrate tracking list with metadata from catalog SQLite
  const hydratedTrackingList = useMemo<TrackingWithAnime[]>(() => {
    if (remoteTracking.length === 0 || !db || status !== 'ready') return [];

    try {
      const ids = remoteTracking.map((r) => r.anilist_id);
      const placeholders = ids.map(() => '?').join(',');
      const sql = `SELECT * FROM anime WHERE anilist_id IN (${placeholders})`;
      const rows = queryObjects<Record<string, unknown>>(sql, ids);

      const animeMap = new Map<number, Anime>();
      rows.forEach((row) => {
        const a = rowToAnime(row);
        a.displayTitle = getAnimeTitle(a);
        animeMap.set(a.anilist_id, a);
      });

      return remoteTracking.map((t) => ({
        tracking: t,
        anime: animeMap.get(t.anilist_id) ?? null,
      }));
    } catch (e) {
      console.error('[shared-profile] Catalog mapping query failed:', e);
      return remoteTracking.map((t) => ({ tracking: t, anime: null }));
    }
  }, [remoteTracking, db, status, queryObjects, getAnimeTitle]);

  // Filtered lists for rendering
  const filteredList = useMemo(() => {
    return hydratedTrackingList.filter((item) => {
      // Status filter
      const friendStatus = item.tracking.watch_status;
      if (friendIncludedStatuses.length > 0 && !friendIncludedStatuses.includes(friendStatus)) return false;
      if (friendExcludedStatuses.length > 0 && friendExcludedStatuses.includes(friendStatus)) return false;

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

      // Co-watch filter: target item exists in our local Dexie watchlist
      if (coWatchFilter) {
        if (!mutualTrackingMap.has(item.tracking.anilist_id)) return false;
      }

      // Movies filter
      if (moviesFilter && item.anime?.format !== 'MOVIE') return false;

      // My List Status Filter
      if (includedStatuses.length > 0 || excludedStatuses.length > 0) {
        const localStatus = mutualTrackingMap.get(item.tracking.anilist_id) || 'NOT_IN_LIST';
        if (includedStatuses.length > 0 && !includedStatuses.includes(localStatus)) return false;
        if (excludedStatuses.length > 0 && excludedStatuses.includes(localStatus)) return false;
      }

      return true;
    });
  }, [
    hydratedTrackingList,
    friendIncludedStatuses,
    friendExcludedStatuses,
    searchQuery,
    coWatchFilter,
    moviesFilter,
    includedStatuses,
    excludedStatuses,
    mutualTrackingMap,
  ]);

  // Paginated tracking list
  const paginatedList = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredList.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredList, currentPage, itemsPerPage]);

  // Spin Roulette Pick
  const triggerRoulette = () => {
    const listToPick = filteredList.map((item) => item.anime).filter(Boolean) as Anime[];
    if (listToPick.length === 0) {
      showToast(t('socialScreen.noOverlappingPlanning'), 'warning');
      return;
    }
    setShowRoulette(true);
    setIsRouletteSpinning(true);

    let counter = 0;
    const interval = setInterval(() => {
      const idx = Math.floor(Math.random() * listToPick.length);
      setRouletteAnime(listToPick[idx]);
      counter++;
      if (counter > 12) {
        clearInterval(interval);
        setIsRouletteSpinning(false);
      }
    }, 120);
  };



  if (isLoadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-sm text-[var(--color-text-secondary)]">
        {t('common.loading')}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <h3 className="text-lg font-bold text-[var(--color-accent-rose)]">
          {t('socialScreen.networkExceptionAlert')}
        </h3>
        <button
          onClick={() => navigate('/social')}
          className="glass-button text-xs"
        >
          ← {t('socialScreen.name')}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-16">
      {/* Back to social */}
      <button
        onClick={() => navigate('/social')}
        className="glass-badge py-1.5 px-3 bg-[var(--color-bg-input)] border-[var(--color-border-glass)] text-[var(--color-text-secondary)] hover:text-white transition-all cursor-pointer text-xs"
      >
        ← {t('socialScreen.name')}
      </button>

      {/* User Header Profile Card */}
      <div className="glass-card p-6 relative overflow-hidden backdrop-blur-xl bg-[#0C0C0E]/60 border border-[var(--color-border-glass)]">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-accent-primary)]/5 rounded-full filter blur-3xl pointer-events-none -mr-32 -mt-32" />

        <div className="flex flex-col sm:flex-row items-center gap-5 relative z-10">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden border-2 border-[var(--color-border-glass)] bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] font-bold text-2xl select-none shrink-0 shadow-lg">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
            ) : (
              <span>{(profile.username || 'U')[0].toUpperCase()}</span>
            )}
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <h2 className="text-2xl font-black text-white">{profile.username}</h2>
            
            {/* Compatibility Badge */}
            {remoteTracking.length > 0 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] border border-[var(--color-accent-primary)]/30 shadow-[0_0_8px_rgba(139,92,246,0.15)]">
                <span>⚡</span>
                <span>{t('socialScreen.commonTitlesBadge', { count: compatibilityScore })}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab Selectors */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('lists')}
          className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'lists'
              ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)]'
              : 'border-[var(--color-border-glass)] bg-[var(--color-bg-input)] text-[var(--color-text-secondary)] hover:text-white'
          }`}
        >
          📋 {t('socialScreen.tabLists')}
        </button>
        <button
          onClick={() => setActiveTab('collections')}
          className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'collections'
              ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)]'
              : 'border-[var(--color-border-glass)] bg-[var(--color-bg-input)] text-[var(--color-text-secondary)] hover:text-white'
          }`}
        >
          📁 {t('socialScreen.tabCollections')}
        </button>
      </div>

      {/* Lists Tab View */}
      {activeTab === 'lists' && (
        <div className="space-y-4">
          {/* Status Sub-filter Chips */}
          <div className="flex flex-wrap gap-2">
            {['CURRENT', 'COMPLETED', 'PLANNING', 'PAUSED', 'DROPPED'].map((stat) => {
              const isIncluded = friendIncludedStatuses.includes(stat);
              const isExcluded = friendExcludedStatuses.includes(stat);
              const color = STATUS_COLORS[stat as keyof typeof STATUS_COLORS];

              let customStyle: React.CSSProperties = {};
              if (isIncluded) {
                customStyle = {
                  borderColor: color,
                  backgroundColor: `${color}1a`, // 10% opacity
                  color: color,
                  boxShadow: `0 0 12px ${color}20`,
                };
              } else if (isExcluded) {
                customStyle = {
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  color: '#f87171',
                  textDecoration: 'line-through',
                };
              }

              return (
                <button
                  key={stat}
                  onClick={() => {
                    setFriendIncludedStatuses([stat]);
                    setFriendExcludedStatuses([]);
                  }}
                  style={customStyle}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    isIncluded || isExcluded
                      ? ''
                      : 'border-[var(--color-border-glass)] bg-[var(--color-bg-input)] text-[var(--color-text-secondary)] hover:text-white'
                  }`}
                >
                  {t(`status.${stat}`)}
                </button>
              );
            })}
          </div>
          {/* Filters card */}
          <div className="glass-card p-4 flex flex-col gap-4 backdrop-blur-xl bg-[#0C0C0E]/60 border border-[var(--color-border-glass)]">
            <div className="flex flex-col md:flex-row gap-3 items-center w-full">
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

                {/* Anime Roulette Spin */}
                <button
                  onClick={triggerRoulette}
                  className="flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-bold border border-[var(--color-accent-rose)]/40 bg-[var(--color-accent-rose)]/10 text-[var(--color-accent-rose)] hover:bg-[var(--color-accent-rose)] hover:text-white transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  🎰 {t('socialScreen.randomPick')}
                </button>

                {/* Filter Panel Toggle Button */}
                <button
                  onClick={() => setIsFilterPanelExpanded(!isFilterPanelExpanded)}
                  className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    isFilterPanelExpanded
                      ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] shadow-[0_0_12px_rgba(139,92,246,0.15)]'
                      : 'border-[var(--color-border-glass)] bg-[var(--color-bg-input)] text-[var(--color-text-secondary)] hover:text-white'
                  }`}
                >
                  ⚙️ {t('filter.title')}
                </button>
              </div>
            </div>

            {/* Collapsible Filter Panel */}
            {isFilterPanelExpanded && (
              <div className="flex flex-col gap-4 border-t border-[var(--color-border-glass)] pt-3 transition-all duration-300 animate-fade-in">
                {/* Friend's List Status Filters */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    {t('socialScreen.friendFiltersLabel')}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {['CURRENT', 'COMPLETED', 'PLANNING', 'PAUSED', 'DROPPED'].map((key) => {
                      const isActive = friendIncludedStatuses.includes(key);
                      const isExcluded = friendExcludedStatuses.includes(key);
                      const label = t(`status.${key}`);

                      return (
                        <ToggleChip
                          key={key}
                          label={label}
                          isActive={isActive}
                          isExcluded={isExcluded}
                          onToggle={() => {
                            if (isExcluded) {
                              setFriendExcludedStatuses(prev => prev.filter(k => k !== key));
                            } else if (isActive) {
                              setFriendIncludedStatuses(prev => prev.filter(k => k !== key));
                              setFriendExcludedStatuses(prev => [...prev, key]);
                            } else {
                              setFriendIncludedStatuses(prev => [...prev, key]);
                            }
                          }}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* My List Status Filters */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    {t('socialScreen.localUserFiltersLabel')}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {['NOT_IN_LIST', 'CURRENT', 'COMPLETED', 'PLANNING', 'PAUSED', 'DROPPED'].map((key) => {
                      const isActive = includedStatuses.includes(key);
                      const isExcluded = excludedStatuses.includes(key);
                      const label = key === 'NOT_IN_LIST' 
                        ? t('contextMenu.notTracking') 
                        : t(`status.${key}`);

                      return (
                        <ToggleChip
                          key={key}
                          label={label}
                          isActive={isActive}
                          isExcluded={isExcluded}
                          onToggle={() => {
                            if (isExcluded) {
                              setExcludedStatuses(prev => prev.filter(k => k !== key));
                            } else if (isActive) {
                              setIncludedStatuses(prev => prev.filter(k => k !== key));
                              setExcludedStatuses(prev => [...prev, key]);
                            } else {
                              setIncludedStatuses(prev => [...prev, key]);
                            }
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* List count header */}
          <div className="flex items-center justify-between border-b border-[var(--color-border-glass)] pb-2 mt-6">
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
              {friendIncludedStatuses.length === 0
                ? t('socialScreen.tabLists')
                : friendIncludedStatuses.map((s) => t(`status.${s}`)).join(', ')}
            </h3>
            <span className="text-xs font-semibold text-[var(--color-text-secondary)] bg-[var(--color-bg-input)] px-2.5 py-1 rounded-lg border border-[var(--color-border-glass)]">
              {t('socialScreen.animeCount', { count: filteredList.length })}
            </span>
          </div>

          {/* List contents */}
          {isLoadingData ? (
            <div className="text-center py-12 text-xs text-[var(--color-text-secondary)]">
              {t('common.loading')}
            </div>
          ) : filteredList.length === 0 ? (
            <div className="glass-card p-12 text-center text-sm text-[var(--color-text-tertiary)] bg-[#0C0C0E]/40 border border-[var(--color-border-glass)]">
              {t('socialScreen.noActiveAnime')}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {paginatedList.map((item) => {
                  if (!item.anime) return null;
                  const progress = item.tracking.episode_progress || 0;
                  const maxEpisodes = item.anime.episodes || 0;
                  const score = item.tracking.score;

                  return (
                    <div
                      key={item.tracking.anilist_id}
                      onClick={() => navigate('/anime', `?id=${item.tracking.anilist_id}`)}
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

                        {/* Score Badge */}
                        {score !== null && score !== 0 && (
                          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-[var(--color-accent-warm)] text-black border border-amber-400/20 shadow-sm flex items-center gap-0.5">
                            ★ {score}
                          </div>
                        )}

                        {/* Episode Progress Indicator */}
                        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2 px-2 py-1 rounded-lg text-[9px] font-bold bg-black/75 backdrop-blur-md border border-white/5 text-[var(--color-text-secondary)]">
                          <span>
                            {t('socialScreen.episodeProgress', { episode: progress, total: maxEpisodes || '?' })}
                          </span>
                        </div>
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
      )}

      {/* Collections Tab View */}
      {activeTab === 'collections' && (
        <div className="space-y-4">
          {isLoadingData ? (
            <div className="text-center py-12 text-xs text-[var(--color-text-secondary)]">
              {t('common.loading')}
            </div>
          ) : collections.length === 0 ? (
            <div className="glass-card p-12 text-center text-sm text-[var(--color-text-tertiary)] bg-[#0C0C0E]/40 border border-[var(--color-border-glass)]">
              {t('socialScreen.noCollections')}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {collections.map(({ collection, items }) => {
                // Get first 4 resolved cover items for thumbnails preview
                const previews = items.slice(0, 4).map((i) => i.anime?.cover_large).filter(Boolean);

                return (
                  <div
                    key={collection.collection_id}
                    onClick={() =>
                      navigate(
                        '/shared-collection',
                        `?userId=${targetUserId}&collectionId=${collection.collection_id}`
                      )
                    }
                    className="glass-card p-4 relative overflow-hidden backdrop-blur-xl bg-[#0C0C0E]/60 border border-[var(--color-border-glass)] hover:bg-[var(--color-bg-card-hover)] hover:border-[var(--color-border-glass-hover)] transition-all duration-300 flex gap-4 cursor-pointer"
                  >
                    {/* Previews grids (4 thumbnails) */}
                    <div className="w-20 h-20 rounded-lg overflow-hidden grid grid-cols-2 grid-rows-2 gap-0.5 bg-[var(--color-bg-input)] border border-white/5 shrink-0">
                      {previews.length > 0 ? (
                        previews.map((src, idx) => (
                          <img
                            key={idx}
                            src={src || ''}
                            alt="thumbnail"
                            className="w-full h-full object-cover"
                          />
                        ))
                      ) : (
                        <div className="col-span-2 row-span-2 flex items-center justify-center text-xs text-[var(--color-text-tertiary)]">
                          📁
                        </div>
                      )}
                      {previews.length > 0 && previews.length < 4 && (
                        <div className="bg-white/5 flex items-center justify-center text-[10px] text-[var(--color-text-secondary)]">
                          +
                        </div>
                      )}
                    </div>

                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      <div>
                        <h4 className="text-sm font-black text-white truncate">
                          {collection.title}
                        </h4>
                        <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 mt-1 leading-normal">
                          {collection.description || t('library.noDescription')}
                        </p>
                      </div>
                      <span className="text-[10px] text-[var(--color-text-tertiary)] mt-2">
                        {items.length} titles
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Anime Roulette Portal Modal */}
      {rouletteRendered && createPortal(
        <div
          className={`fixed inset-0 bg-black/75 z-[100] flex items-center justify-center p-4 transition-all duration-300 ease-out ${
            rouletteVisible ? 'opacity-100 backdrop-blur-md' : 'opacity-0 backdrop-blur-none'
          }`}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isRouletteSpinning) {
              setShowRoulette(false);
              setRouletteAnime(null);
            }
          }}
        >
          <div
            className={`glass-card max-w-sm w-full p-6 relative bg-[var(--color-bg-elevated)] border border-[var(--color-border-glass)] rounded-2xl shadow-2xl text-center space-y-6 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              rouletteVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            <h3 className="text-lg font-black text-[var(--color-accent-rose)] tracking-wide uppercase">
              🎰 {t('socialScreen.animeRouletteTitle')}
            </h3>

            {rouletteAnime ? (
              <div className="space-y-4">
                {/* Poster display */}
                <div className="w-48 h-64 mx-auto rounded-xl overflow-hidden shadow-lg border border-white/5 relative bg-[var(--color-bg-input)]">
                  <img
                    src={rouletteAnime.cover_large || ''}
                    alt={rouletteAnime.displayTitle}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h4 className="text-sm font-black text-white line-clamp-2 px-2">
                  {rouletteAnime.displayTitle}
                </h4>
              </div>
            ) : (
              <div className="w-48 h-64 mx-auto bg-white/5 border border-dashed border-[var(--color-border-glass)] rounded-xl flex items-center justify-center text-xs text-[var(--color-text-secondary)] animate-pulse">
                🎲 ...
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                disabled={isRouletteSpinning}
                onClick={() => {
                  if (rouletteAnime) {
                    setShowRoulette(false);
                    navigate('/anime', `?id=${rouletteAnime.anilist_id}`);
                  }
                }}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary)]/80 text-white cursor-pointer disabled:opacity-50 transition-all"
              >
                {t('socialScreen.viewDetails')}
              </button>
              <button
                disabled={isRouletteSpinning}
                onClick={triggerRoulette}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] hover:border-white text-[var(--color-text-primary)] cursor-pointer disabled:opacity-50 transition-all"
              >
                {t('socialScreen.reroll')}
              </button>
              <button
                disabled={isRouletteSpinning}
                onClick={() => {
                  setShowRoulette(false);
                  setRouletteAnime(null);
                }}
                className="w-full py-2 rounded-xl text-xs font-semibold text-[var(--color-text-secondary)] hover:text-white cursor-pointer disabled:opacity-50 transition-all"
              >
                {t('detail.close')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
