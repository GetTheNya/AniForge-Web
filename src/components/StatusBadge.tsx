/**
 * StatusBadge — colored badges for anime format and media status.
 */

interface StatusBadgeProps {
  type: 'status' | 'format';
  value: string;
}

const STATUS_COLORS: Record<string, string> = {
  RELEASING: 'bg-[var(--color-status-releasing)]/15 text-[var(--color-status-releasing)] border-[var(--color-status-releasing)]/20',
  FINISHED: 'bg-[var(--color-status-finished)]/15 text-[var(--color-status-finished)] border-[var(--color-status-finished)]/20',
  NOT_YET_RELEASED: 'bg-[var(--color-status-upcoming)]/15 text-[var(--color-status-upcoming)] border-[var(--color-status-upcoming)]/20',
  CANCELLED: 'bg-[var(--color-status-cancelled)]/15 text-[var(--color-status-cancelled)] border-[var(--color-status-cancelled)]/20',
  HIATUS: 'bg-[var(--color-status-hiatus)]/15 text-[var(--color-status-hiatus)] border-[var(--color-status-hiatus)]/20',
};

const FORMAT_COLORS: Record<string, string> = {
  TV: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  TV_SHORT: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
  MOVIE: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  SPECIAL: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  OVA: 'bg-teal-500/15 text-teal-400 border-teal-500/20',
  ONA: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  MUSIC: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
};

const STATUS_LABELS: Record<string, string> = {
  RELEASING: 'Airing',
  FINISHED: 'Finished',
  NOT_YET_RELEASED: 'Upcoming',
  CANCELLED: 'Cancelled',
  HIATUS: 'Hiatus',
};

const FORMAT_LABELS: Record<string, string> = {
  TV: 'TV',
  TV_SHORT: 'Short',
  MOVIE: 'Movie',
  SPECIAL: 'Special',
  OVA: 'OVA',
  ONA: 'ONA',
  MUSIC: 'Music',
  MANGA: 'Manga',
  NOVEL: 'Novel',
  ONE_SHOT: 'One Shot',
};

export default function StatusBadge({ type, value }: StatusBadgeProps) {
  const colorMap = type === 'status' ? STATUS_COLORS : FORMAT_COLORS;
  const labelMap = type === 'status' ? STATUS_LABELS : FORMAT_LABELS;
  const colors = colorMap[value] || 'bg-gray-500/15 text-gray-400 border-gray-500/20';
  const label = labelMap[value] || value.replace(/_/g, ' ');

  return (
    <span className={`glass-badge ${colors}`}>
      {label}
    </span>
  );
}
