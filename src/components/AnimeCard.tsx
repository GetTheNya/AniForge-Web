/**
 * AnimeCard — Glassmorphic card displaying anime cover, title, and metadata.
 */

import type { Anime } from '../types/anime';
import { useNavigation } from '../hooks/useNavigation';
import StatusBadge from './StatusBadge';

interface AnimeCardProps {
  anime: Anime;
  index?: number;
}

export default function AnimeCard({ anime, index = 0 }: AnimeCardProps) {
  const { navigate } = useNavigation();
  const coverUrl = anime.cover_large || anime.cover_extra_large;
  const title = anime.title_en || anime.title_romaji;
  const subtitle = anime.title_en ? anime.title_romaji : anime.title_uk;

  const scoreColor =
    anime.score_mal && anime.score_mal >= 7.5
      ? 'text-[var(--color-score-high)]'
      : anime.score_mal && anime.score_mal >= 5.5
        ? 'text-[var(--color-score-mid)]'
        : 'text-[var(--color-score-low)]';

  return (
    <div
      className="glass-card group overflow-hidden animate-scale-in cursor-pointer"
      style={{ animationDelay: `${index * 30}ms`, animationFillMode: 'both' }}
      onClick={() => navigate('/anime', `?id=${anime.anilist_id}`)}
    >
      {/* Cover image */}
      <div className="relative aspect-[3/4] overflow-hidden">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
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
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg-base)] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Score badge (top-right) */}
        {anime.score_mal !== null && anime.score_mal > 0 && (
          <div className="absolute top-2 right-2 glass-badge bg-[var(--color-bg-overlay)]">
            <svg
              className={`w-3 h-3 mr-1 ${scoreColor}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className={`text-xs font-bold ${scoreColor}`}>
              {anime.score_mal.toFixed(1)}
            </span>
          </div>
        )}

        {/* Format badge (top-left) */}
        {anime.format && (
          <div className="absolute top-2 left-2">
            <StatusBadge type="format" value={anime.format} />
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-3 space-y-1.5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] line-clamp-2 leading-snug">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-[var(--color-text-tertiary)] line-clamp-1">
            {subtitle}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap">
          {anime.status && <StatusBadge type="status" value={anime.status} />}
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
