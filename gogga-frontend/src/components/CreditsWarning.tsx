'use client'

/**
 * GOGGA - Credits Warning Banner
 * 
 * Shows warning when user is running low on credits or has run out.
 * Prompts to buy credit packs or upgrade tier.
 */

import { useRouter } from 'next/navigation'
import { AlertTriangle, Zap, TrendingUp, X } from 'lucide-react'
import { useState } from 'react'

interface CreditsWarningProps {
  creditsRemaining: number
  creditsTotal: number
  tier: 'FREE' | 'JIVE' | 'JIGGA'
  onDismiss?: () => void
}

export function CreditsWarning({
  creditsRemaining,
  creditsTotal,
  tier,
  onDismiss,
}: CreditsWarningProps) {
  const router = useRouter()
  const [isDismissed, setIsDismissed] = useState(false)

  // Don't show for FREE tier
  if (tier === 'FREE') return null
  
  // Don't show if dismissed
  if (isDismissed) return null

  const isOutOfCredits = creditsRemaining <= 0
  const isLowCredits = !isOutOfCredits && creditsRemaining < (creditsTotal * 0.1)

  // Don't show if credits are fine
  if (!isOutOfCredits && !isLowCredits) return null

  const handleDismiss = () => {
    setIsDismissed(true)
    onDismiss?.()
  }

  if (isOutOfCredits) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full mx-4 animate-fadeIn">
        <div className="bg-red-50 border border-red-200 rounded-lg shadow-lg p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-100 rounded-full">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-red-800">Out of Credits</h4>
              <p className="text-sm text-red-700 mt-1">
                You've used all your credits. You're now on FREE tier mode with limited features.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => router.push('/upgrade#credits')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Zap size={14} />
                  Buy Credits
                </button>
                <button
                  onClick={() => router.push('/upgrade')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white text-red-700 text-sm font-medium rounded-lg border border-red-300 hover:bg-red-50 transition-colors"
                >
                  <TrendingUp size={14} />
                  Upgrade
                </button>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-red-100 rounded transition-colors text-red-400 hover:text-red-600"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Low credits warning
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full mx-4 animate-fadeIn">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-yellow-100 rounded-full">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-yellow-800">Low Credits</h4>
            <p className="text-sm text-yellow-700 mt-1">
              You have {formatCredits(creditsRemaining)} credits remaining. Consider topping up to avoid interruptions.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => router.push('/upgrade#credits')}
                className="flex items-center gap-1 px-3 py-1.5 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-colors"
              >
                <Zap size={14} />
                Buy Credits
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-yellow-100 rounded transition-colors text-yellow-400 hover:text-yellow-600"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

function formatCredits(credits: number): string {
  if (credits >= 1000000) return `${(credits / 1000000).toFixed(1)}M`
  if (credits >= 1000) return `${Math.round(credits / 1000)}K`
  return credits.toString()
}

export default CreditsWarning
