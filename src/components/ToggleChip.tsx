interface ToggleChipProps {
  label: string;
  isActive: boolean;
  isExcluded: boolean;
  onToggle: () => void;
}

export default function ToggleChip({
  label,
  isActive,
  isExcluded,
  onToggle,
}: ToggleChipProps) {
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
    <button type="button" onClick={onToggle} className={classes}>
      {isExcluded && '−'}{isActive && '+'} {label}
    </button>
  );
}
