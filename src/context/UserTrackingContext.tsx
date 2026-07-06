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
import { userDb, type UserTrackingRecord } from '../services/userDb';

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
}

const UserTrackingContext = createContext<UserTrackingContextValue | null>(null);

export function UserTrackingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // Helper to get last sync time key
  const getSyncTimeKey = useCallback((userId: string) => `user_lists_last_synced_${userId}`, []);

  // Flush local modifications (is_synced === 0) to Supabase
  const flushDirtyQueue = useCallback(async () => {
    if (!user) return;

    if (!navigator.onLine) {
      console.info('[sync] Offline. Skipping flush dirty queue.');
      return;
    }

    try {
      const dirtyRecords = await userDb.user_tracking
        .where('is_synced')
        .equals(0)
        .toArray();

      if (dirtyRecords.length === 0) {
        return;
      }

      console.info(`[sync] Found ${dirtyRecords.length} unsynced records. Flushing...`);

      for (const record of dirtyRecords) {
        try {
          if (record.is_deleted) {
            console.info(`[sync] Processing tombstone deletion for anilist_id=${record.anilist_id}...`);
            
            // Delete from Supabase
            const { error: remoteError } = await supabase
              .from('user_tracking')
              .delete()
              .eq('user_id', user.id)
              .eq('anilist_id', record.anilist_id);

            if (remoteError) throw remoteError;

            // Delete physically from Dexie
            await userDb.user_tracking.delete(record.anilist_id);
            console.info(`[sync] Successfully deleted anilist_id=${record.anilist_id} from Supabase and local DB.`);
          } else {
            console.info(`[sync] Processing upsert for anilist_id=${record.anilist_id}...`);

            // Upsert to Supabase
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

            // Mark as clean
            await userDb.user_tracking.update(record.anilist_id, { is_synced: 1 });
            console.info(`[sync] Successfully synced anilist_id=${record.anilist_id} to Supabase.`);
          }
        } catch (recordError) {
          console.error(`[sync] Failed to flush record for anilist_id=${record.anilist_id}:`, recordError);
        }
      }
    } catch (err) {
      console.error('[sync] Error in flushDirtyQueue:', err);
    }
  }, [user]);

  // Delta Sync Pull from Supabase
  const sync = useCallback(async () => {
    if (!user) return;

    setSyncStatus('syncing');
    console.info(`[sync] Background delta sync starting for user: ${user.id}`);

    try {
      const syncTimeKey = getSyncTimeKey(user.id);
      const lastSyncTime = localStorage.getItem(syncTimeKey) || '1970-01-01T00:00:00Z';
      const syncStartTime = new Date().toISOString();

      let page = 0;
      let hasMore = true;
      const limit = 1000;
      const fetchedItems: any[] = [];

      while (hasMore) {
        const start = page * limit;
        const end = start + limit - 1;

        console.info(`[sync] Fetching page ${page} from Supabase (since ${lastSyncTime})...`);
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

      console.info(`[sync] Retrieved ${fetchedItems.length} delta updates from Supabase.`);

      if (fetchedItems.length > 0) {
        await userDb.transaction('rw', userDb.user_tracking, async () => {
          for (const item of fetchedItems) {
            const local = await userDb.user_tracking.get(item.anilist_id);
            
            if (item.is_deleted) {
              console.info(`[sync] Remote tombstone found for anilist_id=${item.anilist_id}. Physically deleting locally.`);
              await userDb.user_tracking.delete(item.anilist_id);
            } else {
              const remoteMilli = new Date(item.last_modified).getTime();
              const localMilli = local ? new Date(local.updated_at).getTime() : 0;

              // Only overwrite if remote is strictly newer, or doesn't exist locally
              if (!local || remoteMilli > localMilli) {
                console.info(`[sync] Upserting remote record locally: anilist_id=${item.anilist_id}`);
                await userDb.user_tracking.put({
                  anilist_id: item.anilist_id,
                  status: item.watch_status,
                  updated_at: item.last_modified,
                  is_synced: 1, // Clean
                  episode_progress: item.episode_progress || 0,
                  score: item.score,
                  notes: item.notes,
                  is_deleted: false,
                });
              } else {
                console.info(`[sync] Local record is newer/equal for anilist_id=${item.anilist_id}. Keeping local.`);
              }
            }
          }
        });
      }

      // Update sync metadata
      localStorage.setItem(syncTimeKey, syncStartTime);
      setLastSyncedAt(syncStartTime);
      setSyncStatus('idle');
      console.info('[sync] Delta sync completed successfully.');
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

      // Attempt immediate push deletion
      try {
        console.info(`[sync] Immediate push deletion for anilist_id=${anilistId}...`);
        const { error: remoteError } = await supabase
          .from('user_tracking')
          .delete()
          .eq('user_id', user.id)
          .eq('anilist_id', anilistId);

        if (remoteError) throw remoteError;

        // Success: physically remove from Dexie
        await userDb.user_tracking.delete(anilistId);
        console.info(`[sync] Immediate push deletion successful. Evicted anilist_id=${anilistId} locally.`);
      } catch (err) {
        console.warn(`[sync] Immediate deletion push failed (saved locally as tombstone) for anilist_id=${anilistId}:`, err);
      }
    },
    [user]
  );

  // Monitor auth state to trigger initial sync or clear IndexedDB
  useEffect(() => {
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
        console.info('[userDb] User signed out. Clearing user_tracking store...');
        await userDb.user_tracking.clear();
        setLastSyncedAt(null);
      }
    }

    handleAuthChange();

    return () => {
      active = false;
    };
  }, [user, sync, flushDirtyQueue, getSyncTimeKey]);

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
