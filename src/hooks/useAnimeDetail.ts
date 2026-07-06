import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDatabase } from '../context/DatabaseContext';
import { useAuth } from '../context/AuthContext';
import { useUserTracking } from '../context/UserTrackingContext';
import { userDb } from '../services/userDb';
import { rowToAnime, type Anime, type Genre, type Tag, type Studio, type AnimeStaff, type Franchise } from '../types/anime';
import type { UserTracking } from '../types/supabase';

interface UseAnimeDetailResult {
  anime: Anime | null;
  screenshots: string[];
  relations: Anime[];
  franchise: Franchise | null;
  franchiseReleaseCount: number;
  genres: Genre[];
  tags: Tag[];
  staff: AnimeStaff[];
  studios: Studio[];
  recommendations: Anime[];
  tracking: UserTracking | null;
  isLoading: boolean;
  error: string | null;
  updateTracking: (updates: Partial<Omit<UserTracking, 'anilist_id' | 'last_modified'>>) => Promise<void>;
  deleteTracking: () => Promise<void>;
}

export function useAnimeDetail(anilistId: number | null): UseAnimeDetailResult {
  const { db, status, queryObjects } = useDatabase();
  const { user } = useAuth();
  const { saveTracking, removeTracking } = useUserTracking();

  const [anime, setAnime] = useState<Anime | null>(null);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [relations, setRelations] = useState<Anime[]>([]);
  const [franchise, setFranchise] = useState<Franchise | null>(null);
  const [franchiseReleaseCount, setFranchiseReleaseCount] = useState<number>(0);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [staff, setStaff] = useState<AnimeStaff[]>([]);
  const [studios, setStudios] = useState<Studio[]>([]);
  const [recommendations, setRecommendations] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(anilistId !== null);
  const [error, setError] = useState<string | null>(null);

  // Reactive Dexie tracking state
  const trackingRecord = useLiveQuery(
    () => {
      if (!anilistId) return undefined;
      return userDb.user_tracking.get(anilistId);
    },
    [anilistId]
  );

  const tracking = useMemo<UserTracking | null>(() => {
    if (!trackingRecord || trackingRecord.is_deleted) {
      return null;
    }
    return {
      anilist_id: trackingRecord.anilist_id,
      watch_status: trackingRecord.status,
      episode_progress: trackingRecord.episode_progress,
      score: trackingRecord.score,
      notes: trackingRecord.notes,
      last_modified: trackingRecord.updated_at,
    };
  }, [trackingRecord]);

  const fetchDetail = useCallback(async () => {
    if (!db || status !== 'ready' || !anilistId) return;

    setIsLoading(true);
    setError(null);

    try {
      // 1. Base Anime
      const animeRows = queryObjects<Record<string, unknown>>(
        'SELECT * FROM anime WHERE anilist_id = ?',
        [anilistId]
      );
      if (animeRows.length === 0) {
        throw new Error('Anime not found in catalog');
      }
      const animeObj = rowToAnime(animeRows[0]);
      setAnime(animeObj);

      // 2. Screenshots
      const screenshotRows = queryObjects<{ image_url: string }>(
        'SELECT image_url FROM screenshots WHERE anilist_id = ?',
        [anilistId]
      );
      const screenshotList = screenshotRows
        .map((r) => r.image_url)
        .filter((url) => url && url !== 'none' && (url.startsWith('http') || url.startsWith('https')));
      setScreenshots(screenshotList);

      // 3. Relations
      const relationRows = queryObjects<Record<string, unknown>>(
        `SELECT target.* FROM anime target 
         JOIN relations ON target.anilist_id = relations.target_anilist_id 
         WHERE relations.source_anilist_id = ? 
         ORDER BY target.season_year ASC, target.updated_at ASC`,
        [anilistId]
      );
      setRelations(relationRows.map(rowToAnime));

      // 4. Franchise
      const franchiseRows = queryObjects<Franchise>(
        `SELECT f.franchise_id, f.main_anilist_id, f.name_en, f.name_uk 
         FROM franchises f 
         JOIN anime_franchises af ON f.franchise_id = af.franchise_id 
         WHERE af.anilist_id = ?`,
        [anilistId]
      );
      if (franchiseRows.length > 0) {
        const fr = franchiseRows[0];
        setFranchise(fr);

        const countRows = queryObjects<{ cnt: number }>(
          'SELECT COUNT(*) as cnt FROM anime_franchises WHERE franchise_id = ?',
          [fr.franchise_id]
        );
        setFranchiseReleaseCount(countRows.length > 0 ? countRows[0].cnt : 0);
      } else {
        setFranchise(null);
        setFranchiseReleaseCount(0);
      }

      // 5. Genres
      const genreRows = queryObjects<Genre>(
        `SELECT g.slug, g.name_en, g.name_uk 
         FROM genres g 
         JOIN anime_genres ag ON g.slug = ag.genre_slug 
         WHERE ag.anilist_id = ?`,
        [anilistId]
      );
      setGenres(genreRows);

      // 6. Tags
      const tagRows = queryObjects<Tag>(
        `SELECT t.tag_id, t.name_en, t.name_uk, t.category 
         FROM tags t 
         JOIN anime_tags at2 ON t.tag_id = at2.tag_id 
         WHERE at2.anilist_id = ?`,
        [anilistId]
      );
      setTags(tagRows);

      // 7. Staff
      const staffRows = queryObjects<AnimeStaff>(
        `SELECT s.staff_id, s.full_name, s.image_large, ast.role 
         FROM staff s 
         JOIN anime_staff ast ON s.staff_id = ast.staff_id 
         WHERE ast.anilist_id = ? 
         ORDER BY s.staff_id ASC, ast.role ASC`,
        [anilistId]
      );
      setStaff(staffRows);

      // 8. Studios
      const studioRows = queryObjects<Studio>(
        `SELECT s.studio_id, s.name 
         FROM studios s 
         JOIN anime_studios ast ON s.studio_id = ast.studio_id 
         WHERE ast.anilist_id = ? 
         ORDER BY s.name ASC`,
        [anilistId]
      );
      setStudios(studioRows);

      // 9. Recommendations
      const recRows = queryObjects<Record<string, unknown>>(
        `SELECT target.* FROM anime target 
         JOIN anime_recommendations rec ON target.anilist_id = rec.recommended_anilist_id 
         WHERE rec.source_anilist_id = ? 
         ORDER BY target.score_mal DESC, target.updated_at DESC`,
        [anilistId]
      );
      setRecommendations(recRows.map(rowToAnime));

    } catch (e) {
      console.error('[useAnimeDetail] Error loading detail:', e);
      setError(e instanceof Error ? e.message : 'Failed to load details');
    } finally {
      setIsLoading(false);
    }
  }, [db, status, anilistId, queryObjects]);

  const updateTracking = useCallback(
    async (updates: Partial<Omit<UserTracking, 'anilist_id' | 'last_modified'>>) => {
      if (!user || !anilistId) return;

      const trackingUpdates: any = {};
      if (updates.watch_status !== undefined) {
        trackingUpdates.status = updates.watch_status;
      }
      if (updates.episode_progress !== undefined) {
        trackingUpdates.episode_progress = updates.episode_progress;
      }
      if (updates.score !== undefined) {
        trackingUpdates.score = updates.score;
      }
      if (updates.notes !== undefined) {
        trackingUpdates.notes = updates.notes;
      }

      if (updates.watch_status === 'COMPLETED' && anime && anime.episodes) {
        trackingUpdates.episode_progress = anime.episodes;
      }

      try {
        await saveTracking(anilistId, trackingUpdates);
      } catch (e) {
        console.error('[useAnimeDetail] Failed to save tracking info:', e);
        throw e;
      }
    },
    [user, anilistId, saveTracking, anime]
  );

  const deleteTracking = useCallback(async () => {
    if (!user || !anilistId) return;

    try {
      await removeTracking(anilistId);
    } catch (e) {
      console.error('[useAnimeDetail] Failed to delete tracking info:', e);
      throw e;
    }
  }, [user, anilistId, removeTracking]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return {
    anime,
    screenshots,
    relations,
    franchise,
    franchiseReleaseCount,
    genres,
    tags,
    staff,
    studios,
    recommendations,
    tracking,
    isLoading,
    error,
    updateTracking,
    deleteTracking,
  };
}
