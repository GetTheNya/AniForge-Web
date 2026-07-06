import { useState, useEffect, useRef } from 'react';
import { useNavigation } from '../hooks/useNavigation';
import { useAnimeDetail } from '../hooks/useAnimeDetail';
import { useAuth } from '../context/AuthContext';
import { useDatabase } from '../context/DatabaseContext';
import { supabase } from '../services/supabase';
import { rowToAnime, type Anime } from '../types/anime';
import StatusBadge from './StatusBadge';

interface AnimeDetailViewProps {
  anilistId: number;
}

interface Collection {
  collection_id: string;
  name: string;
  description: string | null;
}

export default function AnimeDetailView({ anilistId }: AnimeDetailViewProps) {
  const { navigate } = useNavigation();
  const { user, signInWithGoogle } = useAuth();
  const {
    anime,
    screenshots,
    relations,
    franchise,
    franchiseReleaseCount,
    genres,
    tags,
    staff,
    studios,
    recommendations,
    tracking,
    isLoading,
    error,
    updateTracking,
  } = useAnimeDetail(anilistId);

  // Local state for UI
  const [activeTab, setActiveTab] = useState<'info' | 'relations' | 'staff' | 'franchise'>('info');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  
  // Tracking form states
  const [localNotes, setLocalNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const notesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Collections state
  const [collections, setCollections] = useState<Collection[]>([]);
  const [animeCollectionIds, setAnimeCollectionIds] = useState<string[]>([]);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDesc, setNewCollectionDesc] = useState('');
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);

  // Airing countdown state
  const [countdownText, setCountdownText] = useState('');

  // Sync local notes state with database tracking
  useEffect(() => {
    if (tracking) {
      setLocalNotes(tracking.notes || '');
    } else {
      setLocalNotes('');
    }
  }, [tracking]);

  // Load collections
  useEffect(() => {
    if (!user || !showCollectionModal) return;
    const userId = user.id;

    async function loadCollectionsData() {
      try {
        // 1. Fetch user collections
        const { data: cols, error: colsErr } = await supabase
          .from('user_collections')
          .select('collection_id, name, description')
          .eq('user_id', userId);
        
        if (colsErr) throw colsErr;
        setCollections(cols || []);

        // 2. Fetch collections containing this anime
        const { data: refs, error: refsErr } = await supabase
          .from('user_collection_anime')
          .select('collection_id')
          .eq('anime_id', anilistId);

        if (refsErr) throw refsErr;
        setAnimeCollectionIds((refs || []).map((r) => r.collection_id));
      } catch (e) {
        console.error('[AnimeDetailView] Error loading collections:', e);
      }
    }

    loadCollectionsData();
  }, [user, anilistId, showCollectionModal]);

  // Airing countdown logic
  useEffect(() => {
    if (!anime || anime.status !== 'RELEASING' || !anime.airing_at) {
      setCountdownText('');
      return;
    }

    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const diff = anime.airing_at! - now;

      if (diff <= 0) {
        setCountdownText('Airing soon!');
        clearInterval(interval);
        return;
      }

      const days = Math.floor(diff / (24 * 3600));
      const hours = Math.floor((diff % (24 * 3600)) / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      let text = `Ep. ${anime.airing_episode || '?'} airs in `;
      if (days > 0) text += `${days}d `;
      if (hours > 0 || days > 0) text += `${hours}h `;
      text += `${minutes}m ${seconds}s`;

      setCountdownText(text);
    }, 1000);

    return () => clearInterval(interval);
  }, [anime]);

  // Debounced notes saving
  const handleNotesChange = (val: string) => {
    setLocalNotes(val);
    setIsSavingNotes(true);

    if (notesTimeoutRef.current) clearTimeout(notesTimeoutRef.current);
    notesTimeoutRef.current = setTimeout(async () => {
      try {
        await updateTracking({ notes: val });
      } catch (e) {
        console.error('[AnimeDetailView] Failed to auto-save notes:', e);
      } finally {
        setIsSavingNotes(false);
      }
    }, 1000);
  };

  // Toggle collection cross reference
  const handleToggleCollection = async (collectionId: string) => {
    if (!user) return;
    const isAdded = animeCollectionIds.includes(collectionId);

    try {
      if (isAdded) {
        // Remove
        const { error } = await supabase
          .from('user_collection_anime')
          .delete()
          .eq('collection_id', collectionId)
          .eq('anime_id', anilistId);

        if (error) throw error;
        setAnimeCollectionIds((prev) => prev.filter((id) => id !== collectionId));
      } else {
        // Add (find max index first)
        const { data: refs } = await supabase
          .from('user_collection_anime')
          .select('order_index')
          .eq('collection_id', collectionId)
          .order('order_index', { ascending: false })
          .limit(1);

        const nextIndex = refs && refs.length > 0 ? (refs[0].order_index ?? 0) + 1 : 0;

        const { error } = await supabase
          .from('user_collection_anime')
          .insert({
            collection_id: collectionId,
            anime_id: anilistId,
            order_index: nextIndex,
          });

        if (error) throw error;
        setAnimeCollectionIds((prev) => [...prev, collectionId]);
      }
    } catch (e) {
      console.error('[AnimeDetailView] Toggle collection error:', e);
    }
  };

  // Create new collection
  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newCollectionName.trim()) return;

    setIsCreatingCollection(true);
    try {
      const { data: newCol, error: insertColErr } = await supabase
        .from('user_collections')
        .insert({
          user_id: user.id,
          name: newCollectionName.trim(),
          description: newCollectionDesc.trim() || null,
          is_public: false,
        })
        .select()
        .single();

      if (insertColErr) throw insertColErr;

      // Add anime to newly created collection
      const { error: insertRefErr } = await supabase
        .from('user_collection_anime')
        .insert({
          collection_id: newCol.collection_id,
          anime_id: anilistId,
          order_index: 0,
        });

      if (insertRefErr) throw insertRefErr;

      // Refresh list
      setCollections((prev) => [...prev, newCol]);
      setAnimeCollectionIds((prev) => [...prev, newCol.collection_id]);
      setNewCollectionName('');
      setNewCollectionDesc('');
      setShowCreateCollection(false);
    } catch (e) {
      console.error('[AnimeDetailView] Create collection error:', e);
    } finally {
      setIsCreatingCollection(false);
    }
  };

  if (isLoading && !anime) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-[var(--color-accent-primary)]/20 border-t-[var(--color-accent-primary)] animate-spin" />
        <p className="text-sm text-[var(--color-text-secondary)]">Loading anime details...</p>
      </div>
    );
  }

  if (error || !anime) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[var(--color-accent-rose)]/15 flex items-center justify-center text-[var(--color-accent-rose)] text-3xl">⚠️</div>
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Details Unavailable</h2>
        <p className="text-sm text-[var(--color-text-secondary)] max-w-md">{error || 'Could not retrieve catalog data for this anime.'}</p>
        <button onClick={() => navigate('/')} className="glass-button mt-2">Back to Catalog</button>
      </div>
    );
  }

  const coverUrl = anime.cover_extra_large || anime.cover_large;
  const bannerUrl = anime.banner_image || coverUrl;
  const title = anime.title_en || anime.title_romaji;
  const subtitle = anime.title_en ? anime.title_romaji : anime.title_uk;

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* ─── Premium Glassmorphic Header / Banner ───────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-[var(--color-border-glass)] bg-[var(--color-bg-elevated)] min-h-[300px] md:min-h-[360px] flex flex-col justify-end">
        {/* Banner image with extreme blur / overlay */}
        <div className="absolute inset-0 z-0">
          {bannerUrl && (
            <img
              src={bannerUrl}
              alt=""
              className="w-full h-full object-cover blur-[16px] scale-[1.05] opacity-35"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg-base)] via-[var(--color-bg-base)]/40 to-transparent" />
        </div>

        {/* Header Action Overlay */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[var(--color-border-glass)] bg-[var(--color-bg-overlay)] text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)] transition-all cursor-pointer shadow-lg"
          >
            ← Back
          </button>
          
          {user && (
            <button
              onClick={() => setShowCollectionModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[var(--color-accent-primary)]/30 bg-[var(--color-accent-primary)]/10 text-xs font-semibold text-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary)]/20 transition-all cursor-pointer shadow-lg"
            >
              📥 Collection
            </button>
          )}
        </div>

        {/* Content layout on top of banner */}
        <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row items-end gap-6">
          {/* Main Poster card */}
          {coverUrl && (
            <div className="w-28 md:w-36 aspect-[3/4] rounded-xl overflow-hidden border border-[var(--color-border-glass-hover)] shadow-2xl flex-shrink-0 bg-[var(--color-bg-base)] group cursor-pointer relative"
                 onClick={() => setLightboxIndex(0)}>
              <img
                src={coverUrl}
                alt={title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-xs font-medium">View Poster</span>
              </div>
            </div>
          )}

          {/* Core Info */}
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              {anime.score_mal && (
                <div className="flex items-center gap-1 glass-badge bg-[var(--color-bg-overlay)] border-[var(--color-border-glass)]">
                  <span className="text-[var(--color-accent-warm)] text-xs">★</span>
                  <span className="text-[var(--color-text-primary)] font-bold">{anime.score_mal.toFixed(1)}</span>
                </div>
              )}
              {anime.format && <StatusBadge type="format" value={anime.format} />}
              {anime.season_year && (
                <span className="text-xs text-[var(--color-text-secondary)] font-medium">
                  {anime.season?.toLowerCase()} {anime.season_year}
                </span>
              )}
              {anime.is_adult && (
                <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                  18+
                </span>
              )}
            </div>

            <h1 className="text-xl md:text-3xl font-black text-[var(--color-text-primary)] leading-tight">
              {title}
            </h1>
            
            {subtitle && (
              <p className="text-sm md:text-base text-[var(--color-text-tertiary)] font-medium italic">
                {subtitle}
              </p>
            )}

            {countdownText && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-status-releasing)]/10 border border-[var(--color-status-releasing)]/20 text-xs font-bold text-[var(--color-status-releasing)] animate-pulse">
                <span>⏰</span>
                <span>{countdownText}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Body Details Grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT / CENTER: Main Metadata tabs, Synopsis, Gallery, Franchise, recommendations */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Synopsis */}
          <div className="glass-card p-6 space-y-3">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Synopsis</h2>
            <div className="text-sm text-[var(--color-text-secondary)] leading-relaxed space-y-3">
              {anime.description_en || anime.description_uk ? (
                (anime.description_en || anime.description_uk)!
                  .replace(/<br>/gi, '\n')
                  .replace(/<[^>]*>/g, '')
                  .split('\n')
                  .filter((p) => p.trim())
                  .map((p, i) => <p key={i}>{p}</p>)
              ) : (
                <p className="italic text-[var(--color-text-muted)]">No description available in catalog.</p>
              )}
            </div>
          </div>

          {/* Quick Tab navigation for extra tabs (Relations, Staff, Franchise) */}
          <div className="glass-card overflow-hidden">
            <div className="flex border-b border-[var(--color-border-glass)] bg-[var(--color-bg-base)]/40">
              {(['info', 'relations', 'staff', 'franchise'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === tab
                      ? 'text-[var(--color-accent-primary)] border-b-2 border-[var(--color-accent-primary)] bg-[var(--color-bg-elevated)]/30'
                      : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* Tab 1: Info (Trailer + Screenshots) */}
              {activeTab === 'info' && (
                <div className="space-y-6">
                  {/* Screenshots gallery */}
                  {screenshots.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Screenshots</h3>
                      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                        {screenshots.map((url, idx) => (
                          <div
                            key={idx}
                            onClick={() => setLightboxIndex(idx)}
                            className="w-40 md:w-52 aspect-video rounded-lg overflow-hidden border border-[var(--color-border-glass)] flex-shrink-0 cursor-pointer hover:border-[var(--color-border-glass-hover)] transition-all bg-[var(--color-bg-base)]"
                          >
                            <img src={url} alt={`Screenshot ${idx + 1}`} className="w-full h-full object-cover hover:scale-105 transition-all duration-300" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Embedded Trailer */}
                  {anime.trailer_id && anime.trailer_site === 'youtube' && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Watch Trailer</h3>
                      <div className="relative aspect-video rounded-xl overflow-hidden border border-[var(--color-border-glass)] bg-[var(--color-bg-base)]">
                        <iframe
                          src={`https://www.youtube.com/embed/${anime.trailer_id}`}
                          title={`${title} Trailer`}
                          className="absolute inset-0 w-full h-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    </div>
                  )}
                  
                  {!anime.trailer_id && screenshots.length === 0 && (
                    <p className="italic text-xs text-[var(--color-text-muted)] text-center py-4">
                      No media items available for this anime.
                    </p>
                  )}
                </div>
              )}

              {/* Tab 2: Relations */}
              {activeTab === 'relations' && (
                <div className="space-y-4">
                  {relations.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {relations.map((rel) => {
                        const relCover = rel.cover_large || rel.cover_extra_large;
                        return (
                          <div
                            key={rel.anilist_id}
                            onClick={() => navigate(`/anime`, `?id=${rel.anilist_id}`)}
                            className="flex gap-3 p-3 rounded-xl border border-[var(--color-border-glass)] bg-[var(--color-bg-elevated)]/20 hover:bg-[var(--color-bg-card-hover)] cursor-pointer transition-all hover:border-[var(--color-border-glass-hover)]"
                          >
                            {relCover && (
                              <img src={relCover} alt="" className="w-12 h-16 object-cover rounded-md flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                              <h4 className="text-xs font-bold text-[var(--color-text-primary)] truncate">
                                {rel.title_en || rel.title_romaji}
                              </h4>
                              <p className="text-[10px] text-[var(--color-text-secondary)]">
                                {rel.format} • {rel.season_year || 'Year ?'}
                              </p>
                              {rel.status && (
                                <div className="mt-1">
                                  <StatusBadge type="status" value={rel.status} />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="italic text-xs text-[var(--color-text-muted)] text-center py-4">
                      No relation cross-references found in catalog.
                    </p>
                  )}
                </div>
              )}

              {/* Tab 3: Staff */}
              {activeTab === 'staff' && (
                <div className="space-y-4">
                  {staff.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {staff.map((st) => (
                        <div
                          key={`${st.staff_id}-${st.role}`}
                          className="flex items-center gap-3 p-2 rounded-lg border border-[var(--color-border-glass)] bg-[var(--color-bg-elevated)]/10"
                        >
                          {st.image_large ? (
                            <img src={st.image_large} alt={st.full_name} className="w-10 h-10 object-cover rounded-full flex-shrink-0 border border-[var(--color-border-glass)]" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-[var(--color-bg-card)] flex items-center justify-center text-xs flex-shrink-0">
                              👤
                            </div>
                          )}
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-[var(--color-text-primary)] truncate">{st.full_name}</h4>
                            <p className="text-[10px] text-[var(--color-text-tertiary)] truncate">{st.role}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="italic text-xs text-[var(--color-text-muted)] text-center py-4">
                      No staff database records registered.
                    </p>
                  )}
                </div>
              )}

              {/* Tab 4: Franchise Timeline */}
              {activeTab === 'franchise' && (
                <div className="space-y-6">
                  {franchise ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl border border-[var(--color-accent-primary)]/20 bg-[var(--color-accent-primary)]/5">
                        <h4 className="text-sm font-bold text-[var(--color-accent-primary)]">
                          {franchise.name_en || franchise.name_uk || 'Franchise'}
                        </h4>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                          Part of a franchise timeline containing {franchiseReleaseCount} entries.
                        </p>
                      </div>

                      {/* Timeline Canvas representation */}
                      <div className="relative pl-6 border-l-2 border-[var(--color-accent-primary)]/30 space-y-6 ml-3 py-2">
                        {/* We fetch the list of anime in this franchise and order them */}
                        <FranchiseTimelineLoader
                          franchiseId={franchise.franchise_id}
                          currentAnilistId={anilistId}
                          navigate={navigate}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="italic text-xs text-[var(--color-text-muted)] text-center py-4">
                      This anime is not registered as part of any media franchise.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Recommended For You</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {recommendations.slice(0, 8).map((rec) => {
                  const recCover = rec.cover_large || rec.cover_extra_large;
                  return (
                    <div
                      key={rec.anilist_id}
                      onClick={() => navigate(`/anime`, `?id=${rec.anilist_id}`)}
                      className="glass-card group overflow-hidden cursor-pointer"
                    >
                      <div className="aspect-[3/4] relative overflow-hidden bg-[var(--color-bg-elevated)]">
                        {recCover ? (
                          <img
                            src={recCover}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">🎬</div>
                        )}
                        {rec.score_mal && (
                          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-[var(--color-bg-overlay)] text-[var(--color-accent-warm)] border border-[var(--color-border-glass)]">
                            ★ {rec.score_mal.toFixed(1)}
                          </div>
                        )}
                      </div>
                      <div className="p-2 space-y-1">
                        <h4 className="text-xs font-bold text-[var(--color-text-primary)] line-clamp-1">
                          {rec.title_en || rec.title_romaji}
                        </h4>
                        <p className="text-[10px] text-[var(--color-text-tertiary)] uppercase font-semibold">
                          {rec.format} • {rec.season_year || '?'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Tracking Widget & Meta Badges info */}
        <div className="space-y-6">
          
          {/* Tracking Widget */}
          <div className="glass-card p-6 space-y-5">
            <h3 className="text-base font-bold text-[var(--color-text-primary)] border-b border-[var(--color-border-glass)] pb-2">
              My Tracking
            </h3>

            {!user ? (
              <div className="text-center py-4 space-y-3">
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Sign in with Google to synchronize your watchlists, track episode progress, rate titles, and write personal diaries.
                </p>
                <button
                  onClick={signInWithGoogle}
                  className="w-full glass-button flex items-center justify-center gap-2 text-xs py-2"
                >
                  Sign in with Google
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                
                {/* Watch Status */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)]">Watch Status</label>
                  <select
                    value={tracking?.watch_status || ''}
                    onChange={(e) => updateTracking({ watch_status: e.target.value || 'PLANNING' })}
                    className="w-full px-3 py-2 rounded-xl text-sm bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-primary)]"
                  >
                    <option value="">Not Tracking</option>
                    <option value="WATCHING">Watching</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="PLANNING">Planning to Watch</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="DROPPED">Dropped</option>
                  </select>
                </div>

                {/* Episode Progress */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-semibold text-[var(--color-text-secondary)]">
                    <span>Episode Progress</span>
                    <span className="text-[var(--color-text-tertiary)]">
                      max: {anime.episodes || '?'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={!tracking || (tracking.episode_progress || 0) <= 0}
                      onClick={() => updateTracking({ episode_progress: Math.max(0, (tracking?.episode_progress || 0) - 1) })}
                      className="w-10 h-10 rounded-xl bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] text-lg flex items-center justify-center hover:bg-[var(--color-bg-card-hover)] cursor-pointer text-white disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      -
                    </button>
                    <div className="flex-1 h-10 rounded-xl bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] flex items-center justify-center font-bold text-sm text-[var(--color-text-primary)]">
                      {tracking?.episode_progress || 0} / {anime.episodes || '?'}
                    </div>
                    <button
                      disabled={!tracking || (anime.episodes !== null && (tracking.episode_progress || 0) >= anime.episodes)}
                      onClick={() => updateTracking({ episode_progress: (tracking?.episode_progress || 0) + 1 })}
                      className="w-10 h-10 rounded-xl bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] text-lg flex items-center justify-center hover:bg-[var(--color-bg-card-hover)] cursor-pointer text-white disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Score Rating out of 10 */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-semibold text-[var(--color-text-secondary)]">
                    <span>My Score</span>
                    <span className="font-bold text-[var(--color-accent-primary)]">
                      {tracking?.score ? `${tracking.score}/10` : 'Unrated'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    disabled={!tracking}
                    value={tracking?.score || 0}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      updateTracking({ score: val === 0 ? null : val });
                    }}
                    className="w-full accent-[var(--color-accent-primary)] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Personal Notes */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-semibold text-[var(--color-text-secondary)]">
                    <span>Private Notes</span>
                    {isSavingNotes && (
                      <span className="text-[10px] text-[var(--color-accent-secondary)] animate-pulse">Auto-saving...</span>
                    )}
                  </div>
                  <textarea
                    disabled={!tracking}
                    value={localNotes}
                    onChange={(e) => handleNotesChange(e.target.value)}
                    placeholder="Write a private comment, review or watch history diary..."
                    rows={4}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-primary)] resize-none disabled:opacity-30 disabled:cursor-not-allowed"
                  />
                </div>

              </div>
            )}
          </div>

          {/* Details / Metadata Info Badges */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-base font-bold text-[var(--color-text-primary)] border-b border-[var(--color-border-glass)] pb-2">
              Anime Details
            </h3>

            <div className="space-y-3 text-xs">
              {studios.length > 0 && (
                <div>
                  <h4 className="text-[var(--color-text-tertiary)] font-bold uppercase tracking-wider">Studios</h4>
                  <div className="flex gap-2 flex-wrap mt-1">
                    {studios.map((st) => (
                      <span key={st.studio_id} className="px-2.5 py-1 rounded-full bg-[var(--color-accent-secondary)]/10 text-[var(--color-accent-secondary)] font-bold">
                        {st.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-[var(--color-text-tertiary)] font-bold uppercase tracking-wider">Total Episodes</h4>
                <p className="text-[var(--color-text-primary)] font-medium mt-0.5">{anime.episodes || 'Unknown'}</p>
              </div>

              {anime.duration && (
                <div>
                  <h4 className="text-[var(--color-text-tertiary)] font-bold uppercase tracking-wider">Duration</h4>
                  <p className="text-[var(--color-text-primary)] font-medium mt-0.5">{anime.duration} minutes per episode</p>
                </div>
              )}

              {anime.source && (
                <div>
                  <h4 className="text-[var(--color-text-tertiary)] font-bold uppercase tracking-wider">Original Source</h4>
                  <p className="text-[var(--color-text-primary)] font-medium mt-0.5">{anime.source.replace(/_/g, ' ')}</p>
                </div>
              )}

              {anime.status && (
                <div>
                  <h4 className="text-[var(--color-text-tertiary)] font-bold uppercase tracking-wider">Airing Status</h4>
                  <div className="mt-1">
                    <StatusBadge type="status" value={anime.status} />
                  </div>
                </div>
              )}

              {genres.length > 0 && (
                <div>
                  <h4 className="text-[var(--color-text-tertiary)] font-bold uppercase tracking-wider">Genres</h4>
                  <div className="flex gap-1.5 flex-wrap mt-1.5">
                    {genres.map((g) => (
                      <span key={g.slug} className="px-2 py-0.5 rounded-md bg-[var(--color-bg-base)] text-[var(--color-text-secondary)] border border-[var(--color-border-glass)]">
                        {g.name_en}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {tags.length > 0 && (
                <div>
                  <h4 className="text-[var(--color-text-tertiary)] font-bold uppercase tracking-wider">Tags</h4>
                  <div className="flex gap-1.5 flex-wrap mt-1.5">
                    {tags.slice(0, 15).map((t) => (
                      <span key={t.tag_id} className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--color-bg-base)] text-[var(--color-text-tertiary)] border border-[var(--color-border-glass)]" title={t.category || ''}>
                        {t.name_en}
                      </span>
                    ))}
                    {tags.length > 15 && (
                      <span className="text-[10px] text-[var(--color-text-muted)] self-center">
                        +{tags.length - 15} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* ─── Lightbox Modal for screenshots ─────────────────────────────────── */}
      {lightboxIndex !== null && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 text-white text-3xl font-light hover:opacity-85 cursor-pointer z-50"
          >
            ×
          </button>
          
          <button
            disabled={lightboxIndex === 0}
            onClick={() => setLightboxIndex((p) => p! - 1)}
            className="absolute left-4 text-white text-3xl font-light hover:opacity-85 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
          >
            ‹
          </button>

          <div className="max-w-5xl max-h-[80vh] flex items-center justify-center">
            <img
              src={lightboxIndex === 0 && coverUrl ? coverUrl : screenshots[lightboxIndex - (coverUrl ? 1 : 0)]}
              alt=""
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-white/10"
            />
          </div>

          <button
            disabled={lightboxIndex === (screenshots.length - 1 + (coverUrl ? 1 : 0))}
            onClick={() => setLightboxIndex((p) => p! + 1)}
            className="absolute right-4 text-white text-3xl font-light hover:opacity-85 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
          >
            ›
          </button>
        </div>
      )}

      {/* ─── Collection Management Modal ────────────────────────────────────── */}
      {showCollectionModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-6 space-y-4 animate-scale-in max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[var(--color-border-glass)] pb-2">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Add to Collection</h3>
              <button
                onClick={() => {
                  setShowCollectionModal(false);
                  setShowCreateCollection(false);
                }}
                className="text-[var(--color-text-secondary)] hover:text-white text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            {showCreateCollection ? (
              <form onSubmit={handleCreateCollection} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)]">Name</label>
                  <input
                    type="text"
                    required
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder="E.g., Summer Favorites"
                    className="w-full px-3 py-2 rounded-xl text-sm bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-primary)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)]">Description (Optional)</label>
                  <textarea
                    value={newCollectionDesc}
                    onChange={(e) => setNewCollectionDesc(e.target.value)}
                    placeholder="Short description of this collection..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-primary)] resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateCollection(false)}
                    className="flex-1 py-2 rounded-xl bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingCollection}
                    className="flex-1 py-2 rounded-xl bg-[var(--color-accent-primary)] text-xs text-white font-bold hover:opacity-90 disabled:opacity-50 cursor-pointer"
                  >
                    {isCreatingCollection ? 'Creating...' : 'Create & Add'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <button
                  onClick={() => setShowCreateCollection(true)}
                  className="w-full py-2.5 rounded-xl border border-dashed border-[var(--color-accent-primary)]/40 hover:bg-[var(--color-accent-primary)]/5 text-xs font-bold text-[var(--color-accent-primary)] transition-all cursor-pointer"
                >
                  + Create New Collection
                </button>

                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {collections.length === 0 ? (
                    <p className="text-xs text-[var(--color-text-muted)] text-center py-6">
                      You haven't created any collections yet.
                    </p>
                  ) : (
                    collections.map((col) => {
                      const isAdded = animeCollectionIds.includes(col.collection_id);
                      return (
                        <div
                          key={col.collection_id}
                          onClick={() => handleToggleCollection(col.collection_id)}
                          className={`flex items-center justify-between p-3 rounded-xl border hover:bg-[var(--color-bg-card-hover)] cursor-pointer transition-all ${
                            isAdded
                              ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/5'
                              : 'border-[var(--color-border-glass)]'
                          }`}
                        >
                          <div>
                            <h4 className="text-xs font-bold text-[var(--color-text-primary)]">{col.name}</h4>
                            {col.description && (
                              <p className="text-[10px] text-[var(--color-text-tertiary)] truncate max-w-[250px] mt-0.5">
                                {col.description}
                              </p>
                            )}
                          </div>
                          <input
                            type="checkbox"
                            checked={isAdded}
                            readOnly
                            className="w-4 h-4 rounded accent-[var(--color-accent-primary)]"
                          />
                        </div>
                      );
                    })
                  )}
                </div>

                <button
                  onClick={() => setShowCollectionModal(false)}
                  className="w-full py-2 rounded-xl bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] cursor-pointer"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Franchise Timeline Sub-loader Helper ────────────────────────────

interface FranchiseTimelineLoaderProps {
  franchiseId: number;
  currentAnilistId: number;
  navigate: (pathname: string, search?: string) => void;
}

function FranchiseTimelineLoader({
  franchiseId,
  currentAnilistId,
  navigate,
}: FranchiseTimelineLoaderProps) {
  const { queryObjects } = useDatabase();
  const [entries, setEntries] = useState<Anime[]>([]);

  useEffect(() => {
    try {
      const rows = queryObjects<Record<string, unknown>>(
        `SELECT a.* FROM anime a 
         JOIN anime_franchises af ON a.anilist_id = af.anilist_id 
         WHERE af.franchise_id = ? 
         ORDER BY a.season_year ASC, a.updated_at ASC`,
        [franchiseId]
      );
      setEntries(rows.map(rowToAnime));
    } catch (e) {
      console.error('[FranchiseTimelineLoader] Error loading entries:', e);
    }
  }, [franchiseId, queryObjects]);

  if (entries.length === 0) {
    return <div className="h-4 w-4 rounded-full border-2 border-t-transparent border-[var(--color-accent-primary)] animate-spin" />;
  }

  return (
    <>
      {entries.map((entry) => {
        const isCurrent = entry.anilist_id === currentAnilistId;
        const entryCover = entry.cover_large || entry.cover_extra_large;

        return (
          <div key={entry.anilist_id} className="relative group">
            {/* Timeline node dot indicator */}
            <span
              className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${
                isCurrent
                  ? 'border-[var(--color-accent-primary)] bg-[var(--color-bg-base)] shadow-[0_0_12px_var(--color-accent-primary)]'
                  : 'border-[var(--color-text-muted)] bg-[var(--color-bg-elevated)] group-hover:border-[var(--color-text-secondary)]'
              }`}
            >
              {isCurrent && (
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-primary)]" />
              )}
            </span>

            <div
              onClick={() => {
                if (!isCurrent) {
                  navigate(`/anime`, `?id=${entry.anilist_id}`);
                }
              }}
              className={`flex gap-3 p-2.5 rounded-xl border transition-all ${
                isCurrent
                  ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/5 cursor-default'
                  : 'border-[var(--color-border-glass)] bg-[var(--color-bg-elevated)]/10 hover:bg-[var(--color-bg-card-hover)] hover:border-[var(--color-border-glass-hover)] cursor-pointer'
              }`}
            >
              {entryCover && (
                <img src={entryCover} alt="" className="w-10 h-14 object-cover rounded-md flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h5 className={`text-xs font-bold truncate ${isCurrent ? 'text-[var(--color-accent-primary)]' : 'text-[var(--color-text-primary)]'}`}>
                  {entry.title_en || entry.title_romaji}
                </h5>
                <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                  {entry.format} • {entry.season_year || 'Year ?'}
                </p>
                {entry.status && (
                  <div className="mt-1">
                    <StatusBadge type="status" value={entry.status} />
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
