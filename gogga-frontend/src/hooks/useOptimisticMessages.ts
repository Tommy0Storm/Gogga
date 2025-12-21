'use client'

/**
 * Optimistic Chat Messages Hook
 * 
 * SIMPLIFIED: The React 19 useOptimistic hook doesn't work well with async RxDB updates
 * because it's designed for Server Actions with automatic reconciliation.
 * 
 * This version simply passes through the base messages and provides a loading state
 * that can be shown while waiting for responses.
 */

import type { Message } from '@/hooks/useChatHistory'

export interface OptimisticMessage extends Message {
  id?: string
  isPending?: boolean
  isError?: boolean
  errorMessage?: string
  imageId?: number
  thinking?: string
  detectedLanguage?: string
  languageConfidence?: number
  timestamp?: string
}

/**
 * Hook for managing chat messages with loading states
 * 
 * Instead of adding optimistic messages that cause duplicates,
 * we just track loading state separately and show it in the UI.
 */
export function useOptimisticMessages(messages: OptimisticMessage[]) {
  // Simply return the base messages - no optimistic additions
  // The loading state is handled by isLoading in ChatClient
  
  // Placeholder functions for API compatibility
  const addOptimisticMessage = (_message: OptimisticMessage): string => {
    // No-op - we don't add optimistic messages anymore
    // Loading state is shown via isLoading state in ChatClient
    return Date.now().toString()
  }

  const markAsError = (_id: string, _errorMessage: string) => {
    // No-op - errors are persisted to message history instead
  }

  const clearOptimistic = () => {
    // No-op
  }

  return { 
    messages, // Just pass through the base messages
    addOptimisticMessage,
    markAsError,
    clearOptimistic
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
  addOptimistic({ ...message, isPending: true })

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
      isPending: false,
      isError: true,
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
    isPending: true,
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
    isPending: true,
    timestamp: new Date().toISOString(),
  }
}
