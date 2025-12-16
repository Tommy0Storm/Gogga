/**
 * GOGGA - Login Page (Server Component)
 * 
 * Next.js 16 optimized with Suspense boundary for PPR:
 * - If token in URL → redirect to verification API
 * - If already logged in → redirect to /
 * - If not logged in → show React 19 login form
 * 
 * Uses Next.js 16 Partial Prerendering with Suspense boundary
 */
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { ModernLoginForm } from '@/components/ModernLoginForm'

// Loading skeleton for login form
function LoginSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4">
      <div className="w-full max-w-md space-y-8 animate-pulse">
        <div className="text-center">
          <div className="h-10 bg-gray-200 rounded w-32 mx-auto mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-48 mx-auto"></div>
        </div>
        <div className="space-y-6">
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  )
}

// Dynamic login content that checks auth and handles token
async function LoginContent({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>
}) {
  // Await searchParams inside Suspense boundary
  const params = await searchParams
  const { token, error } = params

  // If token provided, redirect to the verification API route
  if (token) {
    redirect(`/api/auth/verify-token?token=${token}`)
  }

  // Server-side session check
  let session = null;
  try {
    session = await auth();
  } catch (err) {
    // Log but don't crash - treat as not logged in
    console.error('[LoginPage] Auth error (treating as no session):', err);
  }

  if (session?.user) {
    // Already logged in - redirect to main app
    redirect('/');
  }

  // Not logged in - render modern login form with React 19 patterns
  return (
    <>
      {error && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50">
          {error === 'invalid' && 'Invalid or expired magic link. Please request a new one.'}
          {error === 'expired' && 'Magic link has expired. Please request a new one.'}
          {error === 'verification_failed' && 'Verification failed. Please try again.'}
        </div>
      )}
      <ModernLoginForm />
    </>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>
}) {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}
