import { useState, useMemo } from 'react';
import { useNavigation } from '../hooks/useNavigation';
import { useAuth } from '../context/AuthContext';
import { useUserTracking } from '../context/UserTrackingContext';
import { useSupabaseLists } from '../hooks/useSupabaseLists';
import { useUserCollections } from '../hooks/useUserCollections';
import { useLiveQuery } from 'dexie-react-hooks';
import { userDb } from '../services/userDb';
import { useDatabase } from '../context/DatabaseContext';
import AnimeCard from './AnimeCard';

export default function LibraryView() {
  const { user, signInWithGoogle } = useAuth();
  const { navigate } = useNavigation();
  const { saveCollection } = useUserTracking();

  // Tab state: 'lists' (My Lists) or 'collections' (Custom Collections)
  const [activeTab, setActiveTab] = useState<'lists' | 'collections'>('lists');
  
  // Lists sub-tab state (watch status)
  const [activeStatus, setActiveStatus] = useState<string>('CURRENT');

  // Load tracking list (contains tracking + anime object)
  const { trackingList, isLoading: isListsLoading } = useSupabaseLists();
  
  // Load custom collections
  const { collections, isLoading: isCollectionsLoading } = useUserCollections();

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Group tracking by watch status
  const filteredTracking = useMemo(() => {
    return trackingList.filter((item) => item.tracking.watch_status === activeStatus);
  }, [trackingList, activeStatus]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTitle.trim()) return;

    setIsSubmitting(true);
    try {
      const collectionId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
      await saveCollection(collectionId, newTitle.trim(), newDescription.trim());
      setNewTitle('');
      setNewDescription('');
      setShowModal(false);
      // Navigate to the newly created collection details view
      navigate('/collection', `?id=${collectionId}`);
    } catch (err) {
      console.error('[LibraryView] Failed to create collection:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border-glass)] flex items-center justify-center text-3xl">
          🔒
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Sync & Personalize Your Library</h2>
          <p className="text-sm text-[var(--color-text-secondary)] max-w-sm">
            Sign in with Google to create custom anime collections, track your watching progress, and sync everything offline.
          </p>
        </div>
        <button
          onClick={signInWithGoogle}
          className="flex items-center gap-2 glass-button text-sm cursor-pointer"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border-glass)] pb-5">
        <div>
          <h2 className="text-2xl font-black text-[var(--color-text-primary)]">My Library</h2>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
            Manage your anime lists and custom offline-first compilations.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-[var(--color-bg-input)] p-1 rounded-xl border border-[var(--color-border-glass)] self-start sm:self-center">
          <button
            onClick={() => setActiveTab('lists')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'lists'
                ? 'bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] text-white shadow-md'
                : 'text-[var(--color-text-secondary)] hover:text-white'
            }`}
          >
            My Lists
          </button>
          <button
            onClick={() => setActiveTab('collections')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'collections'
                ? 'bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] text-white shadow-md'
                : 'text-[var(--color-text-secondary)] hover:text-white'
            }`}
          >
            Custom Collections
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {activeTab === 'lists' ? (
        <div className="space-y-6">
          {/* Lists Subtabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {[
              { status: 'CURRENT', label: 'Watching', color: 'bg-[var(--color-status-releasing)]' },
              { status: 'COMPLETED', label: 'Completed', color: 'bg-[var(--color-status-finished)]' },
              { status: 'PLANNING', label: 'Planning', color: 'bg-[var(--color-status-upcoming)]' },
              { status: 'PAUSED', label: 'Paused', color: 'bg-[var(--color-status-hiatus)]' },
              { status: 'DROPPED', label: 'Dropped', color: 'bg-[var(--color-status-cancelled)]' },
            ].map((tab) => {
              const count = trackingList.filter((item) => item.tracking.watch_status === tab.status).length;
              return (
                <button
                  key={tab.status}
                  onClick={() => setActiveStatus(tab.status)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all shrink-0 ${
                    activeStatus === tab.status
                      ? 'border-[var(--color-border-glass-hover)] bg-[var(--color-bg-card-hover)] text-white shadow-sm'
                      : 'border-[var(--color-border-glass)] bg-transparent text-[var(--color-text-secondary)] hover:text-white'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${tab.color}`} />
                  <span>{tab.label}</span>
                  <span className="text-[10px] bg-[var(--color-bg-input)] px-1.5 py-0.5 rounded-full text-[var(--color-text-tertiary)] border border-[var(--color-border-glass)]">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* List Content */}
          {isListsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-2xl skeleton" />
              ))}
            </div>
          ) : filteredTracking.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredTracking.map((item, i) => (
                item.anime ? (
                  <AnimeCard key={item.tracking.anilist_id} anime={item.anime} index={i} />
                ) : (
                  <div key={item.tracking.anilist_id} className="glass-card p-4 flex flex-col items-center justify-center text-center aspect-[3/4]">
                    <span className="text-2xl">❔</span>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-2">Anime Not in Catalog</p>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">ID: {item.tracking.anilist_id}</p>
                  </div>
                )
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-[var(--color-border-glass)] rounded-2xl gap-3">
              <span className="text-3xl opacity-30">📚</span>
              <p className="text-sm text-[var(--color-text-secondary)]">No anime tracked in this status list yet.</p>
              <button
                onClick={() => navigate('/')}
                className="text-xs text-[var(--color-accent-primary)] hover:underline cursor-pointer font-bold"
              >
                Go to Catalog to add some!
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Create Button Container */}
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-[var(--color-text-secondary)]">My Custom Collections</h3>
            <button
              onClick={() => setShowModal(true)}
              className="glass-badge hover:bg-[var(--color-bg-card-hover)] border-[var(--color-border-glass)] text-[var(--color-accent-secondary)] hover:text-white cursor-pointer py-1.5 px-3 rounded-xl font-bold text-xs"
            >
              + Create Collection
            </button>
          </div>

          {/* Collections Grid */}
          {isCollectionsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-40 rounded-2xl skeleton" />
              ))}
            </div>
          ) : collections.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {collections.map((col) => (
                <CollectionCard key={col.id} collection={col} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-[var(--color-border-glass)] rounded-2xl gap-3">
              <span className="text-3xl opacity-30">📂</span>
              <p className="text-sm text-[var(--color-text-secondary)]">You haven't created any custom collections yet.</p>
              <button
                onClick={() => setShowModal(true)}
                className="text-xs text-[var(--color-accent-secondary)] hover:underline cursor-pointer font-bold"
              >
                Create your first collection
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sleek Create Collection Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-6 space-y-4 animate-scale-in">
            <div className="flex justify-between items-center border-b border-[var(--color-border-glass)] pb-2">
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">New Collection</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-[var(--color-text-secondary)] hover:text-white text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--color-text-secondary)]">Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="E.g., Masterpieces, Plan to Watch Next"
                  className="w-full px-3 py-2 rounded-xl text-sm bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-primary)] focus:ring-1 focus:ring-[var(--color-accent-primary)]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--color-text-secondary)]">Description (Optional)</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="E.g., Anime series that left a deep impact on me."
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-primary)] resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 rounded-xl bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newTitle.trim()}
                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] text-xs text-white font-bold hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-lg"
                >
                  {isSubmitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Collection Card Subcomponent ──────────────────────────────────────────────

interface CollectionCardProps {
  collection: {
    id: string;
    title: string;
    description: string;
  };
}

function CollectionCard({ collection }: CollectionCardProps) {
  const { navigate } = useNavigation();
  const { db, status, queryObjects } = useDatabase();

  // Get active cross refs for this collection
  const crossRefs = useLiveQuery(
    async () => {
      const refs = await userDb.collection_anime_cross_ref
        .where('collectionId')
        .equals(collection.id)
        .toArray();
      return refs.filter((r) => r.is_deleted !== 1).sort((a, b) => a.orderIndex - b.orderIndex);
    },
    [collection.id]
  );

  // Fetch cover art of first 3 items in collection for a beautiful preview stack
  const coverUrls = useLiveQuery(
    async () => {
      if (!db || status !== 'ready' || !crossRefs || crossRefs.length === 0) return [];
      
      try {
        const top3Ids = crossRefs.slice(0, 3).map((r) => r.animeId);
        const placeholders = top3Ids.map(() => '?').join(',');
        const sql = `SELECT cover_large, cover_extra_large FROM anime WHERE anilist_id IN (${placeholders})`;
        const rows = queryObjects<{ cover_large: string; cover_extra_large: string }>(sql, top3Ids);
        
        return rows.map((r) => r.cover_large || r.cover_extra_large).filter(Boolean);
      } catch (err) {
        console.error('[CollectionCard] Error fetching cover previews:', err);
        return [];
      }
    },
    [db, status, crossRefs]
  ) || [];

  const count = crossRefs ? crossRefs.length : 0;

  return (
    <div
      onClick={() => navigate('/collection', `?id=${collection.id}`)}
      className="glass-card p-5 flex flex-col justify-between h-44 cursor-pointer hover:border-[var(--color-accent-secondary)]/35 group relative overflow-hidden"
    >
      {/* Decorative colored glow on card hover */}
      <div className="absolute -top-10 -right-10 w-24 h-24 bg-gradient-to-br from-[var(--color-accent-primary)]/10 to-[var(--color-accent-secondary)]/10 rounded-full blur-2xl group-hover:scale-150 transition-all duration-500" />

      <div className="space-y-2">
        <div className="flex justify-between items-start gap-2">
          <h3 className="font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent-secondary)] transition-colors text-base line-clamp-1">
            {collection.title}
          </h3>
          <span className="text-[10px] bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] border border-[var(--color-accent-primary)]/20 font-bold px-2 py-0.5 rounded-full shrink-0">
            {count} {count === 1 ? 'anime' : 'animes'}
          </span>
        </div>
        <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 leading-relaxed">
          {collection.description || 'No description provided.'}
        </p>
      </div>

      {/* Previews and link indicator */}
      <div className="flex justify-between items-end mt-4">
        {/* Cover Preview Stack */}
        <div className="flex -space-x-3.5 overflow-hidden">
          {coverUrls.length > 0 ? (
            coverUrls.map((url, i) => (
              <div
                key={i}
                className="w-8 h-11 rounded-md border border-[var(--color-border-glass)] overflow-hidden shadow-md shrink-0 bg-[var(--color-bg-base)]"
                style={{ transform: `rotate(${(i - 1) * 6}deg)`, zIndex: i }}
              >
                <img src={url} alt="Cover preview" className="w-full h-full object-cover" />
              </div>
            ))
          ) : (
            <div className="w-8 h-11 rounded-md border border-dashed border-[var(--color-border-glass)] flex items-center justify-center text-xs opacity-35 bg-[var(--color-bg-input)]">
              Empty
            </div>
          )}
        </div>

        <span className="text-[10px] text-[var(--color-accent-secondary)] font-bold tracking-wider uppercase opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
          View details →
        </span>
      </div>
    </div>
  );
}
