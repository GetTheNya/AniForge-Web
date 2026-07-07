// AniForge Web — TypeScript interfaces matching the SQLite catalog schema

// ─── Anime (31 columns) ────────────────────────────────────────────────────────

export interface Anime {
  anilist_id: number;
  mal_id: number | null;
  title_uk: string | null;
  title_romaji: string;
  title_en: string | null;
  description_uk: string | null;
  description_en: string | null;
  format: AnimeFormat | null;
  status: AnimeStatus | null;
  episodes: number | null;
  duration: number | null;
  season_year: number | null;
  season: AnimeSeason | null;
  is_adult: boolean;
  score_mal: number | null;
  cover_extra_large: string | null;
  cover_large: string | null;
  cover_color: string | null;
  banner_image: string | null;
  has_uk_translation: boolean;
  updated_at: number;
  airing_at: number | null;
  airing_episode: number | null;
  trailer_id: string | null;
  trailer_site: string | null;
  trailer_thumbnail: string | null;
  start_date_year: number | null;
  start_date_month: number | null;
  start_date_day: number | null;
  popularity: number | null;
  source: MediaSource | null;
  synonyms_flat: string | null;
  displayTitle?: string; // Hydrated at runtime
}

// ─── Enum-like string unions ────────────────────────────────────────────────────

export type AnimeFormat =
  | 'TV'
  | 'TV_SHORT'
  | 'MOVIE'
  | 'SPECIAL'
  | 'OVA'
  | 'ONA'
  | 'MUSIC'
  | 'MANGA'
  | 'NOVEL'
  | 'ONE_SHOT';

export const ANIME_FORMATS: AnimeFormat[] = [
  'TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA', 'MUSIC',
];

export type AnimeStatus =
  | 'FINISHED'
  | 'RELEASING'
  | 'NOT_YET_RELEASED'
  | 'CANCELLED'
  | 'HIATUS';

export const ANIME_STATUSES: AnimeStatus[] = [
  'FINISHED', 'RELEASING', 'NOT_YET_RELEASED', 'CANCELLED', 'HIATUS',
];

export type AnimeSeason = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';

export type MediaSource =
  | 'ORIGINAL'
  | 'MANGA'
  | 'LIGHT_NOVEL'
  | 'VISUAL_NOVEL'
  | 'VIDEO_GAME'
  | 'OTHER'
  | 'NOVEL'
  | 'DOUJINSHI'
  | 'ANIME'
  | 'WEB_NOVEL'
  | 'LIVE_ACTION'
  | 'GAME'
  | 'COMIC'
  | 'MULTIMEDIA_PROJECT'
  | 'PICTURE_BOOK';

export const MEDIA_SOURCES: MediaSource[] = [
  'ORIGINAL', 'MANGA', 'LIGHT_NOVEL', 'VISUAL_NOVEL', 'VIDEO_GAME',
  'OTHER', 'NOVEL', 'DOUJINSHI', 'ANIME', 'WEB_NOVEL', 'LIVE_ACTION',
  'GAME', 'COMIC', 'MULTIMEDIA_PROJECT', 'PICTURE_BOOK',
];

// ─── Related entities ───────────────────────────────────────────────────────────

export interface Genre {
  slug: string;
  name_en: string;
  name_uk: string | null;
  name?: string; // Hydrated at runtime
}

export interface Tag {
  tag_id: number;
  name_en: string;
  name_uk: string | null;
  category: string | null;
  name?: string; // Hydrated at runtime
}

export interface Studio {
  studio_id: number;
  name: string;
}

export interface Staff {
  staff_id: number;
  full_name: string;
  image_large: string | null;
}

export interface AnimeStaff extends Staff {
  role: string;
}

export interface Franchise {
  franchise_id: number;
  main_anilist_id: number;
  name_en: string | null;
  name_uk: string | null;
  name?: string; // Hydrated at runtime
}

export interface Relation {
  edge_id: number;
  source_anilist_id: number;
  target_anilist_id: number;
  relation_type: string;
}

export interface Ranking {
  id: number;
  anilist_id: number;
  rank: number;
  context: string;
  all_time: boolean;
  season: string | null;
  year: number | null;
}

// ─── Row mapper utility ─────────────────────────────────────────────────────────

/**
 * Maps a raw sql.js result row (object of column→value) to a typed Anime object.
 * sql.js returns values as primitives; booleans are stored as 0/1 integers.
 */
export function rowToAnime(row: Record<string, unknown>): Anime {
  return {
    anilist_id: row.anilist_id as number,
    mal_id: (row.mal_id as number) ?? null,
    title_uk: (row.title_uk as string) ?? null,
    title_romaji: (row.title_romaji as string) ?? '',
    title_en: (row.title_en as string) ?? null,
    description_uk: (row.description_uk as string) ?? null,
    description_en: (row.description_en as string) ?? null,
    format: (row.format as AnimeFormat) ?? null,
    status: (row.status as AnimeStatus) ?? null,
    episodes: (row.episodes as number) ?? null,
    duration: (row.duration as number) ?? null,
    season_year: (row.season_year as number) ?? null,
    season: (row.season as AnimeSeason) ?? null,
    is_adult: (row.is_adult as number) === 1,
    score_mal: (row.score_mal as number) ?? null,
    cover_extra_large: (row.cover_extra_large as string) ?? null,
    cover_large: (row.cover_large as string) ?? null,
    cover_color: (row.cover_color as string) ?? null,
    banner_image: (row.banner_image as string) ?? null,
    has_uk_translation: (row.has_uk_translation as number) === 1,
    updated_at: row.updated_at as number,
    airing_at: (row.airing_at as number) ?? null,
    airing_episode: (row.airing_episode as number) ?? null,
    trailer_id: (row.trailer_id as string) ?? null,
    trailer_site: (row.trailer_site as string) ?? null,
    trailer_thumbnail: (row.trailer_thumbnail as string) ?? null,
    start_date_year: (row.start_date_year as number) ?? null,
    start_date_month: (row.start_date_month as number) ?? null,
    start_date_day: (row.start_date_day as number) ?? null,
    popularity: (row.popularity as number) ?? null,
    source: (row.source as MediaSource) ?? null,
    synonyms_flat: (row.synonyms_flat as string) ?? null,
  };
}
