/**
 * SearchBar — Glassmorphic search input with result count and loading state.
 */

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  resultCount: number | null;
  isSearching: boolean;
  placeholder?: string;
}

export default function SearchBar({
  value,
  onChange,
  resultCount,
  isSearching,
  placeholder = 'Search anime by title, description, or ID...',
}: SearchBarProps) {
  return (
    <div className="relative w-full">
      {/* Search icon */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
        {isSearching ? (
          <svg
            className="w-5 h-5 text-[var(--color-accent-primary)] animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg
            className="w-5 h-5 text-[var(--color-text-tertiary)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}
      </div>

      <input
        id="search-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="glass-input w-full py-3.5 pl-12 pr-24 text-base"
        autoComplete="off"
        spellCheck={false}
      />

      {/* Result count badge */}
      {resultCount !== null && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--color-text-secondary)] tabular-nums">
            {resultCount.toLocaleString()} results
          </span>
        </div>
      )}
    </div>
  );
}
