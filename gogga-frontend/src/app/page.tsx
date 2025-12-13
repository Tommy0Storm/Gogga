/**
 * GOGGA - Main App Page (Server Component)
 * 
 * Server-side protection with Next.js 16 Partial Prerendering:
 * - Uses connection() API for dynamic boundaries
 * - If not logged in → redirect to /login
 * - If logged in → render main chat UI with Suspense boundaries
 * 
 * This is the recommended approach for NextAuth v5 with PPR:
 * Use `auth()` on the server side for route protection with connection()
 */
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { ChatClient } from './ChatClient'
import { ChatPageWrapper } from './ChatSuspense'

export default async function HomePage() {
  // Wait for actual request (PPR dynamic boundary)
  await connection()
  
  // Server-side session check
  let session = null;
  try {
    session = await auth();
  } catch (error) {
    // Log but don't crash - treat as not logged in
    console.error('[HomePage] Auth error (treating as no session):', error);
  }

  if (!session?.user) {
    // Not logged in - redirect to login
    redirect('/login');
  }

  // Extract user info for client component
  const userEmail = session.user.email || null;
  const userTier =
    (session.user as unknown as { tier?: string })?.tier || 'FREE';
  const isTester =
    (session.user as unknown as { isTester?: boolean })?.isTester || false;

  // Logged in - render main chat UI with user context
  return (
    <ChatPageWrapper>
      <ChatClient userEmail={userEmail} userTier={userTier} isTester={isTester} />
    </ChatPageWrapper>
  );
}
