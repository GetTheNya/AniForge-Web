import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '../hooks/useNavigation';
import { useUserTracking } from '../context/UserTrackingContext';
import { useCollectionAnime } from '../hooks/useUserCollections';
import { userDb } from '../services/userDb';
import AnimeCard from './AnimeCard';

interface CollectionDetailsViewProps {
  collectionId: string | null;
}

export default function CollectionDetailsView({ collectionId }: CollectionDetailsViewProps) {
  const { navigate } = useNavigation();
  const { t } = useTranslation();
  const { removeCollection, removeAnimeFromCollection, reorderAnimeInCollection } = useUserTracking();

  // 1. Reactive query to fetch collection details from Dexie
  const collection = useLiveQuery(
    async () => {
      if (!collectionId) return null;
      const col = await userDb.collections.get(collectionId);
      if (!col || col.is_deleted === 1) return null;
      return col;
    },
    [collectionId]
  );

  // 2. Fetch list of anime in this collection reactively (runs WASM SQLite batch join internally)
  const { items, isLoading } = useCollectionAnime(collectionId);

  // Handle reordering sequence
  const moveAnime = async (currentIndex: number, direction: 'left' | 'right') => {
    if (!collectionId || !items) return;
    
    const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    // Swap sequence in memory
    const reorderedList = [...items];
    const temp = reorderedList[currentIndex];
    reorderedList[currentIndex] = reorderedList[targetIndex];
    reorderedList[targetIndex] = temp;

    // Persist new layout order index to write-through db
    const orderedIds = reorderedList.map((item) => item.crossRef.animeId);
    await reorderAnimeInCollection(collectionId, orderedIds);
  };

  // Handle deletion of the collection itself
  const handleDeleteCollection = async () => {
    if (!collectionId) return;
    
    const confirmed = window.confirm(
      'Are you sure you want to delete this custom collection? All compilation lists inside will be erased.'
    );
    if (confirmed) {
      await removeCollection(collectionId);
      navigate('/library');
    }
  };

  if (!collectionId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-sm text-[var(--color-text-secondary)]">Invalid collection ID.</p>
        <button onClick={() => navigate('/library')} className="glass-button text-xs">
          Back to Library
        </button>
      </div>
    );
  }

  if (collection === undefined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-[var(--color-accent-primary)]/20 border-t-[var(--color-accent-primary)] animate-spin" />
        <p className="text-sm text-[var(--color-text-secondary)]">Loading collection details...</p>
      </div>
    );
  }

  if (collection === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <div className="text-3xl">📭</div>
        <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Collection Not Found</h3>
        <p className="text-xs text-[var(--color-text-secondary)]">
          This collection may have been deleted or does not exist.
        </p>
        <button onClick={() => navigate('/library')} className="glass-button text-xs mt-2">
          Back to Library
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header breadcrumb & back btn */}
      <div>
        <button
          onClick={() => navigate('/library')}
          className="text-xs font-semibold text-[var(--color-accent-secondary)] hover:text-white transition-colors cursor-pointer flex items-center gap-1"
        >
          ← Back to Library
        </button>
      </div>

      {/* Meta Information Shell */}
      <div className="glass-card p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="space-y-2 max-w-2xl">
          <h2 className="text-xl md:text-2xl font-black bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] bg-clip-text text-transparent">
            {collection.title}
          </h2>
          <p className="text-xs md:text-sm text-[var(--color-text-secondary)] leading-relaxed">
            {collection.description || 'No description provided.'}
          </p>
          <div className="text-[10px] text-[var(--color-text-tertiary)] pt-1">
            Created: {new Date(collection.createdAt).toLocaleDateString()} • Items: {items.length}
          </div>
        </div>

        <button
          onClick={handleDeleteCollection}
          className="glass-badge hover:bg-[var(--color-accent-rose)]/15 border-[var(--color-border-glass)] text-[var(--color-accent-rose)] hover:text-red-400 cursor-pointer text-xs font-bold py-2 px-4 rounded-xl shrink-0"
        >
          🗑️ Delete Collection
        </button>
      </div>

      {/* Anime Items Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-xl skeleton" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {items.map((item, i) => (
            <div key={item.crossRef.animeId} className="relative group/item overflow-hidden rounded-xl transition-all duration-300 ease-out hover:-translate-y-1 transform-gpu">
              {/* Overlay controls for reordering and deletion on hover */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/75 to-transparent p-2.5 opacity-0 group-hover/item:opacity-100 transition-opacity z-20 flex flex-col gap-1.5">
                <div className="flex justify-between gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveAnime(i, 'left');
                    }}
                    disabled={i === 0}
                    className="flex-1 bg-[var(--color-bg-overlay)] border border-[var(--color-border-glass)] text-white hover:text-[var(--color-accent-secondary)] disabled:opacity-30 disabled:hover:text-white rounded-lg py-1 cursor-pointer text-[10px] font-bold transition-all text-center"
                    title="Move Left"
                  >
                    ← Left
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveAnime(i, 'right');
                    }}
                    disabled={i === items.length - 1}
                    className="flex-1 bg-[var(--color-bg-overlay)] border border-[var(--color-border-glass)] text-white hover:text-[var(--color-accent-secondary)] disabled:opacity-30 disabled:hover:text-white rounded-lg py-1 cursor-pointer text-[10px] font-bold transition-all text-center"
                    title="Move Right"
                  >
                    Right →
                  </button>
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAnimeFromCollection(collectionId, item.crossRef.animeId);
                  }}
                  className="w-full bg-[var(--color-accent-rose)]/15 border border-[var(--color-accent-rose)]/25 text-[var(--color-accent-rose)] hover:text-white hover:bg-[var(--color-accent-rose)] rounded-lg py-1 cursor-pointer text-[10px] font-black transition-all"
                  title="Remove from collection"
                >
                  Remove Item
                </button>
              </div>

              {/* Underlying standard AnimeCard or placeholder card */}
              {item.anime ? (
                <AnimeCard anime={item.anime} index={i} disableHoverTranslation={true} />
              ) : (
                <div className="glass-card p-4 flex flex-col items-center justify-center text-center aspect-[3/4]">
                  <span className="text-2xl">❔</span>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-2">{t('library.notInCatalog')}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-1">ID: {item.crossRef.animeId}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 border border-dashed border-[var(--color-border-glass)] rounded-2xl gap-3">
          <span className="text-3xl opacity-30">🎬</span>
          <p className="text-sm text-[var(--color-text-secondary)]">This collection is currently empty.</p>
          <button
            onClick={() => navigate('/')}
            className="text-xs text-[var(--color-accent-secondary)] hover:underline cursor-pointer font-bold"
          >
            Browse the Catalog to add anime!
          </button>
        </div>
      )}
    </div>
  );
}
