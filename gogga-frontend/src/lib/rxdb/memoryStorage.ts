/**
 * GOGGA Memory Storage - Lightweight In-Memory Implementation
 * 
 * REFACTORED: Eliminated RxDB memory database to stay within 16 collection limit.
 * 
 * This module provides fast in-memory storage for ephemeral data using:
 * - JavaScript Maps for active session state and pending operations
 * - LRU cache for embedding cache
 * - localStorage for app settings
 * 
 * Benefits:
 * - Zero RxDB collections (saves 3 collections toward the 16 limit)
 * - No database initialization race conditions
 * - Faster access (no async DB operations for ephemeral data)
 * - Simpler architecture with fewer moving parts
 * 
 * Data is NOT persisted across page refreshes (except settings in localStorage).
 */

import { Observable, BehaviorSubject } from 'rxjs';

// ============================================
// Type Definitions (unchanged from RxDB version)
// ============================================

/**
 * Active session state - tracks what the user is currently doing
 */
export interface ActiveSessionDoc {
  id: string;
  sessionId: string;
  lastActivity: number;
  isTyping: boolean;
  currentModel: string;
  pendingMessages: number;
  viewportState?: {
    scrollPosition: number;
    visibleMessageCount: number;
  };
}

/**
 * Embedding cache entry
 */
export interface EmbeddingCacheDoc {
  id: string; // hash of text
  text: string;
  embedding: number[];
  createdAt: number;
  accessCount: number;
}

/**
 * Pending operations queue - for optimistic UI updates
 */
export interface PendingOperationDoc {
  id: string;
  type: 'message' | 'document' | 'image';
  operation: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  createdAt: number;
  status: 'pending' | 'in-flight' | 'completed' | 'failed';
}

// ============================================
// In-Memory Storage State
// ============================================

/**
 * Active session storage using Map
 */
const activeSessionStore = new Map<string, ActiveSessionDoc>();
const activeSessionSubject = new BehaviorSubject<ActiveSessionDoc | null>(null);

/**
 * LRU Embedding Cache
 */
const MAX_CACHE_SIZE = 500;
const embeddingCache = new Map<string, EmbeddingCacheDoc>();
const cacheAccessOrder: string[] = []; // Track LRU order

/**
 * Pending operations storage
 */
const pendingOperationsStore = new Map<string, PendingOperationDoc>();

// ============================================
// Initialization State (for backwards compatibility)
// ============================================

let isInitialized = false;

/**
 * @deprecated No longer needed - memory storage is always available synchronously
 * Kept for backwards compatibility with existing code
 */
export async function getMemoryDatabase(): Promise<{ initialized: true }> {
  isInitialized = true;
  return { initialized: true };
}

/**
 * @deprecated No longer needed
 * Kept for backwards compatibility
 */
export async function destroyMemoryDatabase(): Promise<void> {
  // Clear all in-memory stores
  activeSessionStore.clear();
  embeddingCache.clear();
  cacheAccessOrder.length = 0;
  pendingOperationsStore.clear();
  isInitialized = false;
  console.log('[Memory Storage] All in-memory stores cleared');
}

// ============================================
// Active Session Management
// ============================================

const CURRENT_SESSION_KEY = 'current';

/**
 * Update the current active session state
 */
export async function updateActiveSession(
  sessionId: string,
  updates: Partial<Omit<ActiveSessionDoc, 'id' | 'sessionId'>>
): Promise<void> {
  const existing = activeSessionStore.get(CURRENT_SESSION_KEY);
  
  const newSession: ActiveSessionDoc = {
    id: CURRENT_SESSION_KEY,
    sessionId,
    lastActivity: Date.now(),
    isTyping: existing?.isTyping ?? false,
    currentModel: existing?.currentModel ?? 'default',
    pendingMessages: existing?.pendingMessages ?? 0,
    ...updates,
  };
  
  activeSessionStore.set(CURRENT_SESSION_KEY, newSession);
  activeSessionSubject.next(newSession);
}

/**
 * Get the current active session state
 */
export async function getActiveSession(): Promise<ActiveSessionDoc | null> {
  return activeSessionStore.get(CURRENT_SESSION_KEY) ?? null;
}

/**
 * Subscribe to active session changes
 */
export function subscribeToActiveSession(): Observable<ActiveSessionDoc | null> {
  return activeSessionSubject.asObservable();
}

/**
 * Set typing indicator
 */
export async function setTypingIndicator(isTyping: boolean): Promise<void> {
  const session = await getActiveSession();
  if (session) {
    await updateActiveSession(session.sessionId, { isTyping });
  }
}

// ============================================
// Embedding Cache with LRU Eviction
// ============================================

/**
 * Hash text for cache key using Web Crypto API
 */
async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Update LRU order - move accessed key to end (most recently used)
 */
function touchCacheKey(key: string): void {
  const index = cacheAccessOrder.indexOf(key);
  if (index !== -1) {
    cacheAccessOrder.splice(index, 1);
  }
  cacheAccessOrder.push(key);
}

/**
 * Evict oldest entries if cache is full
 */
function evictIfNeeded(): void {
  while (embeddingCache.size >= MAX_CACHE_SIZE && cacheAccessOrder.length > 0) {
    const oldestKey = cacheAccessOrder.shift();
    if (oldestKey) {
      embeddingCache.delete(oldestKey);
    }
  }
}

/**
 * Get cached embedding for text
 */
export async function getCachedEmbedding(text: string): Promise<number[] | null> {
  const id = await hashText(text);
  const cached = embeddingCache.get(id);
  
  if (cached) {
    // Update access count and LRU order
    cached.accessCount++;
    touchCacheKey(id);
    return [...cached.embedding]; // Return copy
  }
  
  return null;
}

/**
 * Cache an embedding for text
 */
export async function cacheEmbedding(text: string, embedding: number[]): Promise<void> {
  const id = await hashText(text);
  
  // Evict if needed
  evictIfNeeded();
  
  // Insert or update cache entry
  const entry: EmbeddingCacheDoc = {
    id,
    text,
    embedding: [...embedding], // Store copy
    createdAt: Date.now(),
    accessCount: 1,
  };
  
  embeddingCache.set(id, entry);
  touchCacheKey(id);
}

/**
 * Get cache statistics
 */
export async function getEmbeddingCacheStats(): Promise<{
  size: number;
  totalAccesses: number;
  oldestEntry: number | null;
}> {
  if (embeddingCache.size === 0) {
    return { size: 0, totalAccesses: 0, oldestEntry: null };
  }
  
  let totalAccesses = 0;
  let oldestEntry = Infinity;
  
  embeddingCache.forEach(entry => {
    totalAccesses += entry.accessCount;
    if (entry.createdAt < oldestEntry) {
      oldestEntry = entry.createdAt;
    }
  });
  
  return {
    size: embeddingCache.size,
    totalAccesses,
    oldestEntry: oldestEntry === Infinity ? null : oldestEntry,
  };
}

/**
 * Clear the embedding cache
 */
export async function clearEmbeddingCache(): Promise<number> {
  const count = embeddingCache.size;
  embeddingCache.clear();
  cacheAccessOrder.length = 0;
  return count;
}

// ============================================
// Pending Operations (Optimistic UI)
// ============================================

/**
 * Add a pending operation for optimistic UI
 */
export async function addPendingOperation(
  type: PendingOperationDoc['type'],
  operation: PendingOperationDoc['operation'],
  data: Record<string, unknown>
): Promise<string> {
  const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const op: PendingOperationDoc = {
    id,
    type,
    operation,
    data,
    createdAt: Date.now(),
    status: 'pending',
  };
  
  pendingOperationsStore.set(id, op);
  return id;
}

/**
 * Update pending operation status
 */
export async function updatePendingOperation(
  id: string,
  status: PendingOperationDoc['status']
): Promise<void> {
  const op = pendingOperationsStore.get(id);
  if (op) {
    op.status = status;
    pendingOperationsStore.set(id, op);
  }
}

/**
 * Get all pending operations
 */
export async function getPendingOperations(): Promise<PendingOperationDoc[]> {
  return Array.from(pendingOperationsStore.values())
    .filter(op => op.status === 'pending' || op.status === 'in-flight');
}

/**
 * Remove completed/failed operations
 */
export async function cleanupPendingOperations(): Promise<number> {
  let removed = 0;
  pendingOperationsStore.forEach((op, id) => {
    if (op.status === 'completed' || op.status === 'failed') {
      pendingOperationsStore.delete(id);
      removed++;
    }
  });
  return removed;
}

// ============================================
// App Settings (localStorage-backed)
// ============================================

interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  enableAnimations: boolean;
  enableSoundEffects: boolean;
  ragMode: 'basic' | 'semantic';
  lastTier: string;
  onboardingComplete: boolean;
  sendOnEnter: boolean;
  enableVoice: boolean;
  enableThinking: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  fontSize: 16,
  enableAnimations: true,
  enableSoundEffects: false,
  ragMode: 'basic',
  lastTier: 'free',
  onboardingComplete: false,
  sendOnEnter: true,
  enableVoice: true,
  enableThinking: true,
};

const SETTINGS_KEY = 'gogga_app_settings';
const settingsSubject = new BehaviorSubject<AppSettings>(DEFAULT_SETTINGS);

// Initialize settings from localStorage on module load
function initializeSettings(): void {
  if (typeof window === 'undefined') return;
  
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AppSettings>;
      settingsSubject.next({ ...DEFAULT_SETTINGS, ...parsed });
    }
  } catch {
    // Ignore localStorage errors
  }
}

// Auto-initialize on module load (browser only)
if (typeof window !== 'undefined') {
  initializeSettings();
}

/**
 * Get app settings
 */
export async function getAppSettings(): Promise<AppSettings> {
  return settingsSubject.getValue();
}

/**
 * Update app settings
 */
export async function updateAppSettings(
  updates: Partial<AppSettings>
): Promise<AppSettings> {
  const current = settingsSubject.getValue();
  const newSettings = { ...current, ...updates };
  
  settingsSubject.next(newSettings);
  
  // Persist to localStorage
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    } catch {
      // Ignore localStorage errors (quota exceeded, etc.)
    }
  }
  
  return newSettings;
}

/**
 * Subscribe to settings changes
 */
export function subscribeToAppSettings(): Observable<AppSettings> {
  return settingsSubject.asObservable();
}
