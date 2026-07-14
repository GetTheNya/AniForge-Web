import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '../hooks/useNavigation';
import { useUserTracking } from '../context/UserTrackingContext';
import { userDb } from '../services/userDb';
import { useDatabase } from '../context/DatabaseContext';
import { useSettings } from '../context/SettingsContext';
import { useCatalogMeta } from '../hooks/useCatalogMeta';
import { useRandomSession } from '../context/RandomSessionContext';
import { useAuth } from '../context/AuthContext';
import { buildSqlFilterQuery } from '../services/queryBuilder';
import { rowToAnime } from '../types/anime';
import { EMPTY_FILTER, type SearchFilterQuery } from '../types/filters';
import AnimeCard from './AnimeCard';
import Pagination from './Pagination';
import SearchBar from './SearchBar';
import FilterPanel from './FilterPanel';

interface CollectionDetailsViewProps {
  collectionId: string | null;
}

const COLLECTION_DEFAULT_FILTER: SearchFilterQuery = {
  ...EMPTY_FILTER,
  sortBy: 'LAST_MODIFIED',
};

export default function CollectionDetailsView({ collectionId }: CollectionDetailsViewProps) {
  const { navigate } = useNavigation();
  const { t } = useTranslation();
  const { removeCollection, removeAnimeFromCollection, reorderAnimeInCollection } = useUserTracking();
  const { db, status, queryObjects } = useDatabase();
  const { getAnimeTitle } = useSettings();
  const { user } = useAuth();
  const catalogMeta = useCatalogMeta();
  const { startRandomSession } = useRandomSession();

  const collection = useLiveQuery(
    async () => {
      if (!collectionId) return null;
      const col = await userDb.collections.get(collectionId);
      if (!col || col.is_deleted === 1) return null;
      return col;
    },
    [collectionId]
  );

  useEffect(() => {
    if (collection) {
      document.title = `${collection.title} - AniForge Web`;
    }
  }, [collection]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 24;

  // Filter state
  const [filter, setFilter] = useState<SearchFilterQuery>(COLLECTION_DEFAULT_FILTER);
  const [filteredItems, setFilteredItems] = useState<{ crossRef: any; anime: any | null }[]>([]);
  const [isFiltering, setIsFiltering] = useState(false);

  // Reset page and filters when collectionId changes
  useEffect(() => {
    setCurrentPage(1);
    setFilter(COLLECTION_DEFAULT_FILTER);
  }, [collectionId]);

  // 1. Observe active cross-references for this collection reactively from Dexie
  const crossRefs = useLiveQuery(
    async () => {
      if (!collectionId) return [];
      const refs = await userDb.collection_anime_cross_ref
        .where('collectionId')
        .equals(collectionId)
        .toArray();
      
      // Filter out tombstoned items and sort by orderIndex ascending
      return refs
        .filter((r) => r.is_deleted !== 1)
        .sort((a, b) => a.orderIndex - b.orderIndex);
    },
    [collectionId]
  );

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
    if (filter.userStatuses?.length) activeCount++;
    if (filter.excludedUserStatuses?.length) activeCount++;
    if (filter.year !== null) activeCount++;
    if (filter.season !== null) activeCount++;
    
    return filter.textQuery.trim() !== '' || activeCount > 0 || filter.sortBy !== 'LAST_MODIFIED';
  }, [filter]);

  // 2. Perform SQLite filtering on the collection's items
  useEffect(() => {
    if (!crossRefs) {
      setFilteredItems([]);
      return;
    }

    if (crossRefs.length === 0) {
      setFilteredItems([]);
      return;
    }

    if (!db || status !== 'ready') {
      setFilteredItems(crossRefs.map((ref) => ({ crossRef: ref, anime: null })));
      return;
    }

    setIsFiltering(true);
    const run = async () => {
      try {
        const animeIds = crossRefs.map((r) => r.animeId);
        let finalMatchingIds = [...animeIds];
        let excludedUserListIds: number[] | null = null;

        if (user && (filter.userStatuses.length > 0 || filter.excludedUserStatuses.length > 0)) {
          const records = await userDb.user_tracking.toArray();
          const active = records.filter((r) => !r.is_deleted);
          
          if (filter.userStatuses.length > 0) {
            const matchingStatusesIds = active
              .filter((r) => filter.userStatuses.includes(r.status))
              .map((r) => r.anilist_id)
              .filter((id): id is number => typeof id === 'number' && !isNaN(id));
            
            // Intersect collection IDs with matching status IDs
            finalMatchingIds = finalMatchingIds.filter(id => matchingStatusesIds.includes(id));
          }
          
          if (filter.excludedUserStatuses.length > 0) {
            excludedUserListIds = active
              .filter((r) => filter.excludedUserStatuses.includes(r.status))
              .map((r) => r.anilist_id)
              .filter((id): id is number => typeof id === 'number' && !isNaN(id));
          }
        }

        const { sql, params } = buildSqlFilterQuery(filter, {
          matchingUserListIds: finalMatchingIds,
          excludedUserListIds,
        });

        const rows = queryObjects<Record<string, unknown>>(sql, params);
        const matchedAnimeList = rows.map((row) => {
          const anime = rowToAnime(row);
          anime.displayTitle = getAnimeTitle(anime);
          return anime;
        });

        const animeMap = new Map<number, typeof matchedAnimeList[0]>();
        for (const anime of matchedAnimeList) {
          animeMap.set(anime.anilist_id, anime);
        }

        let itemsList: { crossRef: any; anime: any | null }[] = [];

        if (filter.sortBy === 'LAST_MODIFIED' && !isFiltered) {
          // Default: sort manually by orderIndex
          itemsList = crossRefs
            .filter((ref) => animeMap.has(ref.animeId))
            .map((ref) => ({
              crossRef: ref,
              anime: animeMap.get(ref.animeId) ?? null,
            }));
        } else {
          // Sort by SQLite results
          itemsList = matchedAnimeList.map((anime) => {
            const ref = crossRefs.find((r) => r.animeId === anime.anilist_id);
            return {
              crossRef: ref!,
              anime,
            };
          });

          if (filter.sortBy === 'LAST_MODIFIED') {
            itemsList.sort((a, b) => {
              const orderA = a.crossRef?.orderIndex ?? 0;
              const orderB = b.crossRef?.orderIndex ?? 0;
              return orderA - orderB;
            });
          }
        }

        setFilteredItems(itemsList);
      } catch (e) {
        console.error('[CollectionDetailsView] Error filtering collection items:', e);
        setFilteredItems(crossRefs.map((ref) => ({ crossRef: ref, anime: null })));
      } finally {
        setIsFiltering(false);
      }
    };
    run();
  }, [db, status, crossRefs, filter, isFiltered, queryObjects, getAnimeTitle, user]);

  const isLoading = crossRefs === undefined || isFiltering;

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const safePage = Math.min(currentPage, Math.max(1, totalPages));
  const startIndex = (safePage - 1) * itemsPerPage;
  const paginatedItems = useMemo(() => {
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, startIndex]);

  // Handle reordering sequence
  const moveAnime = async (currentIndex: number, direction: 'left' | 'right') => {
    if (!collectionId || filteredItems.length === 0) return;
    
    const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= filteredItems.length) return;

    // Swap sequence in memory
    const reorderedList = [...filteredItems];
    const temp = reorderedList[currentIndex];
    reorderedList[currentIndex] = reorderedList[targetIndex];
    reorderedList[targetIndex] = temp;

    // Persist new layout order index to write-through db
    const orderedIds = reorderedList.map((item) => item.crossRef.animeId);
    await reorderAnimeInCollection(collectionId, orderedIds);
  };

  // Start randomizing session
  const handleRandom = () => {
    const validAnimeIds = filteredItems
      .map((item) => item.anime?.anilist_id)
      .filter((id): id is number => typeof id === 'number');

    if (validAnimeIds.length > 0) {
      startRandomSession(collectionId, validAnimeIds);
    }
  };

  // Handle deletion of the collection itself
  const handleDeleteCollection = async () => {
    if (!collectionId) return;
    
    const confirmed = window.confirm(
      t('collection.deleteConfirm')
    );
    if (confirmed) {
      await removeCollection(collectionId);
      navigate('/library');
    }
  };

  if (!collectionId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-sm text-[var(--color-text-secondary)]">{t('collection.invalidId')}</p>
        <button onClick={() => navigate('/library')} className="glass-button text-xs">
          {t('collection.backToLibrary')}
        </button>
      </div>
    );
  }

  if (collection === undefined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-[var(--color-accent-primary)]/20 border-t-[var(--color-accent-primary)] animate-spin" />
        <p className="text-sm text-[var(--color-text-secondary)]">{t('collection.loading')}</p>
      </div>
    );
  }

  if (collection === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <div className="text-3xl">📭</div>
        <h3 className="text-lg font-bold text-[var(--color-text-primary)]">{t('collection.notFound')}</h3>
        <p className="text-xs text-[var(--color-text-secondary)]">
          {t('collection.notFoundSubtext')}
        </p>
        <button onClick={() => navigate('/library')} className="glass-button text-xs mt-2">
          {t('collection.backToLibrary')}
        </button>
      </div>
    );
  }

  const totalItems = crossRefs?.length || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header breadcrumb & back btn */}
      <div>
        <button
          onClick={() => navigate('/library')}
          className="text-xs font-semibold text-[var(--color-accent-secondary)] hover:text-white transition-colors cursor-pointer flex items-center gap-1"
        >
          ← {t('collection.backToLibrary')}
        </button>
      </div>

      {/* Meta Information Shell */}
      <div className="glass-card p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="space-y-2 max-w-2xl">
          <h2 className="text-xl md:text-2xl font-black bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] bg-clip-text text-transparent">
            {collection.title}
          </h2>
          <p className="text-xs md:text-sm text-[var(--color-text-secondary)] leading-relaxed">
            {collection.description || 'No description provided.'}
          </p>
          <div className="text-[10px] text-[var(--color-text-tertiary)] pt-1">
            {t('collection.created')} {new Date(collection.createdAt).toLocaleDateString()} {t('collection.items')}{' '}
            {isFiltered ? `${filteredItems.length} of ${totalItems}` : totalItems}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 w-full md:w-auto justify-end">
          <button
            onClick={handleRandom}
            disabled={filteredItems.length === 0}
            className="glass-button bg-[var(--color-accent-primary)]/10 hover:bg-[var(--color-accent-primary)]/20 border border-[var(--color-accent-primary)]/30 disabled:opacity-30 disabled:hover:bg-[var(--color-accent-primary)]/10 disabled:cursor-not-allowed cursor-pointer text-xs font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 transition-all"
          >
            🎲 {t('library.randomBtn')}
          </button>

          <button
            onClick={handleDeleteCollection}
            className="glass-badge hover:bg-[var(--color-accent-rose)]/15 border-[var(--color-border-glass)] text-[var(--color-accent-rose)] hover:text-red-400 cursor-pointer text-xs font-bold py-2 px-4 rounded-xl shrink-0"
          >
            🗑️ {t('collection.deleteBtn')}
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      {totalItems > 0 && (
        <div className="space-y-4">
          <SearchBar
            value={filter.textQuery}
            onChange={(text) =>
              setFilter((prev) => ({
                ...prev,
                textQuery: text,
                sortBy: text.length > 0 ? 'RELEVANCE' : prev.sortBy === 'RELEVANCE' ? 'LAST_MODIFIED' : prev.sortBy,
              }))
            }
            resultCount={filteredItems.length}
            isSearching={isFiltering}
            placeholder={t('catalog.searchPlaceholderAnime')}
          />
          <FilterPanel
            filter={filter}
            onChange={setFilter}
            genres={catalogMeta.genres}
            tags={catalogMeta.tags}
            studios={catalogMeta.studios}
            staff={catalogMeta.staff}
            isLoaded={catalogMeta.isLoaded}
            showLastAddedSort={true}
            lastAddedSortLabel={t('sortOptions.BY_MY_ORDER', 'By My Order')}
          />
        </div>
      )}

      {/* Anime Items Grid */}
      {isLoading && filteredItems.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-xl skeleton" />
          ))}
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {paginatedItems.map((item, localIndex) => {
              const globalIndex = startIndex + localIndex;
              return (
                <div key={item.crossRef.animeId} className="relative group/item overflow-hidden rounded-xl transition-all duration-300 ease-out hover:-translate-y-1 transform-gpu">
                  {/* Overlay controls for reordering and deletion on hover */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/75 to-transparent p-2.5 opacity-0 group-hover/item:opacity-100 transition-opacity z-20 flex flex-col gap-1.5">
                    {!isFiltered && (
                      <div className="flex justify-between gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            moveAnime(globalIndex, 'left');
                          }}
                          disabled={globalIndex === 0}
                          className="flex-1 bg-[var(--color-bg-overlay)] border border-[var(--color-border-glass)] text-white hover:text-[var(--color-accent-secondary)] disabled:opacity-30 disabled:hover:text-white rounded-lg py-1 cursor-pointer text-[10px] font-bold transition-all text-center"
                          title={t('collection.moveLeftTitle')}
                        >
                          ← {t('collection.moveLeft')}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            moveAnime(globalIndex, 'right');
                          }}
                          disabled={globalIndex === filteredItems.length - 1}
                          className="flex-1 bg-[var(--color-bg-overlay)] border border-[var(--color-border-glass)] text-white hover:text-[var(--color-accent-secondary)] disabled:opacity-30 disabled:hover:text-white rounded-lg py-1 cursor-pointer text-[10px] font-bold transition-all text-center"
                          title={t('collection.moveRightTitle')}
                        >
                          {t('collection.moveRight')} →
                        </button>
                      </div>
                    )}
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAnimeFromCollection(collectionId, item.crossRef.animeId);
                      }}
                      className="w-full bg-[var(--color-accent-rose)]/15 border border-[var(--color-accent-rose)]/25 text-[var(--color-accent-rose)] hover:text-white hover:bg-[var(--color-accent-rose)] rounded-lg py-1 cursor-pointer text-[10px] font-black transition-all"
                      title={t('collection.removeItemTitle')}
                    >
                      {t('collection.removeItem')}
                    </button>
                  </div>

                  {/* Underlying standard AnimeCard or placeholder card */}
                  {item.anime ? (
                    <AnimeCard anime={item.anime} index={localIndex} disableHoverTranslation={true} fromCollectionId={collectionId} />
                  ) : (
                    <div className="glass-card p-4 flex flex-col items-center justify-center text-center aspect-[3/4]">
                      <span className="text-2xl">❔</span>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-2">{t('library.notInCatalog')}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)] mt-1">ID: {item.crossRef.animeId}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 border border-dashed border-[var(--color-border-glass)] rounded-2xl gap-3">
          <span className="text-3xl opacity-30">🎬</span>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {isFiltered ? t('collection.noFilteredResults') : t('collection.empty')}
          </p>
          {!isFiltered && (
            <button
              onClick={() => navigate('/')}
              className="text-xs text-[var(--color-accent-secondary)] hover:underline cursor-pointer font-bold"
            >
              {t('collection.browseCatalog')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
