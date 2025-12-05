/**
 * GOGGA - Auth Session Provider (Client Component)
 * 
 * Wraps the app with NextAuth SessionProvider for client-side session access.
 * Must be a client component to use 'use client' directive.
 * 
 * Disabled refetch to prevent CLIENT_FETCH_ERROR on initial load.
 */
'use client'

import { SessionProvider } from 'next-auth/react'
import { ReactNode, useState, useEffect } from 'react';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Render children without SessionProvider during SSR to avoid fetch errors
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
      {children}
    </SessionProvider>
  );
}
