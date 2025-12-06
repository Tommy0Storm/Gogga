/**
 * GOGGA - Upgrade Page
 * 
 * Server component for subscription upgrades.
 * Shows tier comparison and PayFast payment options.
 */
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import UpgradeClient from './UpgradeClient'

export default async function UpgradePage() {
  const session = await auth()
  
  if (!session?.user?.email) {
    redirect('/login')
  }

  return (
    <UpgradeClient 
      userEmail={session.user.email}
      currentTier={(session.user as any).tier || 'FREE'}
    />
  )
}
