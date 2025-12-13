'use client'

/**
 * Optimistic Chat Messages with React 19 useOptimistic Hook
 * Provides instant UI feedback for message sending
 */

import { useOptimistic } from 'react'
import type { Message } from '@/hooks/useChatHistory'

export interface OptimisticMessage extends Message {
  isPending?: boolean
  isError?: boolean
  errorMessage?: string
  imageId?: number
  thinking?: string
  detectedLanguage?: string
  languageConfidence?: number
}

/**
 * Hook for managing optimistic chat messages
 * Messages appear instantly in UI, then update when server confirms
 */
export function useOptimisticMessages(messages: OptimisticMessage[]) {
  const [optimisticMessages, setOptimisticState] = useOptimistic<
    OptimisticMessage[],
    { type: 'add' | 'error'; id?: string; message?: OptimisticMessage; errorMessage?: string }
  >(
    messages,
    (state, action) => {
      if (action.type === 'add' && action.message) {
        // Add new optimistic message with generated ID
        return [...state, { ...action.message, id: action.id || Date.now().toString() }]
      }
      
      if (action.type === 'error' && action.id) {
        // Mark message as error
        return state.map(msg => 
          msg.id === action.id 
            ? { ...msg, isPending: false, isError: true, errorMessage: action.errorMessage }
            : msg
        )
      }
      
      return state
    }
  )

  const addOptimisticMessage = (message: OptimisticMessage): string => {
    const id = Date.now().toString() + Math.random()
    setOptimisticState({ type: 'add', message: { ...message, isPending: true }, id })
    return id
  }

  const markAsError = (id: string, errorMessage: string) => {
    setOptimisticState({ type: 'error', id, errorMessage })
  }

  return { 
    messages: optimisticMessages, 
    addOptimisticMessage,
    markAsError
  }
}

/**
 * Action to send a message with optimistic update
 */
export async function sendMessageWithOptimistic(
  message: OptimisticMessage,
  addOptimistic: (msg: OptimisticMessage) => void,
  sendFn: (msg: OptimisticMessage) => Promise<void>
) {
  // Add message optimistically with pending state
  addOptimistic({ ...message, pending: true })

  try {
    // Send to server
    await sendFn(message)
    
    // Server will update via addMessage, which triggers re-render
    // The optimistic update is replaced by the real data
  } catch (error) {
    console.error('[OptimisticMessages] Send failed:', error)
    
    // Mark message as error
    addOptimistic({
      ...message,
      pending: false,
      error: true,
    })
  }
}

/**
 * Helper to create optimistic user message
 */
export function createOptimisticUserMessage(
  content: string,
  additionalProps?: Partial<OptimisticMessage>
): OptimisticMessage {
  return {
    role: 'user',
    content,
    pending: true,
    timestamp: new Date().toISOString(),
    ...additionalProps,
  }
}

/**
 * Helper to create optimistic assistant message placeholder
 */
export function createOptimisticAssistantPlaceholder(): OptimisticMessage {
  return {
    role: 'assistant',
    content: '',
    pending: true,
    timestamp: new Date().toISOString(),
  }
}
