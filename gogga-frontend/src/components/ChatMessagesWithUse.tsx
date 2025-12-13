'use client'

/**
 * React 19 use() Hook Example for Chat Session Data
 * Demonstrates modern async data fetching with use() and Suspense
 */

import { use, Suspense } from 'react'
import { useChatHistory } from '@/hooks/useChatHistory'
import { SessionDataWrapper } from '@/app/ChatSuspense'

/**
 * Fetch session data (returns a Promise)
 */
async function getSessionData(sessionId: string) {
  // Simulate async data fetching
  // In production, this would fetch from your backend/database
  await new Promise(resolve => setTimeout(resolve, 100))
  
  return {
    id: sessionId,
    createdAt: new Date().toISOString(),
    messageCount: 0,
    lastActive: new Date().toISOString()
  }
}

/**
 * Component that uses React 19 use() hook
 * This unwraps the Promise and suspends until it resolves
 */
function ChatSessionInfo({ sessionPromise }: { sessionPromise: Promise<any> }) {
  // React 19: use() hook unwraps Promises and suspends
  const sessionData = use(sessionPromise)
  
  return (
    <div className="text-xs text-muted-foreground">
      Session: {sessionData.id}
    </div>
  )
}

/**
 * Chat messages component using modern patterns
 */
export function ChatMessages({ sessionId, tier }: { sessionId: string; tier: string }) {
  const { messages } = useChatHistory(tier as any)
  
  // Create session promise (this can be passed down)
  const sessionPromise = getSessionData(sessionId)
  
  return (
    <div className="messages-container flex flex-col gap-4">
      {/* Session info with React 19 use() hook */}
      <SessionDataWrapper>
        <ChatSessionInfo sessionPromise={sessionPromise} />
      </SessionDataWrapper>
      
      {/* Message list */}
      <div className="space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={msg.id || idx}
            className={`flex gap-3 ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`rounded-lg px-4 py-2 max-w-[80%] ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Example: Chat page component with Suspense boundaries
 */
export function ChatPageWithSuspense({ sessionId, tier }: { sessionId: string; tier: string }) {
  return (
    <Suspense fallback={<div>Loading chat...</div>}>
      <ChatMessages sessionId={sessionId} tier={tier} />
    </Suspense>
  )
}
