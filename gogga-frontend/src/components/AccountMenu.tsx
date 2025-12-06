'use client'

/**
 * GOGGA - Account Menu Component
 * 
 * Displays user account info, tier status, credits, and upgrade options.
 * Dropdown menu in header showing:
 * - User email
 * - Current tier badge
 * - Credit/token balance
 * - Image usage
 * - Upgrade/purchase options
 * - Sign out
 */

import { useState, useRef, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  User, 
  Crown, 
  Zap, 
  Sparkles, 
  ChevronDown, 
  LogOut, 
  CreditCard, 
  Gift,
  TrendingUp,
  Image as ImageIcon,
  Settings,
  Loader2
} from 'lucide-react'

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
  nextBilling: string | null
  payfastToken: boolean
}

interface AccountMenuProps {
  userEmail: string
  currentTier: 'FREE' | 'JIVE' | 'JIGGA'
}

const TIER_STYLES = {
  FREE: { 
    bg: 'bg-gray-500', 
    text: 'text-gray-100',
    icon: Zap,
    name: 'FREE'
  },
  JIVE: { 
    bg: 'bg-gray-600', 
    text: 'text-gray-100',
    icon: Crown,
    name: 'JIVE'
  },
  JIGGA: { 
    bg: 'bg-gray-800', 
    text: 'text-gray-100',
    icon: Sparkles,
    name: 'JIGGA'
  }
}

function formatCredits(credits: number): string {
  if (credits >= 1000000) return `${(credits / 1000000).toFixed(1)}M`
  if (credits >= 1000) return `${Math.round(credits / 1000)}K`
  return credits.toString()
}

export function AccountMenu({ 
  userEmail,
  currentTier
}: AccountMenuProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const tier = currentTier as keyof typeof TIER_STYLES
  const tierStyle = TIER_STYLES[tier] || TIER_STYLES.FREE
  const TierIcon = tierStyle.icon
  const isPaidTier = tier !== 'FREE'

  // Fetch subscription data when menu opens
  useEffect(() => {
    if (isOpen && !subscription && !isLoading) {
      setIsLoading(true)
      fetch('/api/subscription')
        .then(res => res.json())
        .then(data => {
          if (!data.error) {
            setSubscription(data)
          }
        })
        .catch(console.error)
        .finally(() => setIsLoading(false))
    }
  }, [isOpen, subscription, isLoading])

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${tierStyle.bg} ${tierStyle.text} hover:opacity-90 transition-opacity`}
      >
        <TierIcon size={16} />
        <span className="font-bold text-sm">{tierStyle.name}</span>
        <ChevronDown 
          size={14} 
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50 animate-fadeIn">
          {/* User Info Section */}
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                <User size={20} className="text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {userEmail}
                </p>
                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${tierStyle.bg} ${tierStyle.text} mt-1`}>
                  <TierIcon size={10} />
                  {tierStyle.name} Tier
                </div>
              </div>
            </div>
          </div>

          {/* Credits & Usage Section (Paid tiers only) */}
          {isPaidTier && (
            <div className="p-4 border-b border-gray-200">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Usage This Month
              </h4>
              
              {isLoading ? (
                <div className="flex items-center justify-center py-2">
                  <Loader2 size={16} className="animate-spin text-gray-400" />
                </div>
              ) : subscription ? (
                <>
                  {/* Credits */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Zap size={14} className="text-yellow-500" />
                      <span>Credits</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">
                      {formatCredits(subscription.credits.available)}
                    </span>
                  </div>

                  {/* Images */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <ImageIcon size={14} className="text-blue-500" />
                      <span>Images</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">
                      {subscription.images.limit - subscription.images.used} / {subscription.images.limit}
                    </span>
                  </div>

                  {/* Progress bar for images */}
                  {subscription.images.limit > 0 && (
                    <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all"
                        style={{ width: `${Math.min(100, (subscription.images.used / subscription.images.limit) * 100)}%` }}
                      />
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500">Unable to load usage data</p>
              )}
            </div>
          )}

          {/* Actions Section */}
          <div className="p-2">
            {/* Upgrade (FREE tier) */}
            {tier === 'FREE' && (
              <button
                onClick={() => {
                  setIsOpen(false)
                  router.push('/upgrade')
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg hover:bg-gray-100 transition-colors group"
              >
                <TrendingUp size={18} className="text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Upgrade to JIVE</p>
                  <p className="text-xs text-gray-500">R99/month - Unlock all features</p>
                </div>
              </button>
            )}

            {/* Upgrade from JIVE to JIGGA */}
            {tier === 'JIVE' && (
              <button
                onClick={() => {
                  setIsOpen(false)
                  router.push('/upgrade')
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg hover:bg-gray-100 transition-colors"
              >
                <TrendingUp size={18} className="text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Upgrade to JIGGA</p>
                  <p className="text-xs text-gray-500">R299/month - Thinking mode + more</p>
                </div>
              </button>
            )}

            {/* Buy Credit Packs (Paid tiers) */}
            {isPaidTier && (
              <button
                onClick={() => {
                  setIsOpen(false)
                  router.push('/upgrade#credits')
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Gift size={18} className="text-orange-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Buy Credit Pack</p>
                  <p className="text-xs text-gray-500">R200 / R500 / R1000 top-ups</p>
                </div>
              </button>
            )}

            {/* Manage Subscription (Paid tiers) */}
            {isPaidTier && (
              <button
                onClick={() => {
                  setIsOpen(false)
                  router.push('/dashboard')
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg hover:bg-gray-100 transition-colors"
              >
                <CreditCard size={18} className="text-gray-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Manage Subscription</p>
                  <p className="text-xs text-gray-500">Billing, cancel, payment method</p>
                </div>
              </button>
            )}

            {/* Settings */}
            <button
              onClick={() => {
                setIsOpen(false)
                router.push('/dashboard')
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Settings size={18} className="text-gray-600" />
              <span className="text-sm font-medium text-gray-900">Settings</span>
            </button>

            {/* Divider */}
            <div className="my-2 border-t border-gray-200" />

            {/* Sign Out */}
            <button
              onClick={() => {
                setIsOpen(false)
                signOut({ callbackUrl: '/login' })
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg hover:bg-red-50 transition-colors text-red-600"
            >
              <LogOut size={18} />
              <span className="text-sm font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AccountMenu
