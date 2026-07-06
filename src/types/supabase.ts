// Supabase user data types

export interface UserTracking {
  anilist_id: number;
  watch_status: string;
  score: number | null;
  episode_progress: number | null;
  notes: string | null;
  last_modified: string;
}

export interface UserCollection {
  collection_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
}

export interface UserCollectionAnime {
  collection_id: string;
  anime_id: number;
  order_index: number;
}

export interface UserProfile {
  id: string;
  username: string;
}
