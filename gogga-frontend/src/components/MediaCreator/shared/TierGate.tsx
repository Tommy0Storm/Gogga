/**
 * TierGate Component
 * 
 * Restricts access to features based on subscription tier.
 * Shows upgrade prompt for locked features.
 */

'use client';

import { type ReactNode } from 'react';
import { Lock, Sparkles, ArrowRight } from 'lucide-react';
import type { UserTier } from './types';

interface TierGateProps {
  /** Current user tier */
  tier: UserTier;
  /** Minimum tier required for this feature */
  requiredTier: UserTier;
  /** Feature name for upgrade prompt */
  featureName: string;
  /** Children to render if access granted */
  children: ReactNode;
  /** Custom message for locked state */
  lockedMessage?: string;
  /** Callback when upgrade button clicked */
  onUpgrade?: () => void;
}

const TIER_ORDER: UserTier[] = ['free', 'jive', 'jigga'];

const TIER_LABELS: Record<UserTier, string> = {
  free: 'FREE',
  jive: 'JIVE (R49/mo)',
  jigga: 'JIGGA (R149/mo)',
};

const TIER_FEATURES: Record<UserTier, string[]> = {
  free: ['1 preview image/day', '3-sec video sample'],
  jive: ['50 images/mo', '5 min video/mo', 'Image editing', 'V3 upscaling'],
  jigga: ['200 images/mo', '20 min video/mo', 'V4 Ultra upscaling', 'Priority generation'],
};

export function TierGate({
  tier,
  requiredTier,
  featureName,
  children,
  lockedMessage,
  onUpgrade,
}: TierGateProps) {
  const currentIndex = TIER_ORDER.indexOf(tier);
  const requiredIndex = TIER_ORDER.indexOf(requiredTier);
  
  // Access granted
  if (currentIndex >= requiredIndex) {
    return <>{children}</>;
  }
  
  // Access denied - show upgrade prompt
  return (
    <div className="relative">
      {/* Blurred preview */}
      <div className="blur-sm opacity-50 pointer-events-none select-none">
        {children}
      </div>
      
      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/60 backdrop-blur-sm rounded-lg">
        <div className="text-center p-6 max-w-sm">
          <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-neutral-400" />
          </div>
          
          <h3 className="text-lg font-bold text-white mb-2">
            {featureName} Requires {TIER_LABELS[requiredTier]}
          </h3>
          
          <p className="text-sm text-neutral-400 mb-4">
            {lockedMessage || `Upgrade to ${TIER_LABELS[requiredTier]} to unlock ${featureName.toLowerCase()}.`}
          </p>
          
          {/* Feature highlights */}
          <ul className="text-left text-sm mb-4 space-y-1">
            {TIER_FEATURES[requiredTier].map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-neutral-300">
                <Sparkles className="w-3 h-3 text-yellow-400" />
                {feature}
              </li>
            ))}
          </ul>
          
          <button
            onClick={onUpgrade}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-neutral-900 
                     font-medium rounded-lg hover:bg-neutral-100 transition-colors"
          >
            Upgrade Now
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default TierGate;
