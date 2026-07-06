/**
 * DatabaseContext — Global React Context for the active sql.js WASM instance.
 * 
 * Lifecycle mirrors Android's CatalogDatabaseProvider:
 * 1. On mount: attempt instant boot from Cache API (Phase A)
 * 2. In background: check for updates, download, validate, swap (Phases B+C)
 * 3. On swap: all consumers automatically get the new database reference
 */

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useCallback,
  type ReactNode,
} from 'react';
import {
  initDatabase,
  fetchVersionInfo,
  downloadAndDecompress,
  validateDatabase,
  commitSwap,
  getActiveVersion,
  queryAsObjects,
  executeQuery,
  type QueryResult,
  type Database,
} from '../services/sqlite';
import type { DatabaseStatus } from '../types/database';

// ─── State ──────────────────────────────────────────────────────────────────────

interface DbContextState {
  db: Database | null;
  status: DatabaseStatus;
  version: number | null;
  recordCount: number | null;
  progress: number;
  error: string | null;
}

type DbAction =
  | { type: 'LOADING' }
  | { type: 'READY'; db: Database; version: number; recordCount: number }
  | { type: 'CHECKING' }
  | { type: 'DOWNLOADING'; progress: number }
  | { type: 'PROCESSING' }
  | { type: 'SWAPPED'; db: Database; version: number; recordCount: number }
  | { type: 'ERROR'; error: string }
  | { type: 'PROGRESS'; progress: number };

function reducer(state: DbContextState, action: DbAction): DbContextState {
  switch (action.type) {
    case 'LOADING':
      return { ...state, status: 'loading', error: null };
    case 'READY':
      return {
        ...state,
        status: 'ready',
        db: action.db,
        version: action.version,
        recordCount: action.recordCount,
        error: null,
      };
    case 'CHECKING':
      return { ...state, status: 'checking' };
    case 'DOWNLOADING':
      return { ...state, status: 'downloading', progress: action.progress };
    case 'PROCESSING':
      return { ...state, status: 'processing' };
    case 'SWAPPED':
      return {
        ...state,
        status: 'ready',
        db: action.db,
        version: action.version,
        recordCount: action.recordCount,
        progress: 1,
        error: null,
      };
    case 'ERROR':
      return { ...state, status: 'error', error: action.error };
    case 'PROGRESS':
      return { ...state, progress: action.progress };
    default:
      return state;
  }
}

const initialState: DbContextState = {
  db: null,
  status: 'idle',
  version: null,
  recordCount: null,
  progress: 0,
  error: null,
};

// ─── Context ────────────────────────────────────────────────────────────────────

interface DbContextValue extends DbContextState {
  /** Execute SQL and get raw result sets */
  execQuery: (sql: string, params?: unknown[]) => QueryResult[];
  /** Execute SQL and get results as typed objects */
  queryObjects: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => T[];
}

const DatabaseContext = createContext<DbContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────────────────────────

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      dispatch({ type: 'LOADING' });

      // Phase A: Try instant boot from cache
      try {
        const cachedDb = await initDatabase();
        if (cachedDb && !cancelled) {
          const count = getRecordCount(cachedDb);
          dispatch({
            type: 'READY',
            db: cachedDb,
            version: getActiveVersion() ?? 0,
            recordCount: count,
          });
        }
      } catch (e) {
        console.error('[DatabaseContext] Cache boot failed:', e);
      }

      // Phase B: Background update check
      if (cancelled) return;
      dispatch({ type: 'CHECKING' });

      const versionInfo = await fetchVersionInfo();
      if (!versionInfo || cancelled) {
        if (!state.db && !cancelled) {
          dispatch({ type: 'ERROR', error: 'Failed to fetch catalog version info' });
        }
        return;
      }

      const localVersion = getActiveVersion();
      if (localVersion !== null && versionInfo.version <= localVersion) {
        console.info('[DatabaseContext] Catalog is up to date');
        return;
      }

      // Need to download
      dispatch({ type: 'DOWNLOADING', progress: 0 });
      const buffer = await downloadAndDecompress(versionInfo.version, (p) => {
        if (!cancelled) dispatch({ type: 'PROGRESS', progress: p });
      });

      if (!buffer || cancelled) {
        if (!cancelled) dispatch({ type: 'ERROR', error: 'Download failed' });
        return;
      }

      // Phase C: Validate
      dispatch({ type: 'PROCESSING' });
      const isValid = await validateDatabase(buffer);
      if (!isValid || cancelled) {
        if (!cancelled) dispatch({ type: 'ERROR', error: 'Database validation failed' });
        return;
      }

      // Atomic swap
      const newDb = await commitSwap(buffer, versionInfo);
      if (!cancelled) {
        const count = getRecordCount(newDb);
        dispatch({
          type: 'SWAPPED',
          db: newDb,
          version: versionInfo.version,
          recordCount: count,
        });
      }
    }

    boot();
    return () => { cancelled = true; };
  }, []); // Run once on mount

  const execQuery = useCallback(
    (sql: string, params?: unknown[]): QueryResult[] => {
      return executeQuery(sql, params);
    },
    // We intentionally don't add state.db to deps — executeQuery uses the module-level activeDb
    [],
  );

  const queryObjects = useCallback(
    <T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] => {
      return queryAsObjects<T>(sql, params);
    },
    [],
  );

  const value: DbContextValue = {
    ...state,
    execQuery,
    queryObjects,
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

export function useDatabase(): DbContextValue {
  const ctx = useContext(DatabaseContext);
  if (!ctx) {
    throw new Error('useDatabase must be used within <DatabaseProvider>');
  }
  return ctx;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function getRecordCount(db: Database): number {
  try {
    const result = db.exec('SELECT count(*) FROM anime');
    if (result.length > 0 && result[0].values.length > 0) {
      return result[0].values[0][0] as number;
    }
  } catch {
    // Ignore
  }
  return 0;
}
