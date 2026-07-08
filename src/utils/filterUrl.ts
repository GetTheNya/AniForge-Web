import { EMPTY_FILTER, type SearchFilterQuery, type SortOption, type EpisodeGroup } from '../types/filters';
import type { AnimeFormat, AnimeStatus, MediaSource } from '../types/anime';

/**
 * Serializes a SearchFilterQuery object into URLSearchParams.
 * Only includes parameters that differ from EMPTY_FILTER to keep the URL clean.
 */
export function filterToSearchParams(filter: SearchFilterQuery): URLSearchParams {
  const params = new URLSearchParams();

  if (filter.textQuery) {
    params.set('q', filter.textQuery);
  }
  if (filter.genres.length > 0) {
    params.set('genres', filter.genres.join(','));
  }
  if (filter.excludedGenres.length > 0) {
    params.set('exGenres', filter.excludedGenres.join(','));
  }
  if (filter.studios.length > 0) {
    params.set('studios', filter.studios.join(','));
  }
  if (filter.excludedStudios.length > 0) {
    params.set('exStudios', filter.excludedStudios.join(','));
  }
  if (filter.tags.length > 0) {
    params.set('tags', filter.tags.join(','));
  }
  if (filter.excludedTags.length > 0) {
    params.set('exTags', filter.excludedTags.join(','));
  }
  if (filter.minScore !== null && !isNaN(filter.minScore)) {
    params.set('minScore', filter.minScore.toString());
  }
  if (filter.maxScore !== null && !isNaN(filter.maxScore)) {
    params.set('maxScore', filter.maxScore.toString());
  }
  if (filter.episodeGroups.length > 0) {
    params.set('epGroups', filter.episodeGroups.join(','));
  }
  if (filter.excludedEpisodeGroups.length > 0) {
    params.set('exEpGroups', filter.excludedEpisodeGroups.join(','));
  }
  if (filter.formats.length > 0) {
    params.set('formats', filter.formats.join(','));
  }
  if (filter.excludedFormats.length > 0) {
    params.set('exFormats', filter.excludedFormats.join(','));
  }
  if (filter.hasUkTranslation !== null) {
    params.set('hasUk', filter.hasUkTranslation.toString());
  }
  if (filter.mediaStatuses.length > 0) {
    params.set('statuses', filter.mediaStatuses.join(','));
  }
  if (filter.excludedMediaStatuses.length > 0) {
    params.set('exStatuses', filter.excludedMediaStatuses.join(','));
  }
  if (filter.mediaSources.length > 0) {
    params.set('sources', filter.mediaSources.join(','));
  }
  if (filter.excludedMediaSources.length > 0) {
    params.set('exSources', filter.excludedMediaSources.join(','));
  }
  if (filter.staff.length > 0) {
    params.set('staff', filter.staff.join(','));
  }
  if (filter.excludedStaff.length > 0) {
    params.set('exStaff', filter.excludedStaff.join(','));
  }
  if (filter.userStatuses.length > 0) {
    params.set('uStatus', filter.userStatuses.join(','));
  }
  if (filter.excludedUserStatuses.length > 0) {
    params.set('exUStatus', filter.excludedUserStatuses.join(','));
  }
  if (filter.sortBy !== EMPTY_FILTER.sortBy) {
    params.set('sort', filter.sortBy);
  }

  return params;
}

/**
 * Deserializes URLSearchParams back into a SearchFilterQuery object.
 */
export function searchParamsToFilter(params: URLSearchParams): SearchFilterQuery {
  const parseStringArray = (key: string): string[] => {
    const val = params.get(key);
    return val ? val.split(',').filter(Boolean) : [];
  };

  const parseNumberArray = (key: string): number[] => {
    const val = params.get(key);
    if (!val) return [];
    return val
      .split(',')
      .map((x) => parseInt(x, 10))
      .filter((x) => !isNaN(x));
  };

  const parseScore = (key: string): number | null => {
    const val = params.get(key);
    if (!val) return null;
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
  };

  const parseBoolean = (key: string): boolean | null => {
    const val = params.get(key);
    if (val === 'true') return true;
    if (val === 'false') return false;
    return null;
  };

  return {
    textQuery: params.get('q') || '',
    genres: parseStringArray('genres'),
    excludedGenres: parseStringArray('exGenres'),
    studios: parseNumberArray('studios'),
    excludedStudios: parseNumberArray('exStudios'),
    tags: parseNumberArray('tags'),
    excludedTags: parseNumberArray('exTags'),
    minScore: parseScore('minScore'),
    maxScore: parseScore('maxScore'),
    episodeGroups: parseStringArray('epGroups') as EpisodeGroup[],
    excludedEpisodeGroups: parseStringArray('exEpGroups') as EpisodeGroup[],
    formats: parseStringArray('formats') as AnimeFormat[],
    excludedFormats: parseStringArray('exFormats') as AnimeFormat[],
    hasUkTranslation: parseBoolean('hasUk'),
    mediaStatuses: parseStringArray('statuses') as AnimeStatus[],
    excludedMediaStatuses: parseStringArray('exStatuses') as AnimeStatus[],
    mediaSources: parseStringArray('sources') as MediaSource[],
    excludedMediaSources: parseStringArray('exSources') as MediaSource[],
    staff: parseNumberArray('staff'),
    excludedStaff: parseNumberArray('exStaff'),
    userStatuses: parseStringArray('uStatus'),
    excludedUserStatuses: parseStringArray('exUStatus'),
    sortBy: (params.get('sort') as SortOption) || EMPTY_FILTER.sortBy,
  };
}
