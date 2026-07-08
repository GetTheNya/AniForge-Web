import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigation } from '../hooks/useNavigation';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useUserTracking } from '../context/UserTrackingContext';
import { useSupabaseLists, type TrackingWithAnime } from '../hooks/useSupabaseLists';
import { useUserCollections } from '../hooks/useUserCollections';
import { useLiveQuery } from 'dexie-react-hooks';
import { userDb } from '../services/userDb';
import { useDatabase } from '../context/DatabaseContext';
import AnimeCard from './AnimeCard';
import Pagination from './Pagination';
import { STATUS_COLORS_BG } from '../utils/statusConfig';
import { useSettings } from '../context/SettingsContext';
import { useCatalogMeta } from '../hooks/useCatalogMeta';
import { buildSqlFilterQuery } from '../services/queryBuilder';
import { rowToAnime } from '../types/anime';
import { EMPTY_FILTER, type SearchFilterQuery } from '../types/filters';
import SearchBar from './SearchBar';
import FilterPanel from './FilterPanel';

export default function LibraryView() {
  const { user, signInWithGoogle } = useAuth();
  const { navigate } = useNavigation();
  const { t } = useTranslation();
  const { saveCollection } = useUserTracking();

  // Tab state: 'lists' (My Lists) or 'collections' (Custom Collections)
  const [activeTab, setActiveTab] = useState<'lists' | 'collections'>('lists');
  
  // Lists sub-tab state (watch status)
  const [activeStatus, setActiveStatus] = useState<string>('CURRENT');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 24;

  const { db, status, queryObjects } = useDatabase();
  const { getAnimeTitle } = useSettings();
  const catalogMeta = useCatalogMeta();

  // Filter state
  const [filter, setFilter] = useState<SearchFilterQuery>(EMPTY_FILTER);
  const [filteredTrackingList, setFilteredTrackingList] = useState<TrackingWithAnime[]>([]);
  const [isFiltering, setIsFiltering] = useState(false);

  // Reset page when tab, watch status, or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, activeStatus, filter]);

  // Reset filter when tab or watch status changes
  useEffect(() => {
    setFilter(EMPTY_FILTER);
  }, [activeTab, activeStatus]);

  // Load tracking list (contains tracking + anime object)
  const { trackingList, isLoading: isListsLoading } = useSupabaseLists();
  
  // Load custom collections
  const { collections, isLoading: isCollectionsLoading } = useUserCollections();

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal transition states
  const [collectionModalRendered, setCollectionModalRendered] = useState(false);
  const [collectionModalVisible, setCollectionModalVisible] = useState(false);

  // Sync transitions for modal portal
  useEffect(() => {
    if (showModal) {
      setCollectionModalRendered(true);
      const timer = setTimeout(() => {
        setCollectionModalVisible(true);
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setCollectionModalVisible(false);
      const timer = setTimeout(() => {
        setCollectionModalRendered(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showModal]);

  // Group tracking by watch status (base items for filtering)
  const statusTrackingList = useMemo(() => {
    return trackingList.filter((item) => item.tracking.watch_status === activeStatus);
  }, [trackingList, activeStatus]);

  // Check if filters are active
  const isFiltered = useMemo(() => {
    let activeCount = 0;
    if (filter.genres.length) activeCount++;
    if (filter.excludedGenres.length) activeCount++;
    if (filter.studios.length) activeCount++;
    if (filter.excludedStudios.length) activeCount++;
    if (filter.tags.length) activeCount++;
    if (filter.excludedTags.length) activeCount++;
    if (filter.minScore !== null) activeCount++;
    if (filter.maxScore !== null) activeCount++;
    if (filter.episodeGroups.length) activeCount++;
    if (filter.excludedEpisodeGroups.length) activeCount++;
    if (filter.formats.length) activeCount++;
    if (filter.excludedFormats.length) activeCount++;
    if (filter.hasUkTranslation !== null) activeCount++;
    if (filter.mediaStatuses.length) activeCount++;
    if (filter.excludedMediaStatuses.length) activeCount++;
    if (filter.mediaSources.length) activeCount++;
    if (filter.excludedMediaSources.length) activeCount++;
    if (filter.staff.length) activeCount++;
    if (filter.excludedStaff.length) activeCount++;
    
    return filter.textQuery.trim() !== '' || activeCount > 0 || filter.sortBy !== 'SCORE';
  }, [filter]);

  // Perform SQLite filtering on the status-grouped tracking items
  useEffect(() => {
    if (!statusTrackingList || statusTrackingList.length === 0) {
      setFilteredTrackingList([]);
      return;
    }

    if (!isFiltered) {
      setFilteredTrackingList(statusTrackingList);
      return;
    }

    if (!db || status !== 'ready') {
      setFilteredTrackingList(statusTrackingList);
      return;
    }

    setIsFiltering(true);
    const run = async () => {
      try {
        const animeIds = statusTrackingList
          .map((item) => item.tracking.anilist_id)
          .filter((id): id is number => typeof id === 'number' && !isNaN(id));

        if (animeIds.length === 0) {
          setFilteredTrackingList([]);
          return;
        }

        const { sql, params } = buildSqlFilterQuery(filter, {
          matchingUserListIds: animeIds,
        });

        const rows = queryObjects<Record<string, unknown>>(sql, params);
        const matchedAnimeList = rows.map((row) => {
          const anime = rowToAnime(row);
          anime.displayTitle = getAnimeTitle(anime);
          return anime;
        });

        const trackingMap = new Map<number, TrackingWithAnime>();
        for (const item of statusTrackingList) {
          if (item.tracking.anilist_id) {
            trackingMap.set(item.tracking.anilist_id, item);
          }
        }

        const result: TrackingWithAnime[] = [];
        for (const anime of matchedAnimeList) {
          const matchedItem = trackingMap.get(anime.anilist_id);
          if (matchedItem) {
            result.push({
              tracking: matchedItem.tracking,
              anime: anime,
            });
          }
        }

        setFilteredTrackingList(result);
      } catch (err) {
        console.error('[LibraryView] Error filtering statusTrackingList:', err);
        setFilteredTrackingList(statusTrackingList);
      } finally {
        setIsFiltering(false);
      }
    };

    run();
  }, [db, status, statusTrackingList, filter, isFiltered, queryObjects, getAnimeTitle]);

  const isLoading = isListsLoading || isFiltering;

  const totalPages = Math.ceil(filteredTrackingList.length / itemsPerPage);
  const safePage = Math.min(currentPage, Math.max(1, totalPages));

  const paginatedTracking = useMemo(() => {
    const startIndex = (safePage - 1) * itemsPerPage;
    return filteredTrackingList.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTrackingList, safePage]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTitle.trim()) return;

    setIsSubmitting(true);
    try {
      const collectionId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
      await saveCollection(collectionId, newTitle.trim(), newDescription.trim());
      setNewTitle('');
      setNewDescription('');
      setShowModal(false);
      // Navigate to the newly created collection details view
      navigate('/collection', `?id=${collectionId}`);
    } catch (err) {
      console.error('[LibraryView] Failed to create collection:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border-glass)] flex items-center justify-center text-3xl">
          🔒
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{t('library.syncTitle')}</h2>
          <p className="text-sm text-[var(--color-text-secondary)] max-w-sm">
            {t('library.syncSubtext')}
          </p>
        </div>
        <button
          onClick={signInWithGoogle}
          className="flex items-center gap-2 glass-button text-sm cursor-pointer"
        >
          {t('common.signInGoogle')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border-glass)] pb-5">
        <div>
          <h2 className="text-2xl font-black text-[var(--color-text-primary)]">{t('library.title')}</h2>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
            {t('library.subtext')}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-[var(--color-bg-input)] p-1 rounded-xl border border-[var(--color-border-glass)] self-start sm:self-center">
          <button
            onClick={() => setActiveTab('lists')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'lists'
                ? 'bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] text-white shadow-md'
                : 'text-[var(--color-text-secondary)] hover:text-white'
            }`}
          >
            {t('library.myLists')}
          </button>
          <button
            onClick={() => setActiveTab('collections')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'collections'
                ? 'bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] text-white shadow-md'
                : 'text-[var(--color-text-secondary)] hover:text-white'
            }`}
          >
            {t('library.customCollections')}
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {activeTab === 'lists' ? (
        <div className="space-y-6">
          {/* Lists Subtabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {[
              { status: 'PLANNING', label: t('status.PLANNING'), color: STATUS_COLORS_BG.PLANNING },
              { status: 'CURRENT', label: t('status.CURRENT'), color: STATUS_COLORS_BG.CURRENT },
              { status: 'COMPLETED', label: t('status.COMPLETED'), color: STATUS_COLORS_BG.COMPLETED },
              { status: 'PAUSED', label: t('status.PAUSED'), color: STATUS_COLORS_BG.PAUSED },
              { status: 'DROPPED', label: t('status.DROPPED'), color: STATUS_COLORS_BG.DROPPED },
            ].map((tab) => {
              const count = trackingList.filter((item) => item.tracking.watch_status === tab.status).length;
              return (
                <button
                  key={tab.status}
                  onClick={() => setActiveStatus(tab.status)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all shrink-0 ${
                    activeStatus === tab.status
                      ? 'border-[var(--color-border-glass-hover)] bg-[var(--color-bg-card-hover)] text-white shadow-sm'
                      : 'border-[var(--color-border-glass)] bg-transparent text-[var(--color-text-secondary)] hover:text-white'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${tab.color}`} />
                  <span>{tab.label}</span>
                  <span className="text-[10px] bg-[var(--color-bg-input)] px-1.5 py-0.5 rounded-full text-[var(--color-text-tertiary)] border border-[var(--color-border-glass)]">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search and Filters */}
          {statusTrackingList.length > 0 && (
            <div className="space-y-4 pb-2">
              <SearchBar
                value={filter.textQuery}
                onChange={(text) =>
                  setFilter((prev) => ({
                    ...prev,
                    textQuery: text,
                    sortBy: text.length > 0 ? 'RELEVANCE' : prev.sortBy === 'RELEVANCE' ? 'SCORE' : prev.sortBy,
                  }))
                }
                resultCount={filteredTrackingList.length}
                isSearching={isFiltering}
                placeholder="Search anime..."
              />
              <FilterPanel
                filter={filter}
                onChange={setFilter}
                genres={catalogMeta.genres}
                tags={catalogMeta.tags}
                studios={catalogMeta.studios}
                isLoaded={catalogMeta.isLoaded}
                hideUserStatusFilters={true}
              />
            </div>
          )}

          {/* List Content */}
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-xl skeleton" />
              ))}
            </div>
          ) : filteredTrackingList.length > 0 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {paginatedTracking.map((item, i) => (
                  item.anime ? (
                    <AnimeCard key={item.tracking.anilist_id} anime={item.anime} index={i} />
                  ) : (
                    <div key={item.tracking.anilist_id} className="glass-card p-4 flex flex-col items-center justify-center text-center aspect-[3/4]">
                      <span className="text-2xl">❔</span>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-2">{t('library.notInCatalog')}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)] mt-1">ID: {item.tracking.anilist_id}</p>
                    </div>
                  )
                ))}
              </div>
              <Pagination
                currentPage={safePage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-[var(--color-border-glass)] rounded-2xl gap-3">
              <span className="text-3xl opacity-30">{isFiltered ? '🎬' : '📚'}</span>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {isFiltered ? 'No anime matches the selected filters.' : t('library.noTrackedAnime')}
              </p>
              {!isFiltered && (
                <button
                  onClick={() => navigate('/')}
                  className="text-xs text-[var(--color-accent-primary)] hover:underline cursor-pointer font-bold"
                >
                  {t('library.goToCatalog')}
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Create Button Container */}
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-[var(--color-text-secondary)]">{t('library.myCollections')}</h3>
            <button
              onClick={() => setShowModal(true)}
              className="glass-badge hover:bg-[var(--color-bg-card-hover)] border-[var(--color-border-glass)] text-[var(--color-accent-secondary)] hover:text-white cursor-pointer py-1.5 px-3 rounded-xl font-bold text-xs"
            >
              {t('library.createCollection')}
            </button>
          </div>

          {/* Collections Grid */}
          {isCollectionsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-40 rounded-2xl skeleton" />
              ))}
            </div>
          ) : collections.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {collections.map((col) => (
                <CollectionCard key={col.id} collection={col} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-[var(--color-border-glass)] rounded-2xl gap-3">
              <span className="text-3xl opacity-30">📂</span>
              <p className="text-sm text-[var(--color-text-secondary)]">{t('library.noCustomCollections')}</p>
              <button
                onClick={() => setShowModal(true)}
                className="text-xs text-[var(--color-accent-secondary)] hover:underline cursor-pointer font-bold"
              >
                {t('library.createFirstCollection')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sleek Create Collection Modal */}
      {collectionModalRendered && createPortal(
        <div className={`fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 transition-all duration-300 ease-out ${
          collectionModalVisible ? 'opacity-100 backdrop-blur-sm' : 'opacity-0 backdrop-blur-none'
        }`}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowModal(false);
            }
          }}
        >
          <div className={`glass-card w-full max-w-md p-6 space-y-4 max-h-[85vh] overflow-y-auto transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            collectionModalVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}>
            <div className="flex justify-between items-center border-b border-[var(--color-border-glass)] pb-2">
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">{t('library.newCollection')}</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-[var(--color-text-secondary)] hover:text-white text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--color-text-secondary)]">{t('library.titleLabel')}</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={t('library.placeholderTitle')}
                  className="w-full px-3 py-2 rounded-xl text-sm bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-primary)] focus:ring-1 focus:ring-[var(--color-accent-primary)]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--color-text-secondary)]">{t('library.descriptionOpt')}</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder={t('library.placeholderDesc')}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-primary)] resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 rounded-xl bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] cursor-pointer"
                >
                  {t('library.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newTitle.trim()}
                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] text-xs text-white font-bold hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-lg"
                >
                  {isSubmitting ? t('library.creating') : t('library.create')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Collection Card Subcomponent ──────────────────────────────────────────────

interface CollectionCardProps {
  collection: {
    id: string;
    title: string;
    description: string;
  };
}

function CollectionCard({ collection }: CollectionCardProps) {
  const { navigate } = useNavigation();
  const { db, status, queryObjects } = useDatabase();
  const { t } = useTranslation();

  // Get active cross refs for this collection
  const crossRefs = useLiveQuery(
    async () => {
      const refs = await userDb.collection_anime_cross_ref
        .where('collectionId')
        .equals(collection.id)
        .toArray();
      return refs.filter((r) => r.is_deleted !== 1).sort((a, b) => a.orderIndex - b.orderIndex);
    },
    [collection.id]
  );

  // Fetch cover art of first 3 items in collection for a beautiful preview stack
  const coverUrls = useLiveQuery(
    async () => {
      if (!db || status !== 'ready' || !crossRefs || crossRefs.length === 0) return [];
      
      try {
        const top3Ids = crossRefs.slice(0, 3).map((r) => r.animeId);
        const placeholders = top3Ids.map(() => '?').join(',');
        const sql = `SELECT cover_large, cover_extra_large FROM anime WHERE anilist_id IN (${placeholders})`;
        const rows = queryObjects<{ cover_large: string; cover_extra_large: string }>(sql, top3Ids);
        
        return rows.map((r) => r.cover_large || r.cover_extra_large).filter(Boolean);
      } catch (err) {
        console.error('[CollectionCard] Error fetching cover previews:', err);
        return [];
      }
    },
    [db, status, crossRefs]
  ) || [];

  const count = crossRefs ? crossRefs.length : 0;

  return (
    <div
      onClick={() => navigate('/collection', `?id=${collection.id}`)}
      className="glass-card p-5 flex flex-col justify-between h-44 cursor-pointer hover:border-[var(--color-accent-secondary)]/35 group relative overflow-hidden"
    >
      {/* Decorative colored glow on card hover */}
      <div className="absolute -top-10 -right-10 w-24 h-24 bg-gradient-to-br from-[var(--color-accent-primary)]/10 to-[var(--color-accent-secondary)]/10 rounded-full blur-2xl group-hover:scale-150 transition-all duration-500" />

      <div className="space-y-2">
        <div className="flex justify-between items-start gap-2">
          <h3 className="font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent-secondary)] transition-colors text-base line-clamp-1">
            {collection.title}
          </h3>
          <span className="text-[10px] bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] border border-[var(--color-accent-primary)]/20 font-bold px-2 py-0.5 rounded-full shrink-0">
            {count} {count === 1 ? 'anime' : 'animes'}
          </span>
        </div>
        <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 leading-relaxed">
          {collection.description || t('library.noDescription')}
        </p>
      </div>

      {/* Previews and link indicator */}
      <div className="flex justify-between items-end mt-4">
        {/* Cover Preview Stack */}
        <div className="flex -space-x-3.5 overflow-hidden">
          {coverUrls.length > 0 ? (
            coverUrls.map((url, i) => (
              <div
                key={i}
                className="w-8 h-11 rounded-md border border-[var(--color-border-glass)] overflow-hidden shadow-md shrink-0 bg-[var(--color-bg-base)]"
                style={{ transform: `rotate(${(i - 1) * 6}deg)`, zIndex: i }}
              >
                <img src={url} alt="Cover preview" className="w-full h-full object-cover" />
              </div>
            ))
          ) : (
            <div className="w-8 h-11 rounded-md border border-dashed border-[var(--color-border-glass)] flex items-center justify-center text-xs opacity-35 bg-[var(--color-bg-input)]">
              {t('library.empty')}
            </div>
          )}
        </div>

        <span className="text-[10px] text-[var(--color-accent-secondary)] font-bold tracking-wider uppercase opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
          {t('library.viewDetails')}
        </span>
      </div>
    </div>
  );
}
