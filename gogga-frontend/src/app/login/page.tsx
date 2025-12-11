/**
 * GOGGA - Login Page (Server Component)
 * 
 * Server-side protection:
 * - If already logged in → redirect to /
 * - If not logged in → show login form
 * 
 * This is the recommended approach for NextAuth v5:
 * Use `auth()` on the server side, not client-side checks
 */
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { LoginClient } from './LoginClient'

export default async function LoginPage() {
  // Server-side session check
  // auth() returns null if no session, only throws on actual errors
  let session = null;
  try {
    session = await auth();
  } catch (error) {
    // Log but don't crash - treat as not logged in
    console.error('[LoginPage] Auth error (treating as no session):', error);
  }

  if (session?.user) {
    // Already logged in - redirect to main app
    redirect('/');
  }

  // Not logged in - render login form
  return <LoginClient />;
}
