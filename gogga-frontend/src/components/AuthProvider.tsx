/**
 * GOGGA - Auth Session Provider (Client Component)
 * 
 * Wraps the app with NextAuth SessionProvider for client-side session access.
 * Must be a client component to use 'use client' directive.
 */
'use client'

import { SessionProvider } from 'next-auth/react'
import { ReactNode } from 'react'

export function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
