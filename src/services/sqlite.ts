/**
 * SQLite WASM Engine Service
 * 
 * Direct port of Android's CatalogDatabaseProvider + DatabaseManager pattern.
 * Handles: version checking, streaming gzip download, DecompressionStream,
 * Cache API binary storage, validation, and atomic A/B slot swap.
 */

// sql.js browser bundle exports via CJS module.exports, not ESM default.
// Use namespace import to handle the interop correctly.
import initSqlJsModule from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import {
  API_BASE,
  CACHE_NAME,
  CACHE_KEY_PREFIX,
  LS_KEY_VERSION,
  LS_KEY_GENERATED_AT,
  type VersionInfo,
} from '../types/database';

// Re-export the Database type for consumers
export type Database = SqlJsDatabase;

// Handle CJS/ESM interop: the module may be the function directly, or wrapped in { default }
const initSqlJs = (typeof initSqlJsModule === 'function'
  ? initSqlJsModule
  : (initSqlJsModule as unknown as { default: typeof initSqlJsModule }).default
) as typeof initSqlJsModule;

// ─── Module state ───────────────────────────────────────────────────────────────

let sqlPromise: Promise<SqlJsStatic> | null = null;
let activeDb: SqlJsDatabase | null = null;

// SqlJsStatic type — what initSqlJs resolves to
interface SqlJsStatic {
  Database: new (data?: ArrayLike<number> | null) => SqlJsDatabase;
}

// ─── sql.js WASM initializer (singleton) ────────────────────────────────────────

function getSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      // Load WASM binary from CDN — avoids bundling the 1.5MB file
      locateFile: (file: string) =>
        `https://sql.js.org/dist/${file}`,
    }) as Promise<SqlJsStatic>;
  }
  return sqlPromise;
}

// ─── Cache API helpers ──────────────────────────────────────────────────────────

async function getCacheKey(version: number): Promise<string> {
  return `${CACHE_KEY_PREFIX}${version}.db`;
}

async function loadFromCache(version: number): Promise<ArrayBuffer | null> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const key = await getCacheKey(version);
    const response = await cache.match(key);
    if (!response) return null;
    return response.arrayBuffer();
  } catch (e) {
    console.error('[sqlite] Failed to load from Cache API:', e);
    return null;
  }
}

async function writeToCache(version: number, buffer: ArrayBuffer): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  const key = await getCacheKey(version);
  const response = new Response(buffer, {
    headers: { 'Content-Type': 'application/octet-stream' },
  });
  await cache.put(key, response);
}

async function deleteFromCache(version: number): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const key = await getCacheKey(version);
    await cache.delete(key);
  } catch (e) {
    console.warn('[sqlite] Failed to delete cache entry:', e);
  }
}

// ─── localStorage metadata ─────────────────────────────────────────────────────

export function getActiveVersion(): number | null {
  const v = localStorage.getItem(LS_KEY_VERSION);
  return v ? parseInt(v, 10) : null;
}

function setActiveVersion(version: number, generatedAt?: string): void {
  localStorage.setItem(LS_KEY_VERSION, String(version));
  if (generatedAt) {
    localStorage.setItem(LS_KEY_GENERATED_AT, generatedAt);
  }
}

// ─── Phase A: Instant boot from cache ───────────────────────────────────────────

export async function initDatabase(): Promise<Database | null> {
  const version = getActiveVersion();
  if (version === null) {
    console.info('[sqlite] No cached version found. Fresh install.');
    return null;
  }

  console.info(`[sqlite] Booting from cached version: v${version}`);
  const buffer = await loadFromCache(version);
  if (!buffer) {
    console.warn('[sqlite] Cache miss for version', version);
    localStorage.removeItem(LS_KEY_VERSION);
    return null;
  }

  const SQL = await getSql();
  activeDb = new SQL.Database(new Uint8Array(buffer));
  console.info(`[sqlite] Database v${version} loaded (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB)`);
  return activeDb;
}

// ─── Phase B: Background version check + streaming download ─────────────────────

export async function fetchVersionInfo(): Promise<VersionInfo | null> {
  try {
    const res = await fetch(`${API_BASE}/version.json?t=${Date.now()}`);
    if (!res.ok) return null;
    return (await res.json()) as VersionInfo;
  } catch (e) {
    console.error('[sqlite] Failed to fetch version.json:', e);
    return null;
  }
}

export async function downloadAndDecompress(
  version: number,
  onProgress?: (progress: number) => void,
): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(`${API_BASE}/catalog.db.gz?v=${version}`);
    if (!res.ok || !res.body) {
      console.error('[sqlite] Download failed:', res.status);
      return null;
    }

    // Use DecompressionStream for native browser gzip decompression
    const decompressedStream = res.body.pipeThrough(
      new DecompressionStream('gzip'),
    );

    // Read the entire decompressed stream into an ArrayBuffer
    // We can't easily track decompressed progress, so we track chunks read
    const reader = decompressedStream.getReader();
    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalSize += value.byteLength;
      // Report approximate progress based on expected uncompressed size
      onProgress?.(Math.min(totalSize / (67 * 1024 * 1024), 0.99));
    }

    // Merge all chunks into a single ArrayBuffer
    const result = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }

    onProgress?.(1);
    console.info(`[sqlite] Downloaded and decompressed: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);
    return result.buffer;
  } catch (e) {
    console.error('[sqlite] Download/decompress error:', e);
    return null;
  }
}

// ─── Phase C: Validation in isolated WASM slot ──────────────────────────────────

export async function validateDatabase(buffer: ArrayBuffer): Promise<boolean> {
  try {
    const SQL = await getSql();
    const tempDb = new SQL.Database(new Uint8Array(buffer));
    try {
      const result = tempDb.exec('SELECT count(*) FROM anime');
      if (result.length > 0 && result[0].values.length > 0) {
        const count = result[0].values[0][0] as number;
        console.info(`[sqlite] Validation passed: ${count} anime records`);
        return count > 0;
      }
      return false;
    } finally {
      tempDb.close();
    }
  } catch (e) {
    console.error('[sqlite] Validation failed:', e);
    return false;
  }
}

// ─── Atomic swap: commit new DB to cache + swap active instance ─────────────────

export async function commitSwap(
  buffer: ArrayBuffer,
  versionInfo: VersionInfo,
): Promise<Database> {
  const oldVersion = getActiveVersion();

  // 1. Write new buffer to Cache API
  await writeToCache(versionInfo.version, buffer);

  // 2. Instantiate new sql.js database
  const SQL = await getSql();
  const newDb = new SQL.Database(new Uint8Array(buffer));

  // 3. Close old instance
  if (activeDb) {
    try {
      activeDb.close();
    } catch {
      // Ignore close errors
    }
  }

  // 4. Atomically swap the reference
  activeDb = newDb;

  // 5. Update localStorage metadata
  setActiveVersion(versionInfo.version, versionInfo.generatedAt);

  // 6. Garbage collect old cache entry
  if (oldVersion !== null && oldVersion !== versionInfo.version) {
    await deleteFromCache(oldVersion);
    console.info(`[sqlite] Garbage collected cache for v${oldVersion}`);
  }

  console.info(`[sqlite] Swapped to v${versionInfo.version}`);
  return newDb;
}

// ─── Query execution wrapper ────────────────────────────────────────────────────

export interface QueryResult {
  columns: string[];
  values: unknown[][];
}

export function executeQuery(sql: string, params?: unknown[]): QueryResult[] {
  if (!activeDb) {
    throw new Error('Database not initialized');
  }
  try {
    return activeDb.exec(sql, params as (string | number | Uint8Array | null)[] | undefined);
  } catch (e) {
    console.error('[sqlite] Query error:', sql, e);
    throw e;
  }
}

/**
 * Convenience: execute a query and return results as an array of plain objects.
 */
export function queryAsObjects<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): T[] {
  const results = executeQuery(sql, params);
  if (results.length === 0) return [];
  const { columns, values } = results[0];
  return values.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj as T;
  });
}

/**
 * Returns the active database instance (for direct access if needed).
 */
export function getActiveDatabase(): Database | null {
  return activeDb;
}

/**
 * Force-set the active database (used by DatabaseContext during init).
 */
export function setActiveDatabase(db: Database): void {
  activeDb = db;
}
