// Search filter query — direct port from Android SearchFilterQuery.kt
// Supports include/exclude for genres, tags, studios, staff, formats, statuses, sources

import type { AnimeFormat, AnimeStatus, MediaSource } from './anime';

export type EpisodeGroup =
  | 'LESS_THAN_12'
  | 'BETWEEN_12_AND_18'
  | 'BETWEEN_19_AND_24'
  | 'GREATER_THAN_24';

export type SortOption =
  | 'RELEVANCE'
  | 'SCORE'
  | 'SCORE_ASC'
  | 'YEAR_DESC'
  | 'YEAR_ASC'
  | 'TITLE'
  | 'TITLE_DESC'
  | 'POPULARITY'
  | 'POPULARITY_ASC'
  | 'START_DATE_DESC'
  | 'START_DATE_ASC'
  | 'EPISODES_DESC'
  | 'EPISODES_ASC';

export interface SearchFilterQuery {
  textQuery: string;
  genres: string[];
  excludedGenres: string[];
  studios: number[];
  excludedStudios: number[];
  tags: number[];
  excludedTags: number[];
  minScore: number | null;
  maxScore: number | null;
  episodeGroups: EpisodeGroup[];
  excludedEpisodeGroups: EpisodeGroup[];
  formats: AnimeFormat[];
  excludedFormats: AnimeFormat[];
  hasUkTranslation: boolean | null;
  mediaStatuses: AnimeStatus[];
  excludedMediaStatuses: AnimeStatus[];
  mediaSources: MediaSource[];
  excludedMediaSources: MediaSource[];
  staff: number[];
  excludedStaff: number[];
  userStatuses: string[];
  excludedUserStatuses: string[];
  sortBy: SortOption;
}

export const EMPTY_FILTER: SearchFilterQuery = {
  textQuery: '',
  genres: [],
  excludedGenres: [],
  studios: [],
  excludedStudios: [],
  tags: [],
  excludedTags: [],
  minScore: null,
  maxScore: null,
  episodeGroups: [],
  excludedEpisodeGroups: [],
  formats: [],
  excludedFormats: [],
  hasUkTranslation: null,
  mediaStatuses: [],
  excludedMediaStatuses: [],
  mediaSources: [],
  excludedMediaSources: [],
  staff: [],
  excludedStaff: [],
  userStatuses: [],
  excludedUserStatuses: [],
  sortBy: 'SCORE',
};

