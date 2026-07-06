import Dexie, { type Table } from 'dexie';

export interface UserTrackingRecord {
  anilist_id: number; // Primary Key
  status: string; // watch_status (CURRENT, COMPLETED, PLANNING, DROPPED, PAUSED, REWATCHING)
  updated_at: string; // last_modified timestamp as ISO string
  is_synced: number; // 1 = clean/synced, 0 = dirty/local modification
  episode_progress: number;
  score: number | null;
  notes: string | null;
  is_deleted?: boolean; // soft delete tombstone flag
}

export class UserDatabase extends Dexie {
  user_tracking!: Table<UserTrackingRecord, number>;

  constructor() {
    super('UserDatabase');
    
    // Register store and indexes
    this.version(1).stores({
      user_tracking: 'anilist_id, status, updated_at, is_synced',
    });

    console.info('[userDb] UserDatabase initialized with IndexedDB storage.');
  }
}

export const userDb = new UserDatabase();
export default userDb;
