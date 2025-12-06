/**
 * GOGGA - Main App Page (Server Component)
 * 
 * Server-side protection:
 * - If not logged in → redirect to /login
 * - If logged in → render main chat UI
 * 
 * This is the recommended approach for NextAuth v5:
 * Use `auth()` on the server side for route protection
 */
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ChatClient } from './ChatClient'

export default async function HomePage() {
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

  // Logged in - render main chat UI with user context
  return <ChatClient userEmail={userEmail} userTier={userTier} />;
}
