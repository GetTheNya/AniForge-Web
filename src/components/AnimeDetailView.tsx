import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '../hooks/useNavigation';
import { useAnimeDetail } from '../hooks/useAnimeDetail';
import { useAuth } from '../context/AuthContext';
import { useDatabase } from '../context/DatabaseContext';
import { useSettings } from '../context/SettingsContext';
import { rowToAnime, type Anime } from '../types/anime';
import { STATUS_CONFIGS } from '../utils/statusConfig';
import StatusBadge from './StatusBadge';
import AnimeCard from './AnimeCard';
import { useLiveQuery } from 'dexie-react-hooks';
import { userDb } from '../services/userDb';
import { useUserTracking } from '../context/UserTrackingContext';
import { EMPTY_FILTER } from '../types/filters';
import { filterToSearchParams } from '../utils/filterUrl';
import { useRandomSession } from '../context/RandomSessionContext';

interface AnimeDetailViewProps {
  anilistId: number;
}


export default function AnimeDetailView({ anilistId }: AnimeDetailViewProps) {
  const { navigate } = useNavigation();
  const { user, signInWithGoogle } = useAuth();
  const { t } = useTranslation();
  const { preferUkTitles } = useSettings();
  const { session, nextRandom } = useRandomSession();

  const collectionIdParam = useMemo(() => {
    return new URLSearchParams(window.location.search).get('collectionId');
  }, [anilistId]);
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
    deleteTracking,
  } = useAnimeDetail(anilistId);

  // Local state for UI
  const [activeTab, setActiveTab] = useState<'info' | 'relations' | 'staff' | 'franchise'>('info');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showAllTags, setShowAllTags] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);

  // Transition states for Lightbox Portal
  const [lightboxRendered, setLightboxRendered] = useState(false);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null);

  // Transition states for Collection Modal Portal
  const [collectionModalRendered, setCollectionModalRendered] = useState(false);
  const [collectionModalVisible, setCollectionModalVisible] = useState(false);

  // Sync transitions for lightbox
  useEffect(() => {
    if (lightboxIndex !== null) {
      setActiveLightboxIndex(lightboxIndex);
      setLightboxRendered(true);
      const timer = setTimeout(() => {
        setLightboxVisible(true);
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setLightboxVisible(false);
      const timer = setTimeout(() => {
        setLightboxRendered(false);
        setActiveLightboxIndex(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [lightboxIndex]);

  // Sync transitions for collection modal
  useEffect(() => {
    if (showCollectionModal) {
      setCollectionModalRendered(true);
      const timer = setTimeout(() => {
        setCollectionModalVisible(true);
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setCollectionModalVisible(false);
      const timer = setTimeout(() => {
        setCollectionModalRendered(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showCollectionModal]);

  const navigateToFilterAndScroll = (query: any) => {
    const params = filterToSearchParams(query);
    navigate('/', '?' + params.toString());
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  const filterByStudio = (studioId: number) => {
    navigateToFilterAndScroll({
      ...EMPTY_FILTER,
      studios: [studioId],
    });
  };

  const filterByStatus = (status: string | null) => {
    if (!status) return;
    navigateToFilterAndScroll({
      ...EMPTY_FILTER,
      mediaStatuses: [status as any],
    });
  };

  const filterBySource = (source: string | null) => {
    if (!source) return;
    navigateToFilterAndScroll({
      ...EMPTY_FILTER,
      mediaSources: [source as any],
    });
  };

  const filterByGenre = (genreSlug: string) => {
    navigateToFilterAndScroll({
      ...EMPTY_FILTER,
      genres: [genreSlug],
    });
  };

  const filterByTag = (tagId: number) => {
    navigateToFilterAndScroll({
      ...EMPTY_FILTER,
      tags: [tagId],
    });
  };
  
  // Tracking form states
  const [localNotes, setLocalNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const notesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Collections and cross-ref states reactively using useLiveQuery on Dexie.js
  const collections = useLiveQuery(
    async () => {
      const all = await userDb.collections.toArray();
      // Map to the Collection shape the component expects
      return all
        .filter((c) => c.is_deleted !== 1)
        .map((c) => ({
          collection_id: c.id,
          name: c.title,
          description: c.description,
        }));
    }
  ) || [];

  const animeCollectionIds = useLiveQuery(
    async () => {
      const refs = await userDb.collection_anime_cross_ref
        .where('animeId')
        .equals(anilistId)
        .toArray();
      return refs.filter((r) => r.is_deleted !== 1).map((r) => r.collectionId);
    },
    [anilistId]
  ) || [];

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
        setCountdownText(t('detail.airingSoon'));
        clearInterval(interval);
        return;
      }

      const days = Math.floor(diff / (24 * 3600));
      const hours = Math.floor((diff % (24 * 3600)) / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      let text = t('detail.airingEp', { episode: anime.airing_episode || '?' }) + ' ';
      if (days > 0) text += `${days}${t('detail.daysShort')} `;
      if (hours > 0 || days > 0) text += `${hours}${t('detail.hoursShort')} `;
      text += `${minutes}${t('detail.minutesShort')} ${seconds}${t('detail.secondsShort')}`;

      setCountdownText(text);
    }, 1000);

    return () => clearInterval(interval);
  }, [anime, t]);

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

  // Toggle collection cross reference via write-through sync engine
  const {
    saveCollection,
    addAnimeToCollection,
    removeAnimeFromCollection
  } = useUserTracking();

  const handleToggleCollection = async (collectionId: string) => {
    if (!user) return;
    const isAdded = animeCollectionIds.includes(collectionId);

    try {
      if (isAdded) {
        await removeAnimeFromCollection(collectionId, anilistId);
      } else {
        await addAnimeToCollection(collectionId, anilistId);
      }
    } catch (e) {
      console.error('[AnimeDetailView] Toggle collection error:', e);
    }
  };

  // Create new collection via write-through sync engine
  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newCollectionName.trim()) return;

    setIsCreatingCollection(true);
    try {
      const collectionId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
      await saveCollection(collectionId, newCollectionName.trim(), newCollectionDesc.trim());
      await addAnimeToCollection(collectionId, anilistId);

      setNewCollectionName('');
      setNewCollectionDesc('');
      setShowCreateCollection(false);
    } catch (e) {
      console.error('[AnimeDetailView] Create collection error:', e);
    } finally {
      setIsCreatingCollection(false);
    }
  };

  const checkIfParent = (e: React.MouseEvent<HTMLDivElement>, callback: Function) => {
    if (e.target === e.currentTarget) callback();
  }

  if (isLoading && !anime) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-[var(--color-accent-primary)]/20 border-t-[var(--color-accent-primary)] animate-spin" />
        <p className="text-sm text-[var(--color-text-secondary)]">{t('detail.loadingDetails')}</p>
      </div>
    );
  }

  if (error || !anime) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[var(--color-accent-rose)]/15 flex items-center justify-center text-[var(--color-accent-rose)] text-3xl">⚠️</div>
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{t('detail.detailsUnavailable')}</h2>
        <p className="text-sm text-[var(--color-text-secondary)] max-w-md">{error || t('detail.couldNotRetrieve')}</p>
        <button onClick={() => navigate('/')} className="glass-button mt-2">{t('detail.backToCatalog')}</button>
      </div>
    );
  }

  const coverUrl = anime.cover_extra_large || anime.cover_large;
  const bannerUrl = anime.banner_image || coverUrl;

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

  const renderTrackingWidget = () => (
    <div className="glass-card p-6 flex flex-col gap-5">
      <h3 className="text-base font-bold text-[var(--color-text-primary)] border-b border-[var(--color-border-glass)] pb-2">
        {t('detail.myTracking')}
      </h3>

      {!user ? (
        <div className="text-center py-4 flex flex-col gap-3">
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            {t('detail.signInDetails')}
          </p>
          <button
            onClick={signInWithGoogle}
            className="w-full glass-button flex items-center justify-center gap-2 text-xs py-2"
          >
            {t('common.signInGoogle')}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          
          {/* Watch Status Buttons */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--color-text-secondary)]">{t('detail.watchStatus')}</label>
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
              {STATUS_CONFIGS.map((status) => {
                const isActive = tracking?.watch_status === status.id;
                
                return (
                  <button
                    key={status.id}
                    onClick={async () => {
                      try {
                        if (isActive) {
                            await deleteTracking();
                        } else {
                            await updateTracking({ watch_status: status.id });
                        }
                      } catch (e) {
                        console.error('[WatchStatusButton] Update tracking failed:', e);
                      }
                    }}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all duration-200 cursor-pointer select-none"
                    style={{
                      borderColor: isActive ? status.color : 'var(--color-border-glass)',
                      backgroundColor: isActive ? `${status.color}25` : 'var(--color-bg-input)',
                      color: isActive ? status.color : 'var(--color-text-secondary)',
                      boxShadow: isActive ? `0 0 12px ${status.color}30` : 'none',
                    }}
                  >
                    {isActive ? status.activeIcon : status.inactiveIcon}
                    <span>{t(`status.${status.id}`)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Episode Progress */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs font-semibold text-[var(--color-text-secondary)]">
              <span>{t('detail.episodeProgress')}</span>
              <span className="text-[var(--color-text-tertiary)]">
                {t('detail.maxEpisodes', { count: anime.episodes || '?' })}
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
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs font-semibold text-[var(--color-text-secondary)]">
              <span>{t('detail.myScore')}</span>
              <span className="font-bold text-[var(--color-accent-primary)]">
                {tracking?.score ? `${tracking.score}/10` : t('detail.unrated')}
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
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs font-semibold text-[var(--color-text-secondary)]">
              <span>{t('detail.privateNotes')}</span>
              {isSavingNotes && (
                <span className="text-[10px] text-[var(--color-accent-secondary)] animate-pulse">{t('detail.saving')}</span>
              )}
            </div>
            <textarea
              disabled={!tracking}
              value={localNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder={t('detail.notesPlaceholder')}
              rows={4}
              className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-primary)] resize-none disabled:opacity-30 disabled:cursor-not-allowed"
            />
          </div>

        </div>
      )}
    </div>
  );

  const renderAnimeDetails = () => (
    <div className="glass-card p-6 flex flex-col gap-4">
      <h3 className="text-base font-bold text-[var(--color-text-primary)] border-b border-[var(--color-border-glass)] pb-2">
        {t('detail.animeDetails')}
      </h3>

      <div className="flex flex-col gap-3 text-xs">
        {studios.length > 0 && (
          <div>
            <h4 className="text-[var(--color-text-tertiary)] font-bold uppercase tracking-wider">{t('detail.studios')}</h4>
            <div className="flex gap-2 flex-wrap mt-1">
              {studios.map((st) => (
                <button
                  key={st.studio_id}
                  onClick={() => filterByStudio(st.studio_id)}
                  className="px-2.5 py-1 rounded-full bg-[var(--color-accent-secondary)]/10 hover:bg-[var(--color-accent-secondary)]/20 active:scale-95 text-[var(--color-accent-secondary)] font-bold transition-all cursor-pointer text-left"
                >
                  {st.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <h4 className="text-[var(--color-text-tertiary)] font-bold uppercase tracking-wider">{t('detail.totalEpisodes')}</h4>
          <p className="text-[var(--color-text-primary)] font-medium mt-0.5">{anime.episodes || t('detail.unknown')}</p>
        </div>

        {anime.duration && (
          <div>
            <h4 className="text-[var(--color-text-tertiary)] font-bold uppercase tracking-wider">{t('detail.duration')}</h4>
            <p className="text-[var(--color-text-primary)] font-medium mt-0.5">{anime.duration} {t('detail.minutesPerEp')}</p>
          </div>
        )}

        {anime.source && (
          <div>
            <h4 className="text-[var(--color-text-tertiary)] font-bold uppercase tracking-wider">{t('detail.originalSource')}</h4>
            <div className="mt-1">
              <button
                onClick={() => filterBySource(anime.source)}
                className="px-2.5 py-1 rounded-md bg-[var(--color-bg-base)] hover:bg-[var(--color-bg-elevated)] border border-[var(--color-border-glass)] text-[var(--color-text-primary)] font-medium transition-all cursor-pointer active:scale-95 text-left"
              >
                {t(`sources.${anime.source}`, anime.source.replace(/_/g, ' '))}
              </button>
            </div>
          </div>
        )}

        {anime.status && (
          <div>
            <h4 className="text-[var(--color-text-tertiary)] font-bold uppercase tracking-wider">{t('detail.airingStatus')}</h4>
            <div className="mt-1">
              <StatusBadge type="status" value={anime.status} onClick={() => filterByStatus(anime.status)} />
            </div>
          </div>
        )}

        {genres.length > 0 && (
          <div>
            <h4 className="text-[var(--color-text-tertiary)] font-bold uppercase tracking-wider">{t('detail.genres')}</h4>
            <div className="flex gap-1.5 flex-wrap mt-1.5">
              {genres.map((g) => (
                <button
                  key={g.slug}
                  onClick={() => filterByGenre(g.slug)}
                  className="px-2 py-0.5 rounded-md bg-[var(--color-bg-base)] hover:bg-[var(--color-bg-elevated)] border border-[var(--color-border-glass)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all cursor-pointer active:scale-95 text-left"
                >
                  {g.name || g.name_en}
                </button>
              ))}
            </div>
          </div>
        )}

        {tags.length > 0 && (
          <div>
            <h4 className="text-[var(--color-text-tertiary)] font-bold uppercase tracking-wider">{t('detail.tags')}</h4>
            <div className="flex gap-1.5 flex-wrap mt-1.5">
              {(showAllTags ? tags : tags.slice(0, 15)).map((t) => (
                <button
                  key={t.tag_id}
                  onClick={() => filterByTag(t.tag_id)}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--color-bg-base)] hover:bg-[var(--color-bg-elevated)] border border-[var(--color-border-glass)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-all cursor-pointer active:scale-95 text-left"
                  title={t.category || ''}
                >
                  {t.name || t.name_en}
                </button>
              ))}
              {!showAllTags && tags.length > 15 && (
                <button
                  onClick={() => setShowAllTags(true)}
                  className="text-[10px] text-[var(--color-accent-primary)] hover:underline self-center cursor-pointer active:scale-95"
                >
                  +{tags.length - 15} {t('detail.more')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-8 animate-fade-in pb-16">
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
          <div className="flex items-center gap-3">
            {collectionIdParam ? (
              <button
                onClick={() => navigate('/collection', `?id=${collectionIdParam}`)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[var(--color-border-glass)] bg-[var(--color-bg-overlay)] text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)] transition-all cursor-pointer shadow-lg"
              >
                ← {t('detail.backToCollection')}
              </button>
            ) : (session && !session.collectionId) ? (
              <button
                onClick={() => navigate('/library')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[var(--color-border-glass)] bg-[var(--color-bg-overlay)] text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)] transition-all cursor-pointer shadow-lg"
              >
                ← {t('detail.backToLibrary')}
              </button>
            ) : (
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[var(--color-border-glass)] bg-[var(--color-bg-overlay)] text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)] transition-all cursor-pointer shadow-lg"
              >
                ← {t('detail.backToCatalog')}
              </button>
            )}

            {session && (
              <button
                onClick={() => nextRandom()}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[var(--color-accent-secondary)]/30 bg-[var(--color-accent-secondary)]/15 text-xs font-bold text-[var(--color-accent-secondary)] hover:bg-[var(--color-accent-secondary)]/25 active:scale-95 transition-all cursor-pointer shadow-lg"
              >
                🎲 {t('detail.nextRandom')} ({session.seenIds.length}/{session.filteredIds.length})
              </button>
            )}
          </div>
          
          {user && (
            <button
              onClick={() => setShowCollectionModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[var(--color-accent-primary)]/30 bg-[var(--color-accent-primary)]/10 text-xs font-semibold text-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary)]/20 transition-all cursor-pointer shadow-lg"
            >
              📥 {t('detail.addToCollection')}
            </button>
          )}
        </div>

        {/* Content layout on top of banner */}
        <div className="relative z-10 p-6 lg:p-8 flex flex-row items-end gap-4 lg:gap-6">
          {/* Main Poster card */}
          {coverUrl && (
            <div className="flex-shrink-0 w-[120px] lg:w-[200px] aspect-[3/4] rounded-xl overflow-hidden border border-[var(--color-border-glass-hover)] shadow-2xl bg-[var(--color-bg-base)] group cursor-pointer relative"
                 onClick={() => setLightboxIndex(0)}>
              <img
                src={coverUrl}
                alt={title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-xs font-medium">{t('detail.viewPoster')}</span>
              </div>
            </div>
          )}

          {/* Core Info */}
          <div className="min-w-0 flex-1 space-y-3">
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
                  {anime.season ? t(`season.${anime.season.toLowerCase()}`) : ''} {anime.season_year}
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
        <div className="lg:col-span-2 flex flex-col gap-8">
          
          {/* Mobile-only Tracking Widget */}
          <div className="lg:hidden">
            {renderTrackingWidget()}
          </div>

          {/* Synopsis */}
          <div className="glass-card p-6 flex flex-col gap-3">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{t('detail.synopsis')}</h2>
            <div className="text-sm text-[var(--color-text-secondary)] leading-relaxed flex flex-col gap-3">
              {(() => {
                const synopsisText = preferUkTitles
                  ? (anime.description_uk || anime.description_en)
                  : (anime.description_en || anime.description_uk);

                if (!synopsisText) {
                  return <p className="italic text-[var(--color-text-muted)]">{t('detail.noDescription')}</p>;
                }

                return synopsisText
                  .replace(/<br>/gi, '\n')
                  .replace(/<[^>]*>/g, '')
                  .split('\n')
                  .filter((p) => p.trim())
                  .map((p, i) => <p key={i}>{p}</p>);
              })()}
            </div>
          </div>

          {/* Mobile-only Anime Details */}
          <div className="lg:hidden">
            {renderAnimeDetails()}
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
                  {t(`detail.${tab}`)}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* Tab 1: Info (Trailer + Screenshots) */}
              {activeTab === 'info' && (
                <div className="flex flex-col gap-6">
                  {/* Screenshots gallery */}
                  {screenshots.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <h3 className="text-sm font-bold text-[var(--color-text-primary)]">{t('detail.screenshots')}</h3>
                      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                        {screenshots.map((url, idx) => (
                          <div
                            key={idx}
                            onClick={() => setLightboxIndex(idx + 1)}
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
                    <div className="flex flex-col gap-3">
                      <h3 className="text-sm font-bold text-[var(--color-text-primary)]">{t('detail.watchTrailer')}</h3>
                      <div className="relative aspect-video rounded-xl overflow-hidden border border-[var(--color-border-glass)] bg-[var(--color-bg-base)]">
                        <iframe
                          src={`https://www.youtube.com/embed/${anime.trailer_id}`}
                          title={t('detail.trailerTitle', { title })}
                          className="absolute inset-0 w-full h-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    </div>
                  )}
                  
                  {!anime.trailer_id && screenshots.length === 0 && (
                    <p className="italic text-xs text-[var(--color-text-muted)] text-center py-4">
                      {t('detail.noMedia')}
                    </p>
                  )}
                </div>
              )}

              {/* Tab 2: Relations */}
              {activeTab === 'relations' && (
                <div className="flex flex-col gap-4">
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
                                {rel.displayTitle || rel.title_en || rel.title_romaji}
                              </h4>
                              <p className="text-[10px] text-[var(--color-text-secondary)]">
                                {rel.format} • {rel.season_year || t('detail.yearUnknown')}
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
                      {t('detail.noRelations')}
                    </p>
                  )}
                </div>
              )}

              {/* Tab 3: Staff */}
              {activeTab === 'staff' && (
                <div className="flex flex-col gap-4">
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
                      {t('detail.noStaff')}
                    </p>
                  )}
                </div>
              )}

              {/* Tab 4: Franchise Timeline */}
              {activeTab === 'franchise' && (
                <div className="flex flex-col gap-6">
                  {franchise ? (
                    <div className="flex flex-col gap-4">
                      <div className="p-4 rounded-xl border border-[var(--color-accent-primary)]/20 bg-[var(--color-accent-primary)]/5">
                        <h4 className="text-sm font-bold text-[var(--color-accent-primary)]">
                          {franchise.name || franchise.name_en || franchise.name_uk || t('detail.franchise')}
                        </h4>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                          {t('detail.franchiseTimelineInfo', { count: franchiseReleaseCount })}
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
                      {t('detail.noFranchise')}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{t('detail.recommended')}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {recommendations.slice(0, 8).map((rec, i) => (
                  <AnimeCard key={rec.anilist_id} anime={rec} index={i} />
                ))}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Tracking Widget & Meta Badges info */}
        <div className="hidden lg:flex lg:flex-col lg:gap-6 w-full">
          {renderTrackingWidget()}
          {renderAnimeDetails()}
        </div>

      </div>

      {/* ─── Lightbox Modal for screenshots ─────────────────────────────────── */}
      {lightboxRendered && activeLightboxIndex !== null && createPortal(
        <div className={`fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 transition-all duration-300 ease-out ${
          lightboxVisible ? 'opacity-100 backdrop-blur-md' : 'opacity-0 backdrop-blur-none'
        }`}
          onClick={(e) => checkIfParent(e, () => setLightboxIndex(null))}
        >
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 text-white text-3xl font-light hover:opacity-85 cursor-pointer z-50"
          >
            ×
          </button>
          
          <button
            disabled={activeLightboxIndex === 0}
            onClick={() => setLightboxIndex((p) => p! - 1)}
            className="group absolute left-0 top-0 bottom-0 w-20 md:w-32 flex items-center justify-center text-white text-5xl font-light hover:bg-white/5 transition-all duration-200 disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed z-40"
          >
            <span className="transition-transform duration-200 group-hover:scale-125 group-active:scale-95 group-disabled:scale-100 select-none">
              ‹
            </span>
          </button>

          <div className={`max-w-5xl max-h-[80vh] flex items-center justify-center z-10 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            lightboxVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}>
            <img
              src={activeLightboxIndex === 0 && coverUrl ? coverUrl : screenshots[activeLightboxIndex - (coverUrl ? 1 : 0)]}
              alt=""
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-white/10"
            />
          </div>

          <button
            disabled={activeLightboxIndex === (screenshots.length - 1 + (coverUrl ? 1 : 0))}
            onClick={() => setLightboxIndex((p) => p! + 1)}
            className="group absolute right-0 top-0 bottom-0 w-20 md:w-32 flex items-center justify-center text-white text-5xl font-light hover:bg-white/5 transition-all duration-200 disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed z-40"
          >
            <span className="transition-transform duration-200 group-hover:scale-125 group-active:scale-95 group-disabled:scale-100 select-none">
              ›
            </span>
          </button>
        </div>,
        document.body
      )}

      {/* ─── Collection Management Modal ────────────────────────────────────── */}
      {collectionModalRendered && createPortal(
        <div className={`fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 transition-all duration-300 ease-out ${
          collectionModalVisible ? 'opacity-100 backdrop-blur-sm' : 'opacity-0 backdrop-blur-none'
        }`}
          onClick={(e) => checkIfParent(e, () => {
            setShowCollectionModal(false);
            setShowCreateCollection(false);
          })}
        >
          <div className={`glass-card w-full max-w-md p-6 space-y-4 max-h-[85vh] overflow-y-auto transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            collectionModalVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}>
            <div className="flex justify-between items-center border-b border-[var(--color-border-glass)] pb-2">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">{t('detail.addToCollection')}</h3>
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
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)]">{t('detail.name')}</label>
                  <input
                    type="text"
                    required
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder={t('detail.namePlaceholder')}
                    className="w-full px-3 py-2 rounded-xl text-sm bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-primary)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)]">{t('detail.descriptionOpt')}</label>
                  <textarea
                    value={newCollectionDesc}
                    onChange={(e) => setNewCollectionDesc(e.target.value)}
                    placeholder={t('detail.descPlaceholder')}
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
                    {t('detail.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingCollection}
                    className="flex-1 py-2 rounded-xl bg-[var(--color-accent-primary)] text-xs text-white font-bold hover:opacity-90 disabled:opacity-50 cursor-pointer"
                  >
                    {isCreatingCollection ? t('detail.creating') : t('detail.createAndAdd')}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <button
                  onClick={() => setShowCreateCollection(true)}
                  className="w-full py-2.5 rounded-xl border border-dashed border-[var(--color-accent-primary)]/40 hover:bg-[var(--color-accent-primary)]/5 text-xs font-bold text-[var(--color-accent-primary)] transition-all cursor-pointer"
                >
                  + {t('detail.createCollection')}
                </button>

                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {collections.length === 0 ? (
                    <p className="text-xs text-[var(--color-text-muted)] text-center py-6">
                      {t('detail.noCollections')}
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
                  {t('detail.close')}
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
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
  const { t } = useTranslation();
  const { queryObjects } = useDatabase();
  const { getAnimeTitle } = useSettings();
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
      const mapped = rows.map((row) => {
        const a = rowToAnime(row);
        a.displayTitle = getAnimeTitle(a);
        return a;
      });
      setEntries(mapped);
    } catch (e) {
      console.error('[FranchiseTimelineLoader] Error loading entries:', e);
    }
  }, [franchiseId, queryObjects, getAnimeTitle]);

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
              className={`absolute -left-[31px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${
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
                  {entry.displayTitle || entry.title_en || entry.title_romaji}
                </h5>
                <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                  {entry.format} • {entry.season_year || t('detail.yearUnknown')}
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
