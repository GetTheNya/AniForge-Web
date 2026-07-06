/**
 * useSupabaseLists — fetches user tracking data from Supabase
 * and cross-references with the local SQLite catalog.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDatabase } from '../context/DatabaseContext';
import { supabase } from '../services/supabase';
import { rowToAnime, type Anime } from '../types/anime';
import type { UserTracking } from '../types/supabase';

interface TrackingWithAnime {
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
  const { user } = useAuth();
  const { db, status, queryObjects } = useDatabase();
  const [trackingList, setTrackingList] = useState<TrackingWithAnime[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAndCrossReference = useCallback(async () => {
    if (!user || !db || status !== 'ready') return;

    setIsLoading(true);
    setError(null);

    try {
      // 1. Fetch tracking from Supabase
      const { data, error: fetchError } = await supabase
        .from('user_tracking')
        .select('anilist_id, watch_status, score, episode_progress, notes, last_modified')
        .eq('user_id', user.id)
        .order('last_modified', { ascending: false });

      if (fetchError) throw fetchError;
      if (!data || data.length === 0) {
        setTrackingList([]);
        return;
      }

      const trackingItems = data as UserTracking[];

      // 2. Cross-reference with local SQLite catalog
      const ids = trackingItems.map((t) => t.anilist_id);
      const placeholders = ids.map(() => '?').join(',');
      const sql = `SELECT * FROM anime WHERE anilist_id IN (${placeholders})`;
      const animeRows = queryObjects<Record<string, unknown>>(sql, ids);
      const animeMap = new Map<number, Anime>();
      for (const row of animeRows) {
        const anime = rowToAnime(row);
        animeMap.set(anime.anilist_id, anime);
      }

      // 3. Merge tracking + anime data
      const merged: TrackingWithAnime[] = trackingItems.map((t) => ({
        tracking: t,
        anime: animeMap.get(t.anilist_id) ?? null,
      }));

      setTrackingList(merged);
    } catch (e) {
      console.error('[useSupabaseLists] Error:', e);
      setError(e instanceof Error ? e.message : 'Failed to load tracking data');
    } finally {
      setIsLoading(false);
    }
  }, [user, db, status, queryObjects]);

  useEffect(() => {
    fetchAndCrossReference();
  }, [fetchAndCrossReference]);

  return { trackingList, isLoading, error, refresh: fetchAndCrossReference };
}
