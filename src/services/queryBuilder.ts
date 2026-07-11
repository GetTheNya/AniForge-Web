/**
 * Dynamic SQL Filter Query Builder
 * 
 * Direct port of AnimeRepository.buildSqlFilterQuery() from Android.
 * Generates parameterized SQL queries from a SearchFilterQuery object.
 */

import type { SearchFilterQuery, EpisodeGroup, SortOption } from '../types/filters';

interface BuiltQuery {
  sql: string;
  params: (string | number)[];
}

/**
 * Builds a dynamic SQL query string and parameter array from a SearchFilterQuery.
 * Mirrors the Android Kotlin buildSqlFilterQuery logic exactly.
 */
export function buildSqlFilterQuery(
  filter: SearchFilterQuery,
  options?: {
    limit?: number;
    offset?: number;
    countOnly?: boolean;
    matchingUserListIds?: number[] | null;
    excludedUserListIds?: number[] | null;
  },
): BuiltQuery {
  const { limit, offset, countOnly = false } = options ?? {};
  const params: (string | number)[] = [];

  let sql = countOnly
    ? 'SELECT COUNT(*) as cnt FROM anime'
    : 'SELECT anime.* FROM anime';

  // FTS5 MATCH join or numeric ID interception
  const queryTrim = filter.textQuery.trim();
  const numericId = /^\d+$/.test(queryTrim) ? parseInt(queryTrim, 10) : null;

  const words = numericId !== null
    ? []
    : queryTrim
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => w.length > 0);

  const hasText = words.length > 0;

  if (hasText) {
    sql += ' JOIN anime_search ON anime.anilist_id = anime_search.rowid';
  }

  const where: string[] = [];

  // Numeric ID interception (search by AniList ID or MAL ID)
  if (numericId !== null) {
    const ftsToken = `${queryTrim}*`;
    where.push(
      '(anime.anilist_id IN (SELECT rowid FROM anime_search WHERE anime_search MATCH ?) OR anime.anilist_id = ? OR anime.mal_id = ?)',
    );
    params.push(ftsToken, numericId, numericId);
  } else if (hasText) {
    where.push('anime_search MATCH ?');
    const sanitized = words.map((w) => `${w}*`).join(' ');
    params.push(sanitized);
  }

  // Score bounds
  if (filter.minScore !== null) {
    where.push('anime.score_mal >= ?');
    params.push(filter.minScore);
  }
  if (filter.maxScore !== null) {
    where.push('anime.score_mal <= ?');
    params.push(filter.maxScore);
  }

  // Episode groups
  if (filter.episodeGroups.length > 0) {
    const clauses = filter.episodeGroups.map(episodeGroupToSql);
    where.push(`(${clauses.join(' OR ')})`);
  }
  if (filter.excludedEpisodeGroups.length > 0) {
    const clauses = filter.excludedEpisodeGroups.map(episodeGroupToSql);
    where.push(`NOT (${clauses.join(' OR ')})`);
  }

  // Format multi-select
  if (filter.formats.length > 0) {
    const ph = filter.formats.map(() => '?').join(',');
    where.push(`anime.format IN (${ph})`);
    params.push(...filter.formats);
  }
  if (filter.excludedFormats.length > 0) {
    const ph = filter.excludedFormats.map(() => '?').join(',');
    where.push(`anime.format NOT IN (${ph})`);
    params.push(...filter.excludedFormats);
  }

  // Studios
  if (filter.studios.length > 0) {
    const ph = filter.studios.map(() => '?').join(',');
    where.push(`anime.anilist_id IN (SELECT anilist_id FROM anime_studios WHERE studio_id IN (${ph}))`);
    params.push(...filter.studios);
  }
  if (filter.excludedStudios.length > 0) {
    const ph = filter.excludedStudios.map(() => '?').join(',');
    where.push(`anime.anilist_id NOT IN (SELECT anilist_id FROM anime_studios WHERE studio_id IN (${ph}))`);
    params.push(...filter.excludedStudios);
  }

  // Ukrainian translation toggle
  if (filter.hasUkTranslation === true) {
    where.push('anime.has_uk_translation = 1');
  }

  // Year filter
  if (filter.year !== null) {
    where.push('anime.season_year = ?');
    params.push(filter.year);
  }

  // Season filter
  if (filter.season !== null) {
    where.push('anime.season = ?');
    params.push(filter.season);
  }

  // Genre inclusion (intersecting: must match ALL)
  for (const genre of filter.genres) {
    where.push('anime.anilist_id IN (SELECT anilist_id FROM anime_genres WHERE genre_slug = ?)');
    params.push(genre);
  }
  // Genre exclusion
  if (filter.excludedGenres.length > 0) {
    const ph = filter.excludedGenres.map(() => '?').join(',');
    where.push(`anime.anilist_id NOT IN (SELECT anilist_id FROM anime_genres WHERE genre_slug IN (${ph}))`);
    params.push(...filter.excludedGenres);
  }

  // Tag inclusion (intersecting: must match ALL)
  for (const tagId of filter.tags) {
    where.push('anime.anilist_id IN (SELECT anilist_id FROM anime_tags WHERE tag_id = ?)');
    params.push(tagId);
  }
  // Tag exclusion
  if (filter.excludedTags.length > 0) {
    const ph = filter.excludedTags.map(() => '?').join(',');
    where.push(`anime.anilist_id NOT IN (SELECT anilist_id FROM anime_tags WHERE tag_id IN (${ph}))`);
    params.push(...filter.excludedTags);
  }

  // Staff inclusion
  if (filter.staff.length > 0) {
    const ph = filter.staff.map(() => '?').join(',');
    where.push(`anime.anilist_id IN (SELECT anilist_id FROM anime_staff WHERE staff_id IN (${ph}))`);
    params.push(...filter.staff);
  }
  if (filter.excludedStaff.length > 0) {
    const ph = filter.excludedStaff.map(() => '?').join(',');
    where.push(`anime.anilist_id NOT IN (SELECT anilist_id FROM anime_staff WHERE staff_id IN (${ph}))`);
    params.push(...filter.excludedStaff);
  }

  // Media status
  if (filter.mediaStatuses.length > 0) {
    const ph = filter.mediaStatuses.map(() => '?').join(',');
    where.push(`anime.status IN (${ph})`);
    params.push(...filter.mediaStatuses);
  }
  if (filter.excludedMediaStatuses.length > 0) {
    const ph = filter.excludedMediaStatuses.map(() => '?').join(',');
    where.push(`anime.status NOT IN (${ph})`);
    params.push(...filter.excludedMediaStatuses);
  }

  // Media source
  if (filter.mediaSources.length > 0) {
    const ph = filter.mediaSources.map(() => '?').join(',');
    where.push(`anime.source IN (${ph})`);
    params.push(...filter.mediaSources);
  }
  if (filter.excludedMediaSources.length > 0) {
    const ph = filter.excludedMediaSources.map(() => '?').join(',');
    where.push(`anime.source NOT IN (${ph})`);
    params.push(...filter.excludedMediaSources);
  }

  // User list status filtering (direct numeric embedding to bypass SQLite 999 parameter limit)
  if (options?.matchingUserListIds !== undefined && options.matchingUserListIds !== null) {
    if (options.matchingUserListIds.length > 0) {
      const idList = options.matchingUserListIds.join(',');
      where.push(`anime.anilist_id IN (${idList})`);
    } else {
      where.push('0 = 1');
    }
  }
  if (options?.excludedUserListIds !== undefined && options.excludedUserListIds !== null && options.excludedUserListIds.length > 0) {
    const idList = options.excludedUserListIds.join(',');
    where.push(`anime.anilist_id NOT IN (${idList})`);
  }

  // Assemble WHERE clause
  if (where.length > 0) {
    sql += ' WHERE ' + where.join(' AND ');
  }

  // ORDER BY (only for non-count queries)
  if (!countOnly) {
    sql += buildOrderClause(filter.sortBy, hasText, words);

    if (limit !== undefined && offset !== undefined) {
      sql += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);
    }
  }

  return { sql, params };
}

// ─── Sort order mapping ─────────────────────────────────────────────────────────

function buildOrderClause(
  sortBy: SortOption,
  hasText: boolean,
  words: string[],
): string {
  switch (sortBy) {
    case 'RELEVANCE': {
      if (hasText) {
        const fts = words.map((w) => `${w}*`).join(' ').replace(/'/g, "''");
        return (
          ` ORDER BY CASE` +
          ` WHEN anime.anilist_id IN (SELECT rowid FROM anime_search WHERE title_uk MATCH '${fts}') THEN 1` +
          ` WHEN anime.anilist_id IN (SELECT rowid FROM anime_search WHERE title_en MATCH '${fts}' OR synonyms_flat MATCH '${fts}') THEN 2` +
          ` ELSE 3` +
          ` END ASC, anime.popularity DESC`
        );
      }
      return ' ORDER BY anime.popularity DESC';
    }
    case 'SCORE':
      return ' ORDER BY score_mal DESC';
    case 'SCORE_ASC':
      return ' ORDER BY score_mal ASC';
    case 'YEAR_DESC':
      return ' ORDER BY season_year DESC, updated_at DESC';
    case 'YEAR_ASC':
      return ' ORDER BY season_year ASC, updated_at ASC';
    case 'TITLE':
      return ' ORDER BY title_romaji ASC';
    case 'TITLE_DESC':
      return ' ORDER BY title_romaji DESC';
    case 'POPULARITY':
      return ' ORDER BY popularity DESC';
    case 'POPULARITY_ASC':
      return ' ORDER BY popularity ASC';
    case 'START_DATE_DESC':
      return ' ORDER BY start_date_year DESC, start_date_month DESC, start_date_day DESC';
    case 'START_DATE_ASC':
      return ' ORDER BY start_date_year ASC, start_date_month ASC, start_date_day ASC';
    case 'EPISODES_DESC':
      return ' ORDER BY episodes DESC';
    case 'EPISODES_ASC':
      return ' ORDER BY episodes ASC';
    default:
      return ' ORDER BY score_mal DESC';
  }
}

// ─── Episode group SQL clause mapping ───────────────────────────────────────────

function episodeGroupToSql(group: EpisodeGroup): string {
  switch (group) {
    case 'LESS_THAN_12':
      return 'anime.episodes < 12';
    case 'BETWEEN_12_AND_18':
      return '(anime.episodes >= 12 AND anime.episodes <= 18)';
    case 'BETWEEN_19_AND_24':
      return '(anime.episodes >= 19 AND anime.episodes <= 24)';
    case 'GREATER_THAN_24':
      return 'anime.episodes > 24';
  }
}
