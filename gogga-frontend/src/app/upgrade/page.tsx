/**
 * GOGGA - Upgrade Page
 * 
 * Server component for subscription upgrades with Next.js 16.
 * Shows tier comparison and PayFast payment options.
 */
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { PageErrorBoundary } from '@/components/ErrorBoundary'
import UpgradeClient from './UpgradeClient'

// Loading skeleton for upgrade page
function UpgradeSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="animate-pulse text-center">
        <div className="h-8 w-48 bg-gray-200 rounded mx-auto mb-4"></div>
        <div className="h-4 w-64 bg-gray-200 rounded mx-auto"></div>
      </div>
    </div>
  )
}

// Dynamic content that checks auth
async function UpgradeContent() {
  const session = await auth()
  
  if (!session?.user?.email) {
    redirect('/login')
  }

  return (
    <PageErrorBoundary pageName="Upgrade">
      <UpgradeClient 
        userEmail={session.user.email}
        currentTier={(session.user as any).tier || 'FREE'}
      />
    </PageErrorBoundary>
  )
}

export default function UpgradePage() {
  return (
    <Suspense fallback={<UpgradeSkeleton />}>
      <UpgradeContent />
    </Suspense>
  )
}
