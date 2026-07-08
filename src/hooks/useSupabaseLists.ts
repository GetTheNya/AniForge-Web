/**
 * useSupabaseLists — fetches user tracking data from Dexie (local cache)
 * and cross-references with the local SQLite catalog.
 */

import { useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDatabase } from '../context/DatabaseContext';
import { useUserTracking } from '../context/UserTrackingContext';
import { useSettings } from '../context/SettingsContext';
import { userDb } from '../services/userDb';
import { rowToAnime, type Anime } from '../types/anime';
import type { UserTracking } from '../types/supabase';

export interface TrackingWithAnime {
  tracking: UserTracking;
  anime: Anime | null;
}

interface UseSupabaseListsResult {
  trackingList: TrackingWithAnime[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useSupabaseLists(): UseSupabaseListsResult {
  const { db, status, queryObjects } = useDatabase();
  const { syncStatus, sync } = useUserTracking();
  const { getAnimeTitle } = useSettings();

  // Reactive IndexedDB query
  const trackingRecords = useLiveQuery(
    () => userDb.user_tracking.toArray()
  );

  // Hybrid Cross-Referencing: Join local tracking with catalog metadata
  const trackingList = useMemo<TrackingWithAnime[]>(() => {
    if (!db || status !== 'ready' || !trackingRecords || trackingRecords.length === 0) {
      return [];
    }

    // Filter out soft deleted records
    const activeRecords = trackingRecords.filter((r) => !r.is_deleted);
    if (activeRecords.length === 0) {
      return [];
    }

    try {
      // 1. Extract anilist_id values
      const ids = activeRecords.map((r) => r.anilist_id);

      // 2. Singular optimized batch query against catalog SQLite
      const placeholders = ids.map(() => '?').join(',');
      const sql = `SELECT * FROM anime WHERE anilist_id IN (${placeholders})`;
      
      console.info(`[useSupabaseLists] Hybrid Join: Fetching catalog metadata for ${ids.length} tracking records...`);
      const animeRows = queryObjects<Record<string, unknown>>(sql, ids);
      
      const animeMap = new Map<number, Anime>();
      for (const row of animeRows) {
        const anime = rowToAnime(row);
        anime.displayTitle = getAnimeTitle(anime);
        animeMap.set(anime.anilist_id, anime);
      }

      // 3. Map to public UI tracking format and join with catalog anime
      return activeRecords.map((record) => ({
        tracking: {
          anilist_id: record.anilist_id,
          watch_status: record.status,
          episode_progress: record.episode_progress,
          score: record.score,
          notes: record.notes,
          last_modified: record.updated_at,
        },
        anime: animeMap.get(record.anilist_id) ?? null,
      }));
    } catch (e) {
      console.error('[useSupabaseLists] Error during hybrid join query:', e);
      return [];
    }
  }, [db, status, trackingRecords, queryObjects, getAnimeTitle]);

  const refresh = useCallback(async () => {
    await sync();
  }, [sync]);

  const isLoading = trackingRecords === undefined || syncStatus === 'syncing';

  return {
    trackingList,
    isLoading,
    error: syncStatus === 'error' ? 'Failed to sync tracking data' : null,
    refresh,
  };
}
