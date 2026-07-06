/**
 * App.tsx — Root application component.
 * Assembles the search interface with full filter panel and anime grid.
 */

import { useState, useCallback } from 'react';
import Layout from './components/Layout';
import SearchBar from './components/SearchBar';
import FilterPanel from './components/FilterPanel';
import AnimeCard from './components/AnimeCard';
import AnimeDetailView from './components/AnimeDetailView';
import { useDatabase } from './context/DatabaseContext';
import { useAnimeSearch } from './hooks/useAnimeSearch';
import { useCatalogMeta } from './hooks/useCatalogMeta';
import { useNavigation } from './hooks/useNavigation';
import { EMPTY_FILTER, type SearchFilterQuery } from './types/filters';

function App() {
  const { status, error: dbError, progress } = useDatabase();
  const { pathname, search } = useNavigation();
  const [filter, setFilter] = useState<SearchFilterQuery>(EMPTY_FILTER);
  const { results, isSearching, totalCount, error: searchError } = useAnimeSearch(filter);
  const catalogMeta = useCatalogMeta();

  const handleTextChange = useCallback(
    (text: string) => {
      setFilter((prev) => ({
        ...prev,
        textQuery: text,
        sortBy: text.length > 0 ? 'RELEVANCE' : prev.sortBy === 'RELEVANCE' ? 'SCORE' : prev.sortBy,
      }));
    },
    [],
  );

  // Loading / initial download state
  const isInitialLoading = (status === 'loading' || status === 'idle' || status === 'downloading' || status === 'checking' || status === 'processing') && !results.length && pathname !== '/anime';

  if (isInitialLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 animate-fade-in">
          {/* Animated logo */}
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] flex items-center justify-center shadow-2xl">
              <span className="text-white font-black text-3xl">A</span>
            </div>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] animate-ping opacity-20" />
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
              {status === 'downloading' ? 'Downloading Anime Catalog' : 'Initializing AniForge'}
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] max-w-md">
              {status === 'downloading'
                ? `Streaming and decompressing the catalog database... ${Math.round(progress * 100)}%`
                : status === 'processing'
                  ? 'Validating database integrity...'
                  : 'Connecting to the anime catalog engine...'}
            </p>
          </div>

          {/* Progress bar */}
          {(status === 'downloading' || status === 'processing') && (
            <div className="w-64 h-1.5 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] rounded-full progress-glow transition-all duration-500 ease-out"
                style={{ width: `${Math.max(progress * 100, 5)}%` }}
              />
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-accent-rose)]/15 flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--color-accent-rose)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Connection Error</h2>
          <p className="text-sm text-[var(--color-text-secondary)] max-w-md text-center">
            {dbError || 'Failed to initialize the anime catalog database.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="glass-button mt-2"
          >
            Retry
          </button>
        </div>
      </Layout>
    );
  }

  const isDetailPage = pathname === '/anime';
  const queryParams = new URLSearchParams(search);
  const animeId = isDetailPage ? parseInt(queryParams.get('id') || '', 10) : null;

  return (
    <Layout>
      {isDetailPage && animeId ? (
        <AnimeDetailView key={animeId} anilistId={animeId} />
      ) : (
        <div className="space-y-6">
          {/* Search + filters */}
          <div className="space-y-4">
            <SearchBar
              value={filter.textQuery}
              onChange={handleTextChange}
              resultCount={totalCount}
              isSearching={isSearching}
            />
            <FilterPanel
              filter={filter}
              onChange={setFilter}
              genres={catalogMeta.genres}
              tags={catalogMeta.tags}
              studios={catalogMeta.studios}
              isLoaded={catalogMeta.isLoaded}
            />
          </div>

          {/* Search error */}
          {searchError && (
            <div className="glass-card p-4 border-[var(--color-accent-rose)]/30">
              <p className="text-sm text-[var(--color-accent-rose)]">{searchError}</p>
            </div>
          )}

          {/* Results grid */}
          {results.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {results.map((anime, i) => (
                <AnimeCard key={anime.anilist_id} anime={anime} index={i} />
              ))}
            </div>
          ) : (
            status === 'ready' && !isSearching && (
              <div className="flex flex-col items-center justify-center py-20 gap-3 animate-fade-in">
                <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border-glass)] flex items-center justify-center">
                  <svg className="w-7 h-7 text-[var(--color-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {filter.textQuery ? 'No anime found matching your search' : 'Start searching to explore the catalog'}
                </p>
              </div>
            )
          )}
        </div>
      )}
    </Layout>
  );
}

export default App;
