/**
 * FilterPanel — Expandable glassmorphic filter panel for the full search filter system.
 * Mirrors the Android filter UI with include/exclude toggles for genres, formats, etc.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SearchFilterQuery, SortOption, EpisodeGroup } from '../types/filters';
import type { Genre, Tag, Studio, AnimeSeason, Staff } from '../types/anime';
import { ANIME_FORMATS, ANIME_STATUSES, MEDIA_SOURCES } from '../types/anime';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import MetadataPortal from './MetadataPortal';

interface FilterPanelProps {
  filter: SearchFilterQuery;
  onChange: (filter: SearchFilterQuery) => void;
  genres: Genre[];
  tags: Tag[];
  studios: Studio[];
  staff: Staff[];
  isLoaded: boolean;
  hideUserStatusFilters?: boolean;
  showLastAddedSort?: boolean;
  lastAddedSortLabel?: string;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'SCORE', label: 'Score ↓' },
  { value: 'SCORE_ASC', label: 'Score ↑' },
  { value: 'POPULARITY', label: 'Popularity ↓' },
  { value: 'POPULARITY_ASC', label: 'Popularity ↑' },
  { value: 'YEAR_DESC', label: 'Year ↓' },
  { value: 'YEAR_ASC', label: 'Year ↑' },
  { value: 'TITLE', label: 'Title A→Z' },
  { value: 'TITLE_DESC', label: 'Title Z→A' },
  { value: 'RELEVANCE', label: 'Relevance' },
  { value: 'START_DATE_DESC', label: 'Start Date ↓' },
  { value: 'START_DATE_ASC', label: 'Start Date ↑' },
  { value: 'EPISODES_DESC', label: 'Episodes ↓' },
  { value: 'EPISODES_ASC', label: 'Episodes ↑' },
];

const EPISODE_GROUPS: { value: EpisodeGroup; label: string }[] = [
  { value: 'LESS_THAN_12', label: '< 12 eps' },
  { value: 'BETWEEN_12_AND_18', label: '12–18 eps' },
  { value: 'BETWEEN_19_AND_24', label: '19–24 eps' },
  { value: 'GREATER_THAN_24', label: '> 24 eps' },
];

export default function FilterPanel({
  filter,
  onChange,
  genres,
  tags,
  studios,
  staff,
  isLoaded,
  hideUserStatusFilters = false,
  showLastAddedSort = false,
  lastAddedSortLabel,
}: FilterPanelProps) {
  const { t } = useTranslation();
  const { preferUkTitles } = useSettings();
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [genreSearch, setGenreSearch] = useState('');
  const [tagSearch, setTagSearch] = useState('');
  const [studioSearch, setStudioSearch] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [isPortalOpen, setIsPortalOpen] = useState(false);
  const [portalTab, setPortalTab] = useState<'tags' | 'studios' | 'staff'>('tags');

  const activeFilterCount = countActiveFilters(filter, hideUserStatusFilters);



  const update = (partial: Partial<SearchFilterQuery>) =>
    onChange({ ...filter, ...partial });

  const handleClearAll = () => {
    onChange({
      ...filter,
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
      year: null,
      season: null,
    });
  };

  const filteredGenres = genres.filter(
    (g) =>
      g.name_en.toLowerCase().includes(genreSearch.toLowerCase()) ||
      (g.name_uk && g.name_uk.toLowerCase().includes(genreSearch.toLowerCase())),
  );

  const filteredTags = tags.filter(
    (t) =>
      t.name_en.toLowerCase().includes(tagSearch.toLowerCase()) ||
      (t.name_uk && t.name_uk.toLowerCase().includes(tagSearch.toLowerCase())),
  );

  const filteredStudios = studios.filter((s) =>
    s.name.toLowerCase().includes(studioSearch.toLowerCase()),
  );

  const filteredStaff = staff.filter((s) =>
    s.full_name.toLowerCase().includes(staffSearch.toLowerCase()),
  );

  const sortedTags = [...filteredTags].sort((a, b) => {
    const aSel = filter.tags.includes(a.tag_id) || filter.excludedTags.includes(a.tag_id);
    const bSel = filter.tags.includes(b.tag_id) || filter.excludedTags.includes(b.tag_id);
    if (aSel && !bSel) return -1;
    if (!aSel && bSel) return 1;
    return 0;
  });

  const sortedStudios = [...filteredStudios].sort((a, b) => {
    const aSel = filter.studios.includes(a.studio_id) || filter.excludedStudios.includes(a.studio_id);
    const bSel = filter.studios.includes(b.studio_id) || filter.excludedStudios.includes(b.studio_id);
    if (aSel && !bSel) return -1;
    if (!aSel && bSel) return 1;
    return 0;
  });

  const sortedStaff = [...filteredStaff].sort((a, b) => {
    const aSel = filter.staff.includes(a.staff_id) || filter.excludedStaff.includes(a.staff_id);
    const bSel = filter.staff.includes(b.staff_id) || filter.excludedStaff.includes(b.staff_id);
    if (aSel && !bSel) return -1;
    if (!aSel && bSel) return 1;
    return 0;
  });

  return (
    <div
      className={`glass-card p-4 transition-all duration-300 ${!isExpanded ? 'cursor-pointer' : ''}`}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('select')) return;

        if (!isExpanded) {
          setIsExpanded(true);
        } else {
          // If expanded, only header clicks collapse it
          if (target.closest('.filter-header')) {
            setIsExpanded(false);
          }
        }
      }}
    >
      {/* Header with toggle */}
      <div className={`filter-header flex items-center justify-between ${isExpanded ? 'cursor-pointer' : ''}`}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent-primary)] transition-colors cursor-pointer"
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {t('filter.title')}
            {activeFilterCount > 0 && (
              <span className="glass-badge bg-[var(--color-accent-primary)]/20 text-[var(--color-accent-primary)] border-[var(--color-accent-primary)]/30">
                {activeFilterCount}
              </span>
            )}
          </button>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClearAll();
              }}
              className="text-xs text-[var(--color-accent-rose)] hover:text-white hover:bg-[var(--color-accent-rose)]/20 px-2 py-1 rounded-md border border-[var(--color-accent-rose)]/20 transition-all duration-200 cursor-pointer flex items-center gap-1.5 font-medium"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {t('filter.clearAll', 'Clear All')}
            </button>
          )}
        </div>

        {/* Sort selector */}
        <select
          value={filter.sortBy}
          onChange={(e) => update({ sortBy: e.target.value as SortOption })}
          className="glass-input text-xs py-1.5 px-3 pr-8 cursor-pointer"
        >
          {(showLastAddedSort
            ? [{ value: 'LAST_MODIFIED' as SortOption, label: 'Last Added' }, ...SORT_OPTIONS]
            : SORT_OPTIONS
          ).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.value === 'LAST_MODIFIED' && lastAddedSortLabel
                ? lastAddedSortLabel
                : t(`sortOptions.${opt.value}`, opt.label)}
            </option>
          ))}
        </select>
      </div>

      <div className={`filter-expand-wrapper ${isExpanded && isLoaded ? 'expanded mt-4' : ''}`}>
        <div className="filter-expand-content space-y-5">
          {/* Format chips */}
          <FilterSection title={t('filter.format')}>
            <div className="flex flex-wrap gap-1.5">
              {ANIME_FORMATS.map((fmt) => (
                <ToggleChip
                  key={fmt}
                  label={t(`formats.${fmt}`, fmt.replace(/_/g, ' '))}
                  isActive={filter.formats.includes(fmt)}
                  isExcluded={filter.excludedFormats.includes(fmt)}
                  onToggle={() => {
                    if (filter.excludedFormats.includes(fmt)) {
                      update({ excludedFormats: filter.excludedFormats.filter((f) => f !== fmt) });
                    } else if (filter.formats.includes(fmt)) {
                      update({
                        formats: filter.formats.filter((f) => f !== fmt),
                        excludedFormats: [...filter.excludedFormats, fmt],
                      });
                    } else {
                      update({ formats: [...filter.formats, fmt] });
                    }
                  }}
                />
              ))}
            </div>
          </FilterSection>

          {/* Status chips */}
          <FilterSection title={t('filter.status')}>
            <div className="flex flex-wrap gap-1.5">
              {ANIME_STATUSES.map((st) => (
                <ToggleChip
                  key={st}
                  label={t(`airingStatus.${st}`, st.replace(/_/g, ' '))}
                  isActive={filter.mediaStatuses.includes(st)}
                  isExcluded={filter.excludedMediaStatuses.includes(st)}
                  onToggle={() => {
                    if (filter.excludedMediaStatuses.includes(st)) {
                      update({ excludedMediaStatuses: filter.excludedMediaStatuses.filter((s) => s !== st) });
                    } else if (filter.mediaStatuses.includes(st)) {
                      update({
                        mediaStatuses: filter.mediaStatuses.filter((s) => s !== st),
                        excludedMediaStatuses: [...filter.excludedMediaStatuses, st],
                      });
                    } else {
                      update({ mediaStatuses: [...filter.mediaStatuses, st] });
                    }
                  }}
                />
              ))}
            </div>
          </FilterSection>

          {/* Episode count */}
          <FilterSection title={t('filter.episodes')}>
            <div className="flex flex-wrap gap-1.5">
              {EPISODE_GROUPS.map((eg) => (
                <ToggleChip
                  key={eg.value}
                  label={t(`episodeGroups.${eg.value}`, eg.label)}
                  isActive={filter.episodeGroups.includes(eg.value)}
                  isExcluded={filter.excludedEpisodeGroups.includes(eg.value)}
                  onToggle={() => {
                    if (filter.excludedEpisodeGroups.includes(eg.value)) {
                      update({ excludedEpisodeGroups: filter.excludedEpisodeGroups.filter((g) => g !== eg.value) });
                    } else if (filter.episodeGroups.includes(eg.value)) {
                      update({
                        episodeGroups: filter.episodeGroups.filter((g) => g !== eg.value),
                        excludedEpisodeGroups: [...filter.excludedEpisodeGroups, eg.value],
                      });
                    } else {
                      update({ episodeGroups: [...filter.episodeGroups, eg.value] });
                    }
                  }}
                />
              ))}
            </div>
          </FilterSection>

          {/* Score range */}
          <FilterSection title={t('filter.scoreRange')}>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max="10"
                step="0.5"
                placeholder={t('filter.minScore')}
                value={filter.minScore ?? ''}
                onChange={(e) =>
                  update({ minScore: e.target.value ? parseFloat(e.target.value) : null })
                }
                className="glass-input py-1.5 px-3 w-20 text-xs text-center"
              />
              <span className="text-[var(--color-text-tertiary)] text-xs">{t('filter.toScore')}</span>
              <input
                type="number"
                min="0"
                max="10"
                step="0.5"
                placeholder={t('filter.maxScore')}
                value={filter.maxScore ?? ''}
                onChange={(e) =>
                  update({ maxScore: e.target.value ? parseFloat(e.target.value) : null })
                }
                className="glass-input py-1.5 px-3 w-20 text-xs text-center"
              />
            </div>
          </FilterSection>

          {/* Year & Season */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FilterSection title={t('filter.year')}>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1950"
                  max={new Date().getFullYear() + 2}
                  placeholder={t('filter.anyYear')}
                  value={filter.year ?? ''}
                  onChange={(e) =>
                    update({ year: e.target.value ? parseInt(e.target.value, 10) : null })
                  }
                  className="glass-input py-1.5 px-3 w-50 text-xs text-center"
                />
                {filter.year !== null && (
                  <button
                    onClick={() => update({ year: null })}
                    className="text-xs text-[var(--color-accent-rose)] hover:underline whitespace-nowrap"
                  >
                    {t('filter.clearYear')}
                  </button>
                )}
              </div>
            </FilterSection>

            <FilterSection title={t('filter.season')}>
              <div className="flex flex-wrap items-center gap-1.5">
                {(['WINTER', 'SPRING', 'SUMMER', 'FALL'] as AnimeSeason[]).map((seas) => (
                  <ToggleChip
                    key={seas}
                    label={t(`season.${seas.toLowerCase()}`, seas)}
                    isActive={filter.season === seas}
                    isExcluded={false}
                    onToggle={() => {
                      if (filter.season === seas) {
                        update({ season: null });
                      } else {
                        update({ season: seas });
                      }
                    }}
                  />
                ))}
              </div>
            </FilterSection>
          </div>

          {/* Current Season quick filter button */}
          <div className="flex justify-start">
            <button
              onClick={() => {
                const { year, season } = getCurrentSeason();
                update({ year, season });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] border border-[var(--color-accent-primary)]/20 hover:bg-[var(--color-accent-primary)]/20 active:scale-[0.98] transition-all cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {t('filter.currentSeason')}
            </button>
          </div>

          {/* User List status chips */}
          {user && !hideUserStatusFilters && (
            <FilterSection title={t('filter.userStatus')}>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: 'PLANNING', label: t('status.PLANNING') },
                  { value: 'CURRENT', label: t('status.CURRENT') },
                  { value: 'COMPLETED', label: t('status.COMPLETED') },
                  { value: 'PAUSED', label: t('status.PAUSED') },
                  { value: 'DROPPED', label: t('status.DROPPED') },
                ].map((us) => {
                  const isActive = filter.userStatuses.includes(us.value);
                  const isExcluded = filter.excludedUserStatuses.includes(us.value);
                  return (
                    <ToggleChip
                      key={us.value}
                      label={us.label}
                      isActive={isActive}
                      isExcluded={isExcluded}
                      onToggle={() => {
                        if (isExcluded) {
                          update({
                            excludedUserStatuses: filter.excludedUserStatuses.filter((s) => s !== us.value),
                          });
                        } else if (isActive) {
                          update({
                            userStatuses: filter.userStatuses.filter((s) => s !== us.value),
                            excludedUserStatuses: [...filter.excludedUserStatuses, us.value],
                          });
                        } else {
                          update({
                            userStatuses: [...filter.userStatuses, us.value],
                          });
                        }
                      }}
                    />
                  );
                })}
              </div>
            </FilterSection>
          )}

          {/* Source chips */}
          <FilterSection title={t('filter.source')}>
            <div className="flex flex-wrap gap-1.5">
              {MEDIA_SOURCES.slice(0, 8).map((src) => (
                <ToggleChip
                  key={src}
                  label={t(`sources.${src}`, src.replace(/_/g, ' '))}
                  isActive={filter.mediaSources.includes(src)}
                  isExcluded={filter.excludedMediaSources.includes(src)}
                  onToggle={() => {
                    if (filter.excludedMediaSources.includes(src)) {
                      update({ excludedMediaSources: filter.excludedMediaSources.filter((s) => s !== src) });
                    } else if (filter.mediaSources.includes(src)) {
                      update({
                        mediaSources: filter.mediaSources.filter((s) => s !== src),
                        excludedMediaSources: [...filter.excludedMediaSources, src],
                      });
                    } else {
                      update({ mediaSources: [...filter.mediaSources, src] });
                    }
                  }}
                />
              ))}
            </div>
          </FilterSection>

          {/* Genres with search */}
          <FilterSection title={t('filter.genres', { count: genres.length })}>
            <div className="relative w-full mb-2">
              <input
                type="text"
                placeholder={t('filter.searchGenres')}
                value={genreSearch}
                onChange={(e) => setGenreSearch(e.target.value)}
                className="glass-input py-1.5 pl-3 pr-8 w-full text-xs"
              />
              {genreSearch && (
                <button
                  type="button"
                  onClick={() => setGenreSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {filteredGenres.slice(0, 30).map((g) => (
                <ToggleChip
                  key={g.slug}
                  label={preferUkTitles ? (g.name_uk || g.name_en) : g.name_en}
                  isActive={filter.genres.includes(g.slug)}
                  isExcluded={filter.excludedGenres.includes(g.slug)}
                  onToggle={() => {
                    if (filter.excludedGenres.includes(g.slug)) {
                      update({ excludedGenres: filter.excludedGenres.filter((s) => s !== g.slug) });
                    } else if (filter.genres.includes(g.slug)) {
                      update({
                        genres: filter.genres.filter((s) => s !== g.slug),
                        excludedGenres: [...filter.excludedGenres, g.slug],
                      });
                    } else {
                      update({ genres: [...filter.genres, g.slug] });
                    }
                  }}
                />
              ))}
            </div>
          </FilterSection>

          {/* Tags with search */}
          <FilterSection
            title={t('filter.tags', { count: tags.length })}
            action={
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPortalTab('tags');
                  setIsPortalOpen(true);
                }}
                className="text-[10px] text-[var(--color-accent-primary)] hover:underline cursor-pointer font-bold"
              >
                {t('filter.viewAll', 'View All →')}
              </button>
            }
          >
            <div className="relative w-full mb-2">
              <input
                type="text"
                placeholder={t('filter.searchTags')}
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                className="glass-input py-1.5 pl-3 pr-8 w-full text-xs"
              />
              {tagSearch && (
                <button
                  type="button"
                  onClick={() => setTagSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {sortedTags.slice(0, 30).map((t) => (
                <ToggleChip
                  key={t.tag_id}
                  label={preferUkTitles ? (t.name_uk || t.name_en) : t.name_en}
                  isActive={filter.tags.includes(t.tag_id)}
                  isExcluded={filter.excludedTags.includes(t.tag_id)}
                  onToggle={() => {
                    if (filter.excludedTags.includes(t.tag_id)) {
                      update({ excludedTags: filter.excludedTags.filter((id) => id !== t.tag_id) });
                    } else if (filter.tags.includes(t.tag_id)) {
                      update({
                        tags: filter.tags.filter((id) => id !== t.tag_id),
                        excludedTags: [...filter.excludedTags, t.tag_id],
                      });
                    } else {
                      update({ tags: [...filter.tags, t.tag_id] });
                    }
                  }}
                />
              ))}
            </div>
          </FilterSection>

          {/* Studios with search */}
          <FilterSection
            title={t('filter.studios', { count: studios.length })}
            action={
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPortalTab('studios');
                  setIsPortalOpen(true);
                }}
                className="text-[10px] text-[var(--color-accent-primary)] hover:underline cursor-pointer font-bold"
              >
                {t('filter.viewAll', 'View All →')}
              </button>
            }
          >
            <div className="relative w-full mb-2">
              <input
                type="text"
                placeholder={t('filter.searchStudios')}
                value={studioSearch}
                onChange={(e) => setStudioSearch(e.target.value)}
                className="glass-input py-1.5 pl-3 pr-8 w-full text-xs"
              />
              {studioSearch && (
                <button
                  type="button"
                  onClick={() => setStudioSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {sortedStudios.slice(0, 30).map((s) => (
                <ToggleChip
                  key={s.studio_id}
                  label={s.name}
                  isActive={filter.studios.includes(s.studio_id)}
                  isExcluded={filter.excludedStudios.includes(s.studio_id)}
                  onToggle={() => {
                    if (filter.excludedStudios.includes(s.studio_id)) {
                      update({ excludedStudios: filter.excludedStudios.filter((id) => id !== s.studio_id) });
                    } else if (filter.studios.includes(s.studio_id)) {
                      update({
                        studios: filter.studios.filter((id) => id !== s.studio_id),
                        excludedStudios: [...filter.excludedStudios, s.studio_id],
                      });
                    } else {
                      update({ studios: [...filter.studios, s.studio_id] });
                    }
                  }}
                />
              ))}
            </div>
          </FilterSection>

          {/* Staff with search */}
          <FilterSection
            title={t('staff', 'Staff')}
            action={
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPortalTab('staff');
                  setIsPortalOpen(true);
                }}
                className="text-[10px] text-[var(--color-accent-primary)] hover:underline cursor-pointer font-bold"
              >
                {t('filter.viewAll', 'View All →')}
              </button>
            }
          >
            <div className="relative w-full mb-2">
              <input
                type="text"
                placeholder={t('filter.searchStaff', 'Search staff...')}
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                className="glass-input py-1.5 pl-3 pr-8 w-full text-xs"
              />
              {staffSearch && (
                <button
                  type="button"
                  onClick={() => setStaffSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {sortedStaff.slice(0, 30).map((s) => (
                <ToggleChip
                  key={s.staff_id}
                  label={s.full_name}
                  isActive={filter.staff.includes(s.staff_id)}
                  isExcluded={filter.excludedStaff.includes(s.staff_id)}
                  onToggle={() => {
                    if (filter.excludedStaff.includes(s.staff_id)) {
                      update({ excludedStaff: filter.excludedStaff.filter((id) => id !== s.staff_id) });
                    } else if (filter.staff.includes(s.staff_id)) {
                      update({
                        staff: filter.staff.filter((id) => id !== s.staff_id),
                        excludedStaff: [...filter.excludedStaff, s.staff_id],
                      });
                    } else {
                      update({ staff: [...filter.staff, s.staff_id] });
                    }
                  }}
                />
              ))}
            </div>
          </FilterSection>

          {/* Ukrainian translation toggle */}
          <FilterSection title={t('filter.language')}>
            <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--color-text-secondary)]">
              <input
                type="checkbox"
                checked={filter.hasUkTranslation === true}
                onChange={(e) =>
                  update({ hasUkTranslation: e.target.checked ? true : null })
                }
                className="accent-[var(--color-accent-primary)]"
              />
              {t('filter.hasUkTranslation')}
            </label>
          </FilterSection>

          {/* Reset button */}
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="w-full py-2 text-xs font-medium text-[var(--color-accent-rose)] hover:text-white hover:bg-[var(--color-accent-rose)]/20 rounded-lg transition-colors border border-[var(--color-accent-rose)]/20"
            >
              {t('filter.clearAll')}
            </button>
          )}
        </div>
      </div>

      <MetadataPortal
        isOpen={isPortalOpen}
        onClose={() => setIsPortalOpen(false)}
        initialTab={portalTab}
        tags={tags}
        studios={studios}
        staff={staff}
        filter={filter}
        onChange={onChange}
      />
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function FilterSection({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
          {title}
        </h4>
        {action}
      </div>
      {children}
    </div>
  );
}

/**
 * ToggleChip — 3-state chip: inactive → include (green) → exclude (red) → inactive.
 */
function ToggleChip({
  label,
  isActive,
  isExcluded,
  onToggle,
}: {
  label: string;
  isActive: boolean;
  isExcluded: boolean;
  onToggle: () => void;
}) {
  const base = 'px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-all duration-200 border select-none';
  let classes = base;

  if (isExcluded) {
    classes += ' bg-red-500/15 text-red-400 border-red-500/30 line-through';
  } else if (isActive) {
    classes += ' bg-[var(--color-accent-primary)]/20 text-[var(--color-accent-primary)] border-[var(--color-accent-primary)]/30';
  } else {
    classes += ' bg-[var(--color-bg-input)] text-[var(--color-text-secondary)] border-[var(--color-border-glass)] hover:border-[var(--color-border-glass-hover)] hover:text-[var(--color-text-primary)]';
  }

  return (
    <button onClick={onToggle} className={classes}>
      {isExcluded && '−'}{isActive && '+'} {label}
    </button>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function countActiveFilters(f: SearchFilterQuery, hideUserStatusFilters?: boolean): number {
  let count = 0;
  if (f.genres.length) count++;
  if (f.excludedGenres.length) count++;
  if (f.studios.length) count++;
  if (f.excludedStudios.length) count++;
  if (f.tags.length) count++;
  if (f.excludedTags.length) count++;
  if (f.minScore !== null) count++;
  if (f.maxScore !== null) count++;
  if (f.episodeGroups.length) count++;
  if (f.excludedEpisodeGroups.length) count++;
  if (f.formats.length) count++;
  if (f.excludedFormats.length) count++;
  if (f.hasUkTranslation !== null) count++;
  if (f.mediaStatuses.length) count++;
  if (f.excludedMediaStatuses.length) count++;
  if (f.mediaSources.length) count++;
  if (f.excludedMediaSources.length) count++;
  if (f.staff.length) count++;
  if (f.excludedStaff.length) count++;
  if (!hideUserStatusFilters && f.userStatuses && f.userStatuses.length) count++;
  if (!hideUserStatusFilters && f.excludedUserStatuses && f.excludedUserStatuses.length) count++;
  if (f.year !== null) count++;
  if (f.season !== null) count++;
  return count;
}

function getCurrentSeason(): { year: number; season: AnimeSeason } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0 = Jan, 11 = Dec
  
  let season: AnimeSeason;
  let seasonYear = year;

  if (month === 11 || month === 0 || month === 1) {
    season = 'WINTER';
    if (month === 11) {
      seasonYear = year + 1;
    }
  } else if (month >= 2 && month <= 4) {
    season = 'SPRING';
  } else if (month >= 5 && month <= 7) {
    season = 'SUMMER';
  } else {
    season = 'FALL';
  }
  
  return { year: seasonYear, season };
}
