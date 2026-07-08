/**
 * AnimeCard — Glassmorphic card displaying anime cover, title, and metadata.
 */

import type { Anime } from '../types/anime';
import { useNavigation } from '../hooks/useNavigation';
import StatusBadge from './StatusBadge';
import { useSettings } from '../context/SettingsContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { userDb } from '../services/userDb';
import { STATUS_COLORS } from '../utils/statusConfig';
import { useTranslation } from 'react-i18next';

interface AnimeCardProps {
  anime: Anime;
  index?: number;
  disableHoverTranslation?: boolean;
  fromCollectionId?: string | null;
}

export default function AnimeCard({
  anime,
  index = 0,
  disableHoverTranslation = false,
  fromCollectionId,
}: AnimeCardProps) {
  const { navigate } = useNavigation();
  const { preferUkTitles } = useSettings();
  const { t } = useTranslation();
  const coverUrl = anime.cover_large || anime.cover_extra_large;

  const tracking = useLiveQuery(
    () => userDb.user_tracking.get(anime.anilist_id),
    [anime.anilist_id]
  );

  const hasUserStatus = tracking && !tracking.is_deleted;

  let title = '';
  let subtitle: string | null = null;

  if (preferUkTitles) {
    if (anime.title_uk) {
      title = anime.title_uk;
      subtitle = anime.title_romaji || null;
    } else if (anime.title_en) {
      title = anime.title_en;
      subtitle = anime.title_romaji || null;
    } else {
      title = anime.title_romaji;
      subtitle = null;
    }
  } else {
    if (anime.title_en) {
      title = anime.title_en;
      subtitle = anime.title_romaji || null;
    } else {
      title = anime.title_romaji;
      subtitle = null;
    }
  }

  const scoreColor =
    anime.score_mal && anime.score_mal >= 7.5
      ? 'text-[var(--color-score-high)]'
      : anime.score_mal && anime.score_mal >= 5.5
        ? 'text-[var(--color-score-mid)]'
        : 'text-[var(--color-score-low)]';

  return (
    <div
      className={`group relative rounded-xl bg-neutral-900/80 border border-white/5 border-glass animate-scale-in transition-all duration-300 ease-out hover:border-white/20 flex flex-col transform-gpu ${
        disableHoverTranslation ? '' : 'hover:-translate-y-1'
      }`}
      style={{ animationDelay: `${index * 30}ms`, animationFillMode: 'both' }}
      onClick={() => navigate('/anime', `?id=${anime.anilist_id}${fromCollectionId ? `&collectionId=${fromCollectionId}` : ''}`)}
    >
      {/* Cover image */}
      <div className="relative">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={title}
            loading="lazy"
            decoding='sync'
            className="w-full aspect-[3/4] object-cover rounded-t-xl transition-opacity duration-300 group-hover:opacity-85"
            style={
              anime.cover_color
                ? { backgroundColor: anime.cover_color }
                : undefined
            }
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: anime.cover_color || '#1a1a2e' }}
          >
            <span className="text-4xl opacity-40">🎬</span>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg-base)] via-transparent to-transparent opacity-0 transition-opacity duration-300" />

        {/* Score badge (top-right) */}
        {anime.score_mal !== null && anime.score_mal > 0 && (
          <div className="absolute top-2 right-2 glass-badge h-[22px] bg-[var(--color-bg-overlay)]">
            <svg
              className={`w-3 h-3 mr-1 ${scoreColor}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className={`text-[0.7rem] font-bold ${scoreColor} leading-none`}>
              {anime.score_mal.toFixed(1)}
            </span>
          </div>
        )}

        {/* User Status badge (top-left) */}
        {hasUserStatus && (
          <div
            className="absolute top-2 left-2 glass-badge h-[22px] bg-[var(--color-bg-overlay)]"
            style={{
              color: STATUS_COLORS[tracking.status as keyof typeof STATUS_COLORS] || '#9ca3af',
              borderColor: `${STATUS_COLORS[tracking.status as keyof typeof STATUS_COLORS] || '#6b7280'}80`,
            }}
          >
            {t(`status.${tracking.status}`, { defaultValue: tracking.status })}
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-3 space-y-1.5 flex-grow flex flex-col">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] line-clamp-2 leading-snug">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-[var(--color-text-tertiary)] line-clamp-1">
            {subtitle}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap mt-auto pt-1">
          {anime.format && <StatusBadge type="format" value={anime.format} />}
          {anime.season_year && (
            <span className="text-xs text-[var(--color-text-secondary)]">
              {anime.season_year}
            </span>
          )}
          {anime.episodes && (
            <span className="text-xs text-[var(--color-text-tertiary)]">
              {anime.episodes} ep
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
