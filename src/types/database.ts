// Database lifecycle state types

export interface VersionInfo {
  version: number;
  generatedAt: string;
  mode: string;
  recordCount: number;
  dbSizeBytes: number;
  compressedSizeBytes: number;
  compression: string;
}

export type DatabaseStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'checking'
  | 'downloading'
  | 'processing'
  | 'error';

export interface DatabaseState {
  status: DatabaseStatus;
  version: number | null;
  recordCount: number | null;
  progress: number;
  error: string | null;
}

export const INITIAL_DB_STATE: DatabaseState = {
  status: 'idle',
  version: null,
  recordCount: null,
  progress: 0,
  error: null,
};

// Cache API and localStorage constants
export const CACHE_NAME = 'aniforge-catalog';
export const CACHE_KEY_PREFIX = 'catalog_v';
export const LS_KEY_VERSION = 'active_db_version';
export const LS_KEY_GENERATED_AT = 'db_generated_at';

export const API_BASE = 'https://aniforge-api.getthenya.workers.dev';
