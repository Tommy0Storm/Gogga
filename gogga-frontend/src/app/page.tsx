/**
 * GOGGA - Main App Page (Server Component)
 * 
 * Server-side protection with Next.js 16:
 * - Uses Suspense boundary for dynamic auth
 * - If not logged in → redirect to /login
 * - If logged in → render main chat UI with Suspense boundaries
 * 
 * This is the recommended approach for NextAuth v5 with dynamic rendering
 */
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { ChatClient } from './ChatClient'
import { ChatPageWrapper } from './ChatSuspense'

// Loading skeleton for chat page
function ChatSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-900">
      <div className="text-center animate-pulse">
        <div className="h-12 w-32 bg-neutral-800 rounded mx-auto mb-4"></div>
        <div className="h-4 w-48 bg-neutral-800 rounded mx-auto"></div>
      </div>
    </div>
  )
}

// Dynamic content that checks auth
async function HomeContent() {
  // Opt into dynamic rendering for Next.js 16 with cacheComponents
  await connection();
  
  // Server-side session check with robust error handling
  // Network errors during auth should redirect to login, not crash the app
  let session = null;
  try {
    session = await auth();
  } catch (error) {
    // Log the error for debugging
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[HomePage] Auth error (redirecting to login):', errorMessage);
    
    // Check for network-related errors and handle gracefully
    if (errorMessage.includes('network') || 
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('fetch failed')) {
      console.warn('[HomePage] Network error during auth - likely env misconfiguration');
      // Redirect to login instead of crashing
      redirect('/login?error=network');
    }
    
    // For other errors, also redirect to login to prevent crash loop
    redirect('/login?error=auth');
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

export default function HomePage() {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}
