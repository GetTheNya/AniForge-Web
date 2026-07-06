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

export interface CollectionRecord {
  id: string; // Primary Key (UUID)
  title: string;
  description: string;
  createdAt: number; // integer timestamp (epoch millis)
  is_synced: number; // 1 = clean/synced, 0 = dirty/local modification
  is_deleted: number; // 1 = soft deleted, 0 = active
  last_modified: number; // integer timestamp (epoch millis)
}

export interface CollectionAnimeCrossRefRecord {
  collectionId: string;
  animeId: number;
  orderIndex: number;
  is_synced: number; // 1 = clean/synced, 0 = dirty/local modification
  is_deleted: number; // 1 = soft deleted, 0 = active
  last_modified: number; // integer timestamp (epoch millis)
}

export class UserDatabase extends Dexie {
  user_tracking!: Table<UserTrackingRecord, number>;
  collections!: Table<CollectionRecord, string>;
  collection_anime_cross_ref!: Table<CollectionAnimeCrossRefRecord, [string, number]>;

  constructor() {
    super('UserDatabase');
    
    // Register store and indexes
    this.version(1).stores({
      user_tracking: 'anilist_id, status, updated_at, is_synced',
    });

    this.version(2).stores({
      user_tracking: 'anilist_id, status, updated_at, is_synced',
      collections: 'id, is_synced, is_deleted, last_modified',
      collection_anime_cross_ref: '[collectionId+animeId], collectionId, animeId, is_synced',
    });

    console.info('[userDb] UserDatabase initialized with IndexedDB storage.');
  }
}

export const userDb = new UserDatabase();
export default userDb;

