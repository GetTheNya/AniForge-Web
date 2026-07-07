/**
 * useAnimeSearch — debounced FTS5 search + full filter query hook.
 * Uses the DatabaseContext to execute queries against the active WASM SQLite instance.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { useSettings } from '../context/SettingsContext';
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
  const [results, setResults] = useState<Anime[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runQuery = useCallback(() => {
    if (!db || status !== 'ready') return;

    setIsSearching(true);
    setError(null);

    try {
      // Build paginated query
      const { sql, params } = buildSqlFilterQuery(filter, { limit, offset });
      const rows = queryObjects<Record<string, unknown>>(sql, params);
      const animeList = rows.map((row) => {
        const anime = rowToAnime(row);
        return {
          ...anime,
          displayTitle: getAnimeTitle(anime),
        };
      });
      setResults(animeList);

      // Get total count for pagination
      const { sql: countSql, params: countParams } = buildSqlFilterQuery(filter, { countOnly: true });
      const countResult = execQuery(countSql, countParams);
      if (countResult.length > 0 && countResult[0].values.length > 0) {
        setTotalCount(countResult[0].values[0][0] as number);
      }
    } catch (e) {
      console.error('[useAnimeSearch] Query error:', e);
      setError(e instanceof Error ? e.message : 'Query failed');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [db, status, filter, limit, offset, queryObjects, execQuery, getAnimeTitle]);

  useEffect(() => {
    if (!db || status !== 'ready') return;

    // Debounce text queries; instant for filter-only changes
    const delay = filter.textQuery.length > 0 ? DEBOUNCE_MS : 0;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(runQuery, delay);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [runQuery, db, status, filter.textQuery]);

  return { results, isSearching, totalCount, error };
}
