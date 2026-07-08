/**
 * useAnimeSearch — debounced FTS5 search + full filter query hook.
 * Uses the DatabaseContext to execute queries against the active WASM SQLite instance.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { userDb } from '../services/userDb';
import { buildSqlFilterQuery } from '../services/queryBuilder';
import { rowToAnime, type Anime } from '../types/anime';
import { EMPTY_FILTER, type SearchFilterQuery } from '../types/filters';

const DEBOUNCE_MS = 300;
const DEFAULT_LIMIT = 50;

interface UseAnimeSearchResult {
  results: Anime[];
  isSearching: boolean;
  totalCount: number | null;
  error: string | null;
}

export function useAnimeSearch(
  filter: SearchFilterQuery = EMPTY_FILTER,
  limit: number = DEFAULT_LIMIT,
  offset: number = 0,
): UseAnimeSearchResult {
  const { db, status, queryObjects, execQuery } = useDatabase();
  const { getAnimeTitle } = useSettings();
  const { user } = useAuth();
  const [results, setResults] = useState<Anime[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryCountRef = useRef(0);

  const runQuery = useCallback(async () => {
    if (!db || status !== 'ready') return;

    const currentQueryId = ++queryCountRef.current;
    setIsSearching(true);
    setError(null);

    try {
      let matchingUserListIds: number[] | null = null;
      let excludedUserListIds: number[] | null = null;

      if (user && (filter.userStatuses.length > 0 || filter.excludedUserStatuses.length > 0)) {
        const records = await userDb.user_tracking.toArray();
        const active = records.filter((r) => !r.is_deleted);
        
        if (filter.userStatuses.length > 0) {
          matchingUserListIds = active
            .filter((r) => filter.userStatuses.includes(r.status))
            .map((r) => r.anilist_id)
            .filter((id) => typeof id === 'number' && !isNaN(id));
        }
        
        if (filter.excludedUserStatuses.length > 0) {
          excludedUserListIds = active
            .filter((r) => filter.excludedUserStatuses.includes(r.status))
            .map((r) => r.anilist_id)
            .filter((id) => typeof id === 'number' && !isNaN(id));
        }
      }

      if (currentQueryId !== queryCountRef.current) return;

      // Build paginated query
      const { sql, params } = buildSqlFilterQuery(filter, { 
        limit, 
        offset,
        matchingUserListIds,
        excludedUserListIds
      });
      const rows = queryObjects<Record<string, unknown>>(sql, params);
      const animeList = rows.map((row) => {
        const anime = rowToAnime(row);
        return {
          ...anime,
          displayTitle: getAnimeTitle(anime),
        };
      });

      if (currentQueryId !== queryCountRef.current) return;
      setResults(animeList);

      // Get total count for pagination
      const { sql: countSql, params: countParams } = buildSqlFilterQuery(filter, { 
        countOnly: true,
        matchingUserListIds,
        excludedUserListIds
      });
      const countResult = execQuery(countSql, countParams);
      if (currentQueryId !== queryCountRef.current) return;
      if (countResult.length > 0 && countResult[0].values.length > 0) {
        setTotalCount(countResult[0].values[0][0] as number);
      }
    } catch (e) {
      console.error('[useAnimeSearch] Query error:', e);
      if (currentQueryId === queryCountRef.current) {
        setError(e instanceof Error ? e.message : 'Query failed');
        setResults([]);
      }
    } finally {
      if (currentQueryId === queryCountRef.current) {
        setIsSearching(false);
      }
    }
  }, [db, status, filter, limit, offset, queryObjects, execQuery, getAnimeTitle, user]);

  const lastTextQueryRef = useRef(filter.textQuery);

  useEffect(() => {
    if (!db || status !== 'ready') return;

    const textChanged = lastTextQueryRef.current !== filter.textQuery;
    lastTextQueryRef.current = filter.textQuery;

    // Debounce text queries only when text query changes; instant for pagination or filter changes
    const delay = textChanged && filter.textQuery.length > 0 ? DEBOUNCE_MS : 0;

    if (delay > 0) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(runQuery, delay);
    } else {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      runQuery();
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [runQuery, db, status, filter.textQuery]);

  return { results, isSearching, totalCount, error };
}
