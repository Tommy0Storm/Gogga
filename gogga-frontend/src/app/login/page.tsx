/**
 * GOGGA - Login Page (Server Component)
 * 
 * Next.js 16 optimized with connection() API and ModernLoginForm:
 * - If already logged in → redirect to /
 * - If not logged in → show React 19 login form
 * 
 * Uses Next.js 16 Partial Prerendering with connection() API
 */
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { ModernLoginForm } from '@/components/ModernLoginForm'

export default async function LoginPage() {
  // Wait for actual request (PPR dynamic boundary)
  await connection()
  
  // Server-side session check
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

  // Not logged in - render modern login form with React 19 patterns
  return <ModernLoginForm />;
}
