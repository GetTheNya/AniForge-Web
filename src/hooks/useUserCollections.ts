import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { userDb } from '../services/userDb';
import { useDatabase } from '../context/DatabaseContext';
import { rowToAnime, type Anime } from '../types/anime';

/**
 * Hook to reactively observe custom collections from IndexedDB.
 * Filters out soft-deleted records.
 */
export function useUserCollections() {
  const collections = useLiveQuery(
    async () => {
      const all = await userDb.collections.toArray();
      return all.filter((c) => c.is_deleted !== 1);
    }
  );

  return {
    collections: collections || [],
    isLoading: collections === undefined,
  };
}

/**
 * Hook to reactively observe and resolve anime items in a collection.
 * Hydrates collection references by performing a hybrid batch query
 * against the local SQLite WASM catalog.
 */
export function useCollectionAnime(collectionId: string | null) {
  const { db, status, queryObjects } = useDatabase();

  // 1. Observe active cross-references for this collection
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

  // 2. Hybrid batch join with local SQLite WASM catalog
  const animeList = useMemo<Anime[]>(() => {
    if (!db || status !== 'ready' || !crossRefs || crossRefs.length === 0) {
      return [];
    }

    try {
      const ids = crossRefs.map((r) => r.animeId);
      const placeholders = ids.map(() => '?').join(',');
      const sql = `SELECT * FROM anime WHERE anilist_id IN (${placeholders})`;

      console.info(`[useCollectionAnime] Hybrid Join: Loading metadata for ${ids.length} collection items...`);
      const animeRows = queryObjects<Record<string, unknown>>(sql, ids);

      const animeMap = new Map<number, Anime>();
      for (const row of animeRows) {
        const anime = rowToAnime(row);
        animeMap.set(anime.anilist_id, anime);
      }

      // Re-map to match the collection's sorted orderIndex
      return crossRefs
        .map((ref) => animeMap.get(ref.animeId))
        .filter((anime): anime is Anime => !!anime);
    } catch (e) {
      console.error('[useCollectionAnime] Error during hybrid join query:', e);
      return [];
    }
  }, [db, status, crossRefs, queryObjects]);

  return {
    animeList,
    isLoading: crossRefs === undefined,
  };
}
