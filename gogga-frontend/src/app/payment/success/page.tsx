/**
 * GOGGA - Payment Success Page (Client Component)
 * 
 * Shown after successful PayFast payment.
 * Fetches fresh subscription data to show updated tier.
 */
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Crown, Zap, Sparkles, Loader2, Check, Gift, ArrowRight } from 'lucide-react'
import { PageErrorBoundary } from '@/components/ErrorBoundary'

interface SubscriptionData {
  email: string
  tier: string
  status: string
  credits: {
    total: number
    used: number
    available: number
    purchased: number
    monthly: number
  }
  images: {
    used: number
    limit: number
  }
}

const TIER_INFO = {
  FREE: { 
    icon: Zap, 
    color: 'text-gray-500',
    bg: 'bg-gray-100',
    name: 'FREE'
  },
  JIVE: { 
    icon: Crown, 
    color: 'text-gray-700',
    bg: 'bg-gray-200',
    name: 'JIVE'
  },
  JIGGA: { 
    icon: Sparkles, 
    color: 'text-gray-900',
    bg: 'bg-gray-300',
    name: 'JIGGA'
  }
}

function formatCredits(credits: number): string {
  if (credits >= 1000000) return `${(credits / 1000000).toFixed(1)}M`
  if (credits >= 1000) return `${Math.round(credits / 1000)}K`
  return credits.toString()
}

export default function PaymentSuccessPage() {
  const router = useRouter()
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch updated subscription data
  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        // Small delay to allow ITN webhook to process
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        const res = await fetch('/api/subscription', { cache: 'no-store' })
        const data = await res.json()
        
        if (data.error) {
          setError('Unable to load subscription. Please refresh the page.')
        } else {
          setSubscription(data)
        }
      } catch (err) {
        console.error('Failed to fetch subscription:', err)
        setError('Unable to load subscription. Please refresh the page.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchSubscription()
  }, [])

  const tierKey = (subscription?.tier?.toUpperCase() || 'FREE') as keyof typeof TIER_INFO
  const tierInfo = TIER_INFO[tierKey] || TIER_INFO.FREE
  const TierIcon = tierInfo.icon

  return (
    <PageErrorBoundary pageName="Payment Success">
      <div className="min-h-screen bg-linear-to-b from-gray-100 to-gray-200 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        {/* Success Icon */}
        <div className="w-16 h-16 mx-auto mb-6 bg-green-500 rounded-full flex items-center justify-center">
          <Check className="w-8 h-8 text-white" strokeWidth={3} />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
        <p className="text-gray-600 mb-6">
          Your payment has been processed successfully.
        </p>

        {/* Subscription Status Card */}
        <div className={`${tierInfo.bg} rounded-lg p-4 mb-6`}>
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
              <span className="ml-2 text-gray-600">Loading subscription...</span>
            </div>
          ) : error ? (
            <p className="text-red-600 text-sm">{error}</p>
          ) : subscription ? (
            <div>
              {/* Tier Badge */}
              <div className="flex items-center justify-center gap-2 mb-3">
                <TierIcon className={`w-6 h-6 ${tierInfo.color}`} />
                <span className={`text-xl font-bold ${tierInfo.color}`}>
                  {tierInfo.name} Tier
                </span>
              </div>

              {/* Credits Display */}
              {subscription.credits.available > 0 && (
                <div className="flex items-center justify-center gap-2 text-gray-700">
                  <Gift className="w-4 h-4" />
                  <span className="text-sm">
                    <strong>{formatCredits(subscription.credits.available)}</strong> credits available
                  </span>
                </div>
              )}

              {/* Images Display */}
              {subscription.images.limit > 0 && (
                <div className="flex items-center justify-center gap-2 text-gray-600 mt-1">
                  <span className="text-sm">
                    {subscription.images.limit - subscription.images.used} / {subscription.images.limit} images remaining
                  </span>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <button
            onClick={() => router.push('/')}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Start Chatting
            <ArrowRight className="w-4 h-4" />
          </button>
          <Link
            href="/dashboard"
            className="block w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            View Dashboard
          </Link>
        </div>

        <p className="mt-6 text-sm text-gray-500">
          It may take a few minutes for all features to activate. If you experience any issues, please refresh the page.
        </p>
      </div>
      </div>
    </PageErrorBoundary>
  )
}
