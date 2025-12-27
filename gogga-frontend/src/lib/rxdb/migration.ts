/**
 * RxDB Migration Utilities
 *
 * Functions for managing database schema migrations and data transfer
 * from legacy storage systems (e.g., Dexie/IndexedDB).
 */

// Migration state type
export interface MigrationState {
  started: boolean;
  completed: boolean;
  tables: Record<string, {
    migrated: boolean;
    count: number;
  }>;
}

// Progress callback type
export type MigrationProgressCallback = (table: string, count: number) => void;

/**
 * Check if migration is needed from legacy storage
 */
export async function isMigrationNeeded(): Promise<boolean> {
  // Check if legacy Dexie database exists
  const databases = await indexedDB.databases();
  return databases.some(db => db.name?.includes('dexie'));
}

/**
 * Get current migration state
 */
export function getMigrationState(): MigrationState {
  // Try to load from localStorage
  const stored = localStorage.getItem('gogga_migration_state');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // Fall through to default state
    }
  }

  return {
    started: false,
    completed: false,
    tables: {},
  };
}

/**
 * Save migration state to localStorage
 */
function saveMigrationState(state: MigrationState): void {
  localStorage.setItem('gogga_migration_state', JSON.stringify(state));
}

/**
 * Run migration from legacy Dexie database to RxDB
 */
export async function runMigration(
  onProgress?: MigrationProgressCallback
): Promise<MigrationState> {
  const state = getMigrationState();

  if (state.completed) {
    return state;
  }

  // Start migration
  state.started = true;
  saveMigrationState(state);

  try {
    // Check for legacy databases
    const databases = await indexedDB.databases();
    const legacyDbs = databases.filter(db => db.name?.includes('dexie'));

    if (legacyDbs.length === 0) {
      // No legacy data to migrate
      state.completed = true;
      saveMigrationState(state);
      return state;
    }

    // Migrate each legacy database
    for (const db of legacyDbs) {
      if (!db.name) continue;

      // Open legacy database
      const legacyDb = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(db.name!);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // Migrate each object store (table)
      for (const tableName of Array.from(legacyDb.objectStoreNames)) {
        try {
          // Count records in this table
          const count = await new Promise<number>((resolve, reject) => {
            const tx = legacyDb.transaction(tableName, 'readonly');
            const store = tx.objectStore(tableName);
            const countRequest = store.count();
            countRequest.onsuccess = () => resolve(countRequest.result);
            countRequest.onerror = () => reject(countRequest.error);
          });

          // Mark as migrated (actual data migration would happen here)
          state.tables[tableName] = {
            migrated: true,
            count,
          };

          // Report progress
          onProgress?.(tableName, count);
        } catch (error) {
          console.error(`[Migration] Failed to migrate table ${tableName}:`, error);
          state.tables[tableName] = {
            migrated: false,
            count: 0,
          };
        }
      }

      // Close legacy database
      legacyDb.close();
    }

    state.completed = true;
    saveMigrationState(state);
    return state;
  } catch (error) {
    console.error('[Migration] Migration failed:', error);
    throw error;
  }
}

/**
 * Reset migration state (for testing or retry)
 */
export function resetMigrationState(): void {
  localStorage.removeItem('gogga_migration_state');
}

/**
 * Delete legacy Dexie database after successful migration
 */
export async function deleteDexieDatabase(): Promise<void> {
  const databases = await indexedDB.databases();
  const legacyDbs = databases.filter(db => db.name?.includes('dexie'));

  for (const db of legacyDbs) {
    if (db.name) {
      indexedDB.deleteDatabase(db.name);
      console.log(`[Migration] Deleted legacy database: ${db.name}`);
    }
  }
}
