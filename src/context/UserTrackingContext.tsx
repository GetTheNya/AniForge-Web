import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabase';
import {
  userDb,
  type UserTrackingRecord,
  type CollectionRecord,
  type CollectionAnimeCrossRefRecord,
} from '../services/userDb';

interface UserTrackingContextValue {
  syncStatus: 'idle' | 'syncing' | 'error';
  lastSyncedAt: string | null;
  sync: () => Promise<void>;
  flushDirtyQueue: () => Promise<void>;
  saveTracking: (
    anilistId: number,
    updates: Partial<Omit<UserTrackingRecord, 'anilist_id' | 'updated_at' | 'is_synced' | 'is_deleted'>>
  ) => Promise<void>;
  removeTracking: (anilistId: number) => Promise<void>;
  saveCollection: (id: string, title: string, description: string) => Promise<void>;
  removeCollection: (id: string) => Promise<void>;
  addAnimeToCollection: (collectionId: string, animeId: number) => Promise<void>;
  removeAnimeFromCollection: (collectionId: string, animeId: number) => Promise<void>;
  reorderAnimeInCollection: (collectionId: string, orderedAnimeIds: number[]) => Promise<void>;
}

const UserTrackingContext = createContext<UserTrackingContextValue | null>(null);

export function UserTrackingProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // Helper to get last sync time key
  const getSyncTimeKey = useCallback((userId: string) => `user_lists_last_synced_${userId}`, []);

  // Flush local modifications (is_synced === 0) to Supabase for all three tables
  const flushDirtyQueue = useCallback(async () => {
    if (!user) return;

    if (!navigator.onLine) {
      console.info('[sync] Offline. Skipping flush dirty queue.');
      return;
    }

    try {
      // 1. User tracking mutations (batched)
      const dirtyTracking = await userDb.user_tracking
        .where('is_synced')
        .equals(0)
        .toArray();

      if (dirtyTracking.length > 0) {
        console.info(`[sync] Found ${dirtyTracking.length} unsynced tracking records. Flushing in batch...`);
        const chunkSize = 1000;
        for (let i = 0; i < dirtyTracking.length; i += chunkSize) {
          const chunk = dirtyTracking.slice(i, i + chunkSize);
          const mapped = chunk.map(record => ({
            user_id: user.id,
            anilist_id: record.anilist_id,
            watch_status: record.status,
            episode_progress: record.episode_progress,
            score: record.score,
            notes: record.notes,
            last_modified: record.updated_at,
            is_deleted: !!record.is_deleted,
          }));

          try {
            const { error: remoteError } = await supabase
              .from('user_tracking')
              .upsert(mapped);

            if (remoteError) throw remoteError;

            await userDb.transaction('rw', userDb.user_tracking, async () => {
              for (const record of chunk) {
                if (record.is_deleted) {
                  await userDb.user_tracking.delete(record.anilist_id);
                } else {
                  await userDb.user_tracking.update(record.anilist_id, { is_synced: 1 });
                }
              }
            });
            console.info(`[sync] Synced tracking batch of ${chunk.length} records.`);
          } catch (recordError) {
            console.error('[sync] Failed to flush tracking record batch:', recordError);
          }
        }
      }

      // 2. Collections mutations (batched)
      const dirtyCollections = await userDb.collections
        .where('is_synced')
        .equals(0)
        .toArray();

      if (dirtyCollections.length > 0) {
        console.info(`[sync] Found ${dirtyCollections.length} unsynced collections. Flushing in batch...`);
        const chunkSize = 1000;
        for (let i = 0; i < dirtyCollections.length; i += chunkSize) {
          const chunk = dirtyCollections.slice(i, i + chunkSize);
          const mapped = chunk.map(record => ({
            collection_id: record.id,
            user_id: user.id,
            title: record.title,
            description: record.description || null,
            created_at: new Date(record.createdAt).toISOString(),
            last_modified: new Date(record.last_modified).toISOString(),
            is_deleted: record.is_deleted === 1,
          }));

          try {
            const { error: remoteError } = await supabase
              .from('collections')
              .upsert(mapped);

            if (remoteError) throw remoteError;

            await userDb.transaction('rw', userDb.collections, async () => {
              for (const record of chunk) {
                if (record.is_deleted === 1) {
                  await userDb.collections.delete(record.id);
                } else {
                  await userDb.collections.update(record.id, { is_synced: 1 });
                }
              }
            });
            console.info(`[sync] Synced collections batch of ${chunk.length} records.`);
          } catch (colError) {
            console.error('[sync] Failed to flush collections batch:', colError);
          }
        }
      }

      // 3. Cross-ref mutations (batched)
      const dirtyCrossRefs = await userDb.collection_anime_cross_ref
        .where('is_synced')
        .equals(0)
        .toArray();

      if (dirtyCrossRefs.length > 0) {
        console.info(`[sync] Found ${dirtyCrossRefs.length} unsynced cross-references. Flushing in batch...`);
        const chunkSize = 1000;
        for (let i = 0; i < dirtyCrossRefs.length; i += chunkSize) {
          const chunk = dirtyCrossRefs.slice(i, i + chunkSize);
          const mapped = chunk.map(record => ({
            collection_id: record.collectionId,
            anime_id: record.animeId,
            user_id: user.id,
            order_index: record.orderIndex,
            last_modified: new Date(record.last_modified).toISOString(),
            is_deleted: record.is_deleted === 1,
          }));

          try {
            const { error: remoteError } = await supabase
              .from('collection_anime_cross_ref')
              .upsert(mapped);

            if (remoteError) throw remoteError;

            await userDb.transaction('rw', userDb.collection_anime_cross_ref, async () => {
              for (const record of chunk) {
                if (record.is_deleted === 1) {
                  await userDb.collection_anime_cross_ref.delete([record.collectionId, record.animeId]);
                } else {
                  await userDb.collection_anime_cross_ref.update([record.collectionId, record.animeId], { is_synced: 1 });
                }
              }
            });
            console.info(`[sync] Synced cross-refs batch of ${chunk.length} records.`);
          } catch (refError) {
            console.error('[sync] Failed to flush cross-ref batch:', refError);
          }
        }
      }
    } catch (err) {
      console.error('[sync] Error in flushDirtyQueue:', err);
    }
  }, [user]);

  // Delta Sync Pull from Supabase for all three tables
  const sync = useCallback(async () => {
    if (!user) return;

    setSyncStatus('syncing');
    console.info(`[sync] Background delta sync starting for user: ${user.id}`);

    try {
      const limit = 1000;

      // 1. User tracking delta sync
      const syncTimeKey = getSyncTimeKey(user.id);
      const dbCount = await userDb.user_tracking.count();
      const lastSyncTime = dbCount > 0 ? (localStorage.getItem(syncTimeKey) || '1969-12-31T23:59:59Z') : '1969-12-31T23:59:59Z';
      const syncStartTime = new Date().toISOString();

      let page = 0;
      let hasMore = true;
      const fetchedItems: any[] = [];

      while (hasMore) {
        const start = page * limit;
        const end = start + limit - 1;

        console.info(`[sync] Fetching page ${page} of user_tracking...`);
        const { data, error } = await supabase
          .from('user_tracking')
          .select('anilist_id, watch_status, score, episode_progress, notes, last_modified, is_deleted')
          .eq('user_id', user.id)
          .gt('last_modified', lastSyncTime)
          .range(start, end);

        if (error) throw error;

        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          fetchedItems.push(...data);
          if (data.length < limit) {
            hasMore = false;
          } else {
            page++;
          }
        }
      }

      console.info(`[sync] Retrieved ${fetchedItems.length} user_tracking delta updates.`);

      if (fetchedItems.length > 0) {
        await userDb.transaction('rw', userDb.user_tracking, async () => {
          for (const item of fetchedItems) {
            const local = await userDb.user_tracking.get(item.anilist_id);
            
            if (item.is_deleted) {
              console.info(`[sync] Remote tracking tombstone found for anilist_id=${item.anilist_id}. Deleting.`);
              await userDb.user_tracking.delete(item.anilist_id);
            } else {
              const remoteMilli = new Date(item.last_modified).getTime();
              const localMilli = local ? new Date(local.updated_at).getTime() : 0;

              if (!local || remoteMilli > localMilli) {
                await userDb.user_tracking.put({
                  anilist_id: item.anilist_id,
                  status: item.watch_status,
                  updated_at: item.last_modified,
                  is_synced: 1,
                  episode_progress: item.episode_progress || 0,
                  score: item.score,
                  notes: item.notes,
                  is_deleted: false,
                });
              }
            }
          }
        });
      }
      localStorage.setItem(syncTimeKey, syncStartTime);

      // 2. Collections delta sync
      const collectionsTimeKey = `collections_last_synced_${user.id}`;
      const collectionsDbCount = await userDb.collections.count();
      const collectionsLastSync = collectionsDbCount > 0 ? (localStorage.getItem(collectionsTimeKey) || '1969-12-31T23:59:59Z') : '1969-12-31T23:59:59Z';

      let colsPage = 0;
      let colsHasMore = true;
      const fetchedCollections: any[] = [];

      while (colsHasMore) {
        const start = colsPage * limit;
        const end = start + limit - 1;

        console.info(`[sync] Fetching page ${colsPage} of collections...`);
        const { data, error } = await supabase
          .from('collections')
          .select('collection_id, title, description, created_at, last_modified, is_deleted')
          .eq('user_id', user.id)
          .gt('last_modified', collectionsLastSync)
          .range(start, end);

        if (error) throw error;

        if (!data || data.length === 0) {
          colsHasMore = false;
        } else {
          fetchedCollections.push(...data);
          if (data.length < limit) {
            colsHasMore = false;
          } else {
            colsPage++;
          }
        }
      }

      console.info(`[sync] Retrieved ${fetchedCollections.length} collections delta updates.`);

      if (fetchedCollections.length > 0) {
        const puts: CollectionRecord[] = [];
        const deletes: string[] = [];

        for (const item of fetchedCollections) {
          if (item.is_deleted) {
            deletes.push(item.collection_id);
          } else {
            const local = await userDb.collections.get(item.collection_id);
            const remoteMilli = new Date(item.last_modified).getTime();
            const localMilli = local ? Number(local.last_modified) : 0;

            if (!local || remoteMilli > localMilli) {
              puts.push({
                id: item.collection_id,
                title: item.title,
                description: item.description || '',
                createdAt: item.created_at ? new Date(item.created_at).getTime() : Date.now(),
                is_synced: 1,
                is_deleted: 0,
                last_modified: new Date(item.last_modified).getTime(),
              });
            }
          }
        }

        if (deletes.length > 0) {
          await userDb.collections.bulkDelete(deletes);
          console.info(`[sync] Deleted ${deletes.length} collections locally.`);
        }
        if (puts.length > 0) {
          await userDb.collections.bulkPut(puts);
          console.info(`[sync] Saved ${puts.length} collections locally.`);
        }
      }
      localStorage.setItem(collectionsTimeKey, syncStartTime);

      // 3. Cross-refs delta sync
      const crossRefsTimeKey = `cross_ref_last_synced_${user.id}`;
      const crossRefsDbCount = await userDb.collection_anime_cross_ref.count();
      const crossRefsLastSync = crossRefsDbCount > 0 ? (localStorage.getItem(crossRefsTimeKey) || '1969-12-31T23:59:59Z') : '1969-12-31T23:59:59Z';

      let refsPage = 0;
      let refsHasMore = true;
      const fetchedCrossRefs: any[] = [];

      while (refsHasMore) {
        const start = refsPage * limit;
        const end = start + limit - 1;

        console.info(`[sync] Fetching page ${refsPage} of collection_anime_cross_ref...`);
        const { data, error } = await supabase
          .from('collection_anime_cross_ref')
          .select('collection_id, anime_id, order_index, last_modified, is_deleted')
          .eq('user_id', user.id)
          .gt('last_modified', crossRefsLastSync)
          .range(start, end);

        if (error) throw error;

        if (!data || data.length === 0) {
          refsHasMore = false;
        } else {
          fetchedCrossRefs.push(...data);
          if (data.length < limit) {
            refsHasMore = false;
          } else {
            refsPage++;
          }
        }
      }

      console.info(`[sync] Retrieved ${fetchedCrossRefs.length} cross-ref delta updates.`);

      if (fetchedCrossRefs.length > 0) {
        const puts: CollectionAnimeCrossRefRecord[] = [];
        const deletes: [string, number][] = [];

        for (const item of fetchedCrossRefs) {
          if (item.is_deleted) {
            deletes.push([item.collection_id, item.anime_id]);
          } else {
            const local = await userDb.collection_anime_cross_ref.get([item.collection_id, item.anime_id]);
            const remoteMilli = new Date(item.last_modified).getTime();
            const localMilli = local ? Number(local.last_modified) : 0;

            if (!local || remoteMilli > localMilli) {
              puts.push({
                collectionId: item.collection_id,
                animeId: item.anime_id,
                orderIndex: item.order_index || 0,
                is_synced: 1,
                is_deleted: 0,
                last_modified: new Date(item.last_modified).getTime(),
              });
            }
          }
        }

        if (deletes.length > 0) {
          await userDb.collection_anime_cross_ref.bulkDelete(deletes);
          console.info(`[sync] Deleted ${deletes.length} cross-refs locally.`);
        }
        if (puts.length > 0) {
          await userDb.collection_anime_cross_ref.bulkPut(puts);
          console.info(`[sync] Saved ${puts.length} cross-refs locally.`);
        }
      }
      localStorage.setItem(crossRefsTimeKey, syncStartTime);

      setLastSyncedAt(syncStartTime);
      setSyncStatus('idle');
      console.info('[sync] Delta sync completed successfully for all tables.');
    } catch (err) {
      console.error('[sync] Sync cycle failed:', err);
      setSyncStatus('error');
    }
  }, [user, getSyncTimeKey]);

  // Save/Update tracking (Write-Through queue)
  const saveTracking = useCallback(
    async (
      anilistId: number,
      updates: Partial<Omit<UserTrackingRecord, 'anilist_id' | 'updated_at' | 'is_synced' | 'is_deleted'>>
    ) => {
      if (!user) return;

      const now = new Date().toISOString();
      const existing = await userDb.user_tracking.get(anilistId);

      const record: UserTrackingRecord = {
        anilist_id: anilistId,
        status: updates.status ?? existing?.status ?? 'PLANNING',
        episode_progress: updates.episode_progress ?? existing?.episode_progress ?? 0,
        score: updates.score !== undefined ? updates.score : (existing?.score ?? null),
        notes: updates.notes !== undefined ? updates.notes : (existing?.notes ?? null),
        updated_at: now,
        is_synced: 0, // Mark dirty
        is_deleted: false,
      };

      console.info(`[userDb] Local write: anilist_id=${anilistId}`, record);
      await userDb.user_tracking.put(record);

      // Attempt immediate push
      try {
        console.info(`[sync] Immediate push upsert for anilist_id=${anilistId}...`);
        const { error: remoteError } = await supabase
          .from('user_tracking')
          .upsert({
            user_id: user.id,
            anilist_id: record.anilist_id,
            watch_status: record.status,
            episode_progress: record.episode_progress,
            score: record.score,
            notes: record.notes,
            last_modified: record.updated_at,
            is_deleted: false,
          });

        if (remoteError) throw remoteError;

        // Success: mark as clean in IndexedDB
        await userDb.user_tracking.update(anilistId, { is_synced: 1 });
        console.info(`[sync] Immediate push successful. Marked clean for anilist_id=${anilistId}.`);
      } catch (err) {
        console.warn(`[sync] Immediate push failed (saved locally as dirty) for anilist_id=${anilistId}:`, err);
      }
    },
    [user]
  );

  // Remove tracking (Soft delete queue)
  const removeTracking = useCallback(
    async (anilistId: number) => {
      if (!user) return;

      const now = new Date().toISOString();
      const existing = await userDb.user_tracking.get(anilistId);

      // Write soft delete tombstone locally
      const tombstone: UserTrackingRecord = {
        anilist_id: anilistId,
        status: existing?.status ?? 'PLANNING',
        episode_progress: existing?.episode_progress ?? 0,
        score: existing?.score ?? null,
        notes: existing?.notes ?? null,
        updated_at: now,
        is_synced: 0, // Pending sync
        is_deleted: true, // Soft deleted
      };

      console.info(`[userDb] Local soft delete (tombstone): anilist_id=${anilistId}`);
      await userDb.user_tracking.put(tombstone);

      // Attempt immediate push soft-deletion (upserting is_deleted: true)
      try {
        console.info(`[sync] Immediate push soft deletion for anilist_id=${anilistId}...`);
        const { error: remoteError } = await supabase
          .from('user_tracking')
          .upsert({
            user_id: user.id,
            anilist_id: tombstone.anilist_id,
            watch_status: tombstone.status,
            episode_progress: tombstone.episode_progress,
            score: tombstone.score,
            notes: tombstone.notes,
            last_modified: tombstone.updated_at,
            is_deleted: true,
          });

        if (remoteError) throw remoteError;

        // Success: physically remove from Dexie
        await userDb.user_tracking.delete(anilistId);
        console.info(`[sync] Immediate soft deletion push successful. Evicted anilist_id=${anilistId} locally.`);
      } catch (err) {
        console.warn(`[sync] Immediate deletion push failed (saved locally as tombstone) for anilist_id=${anilistId}:`, err);
      }
    },
    [user]
  );

  // Write-Through: Save custom collection
  const saveCollection = useCallback(
    async (id: string, title: string, description: string) => {
      if (!user) return;

      const now = Date.now();
      const existing = await userDb.collections.get(id);

      const record: CollectionRecord = {
        id,
        title,
        description,
        createdAt: existing?.createdAt ?? now,
        is_synced: 0,
        is_deleted: 0,
        last_modified: now,
      };

      console.info(`[userDb] Local collection write: id=${id}`, record);
      await userDb.collections.put(record);

      try {
        console.info(`[sync] Immediate push upsert for collection_id=${id}...`);
        const { error: remoteError } = await supabase
          .from('collections')
          .upsert({
            collection_id: id,
            user_id: user.id,
            title: title,
            description: description || null,
            created_at: new Date(record.createdAt).toISOString(),
            last_modified: new Date(now).toISOString(),
            is_deleted: false,
          });

        if (remoteError) throw remoteError;

        await userDb.collections.update(id, { is_synced: 1 });
        console.info(`[sync] Immediate collection push successful. Marked clean for id=${id}.`);
      } catch (err) {
        console.warn(`[sync] Immediate collection push failed for id=${id}:`, err);
      }
    },
    [user]
  );

  // Write-Through: Soft delete custom collection
  const removeCollection = useCallback(
    async (id: string) => {
      if (!user) return;

      const now = Date.now();
      const existing = await userDb.collections.get(id);
      if (!existing) return;

      const tombstone: CollectionRecord = {
        ...existing,
        is_synced: 0,
        is_deleted: 1,
        last_modified: now,
      };

      console.info(`[userDb] Local collection soft delete: id=${id}`);
      await userDb.collections.put(tombstone);

      // Soft delete all cross-refs of this collection locally so they flush to supabase
      const refs = await userDb.collection_anime_cross_ref
        .where('collectionId')
        .equals(id)
        .toArray();
      
      const updatedRefs = refs.map(ref => ({
        ...ref,
        is_synced: 0,
        is_deleted: 1,
        last_modified: now,
      }));

      if (updatedRefs.length > 0) {
        await userDb.collection_anime_cross_ref.bulkPut(updatedRefs);
      }

      // Immediate collection push soft-delete (upsert is_deleted: true)
      try {
        console.info(`[sync] Immediate push soft deletion for collection_id=${id}...`);
        const { error: remoteError } = await supabase
          .from('collections')
          .upsert({
            collection_id: id,
            user_id: user.id,
            title: tombstone.title,
            description: tombstone.description || null,
            created_at: new Date(tombstone.createdAt).toISOString(),
            last_modified: new Date(now).toISOString(),
            is_deleted: true,
          });

        if (remoteError) throw remoteError;

        await userDb.collections.delete(id);
        console.info(`[sync] Immediate collection soft deletion successful. Evicted id=${id} locally.`);
      } catch (err) {
        console.warn(`[sync] Immediate collection deletion push failed for id=${id}:`, err);
      }

      // Immediate cross-refs push soft-delete (upsert in batches of 1000, is_deleted: true)
      if (updatedRefs.length > 0) {
        const chunkSize = 1000;
        for (let i = 0; i < updatedRefs.length; i += chunkSize) {
          const chunk = updatedRefs.slice(i, i + chunkSize);
          const mapped = chunk.map(ref => ({
            collection_id: id,
            anime_id: ref.animeId,
            user_id: user.id,
            order_index: ref.orderIndex,
            last_modified: new Date(now).toISOString(),
            is_deleted: true,
          }));

          try {
            const { error: remoteError } = await supabase
              .from('collection_anime_cross_ref')
              .upsert(mapped);

            if (remoteError) throw remoteError;

            const keysToDelete = chunk.map(ref => [id, ref.animeId] as [string, number]);
            await userDb.collection_anime_cross_ref.bulkDelete(keysToDelete);
            console.info(`[sync] Immediate batch cross-ref soft deletion successful for ${chunk.length} items.`);
          } catch (err) {
            console.warn(`[sync] Immediate batch cross-ref deletion push failed for chunk starting at ${i}:`, err);
          }
        }
      }
    },
    [user]
  );

  // Write-Through: Append anime to custom collection
  const addAnimeToCollection = useCallback(
    async (collectionId: string, animeId: number) => {
      if (!user) return;

      const now = Date.now();
      const refs = await userDb.collection_anime_cross_ref
        .where('collectionId')
        .equals(collectionId)
        .toArray();
      const activeRefs = refs.filter((r) => r.is_deleted !== 1);
      const nextIndex = activeRefs.length > 0 ? Math.max(...activeRefs.map((r) => r.orderIndex)) + 1 : 0;

      const record: CollectionAnimeCrossRefRecord = {
        collectionId,
        animeId,
        orderIndex: nextIndex,
        is_synced: 0,
        is_deleted: 0,
        last_modified: now,
      };

      console.info(`[userDb] Local cross-ref write: collectionId=${collectionId}, animeId=${animeId}`, record);
      await userDb.collection_anime_cross_ref.put(record);

      try {
        console.info(`[sync] Immediate push upsert for cross-ref collectionId=${collectionId}, animeId=${animeId}...`);
        const { error: remoteError } = await supabase
          .from('collection_anime_cross_ref')
          .upsert({
            collection_id: collectionId,
            anime_id: animeId,
            user_id: user.id,
            order_index: nextIndex,
            last_modified: new Date(now).toISOString(),
            is_deleted: false,
          });

        if (remoteError) throw remoteError;

        await userDb.collection_anime_cross_ref.update([collectionId, animeId], { is_synced: 1 });
        console.info(`[sync] Immediate cross-ref push successful for ${collectionId}-${animeId}.`);
      } catch (err) {
        console.warn(`[sync] Immediate cross-ref push failed for ${collectionId}-${animeId}:`, err);
      }
    },
    [user]
  );

  // Write-Through: Remove anime from custom collection
  const removeAnimeFromCollection = useCallback(
    async (collectionId: string, animeId: number) => {
      if (!user) return;

      const now = Date.now();
      const existing = await userDb.collection_anime_cross_ref.get([collectionId, animeId]);
      if (!existing) return;

      const tombstone: CollectionAnimeCrossRefRecord = {
        ...existing,
        is_synced: 0,
        is_deleted: 1,
        last_modified: now,
      };

      console.info(`[userDb] Local cross-ref soft delete: collectionId=${collectionId}, animeId=${animeId}`);
      await userDb.collection_anime_cross_ref.put(tombstone);

      // Attempt immediate push soft-deletion (upserting is_deleted: true)
      try {
        console.info(`[sync] Immediate push soft deletion for cross-ref ${collectionId}-${animeId}...`);
        const { error: remoteError } = await supabase
          .from('collection_anime_cross_ref')
          .upsert({
            collection_id: collectionId,
            anime_id: animeId,
            user_id: user.id,
            order_index: tombstone.orderIndex,
            last_modified: new Date(now).toISOString(),
            is_deleted: true,
          });

        if (remoteError) throw remoteError;

        await userDb.collection_anime_cross_ref.delete([collectionId, animeId]);
        console.info(`[sync] Immediate cross-ref soft deletion successful for ${collectionId}-${animeId}.`);
      } catch (err) {
        console.warn(`[sync] Immediate cross-ref deletion push failed for ${collectionId}-${animeId}:`, err);
      }
    },
    [user]
  );

  // Write-Through: Reorder anime inside custom collection
  const reorderAnimeInCollection = useCallback(
    async (collectionId: string, orderedAnimeIds: number[]) => {
      if (!user) return;

      const now = Date.now();

      for (let i = 0; i < orderedAnimeIds.length; i++) {
        const animeId = orderedAnimeIds[i];
        const existing = await userDb.collection_anime_cross_ref.get([collectionId, animeId]);
        const record: CollectionAnimeCrossRefRecord = {
          collectionId,
          animeId,
          orderIndex: i,
          is_synced: 0,
          is_deleted: existing?.is_deleted ?? 0,
          last_modified: now,
        };

        await userDb.collection_anime_cross_ref.put(record);

        try {
          const { error: remoteError } = await supabase
            .from('collection_anime_cross_ref')
            .upsert({
              collection_id: collectionId,
              anime_id: animeId,
              user_id: user.id,
              order_index: i,
              last_modified: new Date(now).toISOString(),
              is_deleted: record.is_deleted === 1,
            });

          if (remoteError) throw remoteError;

          await userDb.collection_anime_cross_ref.update([collectionId, animeId], { is_synced: 1 });
        } catch (err) {
          console.warn(`[sync] Immediate cross-ref reorder push failed for ${collectionId}-${animeId}:`, err);
        }
      }
    },
    [user]
  );

  // Monitor auth state to trigger initial sync or clear IndexedDB
  useEffect(() => {
    if (isLoading) return;

    let active = true;

    async function handleAuthChange() {
      if (user) {
        const syncTimeKey = getSyncTimeKey(user.id);
        const lastSync = localStorage.getItem(syncTimeKey);
        setLastSyncedAt(lastSync);

        if (active) {
          // Flush pending local edits first, then trigger delta sync
          await flushDirtyQueue();
          await sync();
        }
      } else {
        // Logged out: clean database and keys
        console.info('[userDb] User signed out. Clearing stores...');
        await userDb.user_tracking.clear();
        await userDb.collections.clear();
        await userDb.collection_anime_cross_ref.clear();

        // Remove all sync keys from localStorage
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (
            key &&
            (key.startsWith('user_lists_last_synced_') ||
              key.startsWith('collections_last_synced_') ||
              key.startsWith('cross_ref_last_synced_'))
          ) {
            localStorage.removeItem(key);
          }
        }

        setLastSyncedAt(null);
      }
    }

    handleAuthChange();

    return () => {
      active = false;
    };
  }, [user, isLoading, sync, flushDirtyQueue, getSyncTimeKey]);

  // Lifecycle listeners: Reconnection, Page focus, and Periodic timer
  useEffect(() => {
    if (!user) return;

    // Periodic retry loop every 30 seconds
    const timer = setInterval(() => {
      if (navigator.onLine) {
        console.info('[sync] Periodic loop: flushing dirty records...');
        flushDirtyQueue();
      }
    }, 30000);

    // Online event handler
    const handleOnline = () => {
      console.info('[sync] Network connection restored. Flushing queue and running sync...');
      flushDirtyQueue().then(() => sync());
    };

    // Window focus event handler
    const handleFocus = () => {
      console.info('[sync] Window gained focus. Running background delta sync...');
      sync();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, sync, flushDirtyQueue]);

  return (
    <UserTrackingContext.Provider
      value={{
        syncStatus,
        lastSyncedAt,
        sync,
        flushDirtyQueue,
        saveTracking,
        removeTracking,
        saveCollection,
        removeCollection,
        addAnimeToCollection,
        removeAnimeFromCollection,
        reorderAnimeInCollection,
      }}
    >
      {children}
    </UserTrackingContext.Provider>
  );
}

export function useUserTracking() {
  const context = useContext(UserTrackingContext);
  if (!context) {
    throw new Error('useUserTracking must be used within <UserTrackingProvider>');
  }
  return context;
}

