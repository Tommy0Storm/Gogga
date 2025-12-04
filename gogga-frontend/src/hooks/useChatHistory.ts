/**
 * useChatHistory Hook
 * Persists chat history to Dexie for JIVE and JIGGA tiers
 * FREE tier does not save chat history
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  db,
  type ChatSession,
  type ChatMessage,
  createChatSession,
  getChatSessions,
  getSessionMessages,
  saveMessage,
  deleteSession,
  updateSessionTitle,
  generateSessionId,
} from '@/lib/db';

export type Tier = 'free' | 'jive' | 'jigga';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  imageId?: number;
  thinking?: string; // JIGGA thinking block (collapsible in UI)
  meta?: {
    cost_zar?: number;
    model?: string;
    layer?: string;
    latency_seconds?: number;
    tier?: string;
    provider?: string;
    rag_context?: boolean;
    has_thinking?: boolean;
  };
}

interface ChatHistoryState {
  sessionId: string | null;
  sessions: ChatSession[];
  messages: Message[];
  isLoading: boolean;
}

interface UseChatHistoryReturn extends ChatHistoryState {
  addMessage: (message: Message) => Promise<void>;
  newSession: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  deleteCurrentSession: () => Promise<void>;
  clearMessages: () => void;
  setSessionTitle: (title: string) => Promise<void>;
  isPersistenceEnabled: boolean;
}

export function useChatHistory(tier: Tier): UseChatHistoryReturn {
  const [state, setState] = useState<ChatHistoryState>({
    sessionId: null,
    sessions: [],
    messages: [],
    isLoading: false,
  });

  // Persistence only for JIVE and JIGGA
  const isPersistenceEnabled = tier === 'jive' || tier === 'jigga';
  const initialized = useRef(false);

  // Initialize session on mount for JIVE/JIGGA
  useEffect(() => {
    if (isPersistenceEnabled && !initialized.current) {
      initialized.current = true;
      initializeSession();
    } else if (!isPersistenceEnabled) {
      // Clear session for FREE tier
      setState(prev => ({
        ...prev,
        sessionId: null,
        sessions: [],
        messages: [],
      }));
    }
  }, [isPersistenceEnabled, tier]);

  const initializeSession = async () => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Load existing sessions
      const sessions = await getChatSessions(tier as 'jive' | 'jigga');
      
      if (sessions.length > 0) {
        // Load most recent session
        const latestSession = sessions[0];
        const messages = await getSessionMessages(latestSession.id!);
        
        setState({
          sessionId: latestSession.id!,
          sessions,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
            imageId: m.imageId,
            thinking: m.thinking,
            meta: m.meta as Message['meta'],
          })),
          isLoading: false,
        });
      } else {
        // Create new session
        const session = await createChatSession(tier as 'jive' | 'jigga');
        setState({
          sessionId: session.id!,
          sessions: [session],
          messages: [],
          isLoading: false,
        });
      }
    } catch (err) {
      console.error('Failed to initialize chat session:', err);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const addMessage = useCallback(async (message: Message) => {
    // Add to state immediately
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, message],
    }));

    // Persist to Dexie for JIVE/JIGGA
    if (isPersistenceEnabled && state.sessionId) {
      try {
        await saveMessage(state.sessionId, {
          role: message.role,
          content: message.content,
          tier,
          timestamp: new Date(),
          imageId: message.imageId,
          thinking: message.thinking,
          meta: message.meta,
        });
      } catch (err) {
        console.error('Failed to save message:', err);
      }
    }
  }, [isPersistenceEnabled, state.sessionId, tier]);

  const newSession = useCallback(async () => {
    if (!isPersistenceEnabled) {
      setState(prev => ({ ...prev, messages: [] }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const session = await createChatSession(tier as 'jive' | 'jigga');
      const sessions = await getChatSessions(tier as 'jive' | 'jigga');
      
      setState({
        sessionId: session.id!,
        sessions,
        messages: [],
        isLoading: false,
      });
    } catch (err) {
      console.error('Failed to create new session:', err);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [isPersistenceEnabled, tier]);

  const loadSession = useCallback(async (sessionId: string) => {
    if (!isPersistenceEnabled) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const messages = await getSessionMessages(sessionId);
      
      setState(prev => ({
        ...prev,
        sessionId,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
          imageId: m.imageId,
          thinking: m.thinking,
          meta: m.meta as Message['meta'],
        })),
        isLoading: false,
      }));
    } catch (err) {
      console.error('Failed to load session:', err);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [isPersistenceEnabled]);

  const deleteCurrentSession = useCallback(async () => {
    if (!isPersistenceEnabled || !state.sessionId) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      await deleteSession(state.sessionId);
      
      // Get remaining sessions
      const sessions = await getChatSessions(tier as 'jive' | 'jigga');
      
      if (sessions.length > 0) {
        // Load another session
        const messages = await getSessionMessages(sessions[0].id!);
        setState({
          sessionId: sessions[0].id!,
          sessions,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
            imageId: m.imageId,
            thinking: m.thinking,
            meta: m.meta as Message['meta'],
          })),
          isLoading: false,
        });
      } else {
        // Create new session
        const session = await createChatSession(tier as 'jive' | 'jigga');
        setState({
          sessionId: session.id!,
          sessions: [session],
          messages: [],
          isLoading: false,
        });
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [isPersistenceEnabled, state.sessionId, tier]);

  const clearMessages = useCallback(() => {
    setState(prev => ({ ...prev, messages: [] }));
  }, []);

  const setSessionTitle = useCallback(async (title: string) => {
    if (!isPersistenceEnabled || !state.sessionId) return;

    try {
      await updateSessionTitle(state.sessionId, title);
      
      // Refresh sessions
      const sessions = await getChatSessions(tier as 'jive' | 'jigga');
      setState(prev => ({ ...prev, sessions }));
    } catch (err) {
      console.error('Failed to update session title:', err);
    }
  }, [isPersistenceEnabled, state.sessionId, tier]);

  return {
    ...state,
    addMessage,
    newSession,
    loadSession,
    deleteCurrentSession,
    clearMessages,
    setSessionTitle,
    isPersistenceEnabled,
  };
}

export default useChatHistory;
