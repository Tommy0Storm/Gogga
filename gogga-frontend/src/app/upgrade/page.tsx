/**
 * GOGGA - Upgrade Page
 * 
 * Server component for subscription upgrades with Next.js 16 PPR.
 * Shows tier comparison and PayFast payment options.
 */
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { PageErrorBoundary } from '@/components/ErrorBoundary'
import UpgradeClient from './UpgradeClient'

export default async function UpgradePage() {
  // Wait for actual request (PPR dynamic boundary)
  await connection()
  
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
