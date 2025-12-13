'use client'

/**
 * React 19 Suspense boundary components for ChatClient
 * Provides loading states and error boundaries for async data
 */

import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'

/**
 * Loading skeleton for chat interface
 */
export function ChatSkeleton() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Loading Gogga Chat...
        </p>
      </div>
    </div>
  )
}

/**
 * Chat messages loading placeholder
 */
export function ChatMessagesLoading() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex gap-3 animate-pulse"
        >
          <div className="h-8 w-8 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-20 w-full rounded-lg bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Session data loading placeholder
 */
export function SessionDataLoading() {
  return (
    <div className="flex items-center gap-2 p-2">
      <div className="h-6 w-32 animate-pulse rounded bg-muted" />
    </div>
  )
}

/**
 * Error boundary for chat
 */
export function ChatError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="text-destructive">
          <svg
            className="h-16 w-16"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">
          {error.message || 'Failed to load chat. Please try again.'}
        </p>
        <button
          onClick={reset}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}

/**
 * Suspense wrapper for chat page with proper boundaries
 */
export function ChatPageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      {children}
    </Suspense>
  )
}

/**
 * Suspense wrapper for chat messages
 */
export function ChatMessagesWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ChatMessagesLoading />}>
      {children}
    </Suspense>
  )
}

/**
 * Suspense wrapper for session data
 */
export function SessionDataWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<SessionDataLoading />}>
      {children}
    </Suspense>
  )
}
