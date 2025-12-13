'use server'

/**
 * Server Actions for Chat with Next.js 16 Caching
 * Implements updateTag for immediate cache invalidation
 */

import { updateTag, cacheTag, revalidateTag } from 'next/cache'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

interface SendMessageParams {
  chatId: string
  message: string
  userId: string
  userTier: 'free' | 'jive' | 'jigga'
  ragContext?: string | null
  memoryContext?: string | null
  buddyContext?: string | null
  locationContext?: string | null
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
  meta?: Record<string, unknown>
}

/**
 * Send chat message to backend and invalidate cache
 * Uses updateTag for immediate read-your-own-writes semantics
 */
export async function sendChatMessage(params: SendMessageParams) {
  try {
    const {
      chatId,
      message,
      userId,
      userTier,
      ragContext,
      memoryContext,
      buddyContext,
      locationContext,
    } = params

    // Build full message with context
    let messageToSend = message

    if (buddyContext) {
      messageToSend = `USER CONTEXT:\n${buddyContext}\n\n---\n\n${messageToSend}`
    }

    if (memoryContext) {
      messageToSend = `${memoryContext}\n\n---\n\n${messageToSend}`
    }

    if (ragContext) {
      messageToSend = `${ragContext}\n\n---\n\nUser Question: ${messageToSend}`
    }

    if (locationContext) {
      messageToSend = `${locationContext}\n\n---\n\n${messageToSend}`
    }

    const requestPayload = {
      message: messageToSend,
      user_tier: userTier.toUpperCase(),
      stream: userTier !== 'free', // SSE for JIVE/JIGGA, standard for FREE
    }

    // Send to backend
    const response = await fetch(`${BACKEND_URL}/api/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    })

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`)
    }

    // For non-streaming responses, get the data
    let data
    if (userTier === 'free') {
      data = await response.json()
    } else {
      // For streaming, return the response to be handled by client
      // Server Actions can't return streams directly, so we'll handle this differently
      data = { streaming: true, response: null }
    }

    // Immediate cache invalidation for read-your-own-writes
    // User sees their message and response instantly
    updateTag(`chat-${chatId}`)
    updateTag(`user-messages-${userId}`)
    updateTag(`messages`)

    return {
      success: true,
      data,
    }
  } catch (error) {
    console.error('[sendChatMessage] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get cached chat messages for a session
 * Uses 'use cache' directive with cacheTag
 */
export async function getChatMessages(chatId: string, userId: string) {
  'use cache'
  cacheTag('messages', `chat-${chatId}`, `user-messages-${userId}`)

  try {
    // For now, we handle messages client-side with Dexie
    // This is a placeholder for future backend message persistence
    console.log('[getChatMessages] Cache tags applied:', {
      chatId,
      userId,
    })

    return {
      success: true,
      messages: [],
    }
  } catch (error) {
    console.error('[getChatMessages] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Invalidate chat cache when user deletes a session
 * Uses updateTag for immediate invalidation
 */
export async function deleteChatSession(chatId: string, userId: string) {
  try {
    // Delete from backend if needed
    // For now, handled client-side with Dexie

    // Immediate cache invalidation
    updateTag(`chat-${chatId}`)
    updateTag(`user-messages-${userId}`)

    return { success: true }
  } catch (error) {
    console.error('[deleteChatSession] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Background sync for analytics data
 * Uses revalidateTag for eventual consistency
 */
export async function syncChatAnalytics(userId: string) {
  try {
    // Sync analytics to backend
    // Non-critical update, use eventual consistency
    revalidateTag(`analytics-${userId}`, 'max')

    return { success: true }
  } catch (error) {
    console.error('[syncChatAnalytics] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Update user preferences with immediate cache refresh
 */
export async function updateUserPreferences(
  userId: string,
  preferences: Record<string, unknown>
) {
  try {
    // Save preferences to backend/Dexie
    console.log('[updateUserPreferences]:', { userId, preferences })

    // Immediate invalidation so user sees changes
    updateTag(`user-${userId}`)
    updateTag(`preferences-${userId}`)

    return { success: true }
  } catch (error) {
    console.error('[updateUserPreferences] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
