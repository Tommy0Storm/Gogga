/**
 * UpgradePrompt Component
 * 
 * Contextual upgrade prompts for different scenarios.
 */

'use client';

import { Sparkles, Image, Video, Zap, Crown, ArrowRight } from 'lucide-react';
import type { UserTier } from './types';

type PromptType = 
  | 'quota_exhausted'
  | 'feature_locked'
  | 'quality_comparison'
  | 'general';

interface UpgradePromptProps {
  /** Type of prompt to show */
  type: PromptType;
  /** Current tier */
  currentTier: UserTier;
  /** Target tier for upgrade */
  targetTier?: UserTier;
  /** Feature name (for feature_locked type) */
  featureName?: string;
  /** Callback when upgrade clicked */
  onUpgrade?: () => void;
  /** Callback to dismiss */
  onDismiss?: () => void;
  /** Compact inline variant */
  inline?: boolean;
}

const TIER_PRICING: Record<UserTier, string> = {
  free: 'R0',
  jive: 'R99/mo',
  jigga: 'R299/mo',
};

const UPGRADE_BENEFITS: Record<UserTier, { icon: typeof Sparkles; benefits: string[] }> = {
  free: {
    icon: Sparkles,
    benefits: [],
  },
  jive: {
    icon: Zap,
    benefits: [
      '50 HD images/month (no watermark)',
      '5 minutes of video/month',
      'Image editing & V3 upscaling',
      'Priority support',
    ],
  },
  jigga: {
    icon: Crown,
    benefits: [
      '200 HD images/month',
      '20 minutes of video/month',
      'V4 Ultra upscaling (4K)',
      'Audio in videos',
      'Fastest generation',
    ],
  },
};

export function UpgradePrompt({
  type,
  currentTier,
  targetTier = currentTier === 'free' ? 'jive' : 'jigga',
  featureName,
  onUpgrade,
  onDismiss,
  inline = false,
}: UpgradePromptProps) {
  const target = UPGRADE_BENEFITS[targetTier];
  const TargetIcon = target.icon;
  
  // Inline variant
  if (inline) {
    return (
      <div className="flex items-center gap-2 p-2 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
        <Sparkles className="w-4 h-4 text-yellow-500 flex-shrink-0" />
        <span className="text-sm text-yellow-800 dark:text-yellow-200 flex-1">
          {type === 'quota_exhausted' && 'Quota exhausted. '}
          {type === 'feature_locked' && `${featureName} requires ${targetTier.toUpperCase()}. `}
          <button
            onClick={onUpgrade}
            className="font-medium underline hover:no-underline"
          >
            Upgrade to {targetTier.toUpperCase()} ({TIER_PRICING[targetTier]})
          </button>
        </span>
      </div>
    );
  }
  
  // Full card variant
  return (
    <div className="bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-xl p-6 text-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-400/20 to-transparent rounded-full blur-2xl" />
      
      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
              <TargetIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">
                {type === 'quota_exhausted' ? "You've run out!" : `Unlock ${targetTier.toUpperCase()}`}
              </h3>
              <p className="text-sm text-neutral-400">
                {TIER_PRICING[targetTier]}
              </p>
            </div>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-neutral-500 hover:text-white transition-colors"
            >
              ✕
            </button>
          )}
        </div>
        
        {/* Message */}
        <p className="text-neutral-300 mb-4">
          {type === 'quota_exhausted' && 
            "Your monthly quota is exhausted. Upgrade to continue creating amazing content."}
          {type === 'feature_locked' && 
            `${featureName} is available on ${targetTier.toUpperCase()} and above.`}
          {type === 'quality_comparison' && 
            "See the difference? Upgrade for full resolution, no watermarks, and more features."}
          {type === 'general' && 
            "Take your creations to the next level with more images, videos, and premium features."}
        </p>
        
        {/* Benefits */}
        <ul className="space-y-2 mb-6">
          {target.benefits.map((benefit, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
              {benefit}
            </li>
          ))}
        </ul>
        
        {/* CTA */}
        <button
          onClick={onUpgrade}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 
                   text-neutral-900 font-bold rounded-lg hover:from-yellow-300 hover:to-orange-400 transition-all"
        >
          Upgrade to {targetTier.toUpperCase()}
          <ArrowRight className="w-4 h-4" />
        </button>
        
        {currentTier === 'free' && targetTier === 'jive' && (
          <p className="text-center text-xs text-neutral-500 mt-3">
            Or go big with <button onClick={onUpgrade} className="underline">JIGGA (R299/mo)</button>
          </p>
        )}
      </div>
    </div>
  );
}

export default UpgradePrompt;
