/**
 * GOGGA RxDB React Hooks
 * 
 * Custom React hooks for integrating RxDB functionality with React components.
 * Uses RxJS observables with React's useState/useEffect for reactive updates.
 * 
 * USE RXDB FAST MEMORY FOR ANY FAST DB ACTIONS IN THE CHAT APP LIKE SESSION CONNECTIONS
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Subscription } from 'rxjs';
import type { RxDocument } from 'rxdb';

import {
  getDatabase,
  getMemoryDatabase,
  updateActiveSession,
  getActiveSession,
  subscribeToActiveSession,
  setTypingIndicator,
  getCachedEmbedding,
  cacheEmbedding,
  addPendingOperation,
  updatePendingOperation,
  getPendingOperations,
  cleanupPendingOperations,
  getAppSettings,
  updateAppSettings,
  subscribeToAppSettings,
  generateSessionId,
  type ActiveSessionDoc,
  type PendingOperationDoc,
} from './database';

import type {
  ChatSessionDoc,
  ChatMessageDoc,
  GoggaRxDatabase,
} from './schemas';

// ============================================================================
// Session Hook - Fast memory storage for current session state
// ============================================================================

export interface UseSessionState {
  sessionId: string | null;
  isTyping: boolean;
  currentModel: string | null;
  pendingMessages: number;
  lastActivity: number | null;
}

export interface UseSessionReturn {
  state: UseSessionState;
  isLoading: boolean;
  error: Error | null;
  // Actions
  startSession: (model?: string) => Promise<string>;
  setTyping: (isTyping: boolean) => Promise<void>;
  setModel: (model: string) => Promise<void>;
  addPendingMessage: () => Promise<void>;
  removePendingMessage: () => Promise<void>;
}

/**
 * Hook for managing current chat session state using fast memory storage
 * 
 * Uses Memory RxStorage for instant reads/writes without IndexedDB latency.
 * Cross-tab sync is disabled (multiInstance: false) since each tab has its own session state.
 */
export function useSession(): UseSessionReturn {
  const [state, setState] = useState<UseSessionState>({
    sessionId: null,
    isTyping: false,
    currentModel: null,
    pendingMessages: 0,
    lastActivity: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const subscriptionRef = useRef<Subscription | null>(null);

  // Load initial state and subscribe to changes
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        // Get current session from memory storage
        const session = await getActiveSession();
        if (mounted && session) {
          setState({
            sessionId: session.sessionId,
            isTyping: session.isTyping,
            currentModel: session.currentModel ?? null,
            pendingMessages: session.pendingMessages,
            lastActivity: session.lastActivity,
          });
        }
        
        // Subscribe to changes (returns Observable)
        const observable = subscribeToActiveSession();
        subscriptionRef.current = observable.subscribe((doc) => {
          if (mounted && doc) {
            setState({
              sessionId: doc.sessionId,
              isTyping: doc.isTyping,
              currentModel: doc.currentModel ?? null,
              pendingMessages: doc.pendingMessages,
              lastActivity: doc.lastActivity,
            });
          }
        });
        
        if (mounted) {
          setIsLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
      subscriptionRef.current?.unsubscribe();
    };
  }, []);

  // Start a new session
  const startSession = useCallback(async (model?: string): Promise<string> => {
    const sessionId = generateSessionId();
    await updateActiveSession(sessionId, {
      currentModel: model || 'default',
      isTyping: false,
      pendingMessages: 0,
    });
    return sessionId;
  }, []);

  // Set typing indicator
  const setTyping = useCallback(async (isTyping: boolean): Promise<void> => {
    await setTypingIndicator(isTyping);
  }, []);

  // Set current model
  const setModel = useCallback(async (model: string): Promise<void> => {
    const session = await getActiveSession();
    if (session) {
      await updateActiveSession(session.sessionId, { currentModel: model });
    }
  }, []);

  // Add pending message (optimistic UI)
  const addPendingMessage = useCallback(async (): Promise<void> => {
    const session = await getActiveSession();
    if (session) {
      await updateActiveSession(session.sessionId, {
        pendingMessages: session.pendingMessages + 1,
      });
    }
  }, []);

  // Remove pending message (confirmed sent)
  const removePendingMessage = useCallback(async (): Promise<void> => {
    const session = await getActiveSession();
    if (session && session.pendingMessages > 0) {
      await updateActiveSession(session.sessionId, {
        pendingMessages: session.pendingMessages - 1,
      });
    }
  }, []);

  return {
    state,
    isLoading,
    error,
    startSession,
    setTyping,
    setModel,
    addPendingMessage,
    removePendingMessage,
  };
}

// ============================================================================
// App Settings Hook - Local Documents for persistent settings
// ============================================================================

export interface AppSettings {
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

export interface UseAppSettingsReturn {
  settings: AppSettings;
  isLoading: boolean;
  error: Error | null;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
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

/**
 * Hook for managing app settings using Local Documents
 * 
 * Uses Local Documents for schema-less storage that:
 * - Persists across sessions
 * - Doesn't need to match collection schemas
 * - Doesn't replicate
 */
export function useAppSettings(): UseAppSettingsReturn {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const subscriptionRef = useRef<Subscription | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        // Get current settings
        const current = await getAppSettings();
        if (mounted && current) {
          setSettings({ ...DEFAULT_SETTINGS, ...current });
        }
        
        // Subscribe to changes (returns Observable)
        const observable = subscribeToAppSettings();
        subscriptionRef.current = observable.subscribe((doc) => {
          if (mounted && doc) {
            setSettings({ ...DEFAULT_SETTINGS, ...doc });
          }
        });
        
        if (mounted) {
          setIsLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
      subscriptionRef.current?.unsubscribe();
    };
  }, []);

  const update = useCallback(async (updates: Partial<AppSettings>): Promise<void> => {
    await updateAppSettings(updates);
    // Optimistic update
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  return {
    settings,
    isLoading,
    error,
    updateSettings: update,
  };
}

// ============================================================================
// Pending Operations Hook - Optimistic UI queue
// ============================================================================

export interface UsePendingOperationsReturn {
  operations: PendingOperationDoc[];
  isLoading: boolean;
  add: (type: 'message' | 'document' | 'image', operation: string, payload: Record<string, unknown>) => Promise<string>;
  update: (id: string, status: 'pending' | 'in-flight' | 'completed' | 'failed') => Promise<void>;
  cleanup: () => Promise<number>;
}

/**
 * Hook for managing pending operations (optimistic UI)
 * 
 * Uses Memory RxStorage for fast queue management.
 * Operations are queued immediately and processed asynchronously.
 */
export function usePendingOperations(): UsePendingOperationsReturn {
  const [operations, setOperations] = useState<PendingOperationDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const ops = await getPendingOperations();
      if (mounted) {
        setOperations(ops);
        setIsLoading(false);
      }
    }

    load();
    // Refresh periodically
    const interval = setInterval(load, 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const add = useCallback(async (
    type: 'message' | 'document' | 'image',
    operation: string, 
    payload: Record<string, unknown>
  ): Promise<string> => {
    return addPendingOperation(type, operation as 'create' | 'update' | 'delete', payload);
  }, []);

  const update = useCallback(async (
    id: string, 
    status: 'pending' | 'in-flight' | 'completed' | 'failed'
  ): Promise<void> => {
    await updatePendingOperation(id, status);
  }, []);

  const cleanup = useCallback(async (): Promise<number> => {
    return cleanupPendingOperations();
  }, []);

  return {
    operations,
    isLoading,
    add,
    update,
    cleanup,
  };
}

// ============================================================================
// Chat Sessions Hook - Reactive queries to main database
// ============================================================================

export interface UseChatSessionsReturn {
  sessions: ChatSessionDoc[];
  isLoading: boolean;
  error: Error | null;
  createSession: (tier: 'jive' | 'jigga', title?: string) => Promise<string>;
  updateSession: (id: string, updates: Partial<ChatSessionDoc>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
}

/**
 * Hook for managing chat sessions from the main database
 * 
 * Uses RxDB observables for reactive updates across tabs.
 */
export function useChatSessions(): UseChatSessionsReturn {
  const [sessions, setSessions] = useState<ChatSessionDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const subscriptionRef = useRef<Subscription | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const db = await getDatabase();
        
        // Subscribe to all sessions, sorted by updatedAt desc
        const query = db.chatSessions.find({
          sort: [{ updatedAt: 'desc' }],
        });
        
        subscriptionRef.current = query.$.subscribe({
          next: (docs) => {
            if (mounted) {
              setSessions(docs.map(d => d.toJSON() as ChatSessionDoc));
              setIsLoading(false);
            }
          },
          error: (err) => {
            if (mounted) {
              setError(err);
              setIsLoading(false);
            }
          },
        });
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
      subscriptionRef.current?.unsubscribe();
    };
  }, []);

  const createSession = useCallback(async (
    tier: 'jive' | 'jigga',
    title?: string
  ): Promise<string> => {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const sessionId = generateSessionId();
    
    await db.chatSessions.insert({
      id: sessionId,
      tier,
      title: title ?? `New ${tier.toUpperCase()} Chat`,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    });
    
    // Also update memory storage with new active session
    await updateActiveSession(sessionId, {
      currentModel: tier === 'jigga' ? 'qwen' : 'llama',
      isTyping: false,
      pendingMessages: 0,
    });
    
    return sessionId;
  }, []);

  const updateSession = useCallback(async (
    id: string,
    updates: Partial<ChatSessionDoc>
  ): Promise<void> => {
    const db = await getDatabase();
    const doc = await db.chatSessions.findOne(id).exec();
    if (doc) {
      await doc.patch({
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    }
  }, []);

  const deleteSession = useCallback(async (id: string): Promise<void> => {
    const db = await getDatabase();
    const doc = await db.chatSessions.findOne(id).exec();
    if (doc) {
      await doc.remove();
    }
  }, []);

  return {
    sessions,
    isLoading,
    error,
    createSession,
    updateSession,
    deleteSession,
  };
}

// ============================================================================
// Chat Messages Hook - Reactive queries for session messages
// ============================================================================

export interface UseChatMessagesReturn {
  messages: ChatMessageDoc[];
  isLoading: boolean;
  error: Error | null;
  addMessage: (message: Omit<ChatMessageDoc, 'id'>) => Promise<string>;
  updateMessage: (id: string, updates: Partial<ChatMessageDoc>) => Promise<void>;
}

/**
 * Hook for managing chat messages for a specific session
 * 
 * Uses RxDB observables for reactive updates.
 * Population: messages reference sessions and images via `ref` property.
 */
export function useChatMessages(sessionId: string | null): UseChatMessagesReturn {
  const [messages, setMessages] = useState<ChatMessageDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const subscriptionRef = useRef<Subscription | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    let mounted = true;

    async function init() {
      try {
        const db = await getDatabase();
        
        // Subscribe to messages for this session, sorted by timestamp
        const query = db.chatMessages.find({
          selector: { sessionId: sessionId as string },
          sort: [{ timestamp: 'asc' }],
        });
        
        subscriptionRef.current = query.$.subscribe({
          next: (docs) => {
            if (mounted) {
              setMessages(docs.map(d => d.toJSON() as ChatMessageDoc));
              setIsLoading(false);
            }
          },
          error: (err) => {
            if (mounted) {
              setError(err);
              setIsLoading(false);
            }
          },
        });
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
      subscriptionRef.current?.unsubscribe();
    };
  }, [sessionId]);

  const addMessage = useCallback(async (
    message: Omit<ChatMessageDoc, 'id'>
  ): Promise<string> => {
    try {
      const db = await getDatabase();
      const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await db.chatMessages.insert({
        id,
        ...message,
      });
      
      // Update session message count (non-critical, don't let it fail the message add)
      try {
        const session = await db.chatSessions.findOne(message.sessionId).exec();
        if (session) {
          await session.patch({
            messageCount: (session.messageCount || 0) + 1,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (sessionError) {
        console.warn('[RxDB] Failed to update session count:', sessionError);
      }
      
      return id;
    } catch (error) {
      console.error('[RxDB] Failed to add message:', error);
      // Re-throw with context for the caller to handle gracefully
      throw new Error(`Failed to save message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  const updateMessage = useCallback(async (
    id: string,
    updates: Partial<ChatMessageDoc>
  ): Promise<void> => {
    try {
      const db = await getDatabase();
      const doc = await db.chatMessages.findOne(id).exec();
      if (doc) {
        await doc.patch(updates);
      }
    } catch (error) {
      console.error('[RxDB] Failed to update message:', error);
      // Don't re-throw for updates - they're often non-critical
    }
  }, []);

  return {
    messages,
    isLoading,
    error,
    addMessage,
    updateMessage,
  };
}

// ============================================================================
// Embedding Cache Hook - Fast memory cache for embeddings
// ============================================================================

export interface UseEmbeddingCacheReturn {
  get: (text: string) => Promise<number[] | null>;
  set: (text: string, embedding: number[]) => Promise<void>;
  stats: () => Promise<{ count: number; maxSize: number }>;
}

/**
 * Hook for accessing the embedding cache in memory storage
 * 
 * Uses SHA-256 hashing for cache keys.
 * LRU eviction at 500 max entries.
 */
export function useEmbeddingCache(): UseEmbeddingCacheReturn {
  const get = useCallback(async (text: string): Promise<number[] | null> => {
    return getCachedEmbedding(text);
  }, []);

  const set = useCallback(async (text: string, embedding: number[]): Promise<void> => {
    await cacheEmbedding(text, embedding);
  }, []);

  const stats = useCallback(async () => {
    // Memory storage uses JavaScript Map, not RxDB collection
    const { getEmbeddingCacheStats } = await import('./memoryStorage');
    const statsData = await getEmbeddingCacheStats();
    return { count: statsData.size, maxSize: 500 };
  }, []);

  return { get, set, stats };
}
