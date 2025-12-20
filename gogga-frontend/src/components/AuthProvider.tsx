/**
 * GOGGA - Auth Session Provider (Client Component)
 * 
 * Wraps the app with NextAuth SessionProvider for client-side session access.
 * Must be a client component to use 'use client' directive.
 * 
 * Always wraps with SessionProvider to ensure useSession() works everywhere.
 * Disabled refetch to prevent CLIENT_FETCH_ERROR on initial load.
 */
'use client'

import { SessionProvider } from 'next-auth/react'
import { ReactNode } from 'react';

export function AuthProvider({ children }: { children: ReactNode }) {
  // Always wrap with SessionProvider so useSession() works everywhere
  // This prevents "[next-auth]: useSession must be wrapped in a <SessionProvider />"
  return (
    <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
      {children}
    </SessionProvider>
  );
}
