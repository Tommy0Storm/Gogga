'use client'

/**
 * GOGGA - Upgrade Client Component
 * 
 * Interactive tier selection with PayFast integration.
 * Monochrome design with grey gradients per Global.instructions.md.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CREDIT_PACKS, type Tier } from '@/lib/subscription-types'

interface UpgradeClientProps {
  userEmail: string
  currentTier: Tier
}

const TIERS: Array<{
  tier: Tier
  name: string
  price: number
  description: string
  features: string[]
}> = [
  {
    tier: 'FREE',
    name: 'Free',
    price: 0,
    description: 'Basic access with community models',
    features: [
      'Llama 3.3 70B text model',
      'LongCat Flash images',
      'Basic chat history',
      'No document uploads',
    ],
  },
  {
    tier: 'JIVE',
    name: 'Jive',
    price: 99,
    description: 'Enhanced AI with CePO reasoning',
    features: [
      'Llama 3.1 8B + CePO reasoning',
      'FLUX 1.1 Pro (200 images/mo)',
      '500K credits/month',
      '5 document uploads for RAG',
      'Priority support',
    ],
  },
  {
    tier: 'JIGGA',
    name: 'Jigga',
    price: 299,
    description: 'Premium AI with deep thinking',
    features: [
      'Qwen 3 32B with <think> mode',
      'FLUX 1.1 Pro (1000 images/mo)',
      '2M credits/month',
      '10 docs + semantic search',
      'Priority support',
      'Extended context window',
    ],
  },
]

export default function UpgradeClient({ userEmail, currentTier }: UpgradeClientProps) {
  const router = useRouter()
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [pendingTier, setPendingTier] = useState<Tier | null>(null)

  const handleUpgradeClick = (tier: Tier) => {
    if (tier === 'FREE' || tier === currentTier) return
    setPendingTier(tier)
    setShowPaymentModal(true)
  }

  const handleSubscribe = async (tier: Tier, paymentType: 'once_off' | 'tokenization' = 'tokenization') => {
    setIsLoading(true)
    setError(null)
    setSelectedTier(tier)
    setShowPaymentModal(false)

    try {
      const response = await fetch('/api/payments/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier,
          email: userEmail,
          payment_type: paymentType,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create subscription')
      }

      const data = await response.json()
      
      // Create and submit PayFast form
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = data.action_url
      
      Object.entries(data.form_data).forEach(([key, value]) => {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = key
        input.value = String(value)
        form.appendChild(input)
      })
      
      document.body.appendChild(form)
      form.submit()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed')
      setIsLoading(false)
      setSelectedTier(null)
    }
  }

  const handleBuyCredits = async (packSize: 200 | 500 | 1000) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/payments/credit-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pack_size: packSize,
          email: userEmail,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create credit pack order')
      }

      const data = await response.json()
      
      // Create and submit PayFast form
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = data.action_url
      
      Object.entries(data.form_data).forEach(([key, value]) => {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = key
        input.value = String(value)
        form.appendChild(input)
      })
      
      document.body.appendChild(form)
      form.submit()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200">
      {/* Payment Type Modal */}
      {showPaymentModal && pendingTier && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md mx-4 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Choose Payment Type
            </h3>
            <p className="text-gray-600 mb-6">
              How would you like to pay for {TIERS.find(t => t.tier === pendingTier)?.name}?
            </p>
            
            <div className="space-y-4">
              {/* Once-off Option */}
              <button
                onClick={() => handleSubscribe(pendingTier, 'once_off')}
                disabled={isLoading}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-all text-left group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Once-off Payment</div>
                    <div className="text-sm text-gray-500">
                      Pay R{TIERS.find(t => t.tier === pendingTier)?.price} once for 1 month access
                    </div>
                  </div>
                </div>
              </button>

              {/* Recurring/Tokenization Option */}
              <button
                onClick={() => handleSubscribe(pendingTier, 'tokenization')}
                disabled={isLoading}
                className="w-full p-4 border-2 border-gray-900 rounded-lg hover:bg-gray-900 hover:text-white transition-all text-left group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center group-hover:bg-white transition-colors">
                    <svg className="w-5 h-5 text-white group-hover:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-semibold">Monthly Recurring</div>
                    <div className="text-sm opacity-70">
                      R{TIERS.find(t => t.tier === pendingTier)?.price}/month • Auto-renews
                    </div>
                    <div className="text-xs mt-1 text-green-600 group-hover:text-green-300">
                      ✓ Best value • Cancel anytime
                    </div>
                  </div>
                </div>
              </button>
            </div>

            <button
              onClick={() => {
                setShowPaymentModal(false)
                setPendingTier(null)
              }}
              className="w-full mt-6 py-2 text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-300 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button 
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">Back</span>
          </button>
          <h1 className="text-xl font-bold text-gray-900">Upgrade Your Plan</h1>
          <div className="w-20" /> {/* Spacer for centering */}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
            {error}
          </div>
        )}

        {/* Current Tier Banner */}
        <div className="mb-12 text-center">
          <p className="text-gray-600">
            You're currently on the{' '}
            <span className="font-bold text-gray-900">{currentTier}</span> plan
          </p>
        </div>

        {/* Tier Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {TIERS.map((tierInfo) => {
            const isCurrent = tierInfo.tier === currentTier
            const isDowngrade = TIERS.findIndex(t => t.tier === currentTier) > TIERS.findIndex(t => t.tier === tierInfo.tier)
            
            return (
              <div
                key={tierInfo.tier}
                className={`
                  relative bg-white rounded-xl border-2 p-6 transition-all
                  ${isCurrent 
                    ? 'border-gray-900 shadow-lg' 
                    : 'border-gray-200 hover:border-gray-400 hover:shadow-md'
                  }
                  ${tierInfo.tier === 'JIGGA' ? 'md:scale-105' : ''}
                `}
              >
                {tierInfo.tier === 'JIGGA' && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gray-900 text-white text-xs font-bold rounded-full">
                    BEST VALUE
                  </div>
                )}
                
                {isCurrent && (
                  <div className="absolute -top-3 right-4 px-3 py-1 bg-gray-600 text-white text-xs font-bold rounded-full">
                    CURRENT
                  </div>
                )}

                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{tierInfo.name}</h2>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-gray-900">R{tierInfo.price}</span>
                    {tierInfo.price > 0 && <span className="text-gray-500">/month</span>}
                  </div>
                  <p className="mt-2 text-sm text-gray-600">{tierInfo.description}</p>
                </div>

                <ul className="space-y-3 mb-6">
                  {tierInfo.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-gray-700 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleUpgradeClick(tierInfo.tier)}
                  disabled={isCurrent || isDowngrade || isLoading || tierInfo.tier === 'FREE'}
                  className={`
                    w-full py-3 px-4 rounded-lg font-medium transition-all
                    ${isCurrent
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : isDowngrade
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : tierInfo.tier === 'FREE'
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-900 text-white hover:bg-gray-800 active:scale-98'
                    }
                    ${isLoading && selectedTier === tierInfo.tier ? 'opacity-50' : ''}
                  `}
                >
                  {isLoading && selectedTier === tierInfo.tier ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Processing...
                    </span>
                  ) : isCurrent ? (
                    'Current Plan'
                  ) : isDowngrade ? (
                    'Downgrade N/A'
                  ) : tierInfo.tier === 'FREE' ? (
                    'Free Tier'
                  ) : (
                    `Upgrade to ${tierInfo.name}`
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {/* Credit Packs Section */}
        <div className="border-t border-gray-300 pt-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Need More Credits?</h2>
            <p className="text-gray-600">
              Buy credit packs for once-off use. Perfect for heavy usage periods.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {Object.entries(CREDIT_PACKS).map(([key, pack]) => (
              <div
                key={key}
                className="bg-white rounded-xl border border-gray-200 p-6 hover:border-gray-400 hover:shadow-md transition-all"
              >
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900 mb-1">R{pack.price}</div>
                  <div className="text-lg text-gray-600 mb-4">
                    {(pack.credits / 1000).toFixed(0)}K Credits
                  </div>
                  <button
                    onClick={() => handleBuyCredits(pack.price as 200 | 500 | 1000)}
                    disabled={isLoading}
                    className="w-full py-2 px-4 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Processing...' : 'Buy Now'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">
            Credit packs are once-off purchases. Credits don't expire but are used before monthly credits.
          </p>
        </div>

        {/* Payment Info */}
        <div className="mt-12 text-center">
          <div className="flex items-center justify-center gap-4 text-gray-500 text-sm">
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Secure payment via PayFast
            </div>
            <span>•</span>
            <span>Cancel anytime</span>
            <span>•</span>
            <span>ZAR pricing</span>
          </div>
        </div>
      </main>
    </div>
  )
}
