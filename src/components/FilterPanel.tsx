/**
 * FilterPanel — Expandable glassmorphic filter panel for the full search filter system.
 * Mirrors the Android filter UI with include/exclude toggles for genres, formats, etc.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SearchFilterQuery, SortOption, EpisodeGroup } from '../types/filters';
import type { Genre, Tag, Studio } from '../types/anime';
import { ANIME_FORMATS, ANIME_STATUSES, MEDIA_SOURCES } from '../types/anime';
import { useSettings } from '../context/SettingsContext';

interface FilterPanelProps {
  filter: SearchFilterQuery;
  onChange: (filter: SearchFilterQuery) => void;
  genres: Genre[];
  tags: Tag[];
  studios: Studio[];
  isLoaded: boolean;
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
  isLoaded,
}: FilterPanelProps) {
  const { t } = useTranslation();
  const { preferUkTitles } = useSettings();
  const [isExpanded, setIsExpanded] = useState(false);
  const [genreSearch, setGenreSearch] = useState('');
  const [tagSearch, setTagSearch] = useState('');
  const [studioSearch, setStudioSearch] = useState('');

  const activeFilterCount = countActiveFilters(filter);



  const update = (partial: Partial<SearchFilterQuery>) =>
    onChange({ ...filter, ...partial });

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

  return (
    <div className="glass-card p-4 space-y-4">
      {/* Header with toggle */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent-primary)] transition-colors"
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

        {/* Sort selector */}
        <select
          value={filter.sortBy}
          onChange={(e) => update({ sortBy: e.target.value as SortOption })}
          className="glass-input text-xs py-1.5 px-3 pr-8 cursor-pointer"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(`sortOptions.${opt.value}`, opt.label)}
            </option>
          ))}
        </select>
      </div>

      {isExpanded && isLoaded && (
        <div className="space-y-5 animate-fade-in">
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
            <input
              type="text"
              placeholder={t('filter.searchGenres')}
              value={genreSearch}
              onChange={(e) => setGenreSearch(e.target.value)}
              className="glass-input py-1.5 px-3 w-full text-xs mb-2"
            />
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
          <FilterSection title={t('filter.tags', { count: tags.length })}>
            <input
              type="text"
              placeholder={t('filter.searchTags')}
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
              className="glass-input py-1.5 px-3 w-full text-xs mb-2"
            />
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {filteredTags.slice(0, 30).map((t) => (
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
          <FilterSection title={t('filter.studios', { count: studios.length })}>
            <input
              type="text"
              placeholder={t('filter.searchStudios')}
              value={studioSearch}
              onChange={(e) => setStudioSearch(e.target.value)}
              className="glass-input py-1.5 px-3 w-full text-xs mb-2"
            />
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {filteredStudios.slice(0, 30).map((s) => (
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
              onClick={() =>
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
                })
              }
              className="w-full py-2 text-xs font-medium text-[var(--color-accent-rose)] hover:text-white hover:bg-[var(--color-accent-rose)]/20 rounded-lg transition-colors border border-[var(--color-accent-rose)]/20"
            >
              {t('filter.clearAll')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {title}
      </h4>
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

function countActiveFilters(f: SearchFilterQuery): number {
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
  return count;
}
